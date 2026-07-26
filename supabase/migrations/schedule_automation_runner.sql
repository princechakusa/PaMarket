-- ============================================================================
-- Schedule automation-runner
-- ----------------------------------------------------------------------------
-- Every marketplace_notifications_phase1-4.sql function (price drops, listing
-- expiry warnings, stale-listing prompts, view milestones, personalized
-- recommendations, shop new-arrivals, category digest, verification nudges)
-- and the scheduled_notifications -> send-push delivery queue itself are only
-- ever executed when something calls the automation-runner edge function.
-- Nothing did: marketplace_notifications_phase2.sql's own footer already
-- flagged "this repo has no working schedule for it yet (checked: no pg_cron
-- entry, no GitHub Action)". Every notification type built across all four
-- phases has been sitting inert until now.
--
-- This wires pg_cron + pg_net to call it every 15 minutes. The project URL
-- is public (apps/mobile/.env EXPO_PUBLIC_SUPABASE_URL) so it's hardcoded
-- below; the AUTOMATION_SECRET is not (it's an edge function secret, set
-- under Supabase → Edge Functions → automation-runner → Secrets), so it is
-- stored in Vault instead of being pasted into this file.
--
-- MANUAL STEP REQUIRED before this does anything: replace
-- 'REPLACE_WITH_YOUR_AUTOMATION_SECRET' below with the actual value you set
-- for AUTOMATION_SECRET, then run this file in the Supabase SQL Editor.
-- If you ever rotate that secret, re-run just the vault.update_secret block.
--
-- Idempotent. Requires the pg_cron and pg_net extensions (Database →
-- Extensions in the Supabase dashboard; both are available on all plans).
-- ============================================================================

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

do $$
declare
  v_secret_id uuid;
begin
  select id into v_secret_id from vault.secrets where name = 'automation_secret';
  if v_secret_id is null then
    perform vault.create_secret('REPLACE_WITH_YOUR_AUTOMATION_SECRET', 'automation_secret', 'Shared secret for automation-runner edge function');
  end if;
end $$;

select cron.unschedule(jobid) from cron.job where jobname = 'automation-runner-tick';

select cron.schedule(
  'automation-runner-tick',
  '*/15 * * * *',
  $cron$
  select net.http_post(
    url := 'https://gxgytumhknmnwspxjzxw.supabase.co/functions/v1/automation-runner',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-automation-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'automation_secret')
    ),
    body := '{}'::jsonb
  );
  $cron$
);

-- Verification (run manually, after setting the real secret above):
--   select jobid, jobname, schedule, active from cron.job where jobname = 'automation-runner-tick';
--   select * from cron.job_run_details
--     where jobid = (select jobid from cron.job where jobname = 'automation-runner-tick')
--     order by start_time desc limit 5;
--   select * from public.job_runs where job = 'automation_runner' order by created_at desc limit 5;
