-- ============================================================================
-- Schedule amos-publish-dispatcher (AMOS Module 12)
-- ----------------------------------------------------------------------------
-- Until now, a scheduled AMOS post only actually published when an admin
-- clicked "Process Due Now" in Content Calendar — approving and scheduling
-- alone never published anything on its own. This adds a recurring cron job
-- so scheduled, approved content publishes automatically at its scheduled
-- time, without requiring a manual click.
--
-- Reuses the SAME 'automation_secret' Vault entry as amos-research-runner
-- (AMOS_MODULE_1_SCHEDULE.sql) and pamarket-automation-runner — nothing new
-- to configure if either of those is already scheduled on this project.
--
-- Every 5 minutes: close enough to feel real-time for a scheduled post,
-- without excessive invocations. Each run is cheap/near-instant when
-- nothing is actually due (claim_due_amos_schedule returns zero rows).
--
-- Idempotent. Requires pg_cron + pg_net (already enabled on this project).
-- ============================================================================

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

select cron.unschedule(jobid) from cron.job where jobname = 'amos-publish-dispatcher-5min';

select cron.schedule(
  'amos-publish-dispatcher-5min',
  '*/5 * * * *',
  $cron$
  select net.http_post(
    url := 'https://gxgytumhknmnwspxjzxw.supabase.co/functions/v1/amos-publish-dispatcher',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-automation-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'automation_secret')
    ),
    body := '{}'::jsonb
  );
  $cron$
);

-- Verification (run manually):
--   select jobid, jobname, schedule, active from cron.job where jobname = 'amos-publish-dispatcher-5min';
--   select * from cron.job_run_details
--     where jobid = (select jobid from cron.job where jobname = 'amos-publish-dispatcher-5min')
--     order by start_time desc limit 5;
--   select * from public.job_runs where job = 'amos_publish_dispatcher' order by started_at desc limit 5;
