-- =============================================================
-- Fix user_saves RLS + add server-side save/unsave RPCs
-- Idempotent — safe to run multiple times.
-- =============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. Ensure the table and RLS are correct
-- ─────────────────────────────────────────────────────────────
create table if not exists public.user_saves (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  listing_id text not null,
  saved_at   timestamptz not null default now(),
  unique(user_id, listing_id)
);

alter table public.user_saves enable row level security;

-- Grant table-level privileges (required even with RLS policies)
grant select, insert, update, delete on public.user_saves to authenticated;

-- Drop and recreate the policy with explicit text casting and role binding
drop policy if exists "Users manage own saves"    on public.user_saves;
drop policy if exists "user_saves: own select"    on public.user_saves;
drop policy if exists "user_saves: own insert"    on public.user_saves;
drop policy if exists "user_saves: own delete"    on public.user_saves;

create policy "user_saves: own select"
  on public.user_saves for select
  to authenticated
  using (auth.uid()::text = user_id::text);

create policy "user_saves: own insert"
  on public.user_saves for insert
  to authenticated
  with check (auth.uid()::text = user_id::text);

create policy "user_saves: own delete"
  on public.user_saves for delete
  to authenticated
  using (auth.uid()::text = user_id::text);

-- ─────────────────────────────────────────────────────────────
-- 2. Security-definer RPCs — resolve auth.uid() server-side
--    so client-side session edge cases can't cause a mismatch.
-- ─────────────────────────────────────────────────────────────
create or replace function public.save_listing(p_listing_id text)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.user_saves (user_id, listing_id, saved_at)
  values (auth.uid(), p_listing_id, now())
  on conflict (user_id, listing_id) do nothing;
$$;

revoke execute on function public.save_listing(text) from public;
grant  execute on function public.save_listing(text) to authenticated;

create or replace function public.unsave_listing(p_listing_id text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.user_saves
  where  user_id    = auth.uid()
    and  listing_id = p_listing_id;
$$;

revoke execute on function public.unsave_listing(text) from public;
grant  execute on function public.unsave_listing(text) to authenticated;

-- ─────────────────────────────────────────────────────────────
-- 3. Add business_reviews to the realtime publication
--    (fixes "reviews realtime unavailable" channel error)
-- ─────────────────────────────────────────────────────────────
do $$
begin
  alter publication supabase_realtime add table public.business_reviews;
exception when others then
  null; -- already in publication or table does not exist — safe to skip
end;
$$;

notify pgrst, 'reload schema';
