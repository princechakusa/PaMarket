import type { ContentPublisher, DraftForPublish, PublishResult } from './types.ts'

// Stub. No LinkedIn API call exists yet — a future module implements this.
export class LinkedInPublisher implements ContentPublisher {
  readonly platform = 'linkedin'

  async publish(_draft: DraftForPublish): Promise<PublishResult> {
    return { ok: false, status: 'failed', error: 'LinkedInPublisher not implemented yet — publishing to LinkedIn requires a future module (LinkedIn API integration).' }
  }
}
