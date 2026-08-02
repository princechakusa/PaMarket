-- ════════════════════════════════════════════════════════════════════════
-- AMOS Module 3 — Rollback
--
-- Safe at any point: amos_publish_audit is new and Module-3-only. The 3
-- added columns on amos_schedule are dropped, reverting it to Module 0's
-- original shape. amos_schedule/amos_publish_log themselves are NOT
-- dropped (they belong to Module 0). Run manually in the Supabase SQL
-- Editor only if you need to fully remove Module 3.
--
-- Safe to run even if rows exist with status='awaiting_manual_publish' or
-- publish_method set — reverting the status CHECK back to Module 0's
-- original 5 values would fail with existing 'awaiting_manual_publish'
-- rows in place, so this file re-maps those back to 'pending' FIRST,
-- then drops the columns. Nothing is silently destroyed without a plan.
-- ════════════════════════════════════════════════════════════════════════

UPDATE amos_schedule SET status = 'pending' WHERE status = 'awaiting_manual_publish';

ALTER TABLE amos_schedule DROP CONSTRAINT IF EXISTS amos_schedule_status_check;
ALTER TABLE amos_schedule ADD CONSTRAINT amos_schedule_status_check
  CHECK (status IN ('pending','publishing','published','failed','cancelled'));

ALTER TABLE amos_schedule DROP COLUMN IF EXISTS platform;
ALTER TABLE amos_schedule DROP COLUMN IF EXISTS content_version;
ALTER TABLE amos_schedule DROP COLUMN IF EXISTS publish_method;

DROP TABLE IF EXISTS amos_publish_audit CASCADE;
