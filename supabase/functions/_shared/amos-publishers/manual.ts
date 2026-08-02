import type { ContentPublisher, DraftForPublish, PublishResult } from './types.ts'

// The only publisher that actually does something in Module 3. "Publishing"
// here never calls an external API — it hands control to a human. The
// dispatcher always resolves this adapter today regardless of a schedule
// row's real target platform; a future module swaps that lookup to the
// real per-platform adapter once one is implemented (see registry.ts).
export class ManualPublisher implements ContentPublisher {
  readonly platform = 'manual'

  async publish(_draft: DraftForPublish): Promise<PublishResult> {
    return { ok: true, status: 'awaiting_manual_publish' }
  }
}
