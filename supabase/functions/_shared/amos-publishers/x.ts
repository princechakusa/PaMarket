import type { ContentPublisher, DraftForPublish, PublishResult } from './types.ts'

// Stub. No X API call exists yet — a future module implements this. X's
// API has required a paid tier for posting since 2023 (see
// docs/AMOS_ARCHITECTURE.md §7), a budget decision independent of this
// module's plumbing being ready.
export class XPublisher implements ContentPublisher {
  readonly platform = 'x'

  async publish(_draft: DraftForPublish): Promise<PublishResult> {
    return { ok: false, status: 'failed', error: 'XPublisher not implemented yet — publishing to X requires a future module (X API integration, paid tier).' }
  }
}
