-- ============================================================================
-- Phone / WhatsApp sign-in + phone verification.
--
-- PREREQUISITE (Supabase dashboard, not SQL): Authentication → Providers →
-- Phone → enable, and configure an SMS provider (Twilio recommended; for
-- WhatsApp codes use Twilio with an approved WhatsApp sender). Then switch on
-- Admin → General Settings → Phone / WhatsApp sign-in. Until then the app
-- hides every phone option, so nothing is shown half-working.
--
--   * profiles.phone_verified — mirrors auth.users.phone_confirmed_at. Users
--     cannot write it: profiles UPDATE is column-granted (20260914180000) and
--     this new column is deliberately NOT granted; only the auth trigger
--     below sets it.
--   * profiles_public gains phone_verified for the public "Phone verified"
--     badge (the number itself stays private).
--   * listings_require_phone — enforces Admin → General Settings → Require
--     phone verification, but only while phone sign-in is enabled (otherwise
--     users would have no way to comply).
--
-- Idempotent — safe to re-run. Run AFTER 20260928120000_admin_operational_toggles.sql.
-- ============================================================================

update public.app_settings
set settings = coalesce(settings, '{}'::jsonb)
               || jsonb_build_object('phoneAuthEnabled', coalesce((settings ->> 'phoneAuthEnabled')::boolean, false))
where id = 1;

-- ── 1. phone_verified column, kept in sync with auth.users ─────────────────
alter table public.profiles add column if not exists phone_verified boolean not null default false;
grant select (phone_verified) on public.profiles to authenticated;

create or replace function public.sync_profile_phone_verified()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set phone_verified = (new.phone_confirmed_at is not null and coalesce(new.phone, '') <> ''),
      phone = case
                when new.phone_confirmed_at is not null and coalesce(new.phone, '') <> ''
                  then '+' || ltrim(new.phone, '+')
                else phone
              end
  where id = new.id;
  return new;
end;
$$;

drop trigger if exists trg_sync_profile_phone_verified on auth.users;
create trigger trg_sync_profile_phone_verified
  after insert or update of phone, phone_confirmed_at on auth.users
  for each row execute function public.sync_profile_phone_verified();

-- A phone sign-up creates auth.users before the profiles row exists (the
-- trigger above then updates nothing), so also stamp it when the profile
-- row is created. Always derived from auth.users — never from the client.
create or replace function public.profiles_stamp_phone_verified()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.phone_verified := exists (
    select 1 from auth.users u
    where u.id = new.id and u.phone_confirmed_at is not null and coalesce(u.phone, '') <> ''
  );
  return new;
end;
$$;

drop trigger if exists trg_profiles_stamp_phone_verified on public.profiles;
create trigger trg_profiles_stamp_phone_verified
  before insert on public.profiles
  for each row execute function public.profiles_stamp_phone_verified();

-- Backfill anyone who already confirmed a phone.
update public.profiles p
set phone_verified = true
from auth.users u
where u.id = p.id
  and u.phone_confirmed_at is not null
  and coalesce(u.phone, '') <> ''
  and p.phone_verified is distinct from true;

-- ── 2. Public badge ─────────────────────────────────────────────────────────
-- Production's current (deliberately narrowed) projection, with only
-- phone_verified appended. CREATE OR REPLACE VIEW can only add columns at the
-- end; widening back to role/privacy/language/status would also re-expose
-- columns to anon that a later hardening pass removed.
create or replace view public.profiles_public
with (security_barrier = true)
as
select
  id,
  name,
  avatar,
  verified,
  bio,
  city,
  created_at,
  last_seen,
  null::text as phone,
  phone_verified
from public.profiles;

alter view public.profiles_public owner to postgres;
revoke all on public.profiles_public from public, anon, authenticated;
grant select on public.profiles_public to anon, authenticated, service_role;

-- ── 3. Require phone verification before posting ───────────────────────────
create or replace function public.listings_require_phone()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or public.is_admin() then return new; end if;
  if exists (select 1 from public.listings where id = new.id) then return new; end if; -- upsert-edit
  if not (public.app_setting_bool('requirePhoneVerification', false)
          and public.app_setting_bool('phoneAuthEnabled', false)) then
    return new;
  end if;
  if exists (select 1 from auth.users u where u.id = auth.uid() and u.phone_confirmed_at is not null) then
    return new;
  end if;
  raise exception 'phone_verification_required: verify your phone number before posting'
    using errcode = 'check_violation';
end;
$$;

drop trigger if exists trg_listings_require_phone on public.listings;
create trigger trg_listings_require_phone
  before insert on public.listings
  for each row execute function public.listings_require_phone();

notify pgrst, 'reload schema';
