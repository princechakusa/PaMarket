-- profiles_public exposed `email` to any anon/authenticated caller (the view
-- runs with the definer's privileges, bypassing the owner-or-staff-only RLS
-- that harden_profiles_owner_or_staff_read.sql put on the base `profiles`
-- table). Any visitor could read another user's email via
-- GET /rest/v1/profiles_public?id=eq.<uuid>&select=email — confirmed live.
--
-- `phone` is kept: it powers the WhatsApp/Call contact buttons on listings
-- and profiles, a deliberate zero-signup contact channel. `email` has no
-- equivalent load-bearing feature (only a "mailto:" link on profile.html,
-- which degrades gracefully when the column is absent) and is more sensitive
-- PII, so it is dropped from the public projection.

create or replace view public.profiles_public
  with (security_barrier = true)
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
    phone
    -- Excluded: email, wallet_usd, cv, ban_reason, ban_until,
    --           verification_pending, two_factor_enabled,
    --           notification prefs, and any other internal/staff-only field.
  from public.profiles;

grant select on public.profiles_public to anon, authenticated;

notify pgrst, 'reload schema';
