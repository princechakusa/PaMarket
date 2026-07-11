-- ============================================================
-- PaMarket — lock down public.listings RLS (run once in SQL Editor)
-- ============================================================
-- SECURITY FIX. As found on 2026-07-11, the public anon key could INSERT
-- listings under ANY seller_id and UPDATE listings it did not own — i.e.
-- anyone on the internet (the anon key ships in every web page) could
-- create fake listings under other accounts and edit/hijack live listings.
-- DELETE happened to be blocked, so the policy set was inconsistent.
--
-- Root cause: the SELECT / INSERT / regular-user UPDATE policies on
-- public.listings were created ad hoc in the dashboard (never in a
-- migration) and were either granted `to public` or used `using (true)`,
-- so the anon role passed them. The only migration-tracked policies were
-- "listings: admin update" and "listings: own delete".
--
-- This migration drops EVERY existing policy on the table and recreates a
-- correct, complete set (read / insert / update / admin-update / delete).
-- Safe to run more than once. It does NOT touch the Phase A moderation
-- BEFORE INSERT/UPDATE trigger, which continues to run on top of RLS.
--
-- Run this as the postgres/service role via the Supabase SQL Editor (which
-- bypasses RLS), so the probe-row cleanup at the bottom also succeeds.
-- ============================================================

alter table public.listings enable row level security;

-- Depend on the existing recursion-safe admin check.
-- (Defined in admin_security_hardening.sql; recreated here idempotently so
--  this migration is self-contained and safe to run standalone.)
create or replace function public.is_admin()
returns boolean language sql security definer stable
set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;
grant execute on function public.is_admin() to authenticated;

-- ── Drop EVERY existing policy on public.listings ───────────────────
-- Critical: Postgres ORs permissive policies together, so if any old
-- permissive policy (created in the dashboard under an unpredictable name)
-- survived, it would still let the anon role write. Remove all of them so
-- ONLY the correct policies created below remain in force.
do $$
declare p record;
begin
  for p in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'listings'
  loop
    execute format('drop policy if exists %I on public.listings', p.policyname);
  end loop;
end $$;

-- ── SELECT ──────────────────────────────────────────────────────────
-- Anyone (anon + authenticated) may read ACTIVE listings — public
-- marketplace. A signed-in owner additionally sees their own listings in
-- any status (pending/flagged/removed/sold) so "My Ads" and the owner
-- view on /detail keep working. Admins see everything.
create policy "listings: public read active" on public.listings
  for select
  using (
    status = 'active'
    or auth.uid() = seller_id
    or public.is_admin()
  );

-- ── INSERT ──────────────────────────────────────────────────────────
-- Only a signed-in user, and only for a row whose seller_id is THEIR OWN
-- id. Closes the "post under any account" hole.
create policy "listings: insert own" on public.listings
  for insert to authenticated
  with check (auth.uid() = seller_id);

-- ── UPDATE — owner ──────────────────────────────────────────────────
-- A user may update ONLY their own listing and may not reassign it away
-- (with check pins seller_id to themselves).
create policy "listings: update own" on public.listings
  for update to authenticated
  using (auth.uid() = seller_id)
  with check (auth.uid() = seller_id);

-- ── UPDATE — admin moderation (recreated; was dropped above) ────────
-- Admins may approve/reject/remove ANY listing. Postgres ORs the two
-- permissive UPDATE policies, so admins keep full moderation power.
create policy "listings: admin update" on public.listings
  for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ── DELETE — owner or admin (recreated; was dropped above) ──────────
create policy "listings: own delete" on public.listings
  for delete
  using (auth.uid() = seller_id or public.is_admin());

-- ── Clean up the security-probe row created during discovery ────────
-- Left as status='removed' (invisible in browse) because anon DELETE was
-- blocked. This runs as the service role in the SQL Editor, so it deletes.
delete from public.listings
where id = '4ed045f1-0c13-488c-8bd0-879db3ecd052'
  and seller_id = '00000000-0000-0000-0000-000000000000'
  and title = '__contract_probe__';
