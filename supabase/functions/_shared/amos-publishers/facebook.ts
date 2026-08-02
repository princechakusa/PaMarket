import type { ContentPublisher, DraftForPublish, PublishResult } from './types.ts'

// Stub. No Meta Graph API call exists yet — Module 4+ implements this.
// Exists now so the dispatcher's platform→adapter map is complete and the
// registry never needs a shape change when this becomes real.
export class FacebookPublisher implements ContentPublisher {
  readonly platform = 'facebook'

  async publish(_draft: DraftForPublish): Promise<PublishResult> {
    return { ok: false, status: 'failed', error: 'FacebookPublisher not implemented yet — publishing to Facebook requires Module 4 (Meta Graph API integration).' }
  }
}
