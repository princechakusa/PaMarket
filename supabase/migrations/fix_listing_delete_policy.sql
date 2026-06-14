-- Fix listing deletes that "come back" after refresh.
-- Cause: the DELETE row-level-security policy is missing/incorrect in the live
-- DB, so Supabase silently blocks the delete and the next sync re-adds the row.
-- Run in Supabase SQL Editor. Safe to re-run.

alter table public.listings enable row level security;

drop policy if exists "listings: own delete" on public.listings;
create policy "listings: own delete"
  on public.listings for delete
  using (
    auth.uid() = seller_id
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );
