-- ─────────────────────────────────────────────────────────────
-- PaMarket Migration & Fix Script
-- Run this in the Supabase SQL Editor
-- ─────────────────────────────────────────────────────────────

-- 1. Ensure profiles table has verification_pending column
do $$
begin
  if not exists (select 1 from information_schema.columns where table_name='profiles' and table_schema='public' and column_name='verification_pending') then
    alter table public.profiles add column verification_pending boolean not null default false;
  end if;
end $$;

-- 2. Create verifications table
create table if not exists public.verifications (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  id_doc       text, -- Base64 or URL
  selfie       text, -- Base64 or URL
  status       text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  admin_note   text,
  submitted_at timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Index for status
create index if not exists verifications_status_idx on public.verifications (status);

-- Enable RLS
alter table public.verifications enable row level security;

-- Policies for verifications
drop policy if exists "Users can view own verification" on public.verifications;
create policy "Users can view own verification"
  on public.verifications for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own verification" on public.verifications;
create policy "Users can insert own verification"
  on public.verifications for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own verification" on public.verifications;
create policy "Users can update own verification"
  on public.verifications for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Admins can manage all verifications" on public.verifications;
create policy "Admins can manage all verifications"
  on public.verifications
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role = 'admin'
    )
  );

-- 3. Update existing tables if needed
-- Ensure notifications table id is TEXT to accommodate JS-generated UUIDs
-- Note: If id is already UUID, it might fail if JS passes a malformed one.
-- Schema says primary key is TEXT in notifications.sql, so we are good.

-- 4. Enable Realtime
-- Run this manually in the Supabase Dashboard:
-- Database -> Replication -> Enable 'Realtime' for 'verifications', 'notifications', 'listings', 'messages'.
