-- ════════════════════════════════════════════════════════════════════════
-- AMOS Module 6 — Rollback
--
-- Unschedules the daily analytics collection. Does NOT delete collected
-- amos_metrics_daily rows or amos_reports (they're Module 0's tables and
-- may be useful history even after this module is rolled back). Run
-- manually in the Supabase SQL Editor.
-- ════════════════════════════════════════════════════════════════════════

select cron.unschedule(jobid) from cron.job where jobname = 'amos-analytics-collector-daily';

-- To also clear collected metrics (optional, NOT run automatically):
--   delete from amos_metrics_daily where channel in ('marketplace','amos');
