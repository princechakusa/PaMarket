-- ============================================================
-- Jobs hiring pipeline: interview scheduling, cancellation, hiring close-out
-- and candidate notifications at every stage.
-- Run AFTER the jobs_recon_01..06 migrations. Idempotent.
--
-- Clients can only UPDATE applications.status directly (column-level grant
-- from 202608200002), so every interview field below is written exclusively
-- by the security-definer RPCs in this file, each of which verifies that the
-- caller owns the job.
-- ============================================================

begin;

-- ---- Interview details on the application row ----
-- The applicant already has SELECT on their own row, which is exactly who
-- should see these (date, place, link, instructions). Employer-private notes
-- stay in application_notes.
alter table public.applications
  add column if not exists interview_at timestamptz,
  add column if not exists interview_mode text,
  add column if not exists interview_location text,
  add column if not exists interview_link text,
  add column if not exists interview_notes text,
  add column if not exists interview_status text,
  add column if not exists interview_updated_at timestamptz;

alter table public.applications drop constraint if exists applications_interview_mode_check;
alter table public.applications add constraint applications_interview_mode_check
  check (interview_mode is null or interview_mode in ('in_person','video','phone'));

alter table public.applications drop constraint if exists applications_interview_status_check;
alter table public.applications add constraint applications_interview_status_check
  check (interview_status is null or interview_status in ('scheduled','rescheduled','cancelled'));

-- Only http(s) links, so a stored link can never become a javascript: URL
-- when rendered as an anchor on the website.
alter table public.applications drop constraint if exists applications_interview_link_check;
alter table public.applications add constraint applications_interview_link_check
  check (interview_link is null or interview_link ~* '^https?://[^\s]+$');

-- ---- State machine: an interview can be scheduled straight from a new or
-- under-review application (previously only from shortlisted). Everything
-- else is unchanged from jobs_recon_04.
create or replace function public.validate_application_status_transition()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_is_employer boolean;
  v_is_applicant boolean;
begin
  if old.status = new.status then
    return new;
  end if;

  select exists(select 1 from public.listings l where l.id = new.job_id and l.seller_id = auth.uid())
    into v_is_employer;
  v_is_applicant := (auth.uid() = new.applicant_id);

  if v_is_applicant and not v_is_employer then
    if new.status <> 'withdrawn' then
      raise exception 'applicant_can_only_withdraw';
    end if;
    if old.status in ('hired','declined','withdrawn') then
      raise exception 'application_already_finalized';
    end if;
    return new;
  end if;

  if v_is_employer then
    if new.status = 'withdrawn' then
      raise exception 'employer_cannot_withdraw';
    end if;
    if old.status in ('hired','declined','withdrawn') then
      raise exception 'application_already_finalized';
    end if;
    if not (
      (old.status = 'pending'     and new.status in ('reviewing','shortlisted','interview','declined')) or
      (old.status = 'reviewing'   and new.status in ('shortlisted','interview','declined')) or
      (old.status = 'shortlisted' and new.status in ('interview','declined')) or
      (old.status = 'interview'   and new.status in ('offered','declined')) or
      (old.status = 'offered'     and new.status in ('hired','declined'))
    ) then
      raise exception 'invalid_status_transition: % -> %', old.status, new.status;
    end if;
    return new;
  end if;

  raise exception 'not_authorized_for_status_change';
end;
$$;

-- ---- Audit trail: new interview event types ----
alter table public.application_events drop constraint if exists application_events_event_type_check;
alter table public.application_events add constraint application_events_event_type_check
  check (event_type in (
    'submitted','status_changed','interview_scheduled','interview_rescheduled',
    'interview_cancelled','note_added','withdrawn'
  ));

-- ---- Candidate notifications for every stage change ----
-- The INSERT branch (employer gets "New job application") is unchanged.
-- 'interview' is deliberately not notified here: schedule_application_interview
-- sends a richer notification that includes the date and place.
create or replace function public.notify_job_application_events()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_employer uuid;
  v_company text;
  v_title text;
  v_body text;
  v_type text;
