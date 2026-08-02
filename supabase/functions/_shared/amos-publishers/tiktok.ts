import type { ContentPublisher, DraftForPublish, PublishResult } from './types.ts'

// Stub. No TikTok Content Posting API call exists yet — a future module
// implements this. TikTok's API has stricter app-review/business-account
// requirements than the others (see docs/AMOS_ARCHITECTURE.md §7), so this
// adapter may stay a stub longer than Facebook/Instagram/LinkedIn/X.
export class TikTokPublisher implements ContentPublisher {
  readonly platform = 'tiktok'

  async publish(_draft: DraftForPublish): Promise<PublishResult> {
    return { ok: false, status: 'failed', error: 'TikTokPublisher not implemented yet — publishing to TikTok requires a future module (Content Posting API integration, pending app review).' }
  }
}
