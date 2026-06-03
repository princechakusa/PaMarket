-- Verification storage + company verification
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor).
-- Moves sensitive ID/selfie/company images OUT of the database into a PRIVATE
-- Storage bucket, and adds an in-app company verification flow.

-- ─────────────────────────────────────────────────────────────
-- 1. Private bucket for verification documents (ID, selfie, company docs)
--    NOT public — images are only reachable via short-lived signed URLs.
-- ─────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'verification-docs',
  'verification-docs',
  false,
  8388608, -- 8 MB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

-- Files are stored under {auth.uid()}/...  e.g.  <uid>/id_1700000000.jpg
-- A user may write/read/delete only their own folder.
create policy "Users manage their own verification files - insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'verification-docs'
    and split_part(name, '/', 1) = auth.uid()::text
  );

create policy "Users read their own verification files"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'verification-docs'
    and split_part(name, '/', 1) = auth.uid()::text
  );

create policy "Users delete their own verification files"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'verification-docs'
    and split_part(name, '/', 1) = auth.uid()::text
  );

-- Admins (profiles.role = 'admin') may read every verification file for review.
create policy "Admins read all verification files"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'verification-docs'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- ─────────────────────────────────────────────────────────────
-- 2. Identity verifications: store Storage paths instead of base64.
--    (Legacy id_doc / selfie columns are kept for old records.)
-- ─────────────────────────────────────────────────────────────
alter table public.verifications add column if not exists id_doc_path text;
alter table public.verifications add column if not exists selfie_path  text;

-- ─────────────────────────────────────────────────────────────
-- 3. Company verification (in-app). One row per user.
-- ─────────────────────────────────────────────────────────────
create table if not exists public.company_verifications (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  company_name  text,
  reg_cert_path text,   -- Certificate of Incorporation / Business Registration
  owner_id_path text,   -- Owner/Director National ID or passport
  tax_cert_path text,   -- Tax Clearance Certificate (ZIMRA)
  premises_path text,   -- Photo of business premises
  status        text not null default 'pending',  -- pending | approved | rejected
  submitted_at  timestamptz not null default now(),
  reviewed_at   timestamptz
);

alter table public.company_verifications enable row level security;

create policy "Users manage their own company verification - insert"
  on public.company_verifications for insert to authenticated
  with check (user_id = auth.uid());

create policy "Users update their own company verification"
  on public.company_verifications for update to authenticated
  using (user_id = auth.uid());

create policy "Users read their own company verification"
  on public.company_verifications for select to authenticated
  using (user_id = auth.uid());

create policy "Admins read all company verifications"
  on public.company_verifications for select to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

create policy "Admins update all company verifications"
  on public.company_verifications for update to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- ─────────────────────────────────────────────────────────────
-- 4. Profile flags for company verification status
-- ─────────────────────────────────────────────────────────────
alter table public.profiles add column if not exists company_verified boolean default false;
alter table public.profiles add column if not exists company_verification_pending boolean default false;