begin
  select seller_id into v_employer from public.listings where id = new.job_id;
  if v_employer is null then
    raise warning 'notify_job_application_events: missing job % for application %', new.job_id, new.id;
    return new;
  end if;

  if tg_op = 'INSERT' then
    begin
      insert into public.notifications (id, user_id, title, body, type, category, meta)
      values (
        gen_random_uuid()::text,
        v_employer::text,
        'New job application',
        coalesce(nullif(new.applicant_name, ''), 'A candidate') || ' applied for "' || new.job_title || '".',
        'job_application_received',
        'jobs',
        jsonb_build_object(
          'application_id', new.id,
          'job_id', new.job_id,
          'deepLink', 'JobApplications?jobId=' || new.job_id
        )
      ) on conflict do nothing;
    exception when others then
      raise warning 'notify_job_application_events: insert notification failed for %: %', new.id, sqlerrm;
    end;
    return new;
  end if;

  if old.status is not distinct from new.status
     or new.status not in ('reviewing','shortlisted','offered','hired','declined') then
    return new;
  end if;

  v_company := coalesce(nullif(new.company, ''), 'The employer');
  case new.status
    when 'reviewing' then
      v_type := 'job_viewed';
      v_title := 'Your application was viewed';
      v_body := v_company || ' viewed your application for "' || new.job_title || '".';
    when 'shortlisted' then
      v_type := 'job_shortlisted';
      v_title := 'You have been shortlisted';
      v_body := v_company || ' shortlisted you for "' || new.job_title || '".';
    when 'offered' then
      v_type := 'job_offered';
      v_title := 'You have a job offer';
      v_body := v_company || ' extended an offer for "' || new.job_title || '". Open PaMarket to respond.';
    when 'hired' then
      v_type := 'job_hired';
      v_title := 'Congratulations, you got the job';
      v_body := v_company || ' hired you for "' || new.job_title || '".';
    else
      v_type := 'job_declined';
      v_title := 'Application update';
      v_body := v_company || ' decided not to move forward with your application for "' || new.job_title || '".';
  end case;

  begin
    insert into public.notifications (id, user_id, title, body, type, category, meta)
    values (
      gen_random_uuid()::text,
      new.applicant_id::text,
      v_title,
      v_body,
      v_type,
      'jobs',
      jsonb_build_object('application_id', new.id, 'job_id', new.job_id, 'status', new.status, 'deepLink', 'AppliedJobs')
    );
  exception when others then
    raise warning 'notify_job_application_events: status notification failed for %: %', new.id, sqlerrm;
  end;
  return new;
end;
$$;

-- ---- Helper: load an application the caller owns as employer ----
create or replace function public.employer_application_or_raise(p_application_id uuid)
returns public.applications
language plpgsql stable security definer set search_path = public as $$
declare
  v_app public.applications;
begin
  select a.* into v_app
  from public.applications a
  join public.listings l on l.id = a.job_id
  where a.id = p_application_id and l.seller_id = auth.uid();
  if not found then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  return v_app;
end;
$$;
revoke all on function public.employer_application_or_raise(uuid) from public, anon, authenticated;

-- ---- Schedule or reschedule an interview ----
create or replace function public.schedule_application_interview(
  p_application_id uuid,
  p_at timestamptz,
  p_mode text,
  p_location text default null,
  p_link text default null,
  p_notes text default null
)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_app public.applications;
  v_is_reschedule boolean;
  v_when text;
  v_link text := nullif(btrim(coalesce(p_link, '')), '');
begin
  v_app := public.employer_application_or_raise(p_application_id);

  if v_app.status not in ('pending','reviewing','shortlisted','interview') then
    raise exception 'application_not_open_for_interview';
  end if;
  if p_at is null or p_at <= now() then
    raise exception 'interview_time_must_be_in_the_future';
  end if;
  if p_mode is null or p_mode not in ('in_person','video','phone') then
    raise exception 'invalid_interview_mode';
  end if;
  if v_link is not null and v_link !~* '^https?://[^\s]+$' then
    raise exception 'invalid_interview_link';
  end if;

  v_is_reschedule := v_app.interview_at is not null;

  if v_app.status <> 'interview' then
    -- Goes through the transition + audit triggers like any status change.
    update public.applications set status = 'interview' where id = v_app.id;
  end if;

  update public.applications set
    interview_at = p_at,
    interview_mode = p_mode,
    interview_location = left(nullif(btrim(coalesce(p_location, '')), ''), 300),
    interview_link = left(v_link, 500),
    interview_notes = left(nullif(btrim(coalesce(p_notes, '')), ''), 1000),
    interview_status = case when v_is_reschedule then 'rescheduled' else 'scheduled' end,
    interview_updated_at = now()
  where id = v_app.id;

  if v_is_reschedule or v_app.status = 'interview' then
    insert into public.application_events (application_id, event_type, actor_id, actor_role, detail)
    values (v_app.id, case when v_is_reschedule then 'interview_rescheduled' else 'interview_scheduled' end,
            auth.uid(), 'employer', jsonb_build_object('at', p_at, 'mode', p_mode));
  end if;

  v_when := to_char(p_at at time zone 'Africa/Harare', 'Dy DD Mon YYYY "at" HH24:MI') || ' (CAT)';
  begin
    insert into public.notifications (id, user_id, title, body, type, category, meta)
    values (
      gen_random_uuid()::text,
      v_app.applicant_id::text,
      case when v_is_reschedule then 'Interview rescheduled' else 'Interview invitation' end,
      coalesce(nullif(v_app.company, ''), 'The employer')
        || case when v_is_reschedule then ' moved your interview for "' else ' invited you to an interview for "' end
        || v_app.job_title || '" to ' || v_when || '.',
      'job_interview',
      'jobs',
      jsonb_build_object('application_id', v_app.id, 'job_id', v_app.job_id, 'status', 'interview', 'deepLink', 'AppliedJobs')
    );
  exception when others then
    raise warning 'schedule_application_interview: notification failed for %: %', v_app.id, sqlerrm;
  end;

  return true;
