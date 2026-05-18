-- ─────────────────────────────────────────────────────────────
-- listings table
-- ─────────────────────────────────────────────────────────────

create table if not exists public.listings (
  id          uuid primary key default gen_random_uuid(),
  seller_id   uuid not null references auth.users(id) on delete cascade,
  seller_name text not null default '',
  seller_phone text not null default '',
  title       text not null,
  description text not null default '',
  price       numeric(14,2) not null default 0,
  currency    text not null default 'USD' check (currency in ('USD','ZiG')),
  category    text not null default 'other',
  province    text not null default '',
  city        text not null default '',
  suburb      text not null default '',
  photos      text[] not null default '{}',
  status      text not null default 'active' check (status in ('active','sold','deleted','pending')),
  condition   text check (condition in ('new','like-new','used','refurbished')),
  boost       jsonb,
  views       integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists listings_seller_idx   on public.listings (seller_id);
create index if not exists listings_status_idx   on public.listings (status);
create index if not exists listings_category_idx on public.listings (category);
create index if not exists listings_created_idx  on public.listings (created_at desc);

drop trigger if exists listings_set_updated_at on public.listings;
create trigger listings_set_updated_at
  before update on public.listings
  for each row execute function public.set_updated_at();

alter table public.listings enable row level security;

-- Anyone can read active listings
drop policy if exists "listings: public read active" on public.listings;
create policy "listings: public read active"
  on public.listings for select
  using (status = 'active' or seller_id = auth.uid());

-- Authenticated sellers can insert their own listings
drop policy if exists "listings: own insert" on public.listings;
create policy "listings: own insert"
  on public.listings for insert
  with check (auth.uid() = seller_id);

-- Sellers can update/delete only their own listings
drop policy if exists "listings: own update" on public.listings;
create policy "listings: own update"
  on public.listings for update
  using (auth.uid() = seller_id)
  with check (auth.uid() = seller_id);

drop policy if exists "listings: own delete" on public.listings;
create policy "listings: own delete"
  on public.listings for delete
  using (auth.uid() = seller_id);
