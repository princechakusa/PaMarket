-- ─────────────────────────────────────────────────────────────
-- BUSINESS ADMIN VISIBILITY + REALTIME — 2026-06
--
-- Symptom: a newly created business (status = 'pending_activation')
-- never appears in admin.html for review, so it can never be approved
-- and never reaches the Home "Local Shops" section.
--
-- Root cause: the businesses SELECT policy only exposes rows where
--   status = 'active' OR owner_user_id = auth.uid()
-- so an admin (a different user) cannot read other users' pending rows.
-- The "businesses: admin all" policy that fixes this was missing from
-- the deployed database. This migration (re)creates it idempotently.
--
-- Safe to re-run.
-- ─────────────────────────────────────────────────────────────

-- is_admin(): true when the caller's profile has role = 'admin'.
create or replace function public.is_admin() returns boolean
  language sql stable as $$
    select exists (select 1 from public.profiles p
                   where p.id = auth.uid() and p.role = 'admin')
  $$;
grant execute on function public.is_admin() to authenticated;

-- Admins can read AND manage every business (any status), so pending
-- submissions show up in admin.html and can be approved to 'active'.
drop policy if exists "businesses: admin all" on public.businesses;
create policy "businesses: admin all" on public.businesses for all
  using (public.is_admin()) with check (public.is_admin());

-- The admin business view also loads subscriptions and verifications.
drop policy if exists "biz_subs: admin all" on public.business_subscriptions;
create policy "biz_subs: admin all" on public.business_subscriptions for all
  using (public.is_admin()) with check (public.is_admin());

-- business_verifications may not exist in all deployments; skip gracefully.
do $$
begin
  if exists (
    select from pg_tables
    where schemaname = 'public' and tablename = 'business_verifications'
  ) then
    execute $p$drop policy if exists "biz_verif: admin all" on public.business_verifications$p$;
    execute $p$create policy "biz_verif: admin all" on public.business_verifications for all
      using (public.is_admin()) with check (public.is_admin())$p$;
  end if;
end $$;

-- Realtime: once an admin approves a business, the UPDATE event must reach
-- every open app instantly so it appears in Home "Local Shops" without a
-- manual refresh. REPLICA IDENTITY FULL lets clients match the changed row.
alter table public.businesses replica identity full;
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'businesses'
  ) then
    execute 'alter publication supabase_realtime add table public.businesses';
  end if;
end $$;

notify pgrst, 'reload schema';
