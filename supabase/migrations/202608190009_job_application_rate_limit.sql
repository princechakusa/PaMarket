-- ============================================================
-- 202608190009_job_application_rate_limit.sql
--
-- FIX (Audit 3/5 P1, verified live 2026-08-19): applications has
-- UNIQUE(job_id, applicant_id), which stops applying twice to the SAME
-- job, but nothing bounds how many DIFFERENT jobs one account can apply to
-- in a burst. Each insert unconditionally fires trg_notify_job_application
-- (a scheduled_notifications row for the employer) and the notify-application
-- Edge Function sends a real transactional email — confirmed live, no
-- existing throttle of any kind on this table.
--
-- FIX: same proven BEFORE INSERT trigger pattern already live for
-- messages/reports/listings/business_leads, applied to applications,
-- counting by applicant_id.
--
--   max_applications_per_10min = 10
--   max_applications_per_24h   = 20
--
-- Sized for real job-seeker behavior: someone actively job-hunting might
-- reasonably apply to several relevant postings found in one browsing
-- session (a burst of 5-10), and across a full day of searching, apply to
-- perhaps 10-15 jobs total. 10/10min and 20/day sit comfortably above that
-- while bounding a scripted burst that would otherwise flood arbitrary
-- employers with real emails at unlimited scale. Staff exempt, matching
-- every other rate-limit trigger in this codebase.
-- ============================================================

insert into public.moderation_settings (key, int_value)
values
  ('max_applications_per_10min', 10),
  ('max_applications_per_24h', 20)
on conflict (key) do nothing;

create or replace function public.enforce_application_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  burst_lim int;
  burst_cnt int;
  day_lim int;
  day_cnt int;
begin
  if tg_op <> 'INSERT' then
    return new;
  end if;

  if public.is_moderator() then
    return new;
  end if;

  -- Server-authoritative timestamp: prevents backdating out of the window.
  new.applied_at := now();

  select int_value into burst_lim
  from public.moderation_settings
  where key = 'max_applications_per_10min';
  if burst_lim is null then burst_lim := 10; end if;
  if burst_lim > 0 then
    select count(*) into burst_cnt
    from public.applications
    where applicant_id = new.applicant_id
      and applied_at > now() - interval '10 minutes';

    if burst_cnt >= burst_lim then
      raise exception 'rate_limited: too many applications submitted recently. Please wait a little before applying again.'
        using errcode = 'check_violation';
    end if;
  end if;

  select int_value into day_lim
  from public.moderation_settings
  where key = 'max_applications_per_24h';
  if day_lim is null then day_lim := 20; end if;
  if day_lim > 0 then
    select count(*) into day_cnt
    from public.applications
    where applicant_id = new.applicant_id
      and applied_at > now() - interval '24 hours';

    if day_cnt >= day_lim then
      raise exception 'rate_limited: daily application limit reached. Please try again tomorrow.'
        using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_application_rate_limit on public.applications;
create trigger trg_application_rate_limit
  before insert on public.applications
  for each row execute function public.enforce_application_rate_limit();

-- Verification (run after applying):
--   select tgname, tgenabled from pg_trigger where tgrelid='applications'::regclass and tgname='trg_application_rate_limit';
--   select key, int_value from moderation_settings where key like 'max_applications%';
-- ============================================================
