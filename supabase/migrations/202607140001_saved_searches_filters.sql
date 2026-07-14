-- Complete saved searches for the public website.
-- Idempotent and compatible with the original query/category-only table.

create table if not exists public.saved_searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  query text,
  category text,
  saved_at timestamptz not null default now(),
  last_check timestamptz not null default now()
);

alter table public.saved_searches
  add column if not exists name text,
  add column if not exists filters jsonb not null default '{}'::jsonb;

-- The legacy uniqueness rule ignored location and every other filter, so it
-- incorrectly treated distinct searches as duplicates.
alter table public.saved_searches drop constraint if exists uq_saved_search;

update public.saved_searches
set name = coalesce(nullif(query, ''), nullif(category, ''), 'Saved search')
where name is null;

alter table public.saved_searches alter column name set default 'Saved search';

alter table public.saved_searches enable row level security;
grant select, insert, update, delete on public.saved_searches to authenticated;

drop policy if exists "Users manage their own saved searches" on public.saved_searches;
drop policy if exists "saved_searches: own select" on public.saved_searches;
drop policy if exists "saved_searches: own insert" on public.saved_searches;
drop policy if exists "saved_searches: own update" on public.saved_searches;
drop policy if exists "saved_searches: own delete" on public.saved_searches;

create policy "saved_searches: own select" on public.saved_searches
  for select to authenticated using (auth.uid() = user_id);
create policy "saved_searches: own insert" on public.saved_searches
  for insert to authenticated with check (auth.uid() = user_id);
create policy "saved_searches: own update" on public.saved_searches
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "saved_searches: own delete" on public.saved_searches
  for delete to authenticated using (auth.uid() = user_id);

create index if not exists saved_searches_user_saved_idx
  on public.saved_searches (user_id, saved_at desc);

notify pgrst, 'reload schema';
