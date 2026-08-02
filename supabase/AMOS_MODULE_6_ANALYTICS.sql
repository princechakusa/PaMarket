-- ════════════════════════════════════════════════════════════════════════
-- AMOS — Module 6: Analytics & Performance Tracking
--
-- Run manually in the Supabase SQL Editor, after Modules 0-5. No schema
-- changes — amos_metrics_daily and amos_reports (Module 0) already have
-- exactly the shape amos-analytics-collector needs, including the
-- UNIQUE(country_code,date,channel,metric) constraint the collector's
-- upsert relies on to stay idempotent across re-runs on the same day.
--
-- This file only schedules amos-analytics-collector daily via pg_cron,
-- same pattern as amos-research-runner's schedule
-- (AMOS_MODULE_1_SCHEDULE.sql), reusing the same automation_secret Vault
-- entry so nothing new needs to be typed in if it already exists.
-- ════════════════════════════════════════════════════════════════════════

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

do $$
declare
  v_secret_id uuid;
begin
  select id into v_secret_id from vault.secrets where name = 'automation_secret';
  if v_secret_id is null then
    perform vault.create_secret('REPLACE_WITH_YOUR_AUTOMATION_SECRET', 'automation_secret', 'Shared secret for automation-runner and amos-* edge functions');
  end if;
end $$;

select cron.unschedule(jobid) from cron.job where jobname = 'amos-analytics-collector-daily';

-- 06:30 UTC — 30 minutes after the research runner (06:00 UTC), so the
-- day's metrics reflect a full research/generation/approval cycle rather
-- than racing it.
select cron.schedule(
  'amos-analytics-collector-daily',
  '30 6 * * *',
  $cron$
  select net.http_post(
    url := 'https://gxgytumhknmnwspxjzxw.supabase.co/functions/v1/amos-analytics-collector',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-automation-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'automation_secret')
    ),
    body := '{}'::jsonb
  );
  $cron$
);

-- Verification (run manually):
--   select jobid, jobname, schedule, active from cron.job where jobname = 'amos-analytics-collector-daily';
--   select * from public.job_runs where job = 'amos_analytics_collector' order by created_at desc limit 5;
--   select * from public.amos_metrics_daily where date = current_date order by channel, metric;
