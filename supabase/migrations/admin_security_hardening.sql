-- ============================================================
-- PaMarket — admin & security hardening (run once in SQL Editor)
-- Ensures every admin action is locked to admins at the database level, and
-- closes the reports read-leak. Regular users remain restricted to their own
-- data. Safe to run more than once.
-- ============================================================

-- Recursion-safe admin check (SECURITY DEFINER bypasses RLS on profiles).
create or replace function public.is_admin()
returns boolean language sql security definer stable
set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;
grant execute on function public.is_admin() to authenticated;

-- ── profiles: admins may moderate (verify / ban), users only their own row ──
drop policy if exists "profiles admin update" on public.profiles;
create policy "profiles admin update" on public.profiles
  for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ── listings: admins may moderate ANY listing (approve/reject/remove) ──
drop policy if exists "listings: admin update" on public.listings;
create policy "listings: admin update" on public.listings
  for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "listings: own delete" on public.listings;
create policy "listings: own delete" on public.listings
  for delete using (auth.uid() = seller_id or public.is_admin());

-- ── reports: only the reporter or an admin may read (was readable by anyone) ──
alter table public.reports enable row level security;
drop policy if exists "Users read own reports" on public.reports;
drop policy if exists "reports: read own or admin" on public.reports;
create policy "reports: read own or admin" on public.reports
  for select to authenticated
  using (public.is_admin() or reporter_id = auth.uid()::text);

drop policy if exists "reports: admin update" on public.reports;
create policy "reports: admin update" on public.reports
  for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ── paid_ads / app_settings: admin-only writes, public read (re-assert) ──
drop policy if exists "paid_ads admin write" on public.paid_ads;
create policy "paid_ads admin write" on public.paid_ads
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "app_settings admin write" on public.app_settings;
create policy "app_settings admin write" on public.app_settings
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
