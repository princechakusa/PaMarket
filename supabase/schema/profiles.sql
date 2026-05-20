-- ─────────────────────────────────────────────────────────────
-- profiles table  (one row per auth.users row)
-- Run in Supabase SQL editor.
-- ─────────────────────────────────────────────────────────────

create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  name        text not null default 'User',
  phone       text,
  avatar      text,
  verified    boolean not null default false,
  wallet_usd  numeric(12,2) not null default 0,
  language    text not null default 'English',
  email       text,
  bio         text,
  city        text,
  job_title   text,
  skills      text,
  sector      text,
  exp         text,
  cv          jsonb,
  open_to_work boolean not null default false,
  verification_pending boolean not null default false,
  role        text not null default 'user' check (role in ('user','admin','moderator')),
  status      text not null default 'active' check (status in ('active','banned','suspended')),
  ban_reason  text,
  ban_until   timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists profiles_role_idx on public.profiles (role);

-- auto-update updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Auto-create a bare profile row when a new auth user signs up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', 'User'))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;

-- Anyone (including anon) can read profiles — public marketplace
drop policy if exists "profiles: public read" on public.profiles;
create policy "profiles: public read"
  on public.profiles for select
  using (true);

-- Authenticated users can insert only their own profile
drop policy if exists "profiles: own insert" on public.profiles;
create policy "profiles: own insert"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Users can update only their own profile, and cannot elevate their own role
drop policy if exists "profiles: own update" on public.profiles;
create policy "profiles: own update"
  on public.profiles for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    -- role can only be changed by an admin (via service-role key)
    and role = (select role from public.profiles where id = auth.uid())
  );
