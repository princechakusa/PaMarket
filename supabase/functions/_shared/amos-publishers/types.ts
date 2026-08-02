// AMOS publishing adapter contract. Every platform (manual, facebook,
// instagram, linkedin, tiktok, x) implements this same interface so the
// dispatcher never needs platform-specific branching — adding a real
// integration later means writing one new file's publish() method, not
// touching the dispatcher, the schema, or the UI.

export interface DraftForPublish {
  draftId: string
  scheduleId: string
  channel: string
  draftType: string
  body: string | null
  cta: string | null
  hashtags: string[] | null
}

export interface PublishResult {
  ok: boolean
  // 'awaiting_manual_publish' is what ManualPublisher always returns —
  // publish() succeeding does NOT mean the content is live, only that
  // it's been handed to whatever happens next (a human, in Module 3; a
  // real API call, in a future module).
  status: 'awaiting_manual_publish' | 'published' | 'failed'
  externalPostId?: string
  externalUrl?: string
  error?: string
  rawResponse?: unknown
}

export interface ContentPublisher {
  readonly platform: string
  publish(draft: DraftForPublish): Promise<PublishResult>
}
