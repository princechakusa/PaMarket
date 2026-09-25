-- ============================================================
-- Jobs Reconstruction Phase 3 — Migration 5 of 6: Employer profile,
-- seeker preferences, job alerts.
-- Run AFTER migrations 1-4.
-- ============================================================

begin;

-- ---- Employer/company identity: extends the existing recruiter_profiles
-- (already 1:1 with a user, already the entity is_authorized_recruiter()/
-- billing hang off) rather than creating a new companies table or
-- retrofitting `businesses` (which is shared with shops/rentals — out of
-- scope per the task's explicit constraint not to modify unrelated
-- marketplace tables). This is the smallest secure architecture that
-- gives Jobs a real company profile.
alter table public.recruiter_profiles
  add column if not exists company_name text,
  add column if not exists company_logo_url text,
  add column if not exists company_description text,
  add column if not exists company_industry_id uuid references public.job_industries(id),
  add column if not exists company_location text,
  add column if not exists company_website text;

-- Public read of the non-sensitive company fields only, via a narrow view
-- rather than widening recruiter_profiles' own RLS (which stays owner-only
-- for plan/billing columns).
create or replace view public.job_employer_profiles as
select
  rp.user_id,
  rp.company_name,
  rp.company_logo_url,
  rp.company_description,
  ji.label as company_industry_label,
  rp.company_location,
  rp.company_website,
  coalesce(p.company_verified, false) as verified
from public.recruiter_profiles rp
left join public.job_industries ji on ji.id = rp.company_industry_id
left join public.profiles p on p.id = rp.user_id;

grant select on public.job_employer_profiles to anon, authenticated;

-- ---- Seeker structured preferences: additive columns on profiles only.
-- All nullable — per the task's explicit instruction not to force
-- profile completion before browsing Jobs. Existing job_title/skills/
-- sector/exp/open_to_work/expected_salary/cv/cv_file_url/cv_file_path are
-- untouched and unduplicated.
alter table public.profiles
  add column if not exists preferred_job_type_ids uuid[] default '{}',
  add column if not exists preferred_industry_ids uuid[] default '{}',
  add column if not exists preferred_locations text[] default '{}',
  add column if not exists preferred_remote_type text check (preferred_remote_type in ('on_site','hybrid','remote')),
  add column if not exists salary_expectation_min numeric,
  add column if not exists salary_expectation_max numeric;

-- ---- Lightweight recommendations: transparent DB scoring, no AI/ML ----
-- Ranks active jobs for a seeker by simple additive signal overlap against
-- their profile.preferred_* fields (added just above in this same
-- migration — this function must not run before migration 3, where it was
-- originally drafted, since those columns didn't exist yet there; moved
-- here so the function is defined only after its own dependencies are in
-- place). No external dependency, no learned model — every point in the
-- score is explainable.
create or replace function public.recommend_jobs_for_me(p_limit integer default 10)
returns table (
  id uuid, title text, seller_name text, city text, province text,
  job_type_label text, industry_label text, salary_min numeric,
  salary_max numeric, salary_currency text, remote_type text, score integer
)
language plpgsql stable security definer set search_path = public
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    return;
  end if;

  return query
  select
    l.id, l.title, l.seller_name, l.city, l.province,
    jt.label, ji.label, jp.salary_min, jp.salary_max, jp.salary_currency,
    jp.remote_type,
    (
      case when jp.industry_id = any(p.preferred_industry_ids) then 3 else 0 end +
      case when jp.job_type_id = any(p.preferred_job_type_ids) then 2 else 0 end +
      case when jp.remote_type = p.preferred_remote_type then 2 else 0 end +
      case when jp.experience_level = p.exp then 1 else 0 end +
      case when l.city = any(p.preferred_locations) then 1 else 0 end +
      coalesce(cardinality(
        array(select unnest(jp.skills) intersect select unnest(string_to_array(coalesce(p.skills,''), ',')))
      ), 0)
    ) as score
  from public.listings l
  join public.job_postings jp on jp.listing_id = l.id
  left join public.job_types jt on jt.id = jp.job_type_id
  left join public.job_industries ji on ji.id = jp.industry_id
  cross join public.profiles p
  where l.category = 'jobs'
    and l.status = 'active'
    and (l.expires_at is null or l.expires_at > now())
    and p.id = v_user
    and l.seller_id <> v_user
    and not exists (select 1 from public.applications a where a.job_id = l.id and a.applicant_id = v_user)
  order by score desc, l.created_at desc
  limit least(greatest(coalesce(p_limit, 10), 1), 50);