end;
$$;
revoke all on function public.schedule_application_interview(uuid, timestamptz, text, text, text, text) from public, anon;
grant execute on function public.schedule_application_interview(uuid, timestamptz, text, text, text, text) to authenticated;

-- ---- Cancel an interview (the application stays at the interview stage,
-- so the employer can reschedule, extend an offer or decline afterwards) ----
create or replace function public.cancel_application_interview(p_application_id uuid, p_reason text default null)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_app public.applications;
  v_reason text := left(nullif(btrim(coalesce(p_reason, '')), ''), 500);
begin
  v_app := public.employer_application_or_raise(p_application_id);

  if v_app.status <> 'interview' or v_app.interview_at is null or v_app.interview_status = 'cancelled' then
    raise exception 'no_active_interview_to_cancel';
  end if;

  update public.applications set
    interview_status = 'cancelled',
    interview_notes = coalesce(v_reason, interview_notes),
    interview_updated_at = now()
  where id = v_app.id;

  insert into public.application_events (application_id, event_type, actor_id, actor_role, detail)
  values (v_app.id, 'interview_cancelled', auth.uid(), 'employer', jsonb_build_object('reason', v_reason));

  begin
    insert into public.notifications (id, user_id, title, body, type, category, meta)
    values (
      gen_random_uuid()::text,
      v_app.applicant_id::text,
      'Interview cancelled',
      coalesce(nullif(v_app.company, ''), 'The employer') || ' cancelled your interview for "' || v_app.job_title || '".'
        || coalesce(' Reason: ' || v_reason, ''),
      'job_interview_cancelled',
      'jobs',
      jsonb_build_object('application_id', v_app.id, 'job_id', v_app.job_id, 'status', 'interview', 'deepLink', 'AppliedJobs')
    );
  exception when others then
    raise warning 'cancel_application_interview: notification failed for %: %', v_app.id, sqlerrm;
  end;

  return true;
end;
$$;
revoke all on function public.cancel_application_interview(uuid, text) from public, anon;
grant execute on function public.cancel_application_interview(uuid, text) to authenticated;

-- ---- After hiring: decline everyone still in the pipeline for this job.
-- Each row goes through the normal transition trigger and gets the normal
-- "not moving forward" notification. Returns how many were declined.
create or replace function public.decline_remaining_applicants(p_job_id uuid)
returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_count integer;
begin
  if not exists (
    select 1 from public.listings l
    where l.id = p_job_id and l.seller_id = auth.uid() and l.category = 'jobs'
  ) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  update public.applications set status = 'declined'
  where job_id = p_job_id and status not in ('hired','declined','withdrawn');
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke all on function public.decline_remaining_applicants(uuid) from public, anon;
grant execute on function public.decline_remaining_applicants(uuid) to authenticated;

notify pgrst, 'reload schema';

commit;

-- Verification:
--   select column_name from information_schema.columns
--   where table_schema = 'public' and table_name = 'applications' and column_name like 'interview_%';
--   -- expect 7 rows
--   select proname from pg_proc
--   where proname in ('schedule_application_interview','cancel_application_interview','decline_remaining_applicants');
--   -- expect 3 rows
