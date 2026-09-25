-- ============================================================
-- Jobs Reconstruction Phase 3 — Migration 1 of 6: Taxonomy
-- Run manually in Supabase Studio SQL Editor, in file-number order.
-- Idempotent: safe to re-run (create table if not exists, on conflict
-- do nothing for seed rows).
-- ============================================================

begin;

create table if not exists public.job_types (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  label text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true
);

create table if not exists public.job_industries (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  label text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true
);

alter table public.job_types enable row level security;
alter table public.job_industries enable row level security;

drop policy if exists "job_types: public read" on public.job_types;
create policy "job_types: public read" on public.job_types
  for select using (is_active);

drop policy if exists "job_industries: public read" on public.job_industries;
create policy "job_industries: public read" on public.job_industries
  for select using (is_active);

-- Admin-only write. Mirrors rental_categories/rental_brands: no insert/
-- update/delete policy is granted to anon/authenticated at all — writes
-- happen via the service role (Studio / admin tooling), same as those
-- tables' established pattern.
drop policy if exists "job_types: admin write" on public.job_types;
create policy "job_types: admin write" on public.job_types
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "job_industries: admin write" on public.job_industries;
create policy "job_industries: admin write" on public.job_industries
  for all using (public.is_admin()) with check (public.is_admin());

insert into public.job_types (slug, label, sort_order) values
  ('full_time', 'Full-time', 1),
  ('part_time', 'Part-time', 2),
  ('contract', 'Contract', 3),
  ('freelance', 'Freelance', 4),
  ('internship', 'Internship', 5)
on conflict (slug) do nothing;

-- Consolidated 20-category taxonomy — merges the 10 categories previously
-- hardcoded in apps/mobile/lib/jobs.ts (JOB_CATEGORIES) with the 20
-- previously hardcoded in post-job.html (INDUSTRIES). No category from
-- either source list is dropped; overlapping concepts are merged under one
-- label (e.g. mobile's "Healthcare" + website's "Healthcare / Medical" →
-- "Healthcare & Medical"). See Stage 4 report for the full merge mapping.
insert into public.job_industries (slug, label, sort_order) values
  ('accounting_finance',     'Accounting & Finance', 1),
  ('administration_office',  'Administration & Office', 2),
  ('agriculture_farming',    'Agriculture & Farming', 3),
  ('construction_trades',    'Construction & Trades', 4),
  ('customer_service',       'Customer Service', 5),
  ('driving_logistics',      'Driving & Logistics', 6),
  ('education_training',     'Education & Training', 7),
  ('engineering',            'Engineering', 8),
  ('events_hospitality',     'Events & Hospitality', 9),
  ('general_worker_labour',  'General Worker & Labour', 10),
  ('healthcare_medical',     'Healthcare & Medical', 11),
  ('human_resources',        'Human Resources', 12),
  ('it_technology',          'IT & Technology', 13),
  ('legal',                  'Legal', 14),
  ('manufacturing',          'Manufacturing', 15),
  ('sales_marketing',        'Sales & Marketing', 16),
  ('ngo_development',        'NGO & Development', 17),
  ('retail',                 'Retail', 18),
  ('security',               'Security', 19),
  ('other',                  'Other', 20)
on conflict (slug) do nothing;

commit;

-- Verification:
--   select count(*) from public.job_types;      -- expect 5
--   select count(*) from public.job_industries;  -- expect 20
