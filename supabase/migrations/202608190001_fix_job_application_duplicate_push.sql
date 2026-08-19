-- ============================================================
-- 202608190001_fix_job_application_duplicate_push.sql
--
-- FIX (production audit 2/5, verified live 2026-08-19): the UPDATE branch of
-- notify_job_application_events() (fix_job_application_inapp_notify.sql)
-- inserts into BOTH public.scheduled_notifications (drained by the
-- automation-runner cron -> send-push) AND public.notifications (drained
-- immediately by the notifications_dispatch_push trigger ->
-- dispatch-notification-push). That migration's own header comment says
-- automation-runner "was never actually scheduled (no pg_cron entry...)" —
-- true when it was written, but automation-runner is now live in production
-- (cron.job id 3, "* * * * *", active — confirmed via a live query against
-- the linked project). So today, a single shortlist/decline status change
-- genuinely produces two independent FCM pushes to the same applicant.
--
-- FIX: drop the redundant scheduled_notifications insert from the
-- status-change (UPDATE) branch. The public.notifications insert already
-- covers both needs — it's what the website inbox reads AND it already
-- fires notifications_dispatch_push (notification_push_dispatch_trigger.sql)
-- for a push, same as every other in-app notification type. To not lose
-- anything, the notifications insert's title/body/meta are enriched with the
-- copy and deep link that used to live only on the scheduled_notifications
-- side (the friendlier push-quality wording with emoji, and
-- deep_link='AppliedJobs' — dispatch-notification-push reads
-- notif.meta->>'deepLink').
--
-- The INSERT branch (employer notified of a new applicant) is untouched —
-- out of scope, same as the original fix_job_application_inapp_notify.sql.
-- The UPDATE branch's existing guard (OLD.status is distinct from NEW.status
-- and NEW.status in ('shortlisted','declined')) is unchanged, so this stays
-- duplicate-safe on re-saves exactly as before.
--
-- No data migration: existing historical rows in scheduled_notifications /
-- notifications are untouched, only future trigger firings change.
-- ============================================================

create or replace function public.notify_job_application_events()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if TG_OP = 'INSERT' then
    begin
      insert into public.scheduled_notifications (target, title, body, type, deep_link, scheduled_for)
      values (
        NEW.employer_id::text,
        '📩 New application for "' || NEW.job_title || '"',
        coalesce(nullif(NEW.applicant_name,''), 'A candidate') || ' applied for your job posting "' || NEW.job_title || '".',
        'job_application', 'JobApplications?jobId=' || NEW.job_id, now()
      );
    exception when others then
      raise warning 'notify_job_application_events: insert-notify failed for application %: %', NEW.id, sqlerrm;
    end;
    return NEW;
  end if;

  if TG_OP = 'UPDATE' and OLD.status is distinct from NEW.status and NEW.status in ('shortlisted','declined') then
    -- Canonical path for this event: ONE in-app notification row, which
    -- ALSO drives the ONE push via notifications_dispatch_push ->
    -- dispatch-notification-push. (scheduled_notifications insert removed —
    -- see migration header.)
    begin
      insert into public.notifications (id, user_id, title, body, type, category, meta)
      values (
        gen_random_uuid()::text,
        NEW.applicant_id,
        case when NEW.status = 'shortlisted' then '🎉 You''ve been shortlisted!' else 'Application update' end,
        case when NEW.status = 'shortlisted'
          then coalesce(nullif(NEW.company,''), 'The employer') || ' shortlisted you for "' || NEW.job_title || '".'
          else coalesce(nullif(NEW.company,''), 'The employer') || ' decided not to move forward with your application for "' || NEW.job_title
            || '". Keep applying — the right fit is out there.'
        end,
        case when NEW.status = 'shortlisted' then 'job_shortlisted' else 'job_declined' end,
        'jobs',
        jsonb_build_object(
          'application_id', NEW.id, 'job_id', NEW.job_id, 'status', NEW.status,
          'deepLink', 'AppliedJobs'
        )
      );
    exception when others then
      raise warning 'notify_job_application_events: in-app notify failed for application %: %', NEW.id, sqlerrm;
    end;
  end if;

  return NEW;
end;
$$;

-- Verification (run after applying):
--   -- 1. Confirm the scheduled_notifications insert is gone from the UPDATE
--   --    branch:
--   select prosrc from pg_proc where proname = 'notify_job_application_events';
--   -- 2. As an employer, shortlist/decline a real application, then as the
--   --    applicant confirm exactly ONE new row appears in each table:
--   select count(*) from public.notifications
--     where type in ('job_shortlisted','job_declined')
--       and (meta->>'application_id') = '<application_id>';
--   select count(*) from public.scheduled_notifications
--     where type in ('job_shortlisted','job_declined')
--       and target = '<applicant_id>'
--       and created_at > now() - interval '5 minutes';
--   -- the second count should be 0 for a status change made after this
--   -- migration (older rows from before the fix are expected/untouched).
-- ============================================================
