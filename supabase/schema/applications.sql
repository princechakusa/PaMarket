-- ─────────────────────────────────────────────────────────────
-- applications table  (job applications)
-- ─────────────────────────────────────────────────────────────

create table if not exists public.applications (
  id              uuid primary key default gen_random_uuid(),
  job_id          uuid not null references public.listings(id) on delete cascade,
  job_title       text not null default '',
  company         text not null default '',
  applicant_id    uuid not null references auth.users(id) on delete cascade,
  applicant_name  text not null default '',
  applicant_phone text not null default '',
  applicant_email text not null default '',
  message         text not null default '',
  status          text not null default 'pending'
                    check (status in ('pending','shortlisted','declined')),
  employer_id     uuid not null references auth.users(id) on delete cascade,
  applied_at      timestamptz not null default now(),

  -- Prevent duplicate applications to the same job
  unique (job_id, applicant_id)
);

create index if not exists applications_applicant_idx on public.applications (applicant_id);
create index if not exists applications_employer_idx  on public.applications (employer_id);
create index if not exists applications_job_idx       on public.applications (job_id);

alter table public.applications enable row level security;

-- Applicant can see their own applications
-- Employer can see applications for their jobs
drop policy if exists "applications: read" on public.applications;
create policy "applications: read"
  on public.applications for select
  using (
    auth.uid() = applicant_id
    or auth.uid() = employer_id
  );

-- Only the applicant can submit (and must be themselves)
drop policy if exists "applications: insert" on public.applications;
create policy "applications: insert"
  on public.applications for insert
  with check (auth.uid() = applicant_id);

-- Only the employer can update status
drop policy if exists "applications: employer update" on public.applications;
create policy "applications: employer update"
  on public.applications for update
  using (auth.uid() = employer_id)
  with check (auth.uid() = employer_id);
