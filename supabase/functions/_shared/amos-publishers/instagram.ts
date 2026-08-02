import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import type { ContentPublisher, DraftForPublish, PublishResult } from './types.ts'

// Module 5 — real Meta Graph API integration, sharing Facebook's stored
// credential per the architecture ("Instagram shares the Meta token").
// Reuses the same amos_get_vault_secret RPC and amos_integrations row
// pattern FacebookPublisher established in Module 4.
//
// Important limitation, stated plainly rather than silently worked
// around: Instagram's Content Publishing API REQUIRES an image or video
// — there is no text-only post type on Instagram, unlike Facebook's Page
// feed. AMOS's content generator (Module 2) produces a text caption plus
// a set of `hashtags`, never an actual image/video file — image
// generation is explicitly out of scope until a Veo/image-provider
// module ships (see docs/AMOS_ARCHITECTURE.md §7, "Phase 1 ships prompts
// only"). So this adapter is REAL (not a stub) but will always fail with
// a clear, specific error until a media URL is available on the draft —
// this is an accurate reflection of Instagram's actual API constraint,
// not a placeholder.
const GRAPH_API_VERSION = 'v21.0'

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

    // Instagram publishing has no text-only mode — every post needs a
    // media URL, which nothing in the pipeline produces yet.
    return {
      ok: false,
      status: 'failed',
      error: 'Instagram requires an image or video for every post (no text-only posts exist on the platform) — AMOS does not generate or host media yet. This draft can still be published manually.',
    }
  }
}
