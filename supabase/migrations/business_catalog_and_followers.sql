-- ─────────────────────────────────────────────────────────────
-- Business catalog + storefront followers.
-- Run once in the Supabase SQL Editor. Safe to re-run (IF NOT EXISTS).
-- ─────────────────────────────────────────────────────────────

-- Phase C: listings can belong to a business (separate from the personal account).
alter table public.listings
  add column if not exists business_id uuid references public.businesses(id) on delete set null;
create index if not exists listings_business_id_idx on public.listings (business_id);

-- Phase B: storefront followers.
create table if not exists public.business_followers (
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (business_id, user_id)
);
create index if not exists business_followers_biz_idx on public.business_followers (business_id);

alter table public.business_followers enable row level security;

-- Anyone signed in can see follow rows (needed for counts); a user manages only their own follow.
drop policy if exists "biz_followers read" on public.business_followers;
create policy "biz_followers read" on public.business_followers for select using (true);

drop policy if exists "biz_followers follow" on public.business_followers;
create policy "biz_followers follow" on public.business_followers
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "biz_followers unfollow" on public.business_followers;
create policy "biz_followers unfollow" on public.business_followers
  for delete to authenticated using (auth.uid() = user_id);
