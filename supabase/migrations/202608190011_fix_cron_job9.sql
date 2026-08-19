-- ============================================================
-- 202608190011_fix_cron_job9.sql
--
-- Audit 4/5 item 2 (verified live 2026-08-19): cron.job id 9 ("0 0 * * 0",
-- weekly maintenance bundle covering job_runs/error_logs/notifications/
-- search_logs/admin_login_attempts/cron.job_run_details) has FAILED on
-- EVERY recorded execution (4/4, confirmed via cron.job_run_details),
-- going back at least to 2026-07-26. Root cause: its search_logs DELETE
-- clause compares a timestamptz column against a bigint epoch expression
-- ("operator does not exist: timestamp with time zone < bigint") — a
-- genuine type-mismatch bug, unrelated to the previously-flagged
-- notifications redundancy. Because pg_cron runs a multi-statement command
-- as one implicit transaction, this single broken statement rolled back
-- the ENTIRE weekly cleanup every time, silently: job_runs has grown to
-- 21,452+ rows (oldest 25 days, no 14-day retention ever actually
-- applied), and admin_login_attempts has a 43-day-old row despite its
-- documented 30-day retention.
--
-- This migration does two things to cron job 9, both confirmed necessary:
--   1. Removes the notifications DELETE block — genuinely redundant now
--      that job_purge_notifications() (cron id 7) is confirmed live,
--      batched, and correctly owns notification retention on its own
--      schedule. (In practice this block never even executed given the
--      job always failed before reaching it — but it's still the correct,
--      now-explicitly-authorized removal per this audit.)
--   2. Fixes the search_logs clause to a plain timestamptz comparison
--      (search_logs.created_at is timestamptz, confirmed live) — without
--      this, the job would continue failing on every run even after
--      removing the notifications block, and job_runs/error_logs/
--      admin_login_attempts would remain permanently unpurged.
--
-- job_runs and error_logs had no plain created_at index to support their
-- cutoff deletes efficiently (job_runs has three duplicate composite
-- indexes, all leading with `job`, none usable for a bare `created_at <`
-- scan; error_logs had none at all) — added below.
--
-- All five original tables' retention windows are otherwise unchanged
-- (job_runs/error_logs 14 days, search_logs/admin_login_attempts 30 days,
-- cron.job_run_details 14 days). The job's schedule, jobid, and every
-- other cron job (including job 7) are untouched.
--
-- One-time effect on first successful run: job_runs currently holds ~11-25
-- days of backlog beyond its 14-day window (up to several thousand rows)
-- that will be deleted in one statement — a plain indexed range delete on
-- a simple flat log table with no triggers/cascades, expected to be fast
-- and low-risk; not batched, to keep this a minimal, targeted fix rather
-- than a broader redesign of job 9's shape.
-- ============================================================

create index if not exists idx_job_runs_created_at
  on public.job_runs (created_at);

create index if not exists idx_error_logs_created_at
  on public.error_logs (created_at);

select cron.alter_job(
  job_id := 9,
  command := $cron$
        -- Background job queue logs (Keep 14 days)
        DELETE FROM job_runs
        WHERE created_at < NOW() - INTERVAL '14 days';

        -- System error logs (Keep 14 days)
        DELETE FROM error_logs
        WHERE created_at < NOW() - INTERVAL '14 days';

        -- Search activity logs (Keep 30 days)
        DELETE FROM search_logs
        WHERE created_at < NOW() - INTERVAL '30 days';

        -- Admin login attempts (Keep 30 days)
        DELETE FROM admin_login_attempts
        WHERE created_at < NOW() - INTERVAL '30 days';

        -- Cleanup pg_cron's own execution log history (Keep 14 days)
        DELETE FROM cron.job_run_details
        WHERE start_time < NOW() - INTERVAL '14 days';
    $cron$
);

-- Verification (run after applying):
--   select jobid, schedule, command, active from cron.job where jobid = 9;
--   -- wait for or manually trigger the next run, then:
--   select status, return_message from cron.job_run_details where jobid = 9 order by start_time desc limit 1;
--   -- expect status = 'succeeded'
-- ============================================================
