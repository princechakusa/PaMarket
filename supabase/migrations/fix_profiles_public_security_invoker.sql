-- ============================================================================
-- PaMarket — Fix profiles_public Security Definer View (CRITICAL)
-- ----------------------------------------------------------------------------
-- public.profiles_public (created by security_hardening_2026_06.sql) was
-- defined with only `security_barrier = true`, not `security_invoker = true`.
-- Postgres views default to running with the privileges/visibility of the
-- view's OWNER, not the querying user — meaning this view bypasses row-level
-- security on the underlying public.profiles table entirely, regardless of
-- whatever RLS policies fix_profiles_anon_read_exposure.sql and
-- harden_profiles_owner_or_staff_read.sql later applied to profiles itself.
-- Supabase's linter flags this as CRITICAL (0010_security_definer_view).
--
-- The view's column list already excludes sensitive fields (wallet_usd, cv,
-- ban_reason, ban_until, verification_pending, two_factor_enabled,
-- two_factor_secret, push_subscription) — so this was not a full data leak —
-- but it did mean any row-level restriction on WHICH profiles are visible
-- (e.g. hiding banned/deleted accounts, staff-only visibility) was silently
-- bypassed for every anon/authenticated caller going through this view.
--
-- Fix: add security_invoker = true so the view runs with the QUERYING
-- user's own permissions and RLS policies apply normally, exactly as a
-- "safe public read" view is supposed to behave. Column list and grants
-- unchanged.
--
-- Idempotent. Run once in the Supabase SQL Editor.
-- ============================================================================

create or replace view public.profiles_public
  with (security_invoker = true, security_barrier = true)
as
  select
    id,
    name,
    avatar,
    verified,
    role,
    created_at,
    updated_at,
    bio,
    city,
    job_title,
    skills,
    sector,
    exp,
    open_to_work,
    last_seen,
    privacy,
    language,
    status,
    phone,
    email
    -- Excluded: wallet_usd, cv, ban_reason, ban_until,
    --           verification_pending, two_factor_enabled,
    --           two_factor_secret, push_subscription
  from public.profiles;

grant select on public.profiles_public to anon, authenticated;

notify pgrst, 'reload schema';

-- ============================================================================
-- Verification (run manually, not part of the migration):
--
--   select viewowner, reloptions from pg_views
--   join pg_class on pg_class.relname = pg_views.viewname
--   where pg_views.viewname = 'profiles_public';
--   -- reloptions should include security_invoker=true
--
--   set role anon;
--   select count(*) from public.profiles_public;  -- expect > 0, still works
--   reset role;
-- ============================================================================
