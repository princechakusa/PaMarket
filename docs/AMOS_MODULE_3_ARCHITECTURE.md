# AMOS — Module 3: Publishing Control Layer — Architecture

**Status:** Design only. No implementation until explicitly approved.
**Scope:** Human-in-the-loop publishing groundwork — scheduling, queueing, manual publish, platform-specific formatting, status tracking, retry, audit. **No external platform API calls in this module.** Facebook/Instagram/LinkedIn/TikTok/X integration is Module 4+.

---

## 1. Objective

Give an **approved** draft somewhere real to go: a schedule, a queue, a way for an admin to mark it published (by hand, today) or eventually have a future module's adapter do it automatically, with full status/error/retry tracking either way. Module 3 makes the Content Calendar (currently a read-only stub) and the publishing pipeline (currently two empty tables from Module 0) actually functional — without connecting a single external API.

## 2. What already exists (Module 0/2) vs. what Module 3 adds

Module 0 already created the two core tables this module depends on:

| Table | Already has | Module 3 needs to add |
|---|---|---|
| `amos_schedule` | `draft_id`, `scheduled_for`, `status` (pending/publishing/published/failed/cancelled), `attempts`, `last_attempt_at`, `last_error` | `platform` (explicit, not inferred via join), `content_version` (pins which `amos_content_drafts.version` was scheduled — see §4), rename/repurpose `attempts`→ the requested `retry_count` semantics (see open question in §10) |
| `amos_publish_log` | `schedule_id`, `channel`, `external_post_id`, `external_url`, `published_at`, `raw_response` | Nothing structural — already has every field your checklist asks for (published URL, external post ID). Module 3 just starts writing real rows to it, manually. |

So this is **schema-light**: mostly wiring real UI and one real edge function on top of tables that already have the right shape, plus a handful of additive columns. This is intentional — Module 0 was designed anticipating this module, per its own doc.

## 3. System overview

```
Approval Queue (Module 2)
        │ admin clicks "Schedule" on an approved draft
        ▼
┌─────────────────────────┐
│  amos_schedule           │  ← the publishing queue (one row per
│  (queue)                 │     draft × platform × scheduled time)
└───────────┬───────────────┘
            │ pg_cron (manual-trigger only for now, same as
            │ Modules 1/2) fires amos-publish-dispatcher
            ▼
┌──────────────────────────────────────────────────────────┐
│  amos-publish-dispatcher (edge function)                   │
│  Claims due rows → routes each to a PLATFORM ADAPTER        │
│  (interface only in Module 3 — see §6)                      │
└───────────┬──────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────┐        ┌──────────────────────────┐
│ ManualPublisher           │        │ FacebookPublisher (stub)  │
│ (the ONLY adapter that     │       │ InstagramPublisher (stub) │
│  actually does anything    │       │ LinkedInPublisher (stub)  │
│  in Module 3 — marks the    │      │ TikTokPublisher (stub)    │
│  row "awaiting manual       │      │ XPublisher (stub)         │
│  publish", admin does it     │      │  → all throw              │
│  by hand, confirms in UI)    │      │    "not implemented yet"  │
└───────────┬───────────────┘        └──────────────────────────┘
            ▼
┌─────────────────────────┐
│  amos_publish_log         │  ← permanent record: URL, external ID,
│  (audit trail)             │     raw response, timestamp
└─────────────────────────┘
```

## 4. Database changes (additive to Module 0's existing tables)

```sql
-- amos_schedule: add explicit platform + content version pinning
ALTER TABLE amos_schedule ADD COLUMN IF NOT EXISTS platform text; -- denormalized copy of the draft's channel at schedule-time (see §10 open question)
ALTER TABLE amos_schedule ADD COLUMN IF NOT EXISTS content_version int; -- amos_content_drafts.version at the moment it was scheduled — if someone edits the draft again after scheduling, this proves which text was actually approved-and-queued, not just "whatever the draft currently says"
ALTER TABLE amos_schedule ADD COLUMN IF NOT EXISTS retry_count int NOT NULL DEFAULT 0; -- see §10 — likely reuses `attempts` rather than duplicating it; listed here for completeness against your checklist
ALTER TABLE amos_schedule ADD COLUMN IF NOT EXISTS publish_method text CHECK (publish_method IN ('manual','api') OR publish_method IS NULL); -- Module 3 only ever writes 'manual'; the column exists now so Module 4's API adapters don't need a migration to start writing 'api'

-- amos_publish_log already has published_at/external_url/external_post_id/
-- raw_response — no changes needed, confirmed against Module 0 schema.

-- New: publishing-specific audit trail (distinct from admin_audit_logs,
-- which logs WHO did WHAT to the admin panel; this logs the publishing
-- pipeline's own lifecycle events — claimed, attempted, succeeded, failed,
-- retried — the same way amos_job_runs-via-job_runs already does for
-- research/generation runs)
CREATE TABLE IF NOT EXISTS amos_publish_audit (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id  uuid NOT NULL REFERENCES amos_schedule(id) ON DELETE CASCADE,
  event        text NOT NULL CHECK (event IN ('scheduled','claimed','manual_confirmed','failed','retried','cancelled')),
  detail       text,
  actor_id     uuid,        -- NULL for system/dispatcher-originated events
  actor_email  text,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_amos_publish_audit_schedule ON amos_publish_audit (schedule_id, created_at DESC);
-- RLS: is_admin_team(), same pattern as every other amos_* table.
```

