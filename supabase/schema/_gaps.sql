-- ═══════════════════════════════════════════════════════════════
-- Gaps: tables/buckets the app uses that had no schema file.
-- (Appended to COMPLETE_SETUP.sql.)
-- ═══════════════════════════════════════════════════════════════

-- ── Identity verifications ──────────────────────────────────
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

drop policy if exists "verif own select" on public.verifications;
create policy "verif own select" on public.verifications for select to authenticated
  using (user_id::text = auth.uid()::text);
drop policy if exists "verif own insert" on public.verifications;
create policy "verif own insert" on public.verifications for insert to authenticated
  with check (user_id::text = auth.uid()::text);
drop policy if exists "verif own update" on public.verifications;
create policy "verif own update" on public.verifications for update to authenticated
  using (user_id::text = auth.uid()::text);
drop policy if exists "verif admin select" on public.verifications;
create policy "verif admin select" on public.verifications for select to authenticated
  using (auth.uid()::text in (select id::text from public.profiles where role = 'admin'));
drop policy if exists "verif admin update" on public.verifications;
create policy "verif admin update" on public.verifications for update to authenticated
  using (auth.uid()::text in (select id::text from public.profiles where role = 'admin'));

-- ── Paid ads / promotions (admin-managed) ───────────────────
create table if not exists public.paid_ads (
  id          text primary key,
  title       text,
  image_url   text,
  link_url    text,
  placement   text,
  active      boolean not null default true,
  impressions integer not null default 0,
  clicks      integer not null default 0,
  starts_at   timestamptz,
  ends_at     timestamptz,
  created_at  timestamptz not null default now()
);
alter table public.paid_ads enable row level security;

drop policy if exists "paid_ads public read" on public.paid_ads;
create policy "paid_ads public read" on public.paid_ads for select using (true);
drop policy if exists "paid_ads admin write" on public.paid_ads;
create policy "paid_ads admin write" on public.paid_ads for all to authenticated
  using (auth.uid()::text in (select id::text from public.profiles where role = 'admin'))
  with check (auth.uid()::text in (select id::text from public.profiles where role = 'admin'));

-- ── App settings (single config row, id = 1) ────────────────
create table if not exists public.app_settings (
  id         integer primary key default 1,
  key        text unique,
  value      jsonb,
  settings   jsonb default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.app_settings enable row level security;

drop policy if exists "app_settings public read" on public.app_settings;
create policy "app_settings public read" on public.app_settings for select using (true);
drop policy if exists "app_settings admin write" on public.app_settings;
create policy "app_settings admin write" on public.app_settings for all to authenticated
  using (auth.uid()::text in (select id::text from public.profiles where role = 'admin'))
  with check (auth.uid()::text in (select id::text from public.profiles where role = 'admin'));

-- ── Storage buckets used by the app that lacked creation SQL ─
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chat-images','chat-images', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('cv-files','cv-files', true, 5242880, array['application/pdf','image/jpeg','image/png','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict (id) do nothing;

drop policy if exists "chat-images auth upload" on storage.objects;
create policy "chat-images auth upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'chat-images');
drop policy if exists "chat-images public read" on storage.objects;
create policy "chat-images public read" on storage.objects for select
  using (bucket_id = 'chat-images');

drop policy if exists "cv-files auth upload" on storage.objects;
create policy "cv-files auth upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'cv-files');
drop policy if exists "cv-files public read" on storage.objects;
create policy "cv-files public read" on storage.objects for select
  using (bucket_id = 'cv-files');
