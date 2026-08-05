-- Rollback for AMOS_MODULE_12_DISPATCH_SCHEDULE.sql
--
-- Only removes the cron schedule — does not touch amos_schedule rows or
-- the automation_secret Vault entry (shared with other AMOS cron jobs).
-- Run manually in the Supabase SQL Editor.

select cron.unschedule(jobid) from cron.job where jobname = 'amos-publish-dispatcher-5min';
