-- ============================================================
-- Jobs Reconstruction Phase 3 — Migration 4 of 6: Application lifecycle
-- Run AFTER migrations 1-3.
-- Extends applications.status as a strict SUPERSET of the existing 3
-- values — 'pending' is kept exactly as-is (the one real production
-- application is currently status='pending' and must remain valid with no
-- data rewrite). New states are added, not substituted.
-- ============================================================

begin;

-- ---- Extend status to the full lifecycle ----
alter table public.applications drop constraint if exists applications_status_check;
alter table public.applications add constraint applications_status_check
  check (status in ('pending','reviewing','shortlisted','interview','offered','hired','declined','withdrawn'));

-- ---- Transition authorization: a trigger, not just RLS ----
-- RLS (below) decides WHO may attempt an update; this trigger decides
-- WHICH transition is actually valid, regardless of who attempts it —
-- defense in depth, and the one place the whole state machine is defined
-- (not duplicated between client and server).
create or replace function public.validate_application_status_transition()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_is_employer boolean;
  v_is_applicant boolean;
begin
  if old.status = new.status then
    return new; -- no-op update to some other column path; nothing to validate
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
    -- Forward-only pipeline, plus "declined" reachable from any active state.
    if not (
      (old.status = 'pending'     and new.status in ('reviewing','shortlisted','declined')) or
      (old.status = 'reviewing'   and new.status in ('shortlisted','declined')) or
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

drop trigger if exists applications_validate_status_transition on public.applications;
create trigger applications_validate_status_transition
  before update of status on public.applications
  for each row execute function public.validate_application_status_transition();

-- ---- RLS: allow the applicant to attempt a withdraw update; the trigger
-- above is what actually restricts it to status='withdrawn' from a
-- non-terminal state. Employer policy's with-check widened to the full
-- status set (the trigger still gates which specific transition is legal).
drop policy if exists "applications: employer update" on public.applications;
create policy "applications: employer update"
  on public.applications for update to authenticated
  using (exists (select 1 from public.listings j where j.id = job_id and j.seller_id = auth.uid()))
  with check (
    exists (select 1 from public.listings j where j.id = job_id and j.seller_id = auth.uid())
    and status in ('pending','reviewing','shortlisted','interview','offered','hired','declined')
  );

drop policy if exists "applications: applicant withdraw" on public.applications;
create policy "applications: applicant withdraw"
  on public.applications for update to authenticated
  using (applicant_id = auth.uid())
  with check (applicant_id = auth.uid() and status = 'withdrawn');

-- ---- application_events: append-only audit trail ----
create table if not exists public.application_events (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  event_type text not null check (event_type in (
    'submitted','status_changed','interview_scheduled','note_added','withdrawn'
  )),
  actor_id uuid references auth.users(id),
  actor_role text check (actor_role in ('applicant','employer','system')),
  detail jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists application_events_application_idx on public.application_events(application_id, created_at desc);

alter table public.application_events enable row level security;

drop policy if exists "application_events: read" on public.application_events;
create policy "application_events: read"
  on public.application_events for select to authenticated
  using (
    exists (
      select 1 from public.applications a
      where a.id = application_events.application_id
        and (a.applicant_id = auth.uid()
             or exists (select 1 from public.listings l where l.id = a.job_id and l.seller_id = auth.uid()))
    )
    or public.is_moderator()
  );
-- No insert/update/delete policy for anon/authenticated — events are
-- written only by the trigger below (security definer) and future RPCs,
-- never directly by a client, so the audit trail can't be forged.

create or replace function public.log_application_event()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.application_events (application_id, event_type, actor_id, actor_role, detail)
    values (new.id, 'submitted', new.applicant_id, 'applicant', jsonb_build_object('job_id', new.job_id));
    return new;
  end if;

  if tg_op = 'UPDATE' and old.status is distinct from new.status then
    insert into public.application_events (application_id, event_type, actor_id, actor_role, detail)
    values (
      new.id,
      case when new.status = 'withdrawn' then 'withdrawn'
           when new.status = 'interview' then 'interview_scheduled'
           else 'status_changed' end,
      auth.uid(),
      case when auth.uid() = new.applicant_id then 'applicant' else 'employer' end,
      jsonb_build_object('from', old.status, 'to', new.status)
    );
    return new;
  end if;

  return new;
end;
$$;

drop trigger if exists applications_log_event on public.applications;
create trigger applications_log_event
  after insert or update of status on public.applications
  for each row execute function public.log_application_event();

-- ---- application_notes: employer-private, never applicant-visible ----
-- Must be a separate table, not a column on applications: the existing
-- "applications: read" policy already grants the applicant SELECT on
-- their own row's every column, so a private-note column on applications
-- itself would leak to the applicant. This table has no policy granting
-- the applicant any access at all.
create table if not exists public.application_notes (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  employer_id uuid not null references auth.users(id) on delete cascade,
  note text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists application_notes_application_idx on public.application_notes(application_id);

alter table public.application_notes enable row level security;

drop policy if exists "application_notes: employer only" on public.application_notes;
create policy "application_notes: employer only"
  on public.application_notes for all to authenticated
  using (
    employer_id = auth.uid()
    and exists (
      select 1 from public.applications a
      join public.listings l on l.id = a.job_id
      where a.id = application_notes.application_id and l.seller_id = auth.uid()
    )
  )
  with check (employer_id = auth.uid());

drop trigger if exists application_notes_set_updated_at on public.application_notes;
create trigger application_notes_set_updated_at
  before update on public.application_notes
  for each row execute function public.set_updated_at();

-- Employer-added notes are logged into the same audit trail (without the
-- note text itself, to avoid duplicating employer-private content into a
-- table applicants can list event types for).
create or replace function public.log_application_note_event()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.application_events (application_id, event_type, actor_id, actor_role, detail)
  values (new.application_id, 'note_added', new.employer_id, 'employer', '{}'::jsonb);
  return new;
end;
$$;

drop trigger if exists application_notes_log_event on public.application_notes;
create trigger application_notes_log_event
  after insert on public.application_notes
  for each row execute function public.log_application_note_event();

-- ---- Screening-question shape validation ----
-- PostgreSQL CHECK constraints cannot contain a subquery at all (error
-- 0A000), even a correlated one referencing only the row's own column —
-- this is a hard parser restriction, not a data issue. The per-element key
-- check is done in a small IMMUTABLE helper function instead; the CHECK
-- just calls it. jsonb_array_elements() naturally returns 0 rows for '[]',
-- so `not exists(... where not ...)` is vacuously true for an empty array —
-- no separate empty-array branch needed.
create or replace function public.jsonb_array_elements_have_keys(arr jsonb, keys text[])
returns boolean
language sql immutable parallel safe
as $$
  select not exists (
    select 1 from jsonb_array_elements(arr) elem
    where not (elem ?& keys)
  );
$$;

-- Scoped to category='jobs' only via the constraint's own condition, so
-- no other category's use of these generic jsonb columns is restricted.
alter table public.listings drop constraint if exists jobs_custom_questions_shape;
alter table public.listings add constraint jobs_custom_questions_shape check (
  category <> 'jobs' or custom_questions is null or (
    jsonb_typeof(custom_questions) = 'array'
    and public.jsonb_array_elements_have_keys(custom_questions, array['question'])
  )
);

alter table public.applications drop constraint if exists applications_answers_shape;
alter table public.applications add constraint applications_answers_shape check (
  answers is null or (
    jsonb_typeof(answers) = 'array'
    and public.jsonb_array_elements_have_keys(answers, array['question','answer'])
  )
);

commit;

-- Verification:
--   select conname from pg_constraint where conrelid = 'public.applications'::regclass;
--   select * from public.application_events order by created_at desc limit 5; -- expect 1 'submitted' event for the existing application
--   -- Confirm the existing application's status='pending' still satisfies the new check:
--   select id, status from public.applications; -- must not error, must still show 'pending'
