-- ============================================================
-- PaMarket — lock mfa_secret / two_factor_secret to row owner only
-- (run once in SQL Editor)
--
-- Found during a security audit of admin.html: "profiles: owner or staff
-- read" (harden_profiles_owner_or_staff_read.sql) is a ROW-level policy —
-- auth.uid() = id or public.is_moderator() — so once it lets a moderator
-- read another admin's row at all, that moderator gets EVERY column on that
-- row, including the raw TOTP seed in mfa_secret/two_factor_secret. A
-- 'moderator' role account could read a 'super_admin' row's mfa_secret and
-- mint valid TOTP codes to fully impersonate them, bypassing 2FA entirely.
--
-- Fix: revoke SELECT on just these two columns from `authenticated` at the
-- table-privilege level (column privileges apply independently of, and in
-- addition to, row policies — this closes the column for every row,
-- including the caller's own, no matter who is asking). Reads go through
-- get_my_mfa_secret() below instead, which is SECURITY DEFINER and enforces
-- owner-only via auth.uid() regardless of column grants.
--
-- admin.html is updated in the same change to call
-- sb.rpc('get_my_mfa_secret') instead of selecting the column directly.
--
-- Safe to run more than once.
-- ============================================================

revoke select (mfa_secret, two_factor_secret) on public.profiles from authenticated;

create or replace function public.get_my_mfa_secret()
returns text
language sql stable security definer
set search_path = public as $$
  select mfa_secret from public.profiles where id = auth.uid();
$$;
grant execute on function public.get_my_mfa_secret() to authenticated;

-- Staff still legitimately need to know WHETHER a colleague has 2FA on
-- (admin.html's user-detail modal shows a "2FA" badge) without ever seeing
-- the seed itself. A generated boolean column is visible under the normal
-- "owner or staff" row policy since it carries no secret material.
alter table public.profiles add column if not exists mfa_enabled boolean
  generated always as (mfa_secret is not null) stored;

notify pgrst, 'reload schema';

-- Verification (run after applying):
--   -- as moderator A, try to read admin B's secret directly — expect null/empty column, not an error:
--   select mfa_secret from public.profiles where id = '<other-admin-uuid>';
--   -- as the owner, the RPC still returns the real value:
--   select public.get_my_mfa_secret();
