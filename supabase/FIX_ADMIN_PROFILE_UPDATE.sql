-- ============================================================
-- PaMarket — let admins moderate profiles (verify / ban / company-verify)
-- The profiles table only allowed users to update their OWN row, so an
-- admin approving a verification updated 0 rows and the verified badge
-- never turned on. This adds an admin-update policy (recursion-safe) and
-- retroactively verifies anyone already approved. Safe to run more than once.
-- ============================================================

-- SECURITY DEFINER avoids infinite recursion when a profiles policy queries profiles
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;
grant execute on function public.is_admin() to authenticated;

drop policy if exists "profiles admin update" on public.profiles;
create policy "profiles admin update" on public.profiles
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Retroactively grant the verified badge to anyone already approved
update public.profiles
set verified = true, verification_pending = false
where id in (select user_id from public.verifications where status = 'approved');
