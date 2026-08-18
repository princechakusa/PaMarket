-- ============================================================================
-- PaMarket — automation-runner cron job never actually ran: same gateway
-- auth bug as fix_notification_push_dispatch_auth.sql, in the trigger that
-- starts the whole pipeline instead of the one that sends the final push.
-- ----------------------------------------------------------------------------
-- automation-runner has verify_jwt = true (supabase/config.toml). The
-- schedule_automation_runner.sql cron job posts to it with only an
-- x-automation-secret header — no Authorization bearer. Supabase's Edge
-- gateway rejects a request with no Authorization header before any function
-- code runs, exactly like the dispatch-notification-push bug already fixed:
--
--   HTTP 401 {"code":"UNAUTHORIZED_NO_AUTH_HEADER",
--             "message":"Missing authorization header"}
--
-- Confirmed live: calling the deployed function with only Content-Type
-- returns that exact 401, before the function's own secret check ever runs.
-- Every automatic notification type in marketplace_notifications_phase1-4.sql
-- (verification nudges, listing/view reminders, view milestones, category
-- digests, promotion expiry, etc.) has been sitting inert since
-- schedule_automation_runner.sql was written — the every-15-minutes cron
-- job has been firing and getting turned away at the gateway the whole time,
-- not reaching automation-runner's own code at all.
--
-- Fix: same pattern as the already-working dispatch-notification-push fix —
-- send the vault-stored anon key as the bearer token (satisfies the gateway;
-- any valid project key does) alongside the existing x-automation-secret
-- (the function's real authorization check).
--
-- Idempotent (cron.schedule with an existing jobname replaces it in place;
-- this migration also unschedules first exactly like the original did).
-- Requires the automation_secret and pamarket_automation_anon_key vault
-- entries schedule_automation_runner.sql and
-- fix_notification_push_dispatch_auth.sql already require — no new secret
-- to set up if those are already in place.
-- ============================================================================

select cron.unschedule(jobid) from cron.job where jobname = 'automation-runner-tick';

select cron.schedule(
  'automation-runner-tick',
  '*/15 * * * *',
  $cron$
  select net.http_post(
    url := 'https://gxgytumhknmnwspxjzxw.supabase.co/functions/v1/automation-runner',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || coalesce((select decrypted_secret from vault.decrypted_secrets where name = 'pamarket_automation_anon_key'), ''),
      'x-automation-secret', coalesce((select decrypted_secret from vault.decrypted_secrets where name = 'automation_secret'), '')
    ),
    body := '{}'::jsonb
  );
  $cron$
);

-- Verification (run manually after applying):
--   -- confirm the schedule is active
--   select jobid, jobname, schedule, active from cron.job where jobname = 'automation-runner-tick';
--
--   -- fire it once immediately and read the gateway response directly —
--   -- this must NOT be UNAUTHORIZED_NO_AUTH_HEADER
--   select net.http_post(
--     url := 'https://gxgytumhknmnwspxjzxw.supabase.co/functions/v1/automation-runner',
--     headers := jsonb_build_object(
--       'Content-Type','application/json',
--       'Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name='pamarket_automation_anon_key'),
--       'x-automation-secret',(select decrypted_secret from vault.decrypted_secrets where name='automation_secret')
--     ),
--     body := '{}'::jsonb
--   );
--   select status, content::text from net._http_response order by created desc limit 1;
--
--   -- after 15-30 minutes, confirm new notification rows are actually
--   -- being generated
--   select type, count(*), max(created_at) from public.notifications
--     where created_at > now() - interval '1 hour' group by type;
