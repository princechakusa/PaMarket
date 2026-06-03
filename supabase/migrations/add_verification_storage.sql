-- Verification storage + company verification (self-guarding / safe to re-run).
-- Parts that reference existing tables (profiles, verifications) only run if those
-- tables exist, so this never errors on a missing relation.
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor).

-- 1. Private bucket for verification documents
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('verification-docs','verification-docs',false,8388608,
  array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

-- Per-user folder access (always safe)
drop policy if exists "verifdocs user insert" on storage.objects;
create policy "verifdocs user insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'verification-docs' and split_part(name,'/',1) = auth.uid()::text);

drop policy if exists "verifdocs user select" on storage.objects;
create policy "verifdocs user select" on storage.objects for select to authenticated
  using (bucket_id = 'verification-docs' and split_part(name,'/',1) = auth.uid()::text);

drop policy if exists "verifdocs user delete" on storage.objects;
create policy "verifdocs user delete" on storage.objects for delete to authenticated
  using (bucket_id = 'verification-docs' and split_part(name,'/',1) = auth.uid()::text);

-- Admin read of all verification files — only if a profiles table exists.
do $$
begin
  if to_regclass('public.profiles') is not null then
    execute 'drop policy if exists "verifdocs admin select" on storage.objects';
    execute 'create policy "verifdocs admin select" on storage.objects for select to authenticated using (bucket_id = ''verification-docs'' and auth.uid()::text in (select id::text from public.profiles where role = ''admin''))';
  end if;
end $$;

-- 2. Identity verification path columns — only if a verifications table exists.
do $$
begin
  if to_regclass('public.verifications') is not null then
    execute 'alter table public.verifications add column if not exists id_doc_path text';
    execute 'alter table public.verifications add column if not exists selfie_path text';
  end if;
end $$;

-- 3. Company verification table (new — always create)
create table if not exists public.company_verifications (
  user_id       uuid primary key,
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

drop policy if exists "companyverif user insert" on public.company_verifications;
create policy "companyverif user insert" on public.company_verifications for insert to authenticated
  with check (user_id::text = auth.uid()::text);

drop policy if exists "companyverif user update" on public.company_verifications;
create policy "companyverif user update" on public.company_verifications for update to authenticated
  using (user_id::text = auth.uid()::text);

drop policy if exists "companyverif user select" on public.company_verifications;
create policy "companyverif user select" on public.company_verifications for select to authenticated
  using (user_id::text = auth.uid()::text);

-- Admin policies for company verification — only if a profiles table exists.
do $$
begin
  if to_regclass('public.profiles') is not null then
    execute 'drop policy if exists "companyverif admin select" on public.company_verifications';
    execute 'create policy "companyverif admin select" on public.company_verifications for select to authenticated using (auth.uid()::text in (select id::text from public.profiles where role = ''admin''))';
    execute 'drop policy if exists "companyverif admin update" on public.company_verifications';
    execute 'create policy "companyverif admin update" on public.company_verifications for update to authenticated using (auth.uid()::text in (select id::text from public.profiles where role = ''admin''))';
    -- Company verification status flags on profiles
    execute 'alter table public.profiles add column if not exists company_verified boolean default false';
    execute 'alter table public.profiles add column if not exists company_verification_pending boolean default false';
  end if;
end $$;
