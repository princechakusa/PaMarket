import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import type { ContentPublisher, DraftForPublish, PublishResult } from './types.ts'

// Module 14 — real TikTok Content Posting API integration via the
// Upload API (video.upload scope), not Direct Post (video.publish).
//
// video.publish requires a separate TikTok approval beyond what's
// available to add from the app's Scopes list even with Content
// Posting API added — confirmed live, only video.upload was offered.
// Upload API shares content to the creator's TikTok inbox as a draft;
// a human must open the TikTok app notification and tap through
// TikTok's own posting flow to finish (status 'awaiting_manual_publish'
// makes this explicit rather than silently claiming 'published'). This
// is a deliberate interim step, not a workaround — request video.publish
// from TikTok once this app has a real posting track record, then this
// class can call /post/publish/video/init/ (Direct Post) instead of
// /post/publish/inbox/video/init/ for a true one-click auto-publish; no
// other change needed since the request/response shape is nearly
// identical.
//
// Requires the connected TikTok account's own video domain to be
// verified in the TikTok Developer Portal (Settings > URL Properties)
// — R2's pub-*.r2.dev host specifically, since that's where AMOS's
// attached videos are served from. An unverified domain gets rejected
// before TikTok even starts downloading.
//
// credentials_ref points to a Vault secret formatted as
// "<openId>:<accessToken>:<refreshToken>" (set by amos-tiktok-oauth's
// callback leg). Access tokens expire in 24h; this adapter refreshes
// proactively on every call rather than tracking expiry times.
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
      return { ok: false, status: 'failed', error: 'TikTok is not connected — connect it in AMOS System Health → API Manager (needs a TikTok login via OAuth) before scheduling TikTok posts.' }
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
      const initRes = await fetch('https://open.tiktokapis.com/v2/post/publish/inbox/video/init/', {
        method: 'POST',
        headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json; charset=UTF-8' },
        body: JSON.stringify({
          source_info: { source: 'PULL_FROM_URL', video_url: draft.imageUrl },
        }),
      })
      const initBody = await initRes.json()
      const publishId = initBody?.data?.publish_id
      if (!initRes.ok || initBody?.error?.code !== 'ok' || !publishId) {
        return { ok: false, status: 'failed', error: initBody?.error?.message || `TikTok upload init failed (${initRes.status})`, rawResponse: initBody }
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
        if (publishStatus === 'SEND_TO_USER_INBOX') {
          // As good as it gets for the Upload API — content reached the
          // creator's TikTok inbox; a human still has to open the app
          // and tap through TikTok's own flow to actually publish it.
          // 'awaiting_manual_publish' reflects that honestly instead of
          // claiming this auto-published like Direct Post would.
          return { ok: true, status: 'awaiting_manual_publish', externalPostId: publishId, rawResponse: statusBody }
        }
        if (publishStatus === 'FAILED') {
          return { ok: false, status: 'failed', error: statusBody?.data?.fail_reason || 'TikTok reported the upload failed.', rawResponse: statusBody }
        }
        // else PROCESSING_UPLOAD / PROCESSING_DOWNLOAD — keep polling
      }
      return { ok: false, status: 'failed', error: 'TikTok upload did not finish processing in time — check the TikTok inbox for this account; it may still complete.' }
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
    // _service variant (Module 15) — this runs from the dispatcher, which is
    // called by cron with no user session; amos_set_integration_credential's
    // is_admin_team() check would always fail here.
    const { error: setError } = await this.db.rpc('amos_set_integration_credential_service', {
      p_provider: 'tiktok', p_secret_name: credentialsRef, p_secret_value: newSecretValue,
    })
    if (setError) {
      console.error('[TikTokPublisher] refreshed token but failed to persist it:', setError.message)
    }

    return body.access_token
  }
}
