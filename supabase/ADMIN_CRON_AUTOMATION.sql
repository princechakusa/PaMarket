-- ════════════════════════════════════════════════════════════════════════
-- PaMarket — Scheduled Automation (pg_cron)
--
-- Run manually in the Supabase SQL Editor. Idempotent: re-running re-schedules
-- the same jobs rather than duplicating them.
--
-- What this automates (all of these are manual clicks in the Automation Center
-- today; after this they just happen):
--   • unban users whose ban_until has passed          — every 15 min
--   • deactivate ads past their end date              — hourly
--   • expire subscriptions past current_period_end    — daily 02:00
--   • purge notifications older than 30 days          — weekly, Sun 03:00
--
-- Each job writes a heartbeat to job_runs, so the Automation Center shows
-- last-run time, success/failure, and rows affected.
--
-- Prerequisite: ADMIN_ENTERPRISE_V2.sql (creates job_runs).
-- ════════════════════════════════════════════════════════════════════════

-- ── 0. Enable pg_cron ────────────────────────────────────────────────────
-- On Supabase this can also be toggled under Database → Extensions.
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ── 1. CRITICAL: let the cron jobs write their heartbeat ─────────────────
-- job_runs has RLS with an admin-team INSERT policy. pg_cron executes as the
-- `postgres` role, NOT as an authenticated admin, so is_admin_team() is false
-- and every heartbeat INSERT would be silently rejected — the Automation Center
-- would show "never ran" forever even while the jobs worked perfectly.
--
-- Fix: run the job bodies through a SECURITY DEFINER function that owns the
-- write. This keeps job_runs closed to the public while letting cron log to it.
CREATE OR REPLACE FUNCTION log_job_run(
  p_job text, p_ok boolean, p_detail text DEFAULT NULL, p_rows int DEFAULT NULL
) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO job_runs(job, ok, detail, rows_affected)
  VALUES (p_job, p_ok, p_detail, p_rows);
$$;

-- ── 2. The jobs themselves ───────────────────────────────────────────────
-- Each is a SECURITY DEFINER function so it runs with owner privileges (past
-- RLS) and can record how many rows it actually touched. Wrapped in an
-- exception handler so a failure is LOGGED rather than silently swallowed by
-- cron — a job that fails loudly in the Automation Center is the whole point.

-- 2a. Auto-unban expired bans.
CREATE OR REPLACE FUNCTION job_unban_expired() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n int;
BEGIN
  UPDATE profiles
     SET status = 'active', ban_reason = NULL, ban_until = NULL
   WHERE status = 'banned'
     AND ban_until IS NOT NULL
     AND ban_until < now();
  GET DIAGNOSTICS n = ROW_COUNT;
  PERFORM log_job_run('unban_expired', true, 'auto', n);
EXCEPTION WHEN OTHERS THEN
  PERFORM log_job_run('unban_expired', false, SQLERRM, NULL);
END; $$;

-- 2b. Deactivate ads whose end date has passed.
CREATE OR REPLACE FUNCTION job_expire_ads() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n int;
BEGIN
  UPDATE paid_ads
     SET active = false
   WHERE active = true
     AND ends_at IS NOT NULL
     AND ends_at < now();
  GET DIAGNOSTICS n = ROW_COUNT;
  PERFORM log_job_run('expire_ads', true, 'auto', n);
EXCEPTION WHEN OTHERS THEN
  PERFORM log_job_run('expire_ads', false, SQLERRM, NULL);
END; $$;

-- 2c. Expire subscriptions past their period end, and drop the business to the
--     free plan so paid features actually stop. Both writes, or neither.
CREATE OR REPLACE FUNCTION job_expire_subscriptions() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n int;
BEGIN
  WITH lapsed AS (
    UPDATE business_subscriptions
       SET status = 'expired'
     WHERE status = 'active'
       AND current_period_end IS NOT NULL
       AND current_period_end < now()
    RETURNING business_id
  )
  UPDATE businesses b
     SET plan_id = 'free'
    FROM lapsed l
   WHERE b.id = l.business_id;
  GET DIAGNOSTICS n = ROW_COUNT;
  PERFORM log_job_run('expire_subscriptions', true, 'auto', n);
EXCEPTION WHEN OTHERS THEN
  PERFORM log_job_run('expire_subscriptions', false, SQLERRM, NULL);
END; $$;

-- 2d. Purge notifications older than 30 days.
--     NOTE: notifications.created_at is a BIGINT of epoch MILLISECONDS on this
--     database (the app writes Date.now()), not a timestamptz. Verified against
--     live data before writing this. Do not "fix" it to now() - interval.
CREATE OR REPLACE FUNCTION job_purge_notifications() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n int; cutoff bigint;
BEGIN
  cutoff := (EXTRACT(EPOCH FROM now())::bigint * 1000) - (30::bigint * 86400000);
  DELETE FROM notifications WHERE created_at < cutoff;
  GET DIAGNOSTICS n = ROW_COUNT;
  PERFORM log_job_run('purge_notifications', true, 'weekly', n);
EXCEPTION WHEN OTHERS THEN
  PERFORM log_job_run('purge_notifications', false, SQLERRM, NULL);
END; $$;

-- ── 3. Schedule them ─────────────────────────────────────────────────────
-- Unschedule first so re-running this file never creates duplicate jobs.
SELECT cron.unschedule('unban-expired')          WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'unban-expired');
SELECT cron.unschedule('expire-ads')             WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'expire-ads');
SELECT cron.unschedule('expire-subscriptions')   WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'expire-subscriptions');
SELECT cron.unschedule('purge-old-notifications')WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'purge-old-notifications');

SELECT cron.schedule('unban-expired',           '*/15 * * * *', 'SELECT job_unban_expired()');
SELECT cron.schedule('expire-ads',              '0 * * * *',    'SELECT job_expire_ads()');
SELECT cron.schedule('expire-subscriptions',    '0 2 * * *',    'SELECT job_expire_subscriptions()');
SELECT cron.schedule('purge-old-notifications', '0 3 * * 0',    'SELECT job_purge_notifications()');

-- ── 4. Prove it works right now, instead of waiting for the schedule ─────
-- Runs each job once immediately. Safe: they are all idempotent no-ops when
-- there is nothing to do.
SELECT job_unban_expired();
SELECT job_expire_ads();
SELECT job_expire_subscriptions();
SELECT job_purge_notifications();

-- ── 5. Housekeeping ──────────────────────────────────────────────────────
-- Remove the probe row written while verifying that anonymous search logging
-- worked (anon has no DELETE grant on search_logs, by design, so it has to go
-- from here).
DELETE FROM search_logs WHERE term = '__probe__';

-- ── 6. Verify ────────────────────────────────────────────────────────────
-- Expect 4 scheduled jobs, and 4 heartbeat rows from the immediate run above.
-- If job_runs is EMPTY, the SECURITY DEFINER heartbeat is not working — that is
-- the single most likely failure mode, so check it.
SELECT jobname, schedule, active FROM cron.job ORDER BY jobname;
SELECT job, ok, rows_affected, detail, created_at
  FROM job_runs ORDER BY created_at DESC LIMIT 10;