**Why `platform` is denormalized onto `amos_schedule` rather than always joining through `amos_content_drafts.channel`:** a draft's channel never changes after generation, so today the join is equivalent — but once retries/reschedules exist, having the queue row self-describe its target platform makes every dispatcher/adapter query simpler and matches your explicit checklist requirement ("The system should store: Platform...").

## 5. Publishing queue workflow (manual-approval mandatory throughout)

1. **Approval Queue (Module 2, unchanged mechanics)**: admin approves a draft → `status='approved'`. This step is untouched — Module 3 does not change what "approved" means or how it's granted.
2. **New: "Schedule" action**, only available on `status='approved'` drafts. Admin picks a date/time (default: `amos_settings.posting_hours` optimal window for that platform, falling back to "now + 1 hour"). Creates one `amos_schedule` row: `draft_id`, `platform` (copied from the draft's channel), `scheduled_for`, `content_version` (copied from the draft's current `version`), `status='pending'`, `publish_method` left NULL until dispatch decides.
3. **Publishing queue view** (new Approval-Queue-adjacent tab, or an extension of the existing Content Calendar — see §7): shows all `pending`/`publishing`/`failed` rows, most-urgent-first.
4. **Dispatch (manual-trigger only, matching Modules 1/2's "review before automating" pattern)**: an admin clicks "Process Due Now" (or, once trusted, a future `pg_cron` schedule). `amos-publish-dispatcher` claims due rows (`scheduled_for <= now()`, `status='pending'`), and for each:
   - Looks up the platform adapter (see §6). In Module 3, **every adapter except `ManualPublisher` immediately returns a "not implemented" result** — this is deliberate, not a bug, so the plumbing is provably real without ever making an outbound call.
   - `ManualPublisher` sets `status='awaiting_manual_publish'` (a new status — see §10) and writes an `amos_publish_audit` row (`event='claimed'`).
5. **Manual publish confirmation**: the admin actually posts the content themselves (copy-paste into Facebook, etc. — exactly how you're operating today, just now tracked), then clicks "Mark Published" in the admin panel, optionally pasting the real post URL. This writes the `amos_publish_log` row (`published_at`, `external_url` if given) and flips `amos_schedule.status='published'`.
6. **Failure**: if a dispatch attempt errors (adapter throws, or the admin marks "Failed" instead of "Published"), `status='failed'`, `last_error` set, `retry_count`/`attempts` incremented, `amos_publish_audit` gets a `'failed'` row. A **Retry** button re-queues it (`status='pending'`, same `scheduled_for` or admin picks a new time).
7. **Cancel**: admin can cancel a still-`pending` row (e.g. the moment passed, or they changed their mind) → `status='cancelled'`, audited.

Every transition writes to `amos_publish_audit` — this is the "publishing audit logs" requirement, kept distinct from the general `admin_audit_logs` (which already covers admin actions like approve/edit/reject in Module 2) so publishing-pipeline events have their own clean timeline, mirroring how `job_runs` is a separate concern from `admin_audit_logs`.

## 6. Publishing adapter design (interfaces only — no real API calls)

```ts
// supabase/functions/_shared/amos-publishers/types.ts
export interface PublishResult {
  ok: boolean
  externalPostId?: string
  externalUrl?: string
  error?: string
  rawResponse?: unknown
}

export interface ContentPublisher {
  readonly platform: string
  publish(draft: DraftForPublish): Promise<PublishResult>
}
```

```ts
// supabase/functions/_shared/amos-publishers/manual.ts
// The only adapter that does anything in Module 3. "Publishing" here means
// handing control back to a human — it never calls out anywhere.
export class ManualPublisher implements ContentPublisher {
  readonly platform = 'manual'
  async publish(draft: DraftForPublish): Promise<PublishResult> {
    return { ok: true, error: undefined } // caller sets status='awaiting_manual_publish', not 'published' — a human still has to confirm
  }
}
```

```ts
// supabase/functions/_shared/amos-publishers/facebook.ts (Module 4 fills this in)
export class FacebookPublisher implements ContentPublisher {
  readonly platform = 'facebook'
  async publish(): Promise<PublishResult> {
    return { ok: false, error: 'FacebookPublisher not implemented yet — Module 4' }
  }
}
// InstagramPublisher, LinkedInPublisher, TikTokPublisher, XPublisher: identical
// stub shape, one file each, swapped in the dispatcher's platform→adapter
// map. Adding a real integration later is "implement this one file's
// publish() method" — no dispatcher/schema change needed, which is exactly
// the "plug into the same system" requirement.
```

```ts
// supabase/functions/_shared/amos-publishers/registry.ts
export const PUBLISHERS: Record<string, ContentPublisher> = {
  manual: new ManualPublisher(),
  facebook: new FacebookPublisher(),
  instagram: new InstagramPublisher(),
  linkedin: new LinkedInPublisher(),
  tiktok: new TikTokPublisher(),
  x: new XPublisher(),
}
```

The dispatcher always resolves `PUBLISHERS['manual']` in Module 3 regardless of the draft's actual `platform` column — every schedule row's real target platform is preserved and displayed, but the *publish mechanism* is manual-only until a future module swaps the lookup from hardcoded `'manual'` to `PUBLISHERS[schedule.platform]`. This is a one-line change in the dispatcher when Module 4 ships, not a redesign.

## 7. Admin UI additions

Extends the existing "Marketing (AMOS)" section, reusing the panel's established `hasTable()`/`migrationNotice()`/`auditLog()` conventions:

1. **Approval Queue** (Module 2, existing): approved drafts gain a **"Schedule"** button (only visible when `status='approved'`) opening a small date/time picker → creates the `amos_schedule` row.
2. **Content Calendar** (Module 0 stub → Module 3 real): becomes the **Publishing Queue** view — pending/publishing/awaiting-manual/failed/published rows, sortable by `scheduled_for`, with inline actions:
   - **Process Due Now** (manual dispatcher trigger, same JWT-auth pattern as Modules 1/2's "Run Now")
   - **Mark Published** (opens a small form: paste URL, confirm) — the human-in-the-loop step
   - **Mark Failed** / **Retry** / **Cancel**
3. **New: Publishing Audit** sub-view (or a filter within the existing AMOS Audit Trail tab) — the `amos_publish_audit` timeline per schedule row.
4. **System Health**: gains a "Publishing" card alongside the existing research/generation job status — last dispatch run, pending count, failed count.

## 8. Edge Function

`supabase/functions/amos-publish-dispatcher/index.ts` — new. Same dual-auth (cron secret / admin JWT), same rate-limiting helper (`_shared/amos-rate-limit.ts`, already built in Module 2 — reused, not duplicated), same `job_runs` heartbeat + `admin_audit_logs` manual-trigger audit pattern as `amos-research-runner`/`amos-content-generator`. No `pg_cron` schedule wired up initially — manual "Process Due Now" only, consistent with your stated preference to review each module's real behavior before automating it.

## 9. Rollback

`AMOS_MODULE_3_ROLLBACK.sql`: drop `amos_publish_audit`, drop the 4 added columns from `amos_schedule` (safe — no pre-existing data depends on them), remove the edge function, revert the 3 admin.html UI additions. `amos_schedule`/`amos_publish_log` themselves are NOT dropped (they're Module 0's).

## 10. Open questions before implementation

1. **`attempts` vs `retry_count`**: Module 0's `amos_schedule.attempts` already means exactly what your checklist calls `retry_count`. Reuse `attempts` (rename in UI copy only, no schema change) or add a genuinely separate `retry_count` column with different semantics (e.g. `attempts` = total tries including the first, `retry_count` = retries after the first failure)?
2. **New status value**: step 4 above introduces `'awaiting_manual_publish'`, not in Module 0's original `amos_schedule.status` CHECK (`pending/publishing/published/failed/cancelled`). Add it as a 6th value, or fold "awaiting manual publish" into the existing `'publishing'` status and distinguish via `publish_method='manual'` instead (no CHECK constraint change needed)?
3. **Scheduling multiple platforms for one content item at once**: should "Schedule" in the Approval Queue let an admin schedule all approved placements for one content item in a single action (e.g. "schedule everything approved for this idea for tomorrow 9am"), or strictly one draft → one schedule row at a time, matching today's per-draft approve/reject granularity?

---

*Design only — no code, no migration, no edge function will be created until this is approved.*
