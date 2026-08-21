-- A normal PaMarket account is not a Candidate Profile. Physical testing
-- found the mobile Apply screen let any authenticated user submit a job
-- application by pre-filling name/email/phone straight off the generic
-- profiles row — with zero check that the user had ever actually built a
-- Candidate Profile (Jobs > Get Hired > Candidate Profile).
--
-- Eligibility rule mirrors the ONE place this product already defines what
-- a "usable" Candidate Profile is: jobs/cv-profile.tsx's own save() gate
-- (job_title, sector, city all required before that screen will save at
-- all). No new/invented requirement — CV and open_to_work are untouched and
-- remain optional/independent, per that same screen's existing behavior.

create or replace function public.has_valid_candidate_profile(p_user_id uuid)
returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = p_user_id
      and nullif(btrim(p.job_title), '') is not null
      and nullif(btrim(p.sector), '') is not null
      and nullif(btrim(p.city), '') is not null
  );
$$;

revoke all on function public.has_valid_candidate_profile(uuid) from public, anon;
grant execute on function public.has_valid_candidate_profile(uuid) to authenticated;

-- Server-side authority: extend the existing INSERT-time authorization
-- trigger (added in 202608200002_release_blocker_recruitment_hardening.sql)
-- rather than adding a second competing trigger. Only the INSERT branch is
-- touched — UPDATE (status changes) is untouched, and this never runs
-- against historical rows, so an application whose applicant's profile was
-- later edited or cleared stays valid exactly as it is today.
create or replace function public.authorize_job_application_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_job public.listings%rowtype;
begin
  if tg_op = 'INSERT' then
    if v_uid is null then
      raise exception 'Authentication required.' using errcode = '42501';
    end if;
    if new.applicant_id is distinct from v_uid then
      raise exception 'Applicant identity must match the authenticated user.' using errcode = '42501';
    end if;
    if not public.has_valid_candidate_profile(v_uid) then
      raise exception 'candidate_profile_required: complete your Candidate Profile before applying.' using errcode = '42501';
    end if;

    select * into v_job from public.listings where id = new.job_id;
    if not found or v_job.category <> 'jobs' then
      raise exception 'Job not found.' using errcode = '23503';
    end if;
    if v_job.status <> 'active'
       or (v_job.expires_at is not null and v_job.expires_at <= now()) then
      raise exception 'This job is not accepting applications.' using errcode = 'check_violation';
    end if;
    if v_job.seller_id = v_uid then
      raise exception 'You cannot apply to your own job.' using errcode = 'check_violation';
    end if;

    -- Client-supplied relationship and display fields are never authoritative.
    new.employer_id := v_job.seller_id;
    new.job_title := v_job.title;
    new.company := coalesce(nullif(btrim(v_job.seller_name), ''), 'Company');
    new.status := 'pending';
    new.applied_at := now();
    return new;
  end if;

  if new.applicant_id is distinct from old.applicant_id
     or new.job_id is distinct from old.job_id
     or new.employer_id is distinct from old.employer_id then
    raise exception 'Application relationship fields are immutable.' using errcode = '42501';
  end if;
  return new;
end;
$$;

-- Defense in depth: the RLS policy's own WITH CHECK gets the same rule, not
-- just the trigger — matches this table's existing belt-and-suspenders style
-- (both an RLS predicate AND a BEFORE INSERT trigger already existed here).
drop policy if exists "applications: insert" on public.applications;
create policy "applications: insert"
  on public.applications for insert to authenticated
  with check (
    applicant_id = auth.uid()
    and public.has_valid_candidate_profile(auth.uid())
    and exists (
      select 1 from public.listings j
      where j.id = job_id
        and j.category = 'jobs'
        and j.status = 'active'
        and (j.expires_at is null or j.expires_at > now())
        and j.seller_id = employer_id
        and j.seller_id <> auth.uid()
    )
  );

notify pgrst, 'reload schema';
