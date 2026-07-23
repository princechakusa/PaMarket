-- ============================================================
-- fix_job_application_inapp_notify.sql
--
-- GAP (P1-4, 2026-07-23 audit): when an employer shortlists or declines an
-- applicant on applications.html, the applicant gets nothing in their
-- website notifications inbox. trg_notify_job_application
-- (marketplace_notifications_phase2.sql) already fires on this exact status
-- change, but it only inserts into public.scheduled_notifications — a push
-- queue drained by automation-runner, which that same migration's own
-- footer documents as never actually scheduled (no pg_cron entry, no
-- GitHub Action). It does not, and was never meant to, write to
-- public.notifications — the table notifications.html / account-pages.js
-- actually read.
--
-- FIX: extend the EXISTING trigger function (not a new trigger) to also
-- insert into public.notifications on the same status-change branch, using
-- the same real-table shape as the rental notify triggers (id text
-- generated, meta jsonb, category). The insert-of-application branch
-- (employer gets notified of a new applicant) is untouched — out of scope
-- for this fix, which is about notifying the applicant only.
--
-- Duplicate-safe: reuses the trigger's existing guard
-- (OLD.status is distinct from NEW.status and NEW.status in
-- ('shortlisted','declined')), so re-saving the same status is still a
-- no-op — this was already true for the scheduled_notifications insert and
-- now applies identically to the new notifications insert.
--
-- Run once in the Supabase SQL Editor.
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
    begin
      insert into public.scheduled_notifications (target, title, body, type, deep_link, scheduled_for)
      values (
        NEW.applicant_id::text,
        case when NEW.status = 'shortlisted' then '🎉 You''ve been shortlisted!' else 'Application update' end,
        case when NEW.status = 'shortlisted'
          then coalesce(nullif(NEW.company,''), 'The employer') || ' shortlisted you for "' || NEW.job_title || '".'
          else coalesce(nullif(NEW.company,''), 'The employer') || ' decided not to move forward with your application for "' || NEW.job_title
            || '". Keep applying — the right fit is out there.'
        end,
        case when NEW.status = 'shortlisted' then 'job_shortlisted' else 'job_declined' end,
        'AppliedJobs', now()
      );
    exception when others then
      raise warning 'notify_job_application_events: status-notify failed for application %: %', NEW.id, sqlerrm;
    end;

    -- NEW: the in-app notification the website inbox actually reads.
    begin
      insert into public.notifications (id, user_id, title, body, type, category, meta)
      values (
        gen_random_uuid()::text,
        NEW.applicant_id,
        case when NEW.status = 'shortlisted' then 'You''ve been shortlisted!' else 'Application update' end,
        case when NEW.status = 'shortlisted'
          then coalesce(nullif(NEW.company,''), 'The employer') || ' shortlisted you for "' || NEW.job_title || '".'
          else coalesce(nullif(NEW.company,''), 'The employer') || ' decided not to move forward with your application for "' || NEW.job_title || '".'
        end,
        case when NEW.status = 'shortlisted' then 'job_shortlisted' else 'job_declined' end,
        'jobs',
        jsonb_build_object('application_id', NEW.id, 'job_id', NEW.job_id, 'status', NEW.status)
      );
    exception when others then
      raise warning 'notify_job_application_events: in-app notify failed for application %: %', NEW.id, sqlerrm;
    end;
  end if;

  return NEW;
end;
$$;

-- Trigger itself is unchanged (still trg_notify_job_application, still
-- after insert or update of status) — replacing the function is enough.

-- Verification (run after applying):
--   -- 1. Confirm the function body includes the new insert:
--   select prosrc from pg_proc where proname = 'notify_job_application_events';
--   -- 2. As an employer, shortlist/decline a real application in
--   --    applications.html, then as the applicant:
--   select id, user_id, title, type, category, meta, created_at
--   from public.notifications
--   where type in ('job_shortlisted','job_declined')
--   order by created_at desc limit 5;
--   -- 3. Re-click the same status button again (no-op) and confirm no
--   --    second row was inserted for the same application_id.
-- ============================================================
