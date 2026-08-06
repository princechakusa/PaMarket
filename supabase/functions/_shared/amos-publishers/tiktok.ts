import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import type { ContentPublisher, DraftForPublish, PublishResult } from './types.ts'

// Module 14 — real TikTok Content Posting API integration via
// PULL_FROM_URL (TikTok fetches the video from a URL we give it — the
// same R2 public URL pattern used for the video the admin attached to
// the draft — rather than a separate chunked-upload flow).
//
// Requires the connected TikTok account's own video domain to be
// verified in the TikTok Developer Portal (Settings > URL Properties)
// — R2's pub-*.r2.dev host specifically, since that's where AMOS's
// attached videos are served from. An unverified domain gets rejected
// with url_ownership_unverified before TikTok even starts downloading.
//
// credentials_ref points to a Vault secret formatted as
// "<openId>:<accessToken>:<refreshToken>" (set by amos-tiktok-oauth's
// callback leg). Access tokens expire in 24h; this adapter refreshes
// proactively on every publish call rather than tracking expiry times,
// since TikTok posts are infrequent enough that the extra refresh call
// is cheap and this avoids a whole separate expiry-tracking mechanism.
//
// privacy_level is SELF_ONLY (visible only to the connected account)
// deliberately — until this app has passed TikTok's own review, posts
// from an unaudited client are restricted to that visibility regardless
// (TikTok enforces this server-side), so this default doesn't lose
// anything today and stays a safe, intentional choice once audited too.
const TIKTOK_STATUS_POLL_MAX_ATTEMPTS = 10
const TIKTOK_STATUS_POLL_DELAY_MS = 3000

export class TikTokPublisher implements ContentPublisher {
  readonly platform = 'tiktok'
  private db: SupabaseClient

  constructor(db: SupabaseClient) {
    this.db = db
  }

  async publish(draft: DraftForPublish): Promise<PublishResult> {
    const { data: integration, error: intError } = await this.db
      .from('amos_integrations')
      .select('status, credentials_ref')
      .eq('provider', 'tiktok')
      .maybeSingle()

    if (intError || !integration || integration.status !== 'connected' || !integration.credentials_ref) {
      return { ok: false, status: 'failed', error: 'TikTok is not connected — connect it in AMOS System Health → API Manager (needs a TikTok login via OAuth) before scheduling TikTok posts to auto-publish.' }
    }

    if (draft.mediaType !== 'video' || !draft.imageUrl) {
      return { ok: false, status: 'failed', error: 'TikTok requires a video for every post — attach one from the Approval Queue or Content Calendar before scheduling.' }
    }

    const { data: decryptedSecret, error: secretError } = await this.db
      .rpc('amos_get_vault_secret', { secret_name: integration.credentials_ref })
    if (secretError || !decryptedSecret) {
      return { ok: false, status: 'failed', error: 'TikTok credentials_ref is set but the Vault secret could not be read — check it was stored correctly.' }
    }
    const parts = (decryptedSecret as string).split(':')
    if (parts.length !== 3) {
      return { ok: false, status: 'failed', error: 'TikTok credentials are malformed (expected "openId:accessToken:refreshToken") — reconnect in API Manager.' }
    }
    const [, , refreshToken] = parts

    const clientKey = Deno.env.get('TIKTOK_CLIENT_KEY') || ''
    const clientSecret = Deno.env.get('TIKTOK_CLIENT_SECRET') || ''
    if (!clientKey || !clientSecret) {
      return { ok: false, status: 'failed', error: 'TIKTOK_CLIENT_KEY/TIKTOK_CLIENT_SECRET not configured on this function.' }
    }

    let accessToken: string
    try {
      accessToken = await this.refreshAccessToken(clientKey, clientSecret, refreshToken, integration.credentials_ref)
    } catch (error) {
      return { ok: false, status: 'failed', error: `TikTok token refresh failed: ${error instanceof Error ? error.message : String(error)} — the connection may need to be redone in API Manager.` }
    }

    try {
      const initRes = await fetch('https://open.tiktokapis.com/v2/post/publish/video/init/', {
        method: 'POST',
        headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json; charset=UTF-8' },
        body: JSON.stringify({
          post_info: {
            title: (draft.body || '').slice(0, 2200),
            privacy_level: 'SELF_ONLY',
            disable_duet: false,
            disable_stitch: false,
            disable_comment: false,
          },
          source_info: { source: 'PULL_FROM_URL', video_url: draft.imageUrl },
        }),
      })
      const initBody = await initRes.json()
      const publishId = initBody?.data?.publish_id
      if (!initRes.ok || initBody?.error?.code !== 'ok' || !publishId) {
        return { ok: false, status: 'failed', error: initBody?.error?.message || `TikTok publish init failed (${initRes.status})`, rawResponse: initBody }
      }

      for (let attempt = 0; attempt < TIKTOK_STATUS_POLL_MAX_ATTEMPTS; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, TIKTOK_STATUS_POLL_DELAY_MS))
        const statusRes = await fetch('https://open.tiktokapis.com/v2/post/publish/status/fetch/', {
          method: 'POST',
          headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json; charset=UTF-8' },
          body: JSON.stringify({ publish_id: publishId }),
        })
        const statusBody = await statusRes.json()
        const publishStatus = statusBody?.data?.status
        if (publishStatus === 'PUBLISH_COMPLETE') {
          return { ok: true, status: 'published', externalPostId: publishId, rawResponse: statusBody }
        }
        if (publishStatus === 'FAILED') {
          return { ok: false, status: 'failed', error: statusBody?.data?.fail_reason || 'TikTok reported the publish failed.', rawResponse: statusBody }
        }
        // else PROCESSING_UPLOAD / PROCESSING_DOWNLOAD / SEND_TO_USER_INBOX — keep polling
      }
      return { ok: false, status: 'failed', error: 'TikTok publish did not finish processing in time — check the TikTok inbox for this account; it may still complete.' }
    } catch (error) {
      return { ok: false, status: 'failed', error: error instanceof Error ? error.message : String(error) }
    }
  }

  // Refreshes and immediately persists the new token pair — TikTok
  // rotates the refresh_token on every use, so the old one stored in
  // Vault must be overwritten every time or the NEXT refresh would fail
  // with a stale, already-consumed refresh token.
  private async refreshAccessToken(clientKey: string, clientSecret: string, refreshToken: string, credentialsRef: string): Promise<string> {
    const res = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_key: clientKey,
        client_secret: clientSecret,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    })
    const body = await res.json()
    if (!res.ok || !body.access_token) {
      throw new Error(body?.error_description || `refresh failed (${res.status})`)
    }

    const newSecretValue = `${body.open_id}:${body.access_token}:${body.refresh_token}`
    const { error: setError } = await this.db.rpc('amos_set_integration_credential', {
      p_provider: 'tiktok', p_secret_name: credentialsRef, p_secret_value: newSecretValue,
    })
    if (setError) {
      // The refresh itself succeeded — don't fail the whole publish over
      // a storage hiccup, but log loudly since the NEXT refresh attempt
      // will fail with this now-stale refresh token if it isn't stored.
      console.error('[TikTokPublisher] refreshed token but failed to persist it:', setError.message)
    }

    return body.access_token
  }
}
