-- ─────────────────────────────────────────────────────────────
-- reviews table  (seller ratings)
-- ─────────────────────────────────────────────────────────────

create table if not exists public.reviews (
  id            uuid primary key default gen_random_uuid(),
  seller_id     uuid not null references auth.users(id) on delete cascade,
  reviewer_id   uuid not null references auth.users(id) on delete cascade,
  reviewer_name text not null default '',
  rating        smallint not null check (rating between 1 and 5),
  text          text not null default '',
  created_at    timestamptz not null default now(),

  -- One review per reviewer per seller
  unique (seller_id, reviewer_id),
  -- Reviewers cannot review themselves
  check (seller_id <> reviewer_id)
);

create index if not exists reviews_seller_idx   on public.reviews (seller_id, created_at desc);
create index if not exists reviews_reviewer_idx on public.reviews (reviewer_id);

alter table public.reviews enable row level security;

-- Anyone can read reviews — public marketplace
drop policy if exists "reviews: public read" on public.reviews;
create policy "reviews: public read"
  on public.reviews for select
  using (true);

-- Authenticated users can leave a review (as themselves, not for themselves)
drop policy if exists "reviews: own insert" on public.reviews;
create policy "reviews: own insert"
  on public.reviews for insert
  with check (
    auth.uid() = reviewer_id
    and auth.uid() <> seller_id
  );

-- Reviewers can delete their own reviews
drop policy if exists "reviews: own delete" on public.reviews;
create policy "reviews: own delete"
  on public.reviews for delete
  using (auth.uid() = reviewer_id);
