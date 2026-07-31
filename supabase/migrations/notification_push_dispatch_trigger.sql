-- ============================================================
-- PaMarket — dispatch a push for every notification, not just some
-- (run once in SQL Editor)
--
-- BUG FOUND: chat message pushes reach the Android tray (notify-message is
-- a dedicated webhook straight to FCM) and a handful of scheduled types
-- reach it via scheduled_notifications -> automation-runner -> send-push.
-- But ~20 other notification types (rental listing/company decisions,
-- business verification/suspension, new reviews, new leads, job application
-- status changes, admin/moderation notices) are written by triggers that
-- insert straight into public.notifications and stop there. No push was
-- ever sent for them, so they only ever appeared in the in-app
-- Notifications screen, never the OS tray.
--
-- FIX: a single AFTER INSERT trigger on public.notifications calls the new
-- dispatch-notification-push edge function (via pg_net, same mechanism
-- already wired for automation-runner in schedule_automation_runner.sql) for
-- any row that hasn't been pushed yet. push_sent guards against double
-- sending rows that send-push already pushed itself when it inserted them.
--
-- MANUAL STEP REQUIRED: deploy the dispatch-notification-push edge function
-- (supabase functions deploy dispatch-notification-push) and set its
-- AUTOMATION_SECRET secret to the SAME value already configured for
-- automation-runner.
--
-- Safe to run more than once.
-- ============================================================

alter table public.notifications add column if not exists push_sent boolean not null default false;

-- Rows send-push inserts itself already got a push in that same call —
-- mark all pre-existing rows as "handled" so this migration never triggers
-- a flood of pushes for years of historical notifications.
update public.notifications set push_sent = true where push_sent = false;

create or replace function public.dispatch_pending_notification_push()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, net
as $$
begin
  if coalesce(new.push_sent, false) = false then
    perform net.http_post(
      url := 'https://gxgytumhknmnwspxjzxw.supabase.co/functions/v1/dispatch-notification-push',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-automation-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'automation_secret')
      ),
      body := jsonb_build_object('notificationId', new.id)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists notifications_dispatch_push on public.notifications;
create trigger notifications_dispatch_push
  after insert on public.notifications
  for each row
  execute function public.dispatch_pending_notification_push();

-- Verification (run manually, after deploying the edge function):
--   -- trigger a type that previously never pushed, e.g. approve a rental
--   -- listing/company in admin.html, then check:
--   select id, type, push_sent, created_at from public.notifications
--     order by created_at desc limit 5;
