import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import type { ContentPublisher, DraftForPublish, PublishResult } from './types.ts'

// Module 4 — real Meta Graph API integration. Reads the Page access token
// from Supabase Vault via amos_integrations.credentials_ref (never a raw
// key in this file or in any table column — per the architecture's
// security model). If no token is connected yet, fails cleanly with a
// specific, actionable error instead of crashing or silently no-opping —
// same pattern as ANTHROPIC_API_KEY not being configured in Module 2.
//
// Graph API version pinned explicitly; Meta deprecates old versions on a
// schedule, so this is the one place to bump it later.
const GRAPH_API_VERSION = 'v21.0'

export class FacebookPublisher implements ContentPublisher {
  readonly platform = 'facebook'
  private db: SupabaseClient

  constructor(db: SupabaseClient) {
    this.db = db
  }

  async publish(draft: DraftForPublish): Promise<PublishResult> {
    const { data: integration, error: intError } = await this.db
      .from('amos_integrations')
      .select('status, credentials_ref')
      .eq('provider', 'facebook')
      .maybeSingle()

    if (intError || !integration || integration.status !== 'connected' || !integration.credentials_ref) {
      return {
        ok: false,
        status: 'failed',
        error: 'Facebook is not connected — set it up in AMOS System Health → API Manager (needs a Page access token stored in Vault) before scheduling Facebook posts to auto-publish.',
      }
    }

    // Vault's tables are not PostgREST-exposed by default (by design —
    // .from() can't reach them), so the read goes through a
    // SECURITY DEFINER RPC (amos_get_vault_secret, see
    // AMOS_MODULE_4_PUBLISHING_INTEGRATION.sql) instead of a table query.
    const { data: decryptedSecret, error: secretError } = await this.db
      .rpc('amos_get_vault_secret', { secret_name: integration.credentials_ref })

    if (secretError || !decryptedSecret) {
      return { ok: false, status: 'failed', error: 'Facebook credentials_ref is set but the Vault secret could not be read — check it was stored correctly.' }
    }

    // credentials_ref points to a Vault secret whose value is
    // "<pageId>:<pageAccessToken>" — one secret, not two, to keep Vault
    // lookups to a single row per platform.
    const [pageId, pageAccessToken] = (decryptedSecret as string).split(':', 2)
    if (!pageId || !pageAccessToken) {
      return { ok: false, status: 'failed', error: 'Facebook credentials are malformed (expected "pageId:pageAccessToken") — reconnect in API Manager.' }
    }

    if (!draft.body) {
      return { ok: false, status: 'failed', error: 'Draft has no body text to publish.' }
    }

    try {
      // With an image (Module 10), post to /photos with the image URL and
      // caption together — Meta attaches the photo and uses `caption` as
      // the post text in one call, still a single feed post either way.
      // Without one, fall back to the original text-only /feed post so
      // nothing here regresses for drafts generated before media support
      // existed or for channels where image generation was skipped/failed.
      const usePhoto = !!draft.imageUrl
      const endpoint = usePhoto ? 'photos' : 'feed'
      const payload = usePhoto
        ? { url: draft.imageUrl, caption: draft.body, access_token: pageAccessToken }
        : { message: draft.body, access_token: pageAccessToken }

      const res = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${pageId}/${endpoint}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const body = await res.json()

      if (!res.ok || body.error) {
        const message = body?.error?.message || `Graph API error ${res.status}`
        return { ok: false, status: 'failed', error: message, rawResponse: body }
      }

      // Graph API returns "{pageId}_{postId}" as `id` for a plain /feed post,
      // but for a /photos post that same combined id comes back as
      // `post_id` instead — `id` there is just the photo object's own id,
      // which does not resolve as a post URL.
      const externalPostId: string = usePhoto ? body.post_id : body.id
      const externalUrl = externalPostId ? `https://www.facebook.com/${externalPostId}` : undefined

      return { ok: true, status: 'published', externalPostId, externalUrl, rawResponse: body }
    } catch (error) {
      return { ok: false, status: 'failed', error: error instanceof Error ? error.message : String(error) }
    }
  }
}
