-- ============================================================
-- Jobs Reconstruction Phase 3 — Migration 2 of 6: job_postings
-- Run AFTER 20260925140000_jobs_recon_01_taxonomy.sql.
-- Idempotent for the table/index/policy/trigger DDL. The backfill INSERT
-- uses `on conflict (listing_id) do nothing`, so re-running this file is
-- also safe and will not duplicate or overwrite backfilled rows.
-- ============================================================

begin;

create table if not exists public.job_postings (
  listing_id uuid primary key references public.listings(id) on delete cascade,

  -- Taxonomy (UUID FKs, per Stage 4 correction — not slug text FKs)
  job_type_id uuid references public.job_types(id),
  industry_id uuid references public.job_industries(id),
  experience_level text check (experience_level in ('entry','mid','senior','expert')),
  remote_type text check (remote_type in ('on_site','hybrid','remote')),
  skills text[] not null default '{}',

  -- Salary
  salary_min numeric check (salary_min is null or salary_min >= 0),
  salary_max numeric check (salary_max is null or salary_max >= salary_min),
  salary_currency text,
  salary_negotiable boolean not null default false,

  -- Structured content. listings.description remains the compatibility
  -- fallback for legacy readers; these columns are the canonical source
  -- once populated. NULL here means "read the legacy description blob
  -- instead" — never an implied absence of content.
  responsibilities text,
  requirements text,
  benefits text,

  -- Application configuration
  how_to_apply_email text,
  how_to_apply_phone text,
  accepts_in_app_applications boolean not null default true,
  application_deadline timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists job_postings_job_type_idx on public.job_postings(job_type_id) where job_type_id is not null;
create index if not exists job_postings_industry_idx on public.job_postings(industry_id) where industry_id is not null;
create index if not exists job_postings_skills_gin_idx on public.job_postings using gin(skills);
create index if not exists job_postings_salary_idx on public.job_postings(salary_min, salary_max);
create index if not exists job_postings_experience_idx on public.job_postings(experience_level) where experience_level is not null;
create index if not exists job_postings_remote_idx on public.job_postings(remote_type) where remote_type is not null;
create index if not exists job_postings_deadline_idx on public.job_postings(application_deadline) where application_deadline is not null;

alter table public.job_postings enable row level security;

drop policy if exists "job_postings: read follows listing visibility" on public.job_postings;
create policy "job_postings: read follows listing visibility"
  on public.job_postings for select
  using (
    exists (
      select 1 from public.listings l
      where l.id = job_postings.listing_id
        and (l.status = 'active' or l.seller_id = auth.uid())
    )
    or public.is_moderator()
  );
-- No insert/update/delete policy for anon/authenticated: writes only
-- through the security-definer RPCs in migration 6 (job_postings_02 does
-- the one-time backfill inside this transaction, running as the migration
-- role, not through RLS).

-- Reuse the existing shared trigger function — do not redefine it.
drop trigger if exists job_postings_set_updated_at on public.job_postings;
create trigger job_postings_set_updated_at
  before update on public.job_postings
  for each row execute function public.set_updated_at();

-- ---- One-time backfill from existing listings.description text ----
-- Extract-then-classify (never scans past the isolated SALARY:/JOB TYPE:/
-- INDUSTRY: line itself), label->id taxonomy lookup (never a raw-text
-- insert into an FK column), NULL on any ambiguous/unmatched value.
-- Includes soft-deleted listings (status='deleted') per the Stage 4
-- decision: deleted listings retain child data in this codebase's
-- established convention (e.g. rental_vehicle_listings keeps its specs/
-- media rows after archiving "so listing history and analytics are
-- preserved" — same reasoning applies here).
insert into public.job_postings (listing_id, job_type_id, industry_id, salary_min, salary_max, salary_currency, salary_negotiable)
select
  l.id,
  jt.id,
  ji.id,
  case
    when salary_raw.val ~* '(negotiable|tbd|competitive)' then null
    when salary_raw.val ~ '^[A-Za-z$]*\s*[0-9]+(\.[0-9]+)?\s*$'
      then (regexp_match(salary_raw.val, '([0-9]+(\.[0-9]+)?)'))[1]::numeric
    else null
  end,
  case
    when salary_raw.val ~* '(negotiable|tbd|competitive)' then null
    when salary_raw.val ~ '^[A-Za-z$]*\s*[0-9]+(\.[0-9]+)?\s*$'
      then (regexp_match(salary_raw.val, '([0-9]+(\.[0-9]+)?)'))[1]::numeric
    else null
  end,
  l.currency,
  coalesce(salary_raw.val ~* '(negotiable|tbd|competitive)', false)
from public.listings l
cross join lateral (
  select nullif(trim(substring(l.description from 'SALARY:\s*([^\n]+)')), '') as val
) salary_raw
left join lateral (
  select trim(substring(l.description from 'JOB TYPE:\s*([^\n]+)')) as val
) job_type_raw on true
left join public.job_types jt on jt.label = job_type_raw.val
left join lateral (
  select trim(substring(l.description from 'INDUSTRY:\s*([^\n]+)')) as val
) industry_raw on true
left join public.job_industries ji on ji.label = industry_raw.val
where l.category = 'jobs'
on conflict (listing_id) do nothing;

commit;

-- Verification (run these after applying):
--   select l.id, l.status, l.title, jt.label as job_type, ji.label as industry,
--          jp.salary_min, jp.salary_max, jp.salary_currency, jp.salary_negotiable
--   from public.listings l
--   left join public.job_postings jp on jp.listing_id = l.id
--   left join public.job_types jt on jt.id = jp.job_type_id
--   left join public.job_industries ji on ji.id = jp.industry_id
--   where l.category = 'jobs';
-- Expect exactly 2 rows (as of this writing): the active "Full charge
-- accountant" job with job_type=Full-time, industry=Accounting & Finance,
-- salary_min=salary_max=300, salary_currency=USD, salary_negotiable=false;
-- and the deleted QA test job with job_type=Full-time, industry=Retail,
-- salary_min/max=NULL, salary_negotiable=true.
