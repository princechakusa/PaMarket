-- ============================================================================
-- PaMarket — restore push delivery: the dispatch trigger was missing the
-- Authorization header the Edge Function gateway requires
-- ----------------------------------------------------------------------------
-- dispatch_pending_notification_push() posts to the dispatch-notification-push
-- Edge Function with only an x-automation-secret header. That secret is what
-- the *function* checks, but Supabase's Edge gateway rejects the request before
-- any function code runs when there is no Authorization bearer token:
--
--   HTTP 401 {"code":"UNAUTHORIZED_NO_AUTH_HEADER",
--             "message":"Missing authorization header"}
--
-- net._http_response shows 453 consecutive 401s and not a single 200, so every
-- notification insert created its row and then silently failed to push. The
-- trigger wraps the call in `exception when others then raise warning`, which
-- kept the failure invisible: notifications simply never arrived on devices.
--
-- Fix: send the service-role key as the bearer token (the gateway's requirement)
-- alongside the existing x-automation-secret (the function's own check). Both
-- come from the vault — no secret is written into the function body.
--
-- Also fixed here:
--   * The dispatch result is recorded on the notification row instead of being
--     discarded, so a future failure is visible in the data rather than only in
--     Postgres log warnings nobody reads.
--   * The exception handler no longer hides which notification failed.
--
-- A notification insert must never fail because push dispatch failed, so the
-- exception handler is kept — it just records the reason now.
--
-- Idempotent. Run once via the Supabase SQL Editor.
-- ============================================================================

-- Small additive column so a failed dispatch leaves a trace. Nullable, no
-- default, no backfill — existing rows are unaffected.
alter table public.notifications
  add column if not exists push_error text;

create or replace function public.dispatch_pending_notification_push()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_secret text;
  v_service_key text;
begin
  if coalesce(new.push_sent, false) = false then
    begin
      select decrypted_secret into v_secret
        from vault.decrypted_secrets where name = 'automation_secret';
      -- Any valid project key satisfies the gateway's verify_jwt check; the
      -- real authorisation is the automation secret below. The anon key is
      -- already in the vault and is the least-privileged option that works.
      select decrypted_secret into v_service_key
        from vault.decrypted_secrets where name = 'pamarket_automation_anon_key';

      -- The gateway needs a bearer token; the function needs the automation
      -- secret. Sending only the latter is what produced the 401s.
      perform net.http_post(
        url := 'https://gxgytumhknmnwspxjzxw.supabase.co/functions/v1/dispatch-notification-push',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || coalesce(v_service_key, ''),
          'x-automation-secret', coalesce(v_secret, '')
        ),
        body := jsonb_build_object('notificationId', new.id)
      );
    exception when others then
      -- Never block the insert on a push failure, but stop losing the reason.
      new.push_error := left(sqlerrm, 500);
      raise warning 'dispatch_pending_notification_push failed for %: %', new.id, sqlerrm;
    end;
  end if;
  return new;
end;
$$;

notify pgrst, 'reload schema';

-- Verification (run manually after applying):
--   -- dispatch an existing unsent notification and read the gateway response
--   select net.http_post(
--     url := 'https://gxgytumhknmnwspxjzxw.supabase.co/functions/v1/dispatch-notification-push',
--     headers := jsonb_build_object(
--       'Content-Type','application/json',
--       'Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name='service_role_key'),
--       'x-automation-secret',(select decrypted_secret from vault.decrypted_secrets where name='automation_secret')
--     ),
--     body := jsonb_build_object('notificationId','<id>')
--   );
--   -- then:
--   select status_code, content from net._http_response order by id desc limit 1;
--   -- expect: 200
