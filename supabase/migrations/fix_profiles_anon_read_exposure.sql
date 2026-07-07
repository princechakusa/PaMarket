-- ============================================================================
-- SECURITY FIX — profiles base table was readable by the anon role
--
-- Problem (confirmed): the base public.profiles SELECT policy was
--   using (true)   -- applies to PUBLIC, including the anon role
-- so the ENTIRE profiles row was readable with the anon key — including
-- sensitive columns (two_factor_secret, wallet_usd, cv, ban_reason,
-- push_subscription, …). The anon key is embedded in the public website's
-- JavaScript, so anyone could dump these for every user with a single request:
--   GET /rest/v1/profiles?select=id,two_factor_secret,wallet_usd,cv
--
-- The safe public projection public.profiles_public (security-barrier view,
-- created in security_hardening_2026_06.sql) already exposes only non-sensitive
-- columns and is what the public website uses. Views read as their owner, so
-- profiles_public is UNAFFECTED by the base-table policy below.
--
-- Fix: scope the base-table read to the `authenticated` role only. The anon
-- role then has NO select policy on public.profiles and receives zero rows.
--   * Public website (anon): unaffected — it reads public.profiles_public.
--   * Signed-in app / admin panel: unaffected — they read as `authenticated`.
--
-- NOTE (residual, tracked separately): this closes the anonymous vector — the
-- only trivially-exploitable one, since the anon key is public. A signed-in
-- user can still read another user's sensitive columns via the base table
-- (policy is still `using(true)` for authenticated). Fully closing that
-- requires scoping the base read to owner-or-staff
--   using (auth.uid() = id or public.is_moderator())
-- and rerouting the ~6 cross-user app reads to profiles_public. That change
-- touches app query sites and needs live QA, so it is documented in the audit
-- rather than applied blind here.
-- ============================================================================

drop policy if exists "profiles: public read" on public.profiles;

create policy "profiles: authenticated read"
  on public.profiles
  for select
  to authenticated
  using (true);

-- Verification (run after applying):
--   set role anon;          select count(*) from public.profiles;          -- expect 0
--   set role anon;          select count(*) from public.profiles_public;   -- expect > 0 (public view still works)
--   reset role;
