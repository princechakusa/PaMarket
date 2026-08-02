-- ════════════════════════════════════════════════════════════════════════
-- AMOS Module 1 — Verification layer
--
-- Run manually in the Supabase SQL Editor, after AMOS_MODULE_1_RESEARCH.sql
-- and AMOS_MODULE_1_SCHEDULE.sql. Additive only.
--
-- Adds two optional columns to the EXISTING job_runs table (shared by every
-- scheduled job in this codebase, not just AMOS) so a run's audit record
-- captures start time and how it was triggered, not just the end time and
-- outcome it already recorded. Both columns are nullable / have safe
-- defaults, so every other job that writes to job_runs (ad expiry,
-- notification dispatch, automation-runner, etc.) keeps working completely
-- unchanged — they simply won't populate the two new columns, which the
-- AMOS dashboard treats as "unknown" rather than an error.
-- ════════════════════════════════════════════════════════════════════════

ALTER TABLE job_runs ADD COLUMN IF NOT EXISTS started_at timestamptz;
ALTER TABLE job_runs ADD COLUMN IF NOT EXISTS trigger_type text CHECK (trigger_type IN ('cron','manual') OR trigger_type IS NULL);

CREATE INDEX IF NOT EXISTS idx_job_runs_job_created ON job_runs (job, created_at DESC);
