-- ============================================================
-- PaMarket — GAP FILL
-- Your database is already fully built (all 19 tables exist and
-- persist data). This script ONLY adds the 6 pieces that were
-- genuinely missing, matched exactly to your live column types.
-- Every comparison here is uuid=uuid or text=text — no text=uuid.
-- Safe to run more than once.
-- ============================================================

-- 1) Identity verification: add the private-storage path columns
--    (your verifications table has id_doc/selfie but not the *_path columns)
alter table public.verifications add column if not exists id_doc_path text;
alter table public.verifications add column if not exists selfie_path text;

-- 2) Profiles: company-verification flags used by the app + admin
alter table public.profiles add column if not exists company_verified boolean default false;
alter table public.profiles add column if not exists company_verification_pending boolean default false;

-- 3) Company verifications table (did not exist)
--    user_id is uuid to match profiles.id and auth.uid()
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

drop policy if exists "companyverif own all" on public.company_verifications;
create policy "companyverif own all" on public.company_verifications
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "companyverif admin read" on public.company_verifications;
create policy "companyverif admin read" on public.company_verifications
  for select to authenticated
  using (auth.uid() in (select id from public.profiles where role = 'admin'));

drop policy if exists "companyverif admin update" on public.company_verifications;
create policy "companyverif admin update" on public.company_verifications
  for update to authenticated
  using (auth.uid() in (select id from public.profiles where role = 'admin'));

-- 4) Private verification-docs storage bucket (did not exist)
--    Files are stored as: <user_id>/<label>_<timestamp>.jpg
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('verification-docs','verification-docs', false, 8388608,
        array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

drop policy if exists "verifdocs own insert" on storage.objects;
create policy "verifdocs own insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'verification-docs' and split_part(name,'/',1) = auth.uid()::text);

drop policy if exists "verifdocs own select" on storage.objects;
create policy "verifdocs own select" on storage.objects for select to authenticated
  using (bucket_id = 'verification-docs' and split_part(name,'/',1) = auth.uid()::text);

drop policy if exists "verifdocs own delete" on storage.objects;
create policy "verifdocs own delete" on storage.objects for delete to authenticated
  using (bucket_id = 'verification-docs' and split_part(name,'/',1) = auth.uid()::text);

drop policy if exists "verifdocs admin select" on storage.objects;
create policy "verifdocs admin select" on storage.objects for select to authenticated
  using (bucket_id = 'verification-docs'
         and auth.uid() in (select id from public.profiles where role = 'admin'));
