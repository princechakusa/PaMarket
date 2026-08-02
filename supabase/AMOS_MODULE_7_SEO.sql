-- ════════════════════════════════════════════════════════════════════════
-- AMOS — Module 7: SEO
--
-- Run manually in the Supabase SQL Editor, after Modules 0-6. No schema
-- changes — amos_seo_recommendations (Module 0) already has exactly the
-- shape amos-seo-runner needs.
--
-- Schedules amos-seo-runner weekly (SEO issues don't change hour to hour
-- the way market intelligence does — a daily run would just be noise).
-- Same automation_secret Vault reuse as every other AMOS schedule.
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

select cron.unschedule(jobid) from cron.job where jobname = 'amos-seo-runner-weekly';

-- Mondays 07:00 UTC — after the daily research/generation/analytics runs
-- have had a chance to run at least once that week.
select cron.schedule(
  'amos-seo-runner-weekly',
  '0 7 * * 1',
  $cron$
  select net.http_post(
    url := 'https://gxgytumhknmnwspxjzxw.supabase.co/functions/v1/amos-seo-runner',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-automation-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'automation_secret')
    ),
    body := '{}'::jsonb
  );
  $cron$
);

-- Verification (run manually):
--   select jobid, jobname, schedule, active from cron.job where jobname = 'amos-seo-runner-weekly';
--   select * from public.job_runs where job = 'amos_seo_runner' order by created_at desc limit 5;
--   select * from public.amos_seo_recommendations where status = 'open' order by created_at desc limit 20;
