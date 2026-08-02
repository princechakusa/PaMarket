-- ============================================================================
-- Schedule amos-research-runner (AMOS Module 1)
-- ----------------------------------------------------------------------------
-- Runs the Market Intelligence research runner once a day, so
-- amos_market_intelligence stays fresh (search-log gaps recomputed, upcoming
-- ZW calendar events refreshed) without needing a manual "Run Now" click.
--
-- Reuses the SAME secret as automation-runner (the 'automation_secret' Vault
-- entry set up by schedule_automation_runner.sql) — amos-research-runner
-- checks the identical AUTOMATION_SECRET edge function env var, so if that's
-- already configured for automation-runner, nothing new needs to be typed
-- in here. If automation-runner was never scheduled on this project, this
-- file still creates the Vault secret itself (idempotent either way).
--
-- MANUAL STEP REQUIRED only if 'automation_secret' does not already exist in
-- Vault: replace 'REPLACE_WITH_YOUR_AUTOMATION_SECRET' below with the actual
-- value you set for the AUTOMATION_SECRET edge function secret (Supabase →
-- Edge Functions → amos-research-runner → Secrets), then run this file.
--
-- Prerequisite: amos-research-runner must already be deployed
-- (supabase functions deploy amos-research-runner --no-verify-jwt) with
-- AUTOMATION_SECRET set to the same value as automation-runner's.
--
-- Idempotent. Requires pg_cron + pg_net (already enabled if
-- schedule_automation_runner.sql has been run on this project).
-- ============================================================================

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

do $$
declare
  v_secret_id uuid;
begin
  select id into v_secret_id from vault.secrets where name = 'automation_secret';
  if v_secret_id is null then
    perform vault.create_secret('REPLACE_WITH_YOUR_AUTOMATION_SECRET', 'automation_secret', 'Shared secret for automation-runner and amos-research-runner edge functions');
  end if;
end $$;

select cron.unschedule(jobid) from cron.job where jobname = 'amos-research-runner-daily';

-- 06:00 UTC = 08:00 Harare (Zimbabwe is UTC+2, no DST) — runs early enough
-- that fresh trend data is ready before the admin's morning review, per the
-- brief's "every morning automatically perform research" goal.
select cron.schedule(
  'amos-research-runner-daily',
  '0 6 * * *',
  $cron$
  select net.http_post(
    url := 'https://gxgytumhknmnwspxjzxw.supabase.co/functions/v1/amos-research-runner',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-automation-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'automation_secret')
    ),
    body := '{}'::jsonb
  );
  $cron$
);

-- Verification (run manually, after setting the real secret above if it
-- wasn't already set):
--   select jobid, jobname, schedule, active from cron.job where jobname = 'amos-research-runner-daily';
--   select * from cron.job_run_details
--     where jobid = (select jobid from cron.job where jobname = 'amos-research-runner-daily')
--     order by start_time desc limit 5;
--   select * from public.job_runs where job = 'amos_research_runner' order by created_at desc limit 5;
