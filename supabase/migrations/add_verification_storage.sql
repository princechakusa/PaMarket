-- Verification storage + company verification (idempotent / safe to re-run)
-- Admin checks avoid any "table.id" token so they don't get mangled on paste.
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor).

-- 1. Private bucket for verification documents (ID, selfie, company docs)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'verification-docs',
  'verification-docs',
  false,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

drop policy if exists "verifdocs user insert" on storage.objects;
create policy "verifdocs user insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'verification-docs' and split_part(name, '/', 1) = auth.uid()::text);

drop policy if exists "verifdocs user select" on storage.objects;
create policy "verifdocs user select"
  on storage.objects for select to authenticated
  using (bucket_id = 'verification-docs' and split_part(name, '/', 1) = auth.uid()::text);

drop policy if exists "verifdocs user delete" on storage.objects;
create policy "verifdocs user delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'verification-docs' and split_part(name, '/', 1) = auth.uid()::text);

drop policy if exists "verifdocs admin select" on storage.objects;
create policy "verifdocs admin select"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'verification-docs'
    and auth.uid()::text in (select id::text from public.profiles where role = 'admin')
  );

-- 2. Identity verifications: store Storage paths instead of base64
alter table public.verifications add column if not exists id_doc_path text;
alter table public.verifications add column if not exists selfie_path  text;

-- 3. Company verification (in-app). One row per user.
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

drop policy if exists "companyverif user insert" on public.company_verifications;
create policy "companyverif user insert"
  on public.company_verifications for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "companyverif user update" on public.company_verifications;
create policy "companyverif user update"
  on public.company_verifications for update to authenticated
  using (user_id = auth.uid());

drop policy if exists "companyverif user select" on public.company_verifications;
create policy "companyverif user select"
  on public.company_verifications for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "companyverif admin select" on public.company_verifications;
create policy "companyverif admin select"
  on public.company_verifications for select to authenticated
  using (auth.uid()::text in (select id::text from public.profiles where role = 'admin'));

drop policy if exists "companyverif admin update" on public.company_verifications;
create policy "companyverif admin update"
  on public.company_verifications for update to authenticated
  using (auth.uid()::text in (select id::text from public.profiles where role = 'admin'));

-- 4. Profile flags for company verification status
alter table public.profiles add column if not exists company_verified boolean default false;
alter table public.profiles add column if not exists company_verification_pending boolean default false;
