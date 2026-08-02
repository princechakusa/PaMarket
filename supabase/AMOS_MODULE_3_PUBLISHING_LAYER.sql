-- ════════════════════════════════════════════════════════════════════════
-- AMOS — Module 3: Publishing Control Layer
--
-- Run manually in the Supabase SQL Editor, after Modules 0, 1, 2 (and
-- Module 1's verification + Module 2's quality layer). Additive only.
--
-- Safety check performed before writing this file (against the live
-- database, not just the source .sql files): confirmed amos_schedule and
-- amos_publish_log's live columns match AMOS_MODULE_0_FOUNDATION.sql
-- exactly — no drift, nothing to reconcile. This file only ADDs columns
-- guarded by IF NOT EXISTS and only creates one genuinely new table
-- (amos_publish_audit). No existing column is dropped, renamed, or
-- retyped, and no existing row's data is touched.
--
-- No external API calls, no Facebook/Instagram/LinkedIn/TikTok/X
-- integration — every publisher adapter except the manual one is a stub
-- that returns "not implemented yet" (see supabase/functions/_shared/
-- amos-publishers/). This module only makes the publishing QUEUE and the
-- MANUAL publish workflow real.
-- ════════════════════════════════════════════════════════════════════════

-- ── amos_schedule: 3 new columns (attempts/retry_count stays a single
--    column per your decision — "attempts = total processing attempts",
--    UI labels it "Retry Count" where relevant, no duplicate field) ──────
ALTER TABLE amos_schedule ADD COLUMN IF NOT EXISTS platform text;
ALTER TABLE amos_schedule ADD COLUMN IF NOT EXISTS content_version int;
ALTER TABLE amos_schedule ADD COLUMN IF NOT EXISTS publish_method text CHECK (publish_method IN ('manual','api') OR publish_method IS NULL);

-- Backfill platform for any pre-existing rows (there should be none yet —
-- the Content Calendar has been a read-only stub until now — but this
-- keeps the migration correct if that ever changes) from the draft's
-- channel, which is the source of truth today.
UPDATE amos_schedule s
SET platform = d.channel
FROM amos_content_drafts d
WHERE s.draft_id = d.id AND s.platform IS NULL;

-- Widen status to add 'awaiting_manual_publish' as its own distinct value
-- (per your decision: do not overload 'publishing' — 'publishing' means
-- the system is actively processing; 'awaiting_manual_publish' means
-- processing finished and a human needs to act).
ALTER TABLE amos_schedule DROP CONSTRAINT IF EXISTS amos_schedule_status_check;
ALTER TABLE amos_schedule ADD CONSTRAINT amos_schedule_status_check
  CHECK (status IN ('pending','publishing','awaiting_manual_publish','published','failed','cancelled'));

-- ── amos_publish_log: no columns needed — already has schedule_id,
--    channel, external_post_id, external_url, published_at, raw_response.
--    Confirmed against the live database above; nothing to add. ─────────

-- ── New: publishing pipeline's own event timeline, distinct from
--    admin_audit_logs (which already covers approve/edit/reject from
--    Module 2) — mirrors how job_runs is a separate concern from
--    admin_audit_logs for the research/generation runners. ─────────────
CREATE TABLE IF NOT EXISTS amos_publish_audit (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id  uuid NOT NULL REFERENCES amos_schedule(id) ON DELETE CASCADE,
  event        text NOT NULL CHECK (event IN ('scheduled','claimed','manual_confirmed','failed','retried','cancelled')),
  detail       text,
  actor_id     uuid,
  actor_email  text,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_amos_publish_audit_schedule ON amos_publish_audit (schedule_id, created_at DESC);
ALTER TABLE amos_publish_audit ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "amos_publish_audit team" ON amos_publish_audit;
CREATE POLICY "amos_publish_audit team" ON amos_publish_audit FOR ALL
  USING (is_admin_team()) WITH CHECK (is_admin_team());

-- ── Post-migration safety check (run this SELECT by hand afterward to
--    confirm the migration applied exactly as intended — no duplicate
--    columns, correct constraint, new table present with RLS on) ───────
-- select column_name, data_type from information_schema.columns
--   where table_name='amos_schedule' order by ordinal_position;
-- select pg_get_constraintdef(oid) from pg_constraint
--   where conrelid='amos_schedule'::regclass and conname='amos_schedule_status_check';
-- select relrowsecurity from pg_class where relname='amos_publish_audit';
