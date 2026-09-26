-- ============================================================
-- Log retention: reclaim space from automatic logs and keep them bounded.
-- Measured 2026-09-26: 278 MB total, of which
--   net._http_response    163 MB (390 rows; bloat from pg_net churn)
--   public.job_runs         45 MB (34,668 rows of automation history)
--   cron.job_run_details    34 MB (26,307 rows, never pruned)
-- Real application data is ~10 MB and is not touched here.
-- Nothing in the app reads old rows from any of these tables.
-- ============================================================

-- 1. pg_net response log: only kept for debugging; safe to empty.
do $$
begin
  begin
    truncate table net._http_response;
  exception when insufficient_privilege then
    delete from net._http_response;
  end;
end $$;

-- 2. pg_cron run history older than 7 days.
delete from cron.job_run_details where start_time < now() - interval '7 days';

-- 3. Automation run history older than 30 days.
delete from public.job_runs where created_at < now() - interval '30 days';

-- 4. Keep it that way: daily cleanup at 03:30 UTC (re-running updates it).
select cron.schedule(
  'pamarket-log-retention-daily',
  '30 3 * * *',
  $cron$
    delete from cron.job_run_details where start_time < now() - interval '7 days';
    delete from public.job_runs where created_at < now() - interval '30 days';
  $cron$
);

-- Afterwards, run this as its own separate query to hand the freed space
-- back so the dashboard size drops (it cannot run inside a transaction):
--   vacuum full public.job_runs, cron.job_run_details, net._http_response;
