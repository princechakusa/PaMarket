-- CRITICAL — found during live production verification, 2026-07-23.
--
-- Confirmed live: an anonymous request (public anon key, no auth) could read
-- every column of every row in public.profiles, including email, phone,
-- wallet_usd, ban_reason, two_factor_enabled, verification_pending, cv, and
-- push_subscription — all 42 production users.
--
-- Root cause: two migrations already in this repo directly conflict.
-- harden_profiles_owner_or_staff_read.sql restricts SELECT to
-- `auth.uid() = id or is_moderator()`. But security_hardening_2026_06.sql
-- (line ~157) DROPS and RE-CREATES a policy literally named
-- "profiles: public read" with `using (true)` — fully public. Postgres RLS
-- policies for the same command are OR'd together, so as long as that
-- using(true) policy exists at all, it alone grants anon/authenticated read
-- access to the whole table regardless of any other, stricter policy present.
-- Whichever of those two migrations ran later (or ran at all — this project
-- has had migrations in this repo go unapplied before, see
-- fix_message_rate_limit.sql / moderation_backend_phase_a.sql), the
-- using(true) policy is what's active in production right now.
--
-- Fix: drop every existing SELECT policy on public.profiles by name (not
-- assuming which ones exist) and leave exactly one: owner-or-staff. INSERT/
-- DELETE policies are untouched (out of scope for this leak, and their
-- current definitions aren't captured in this migration history, so we don't
-- risk touching what we can't see). The two known-good UPDATE policies are
-- re-asserted by exact name, matching the "re-assert to guard against
-- migration ordering issues" precedent already used in this repo.

do $policy_cleanup$
declare
  p record;
begin
  for p in
    select policyname
    from pg_policies
    where schemaname = 'public' and tablename = 'profiles' and cmd = 'SELECT'
  loop
    execute format('drop policy %I on public.profiles', p.policyname);
  end loop;
end
$policy_cleanup$;

alter table public.profiles enable row level security;

-- Defensive: this project has had migrations from this repo go unapplied
-- before (see fix_message_rate_limit.sql's discovery that moderation_settings
-- didn't exist). is_admin() is referenced below by the admin update policy —
-- recreate it defensively rather than assume admin_security_hardening.sql ran.
create or replace function public.is_admin()
returns boolean language sql security definer stable
set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;
grant execute on function public.is_admin() to authenticated;

create policy "profiles: owner or staff read"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = id or public.is_moderator());

-- Re-assert the two known-good UPDATE policies (own-row with role-freeze,
-- and admin) in case either was also affected by the same drift.
drop policy if exists "profiles: own update" on public.profiles;
create policy "profiles: own update"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and role = (select role from public.profiles where id = auth.uid())
  );

drop policy if exists "profiles admin update" on public.profiles;
create policy "profiles admin update" on public.profiles
  for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

notify pgrst, 'reload schema';

-- Verification (run after applying):
--   -- as anon (no Authorization / anon key only):
--   select count(*) from public.profiles;                      -- expect RLS to block (0 rows or 401/403 via PostgREST, since anon has no policy at all now)
--   -- as a non-owner, non-staff authenticated user:
--   select count(*) from public.profiles where id <> auth.uid(); -- expect 0
--   -- as the owner:
--   select id from public.profiles where id = auth.uid();        -- expect 1 row