end;
$$;

revoke all on function public.recommend_jobs_for_me(integer) from public;
grant execute on function public.recommend_jobs_for_me(integer) to authenticated;

-- ---- Job alerts: a dedicated, typed model (not the generic
-- saved_searches jsonb blob) since salary-range + multi-select criteria
-- need real columns to filter efficiently and to avoid depending on an
-- untyped filters shape for something as specific as job matching.
create table if not exists public.job_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default '',
  keywords text,
  job_type_id uuid references public.job_types(id),
  industry_id uuid references public.job_industries(id),
  province text,
  city text,
  remote_type text check (remote_type in ('on_site','hybrid','remote')),
  experience_level text check (experience_level in ('entry','mid','senior','expert')),
  salary_min numeric,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  last_notified_at timestamptz
);

create index if not exists job_alerts_user_idx on public.job_alerts(user_id) where is_active;

alter table public.job_alerts enable row level security;

drop policy if exists "job_alerts: owner all" on public.job_alerts;
create policy "job_alerts: owner all"
  on public.job_alerts for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Matching query, exposed as a function rather than a cron job/notification
-- pipeline (no new background infrastructure introduced — a future stage
-- can wire this into the existing saved-search notification job if desired,
-- reusing that infra rather than building a second one). Avoids excessive
-- notification risk by simply being a pull-based "what matches right now"
-- query, not a push mechanism, until that decision is made deliberately.
create or replace function public.jobs_matching_alert(p_alert_id uuid)
returns setof public.listings
language plpgsql stable security definer set search_path = public
as $$
declare
  v_alert public.job_alerts%rowtype;
begin
  select * into v_alert from public.job_alerts where id = p_alert_id and user_id = auth.uid();
  if not found then
    return;
  end if;

  return query
  select l.*
  from public.listings l
  join public.job_postings jp on jp.listing_id = l.id
  where l.category = 'jobs'
    and l.status = 'active'
    and (l.expires_at is null or l.expires_at > now())
    and (v_alert.keywords is null or l.title ilike '%' || v_alert.keywords || '%' or l.description ilike '%' || v_alert.keywords || '%')
    and (v_alert.job_type_id is null or jp.job_type_id = v_alert.job_type_id)
    and (v_alert.industry_id is null or jp.industry_id = v_alert.industry_id)
    and (v_alert.province is null or l.province ilike v_alert.province)
    and (v_alert.city is null or l.city ilike v_alert.city)
    and (v_alert.remote_type is null or jp.remote_type = v_alert.remote_type)
    and (v_alert.experience_level is null or jp.experience_level = v_alert.experience_level)
    and (v_alert.salary_min is null or jp.salary_max is null or jp.salary_max >= v_alert.salary_min)
  order by l.created_at desc
  limit 50;
end;
$$;

revoke all on function public.jobs_matching_alert(uuid) from public;
grant execute on function public.jobs_matching_alert(uuid) to authenticated;

commit;

-- Verification:
--   select * from public.job_employer_profiles limit 1;
--   select column_name from information_schema.columns where table_name='profiles' and column_name like 'preferred_%';
--   select proname from pg_proc where proname = 'recommend_jobs_for_me' and pronamespace = 'public'::regnamespace;
