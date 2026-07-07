-- ============================================================================
-- R1 — Profiles security hardening (owner-or-staff base read)
--
-- Builds on fix_profiles_anon_read_exposure.sql (which blocked the anon role).
-- This closes the remaining vector: a signed-in user could still read ANOTHER
-- user's sensitive base-table columns (two_factor_secret, wallet_usd, cv,
-- ban_reason, push_subscription) because the authenticated policy was still
-- `using (true)`.
--
-- New rule: the base public.profiles row is readable only by
--   * its owner            (auth.uid() = id), or
--   * a moderator / admin  (public.is_moderator(), which checks role in
--                           ('admin','moderator') and is SECURITY DEFINER so it
--                           does not recurse through this policy).
--
-- All public *display* data (name, avatar, verified, last_seen, privacy,
-- phone, email, …) is served by the public.profiles_public security-barrier
-- view, which the website and the app's cross-user reads use. This keeps seller
-- names/avatars, chat avatars, presence and lead/reviewer names working while
-- private columns never reach a stranger's client.
--
-- App reads updated to profiles_public alongside this migration:
--   app.js (seller cards), messages.js (chat avatar),
--   realtime-extras.js (presence), business-profile.js (owner lookup),
--   rentals-business.js (lead names), rentals.js (reviewer names).
-- All remaining base-table reads are own-row (loadProfile, 2FA, settings) or
-- run as staff (admin panel), so they satisfy the policy unchanged.
-- ============================================================================

drop policy if exists "profiles: public read"        on public.profiles;
drop policy if exists "profiles: authenticated read"  on public.profiles;

create policy "profiles: owner or staff read"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = id or public.is_moderator());

-- Verification (run after applying):
--   -- as a non-owner, non-staff authenticated user:
--   set local role authenticated;
--   set local request.jwt.claim.sub = '<some-other-user-uuid>';
--   select count(*) from public.profiles where id <> '<other-user-uuid>'::uuid; -- expect 0
--   select count(*) from public.profiles_public;                                -- expect > 0
