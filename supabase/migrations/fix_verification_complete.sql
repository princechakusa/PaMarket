-- ============================================================
-- PaMarket — Complete verification system DB setup
-- Safe to run multiple times (idempotent).
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. Ensure profiles has all required verification columns
alter table public.profiles add column if not exists verification_pending    boolean not null default false;
alter table public.profiles add column if not exists company_verified        boolean not null default false;
alter table public.profiles add column if not exists company_verification_pending boolean not null default false;
alter table public.profiles add column if not exists company                 text;

-- 2. Identity verifications table (blue-badge flow: ID + selfie)
create table if not exists public.verifications (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  id_doc       text,
  selfie       text,
  id_doc_path  text,
  selfie_path  text,
  status       text not null default 'pending',
  submitted_at timestamptz not null default now(),
  admin_note   text,
  unique (user_id)
);
alter table public.verifications enable row level security;

drop policy if exists "verif own insert"   on public.verifications;
drop policy if exists "verif own update"   on public.verifications;
drop policy if exists "verif own select"   on public.verifications;
drop policy if exists "verif admin select" on public.verifications;
drop policy if exists "verif admin update" on public.verifications;
drop policy if exists "verif_write_own"    on public.verifications;
drop policy if exists "verif_read_all"     on public.verifications;

create policy "verif own insert" on public.verifications
  for insert to authenticated
  with check (user_id = auth.uid());

create policy "verif own update" on public.verifications
  for update to authenticated
  using  (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "verif own select" on public.verifications
  for select to authenticated
  using (user_id = auth.uid());

create policy "verif admin select" on public.verifications
  for select to authenticated
  using (auth.uid() in (select id from public.profiles where role = 'admin'));

create policy "verif admin update" on public.verifications
  for update to authenticated
  using (auth.uid() in (select id from public.profiles where role = 'admin'));

-- 3. Company / individual-employer verifications table (job-posting gate)
create table if not exists public.company_verifications (
  user_id       uuid primary key references auth.users (id) on delete cascade,
  company_name  text,
  reg_cert_path text,
  owner_id_path text,
  tax_cert_path text,
  premises_path text,
  status        text not null default 'pending',
  submitted_at  timestamptz not null default now(),
  reviewed_at   timestamptz
);
alter table public.company_verifications enable row level security;

drop policy if exists "companyverif user insert"  on public.company_verifications;
drop policy if exists "companyverif user update"  on public.company_verifications;
drop policy if exists "companyverif user select"  on public.company_verifications;
drop policy if exists "companyverif admin select" on public.company_verifications;
drop policy if exists "companyverif admin update" on public.company_verifications;

create policy "companyverif user insert" on public.company_verifications
  for insert to authenticated
  with check (user_id = auth.uid());

create policy "companyverif user update" on public.company_verifications
  for update to authenticated
  using  (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "companyverif user select" on public.company_verifications
  for select to authenticated
  using (user_id = auth.uid());

create policy "companyverif admin select" on public.company_verifications
  for select to authenticated
  using (auth.uid() in (select id from public.profiles where role = 'admin'));

create policy "companyverif admin update" on public.company_verifications
  for update to authenticated
  using (auth.uid() in (select id from public.profiles where role = 'admin'));
