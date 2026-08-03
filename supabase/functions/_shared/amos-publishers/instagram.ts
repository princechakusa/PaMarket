import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import type { ContentPublisher, DraftForPublish, PublishResult } from './types.ts'

// Module 5 — real Meta Graph API integration, sharing Facebook's stored
// credential per the architecture ("Instagram shares the Meta token").
// Reuses the same amos_get_vault_secret RPC and amos_integrations row
// pattern FacebookPublisher established in Module 4.
//
// Instagram's Content Publishing API REQUIRES an image or video — there
// is no text-only post type on Instagram, unlike Facebook's Page feed.
// Before Module 10 (AI media generation), nothing in the pipeline ever
// produced a real image, so this adapter always failed with a clear,
// specific error. Now that amos-media-generator can attach an image to a
// draft, publish() uses it via Instagram's two-step Content Publishing
// flow (create a media container from the image URL + caption, then
// publish that container) — if no image is present on the draft, it
// still fails with the same explicit "needs an image" error rather than
// guessing or falling back to a broken text-only call.
const GRAPH_API_VERSION = 'v21.0'
const CONTAINER_POLL_MAX_ATTEMPTS = 5
const CONTAINER_POLL_DELAY_MS = 1500

export class InstagramPublisher implements ContentPublisher {
  readonly platform = 'instagram'
  private db: SupabaseClient

  constructor(db: SupabaseClient) {
    this.db = db
  }

  async publish(draft: DraftForPublish): Promise<PublishResult> {
    const { data: integration, error: intError } = await this.db
      .from('amos_integrations')
      .select('status, credentials_ref')
      .eq('provider', 'facebook') // shares Facebook's connection, not its own row
      .maybeSingle()

    if (intError || !integration || integration.status !== 'connected' || !integration.credentials_ref) {
      return { ok: false, status: 'failed', error: 'Instagram publishing shares the Facebook connection — connect Facebook in API Manager first (needs a Page linked to an Instagram Business Account).' }
    }

    if (!draft.imageUrl) {
      return {
        ok: false,
        status: 'failed',
        error: 'Instagram requires an image or video for every post (no text-only posts exist on the platform) — this draft has no generated image yet. Generate one from the Approval Queue, or publish manually.',
      }
    }

    // credentials_ref value is "<pageId>:<pageAccessToken>" (Facebook's
    // format, shared here) — but Instagram's API needs the IG Business
    // Account id, which Graph derives from the connected Page.
    const { data: decryptedSecret, error: secretError } = await this.db
      .rpc('amos_get_vault_secret', { secret_name: integration.credentials_ref })
    if (secretError || !decryptedSecret) {
      return { ok: false, status: 'failed', error: 'Facebook credentials_ref is set but the Vault secret could not be read — check it was stored correctly.' }
    }
    const [pageId, pageAccessToken] = (decryptedSecret as string).split(':', 2)
    if (!pageId || !pageAccessToken) {
      return { ok: false, status: 'failed', error: 'Facebook credentials are malformed (expected "pageId:pageAccessToken") — reconnect in API Manager.' }
    }

    try {
      const pageInfoRes = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${pageId}?fields=instagram_business_account&access_token=${encodeURIComponent(pageAccessToken)}`)
      const pageInfo = await pageInfoRes.json()
      const igUserId: string | undefined = pageInfo?.instagram_business_account?.id
      if (!pageInfoRes.ok || !igUserId) {
        return { ok: false, status: 'failed', error: 'The connected Facebook Page has no linked Instagram Business Account — link one in Meta Business Suite first.', rawResponse: pageInfo }
      }

      const caption = draft.hashtags?.length ? `${draft.body}\n\n${draft.hashtags.join(' ')}` : draft.body

      const containerRes = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${igUserId}/media`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ image_url: draft.imageUrl, caption, access_token: pageAccessToken }),
      })
      const container = await containerRes.json()
      if (!containerRes.ok || container.error || !container.id) {
        return { ok: false, status: 'failed', error: container?.error?.message || `Instagram container creation failed (${containerRes.status})`, rawResponse: container }
      }

      // The container needs a moment to finish fetching/processing the
      // image before it can be published — poll status_code rather than
      // publishing immediately, which Meta's own docs warn will 400 on a
      // container that isn't FINISHED yet for larger images.
      let ready = false
      for (let attempt = 0; attempt < CONTAINER_POLL_MAX_ATTEMPTS; attempt++) {
        const statusRes = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${container.id}?fields=status_code&access_token=${encodeURIComponent(pageAccessToken)}`)
        const statusBody = await statusRes.json()
        if (statusBody.status_code === 'FINISHED') { ready = true; break }
        if (statusBody.status_code === 'ERROR') {
          return { ok: false, status: 'failed', error: 'Instagram failed to process the image container.', rawResponse: statusBody }
        }
        await new Promise((resolve) => setTimeout(resolve, CONTAINER_POLL_DELAY_MS))
      }
      if (!ready) {
        return { ok: false, status: 'failed', error: 'Instagram media container did not finish processing in time — try again shortly.' }
      }

      const publishRes = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${igUserId}/media_publish`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ creation_id: container.id, access_token: pageAccessToken }),
      })
      const published = await publishRes.json()
      if (!publishRes.ok || published.error || !published.id) {
        return { ok: false, status: 'failed', error: published?.error?.message || `Instagram publish failed (${publishRes.status})`, rawResponse: published }
      }

      // published.id is an internal media id, not the public shortcode
      // used in instagram.com/p/{shortcode}/ URLs — Graph API doesn't
      // return that shortcode directly, so no externalUrl is fabricated
      // here rather than link to something that won't resolve.
      return {
        ok: true,
        status: 'published',
        externalPostId: published.id,
        rawResponse: published,
      }
    } catch (error) {
      return { ok: false, status: 'failed', error: error instanceof Error ? error.message : String(error) }
    }
  }
}
