import type { ContentPublisher, DraftForPublish, PublishResult } from './types.ts'

// Stub. No Meta Graph API call exists yet — a future module implements
// this (likely sharing auth/token plumbing with FacebookPublisher, since
// both go through Meta Business).
export class InstagramPublisher implements ContentPublisher {
  readonly platform = 'instagram'

  async publish(_draft: DraftForPublish): Promise<PublishResult> {
    return { ok: false, status: 'failed', error: 'InstagramPublisher not implemented yet — publishing to Instagram requires a future module (Meta Graph API integration).' }
  }
}
