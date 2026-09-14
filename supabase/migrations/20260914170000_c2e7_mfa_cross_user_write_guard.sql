-- C2E-7: block cross-user writes to the four MFA/2FA columns on profiles.
--
-- Confirmed live before this change: profiles' two broad UPDATE policies
-- ("profiles admin update" using is_admin(), "profiles: admin update"
-- using is_admin_team()) place no column restriction, and the existing
-- trg_profiles_guard_privileged trigger's guarded-field list does not
-- include mfa_secret/mfa_enabled/two_factor_secret/two_factor_enabled —
-- so any staff role could overwrite another user's 2FA/MFA columns via a
-- plain UPDATE.
--
-- This is deliberately a SEPARATE new trigger, not an extension of
-- profiles_guard_privileged: that trigger's model is "admin+AAL2 allowed,
-- everyone else silently reverted" (correct for role/status/ban fields,
-- which ARE legitimately admin-settable on other users' rows). MFA/2FA
-- secrets are different — no legitimate caller, admin included, ever
-- needs to set someone else's 2FA secret, and ordinary users must be able
-- to write their OWN two_factor_secret/two_factor_enabled without any
-- AAL2 requirement (apps/mobile/app/two-factor-setup.tsx's live
-- self-service enrollment flow). Reusing the existing trigger's model
-- as-is would have silently broken that flow for every non-admin user.
--
-- Does not touch: profiles_guard_privileged, has_mfa_aal2(),
-- get_my_mfa_secret(), the profiles RLS policies, any C2E-4/C2E-5/C2E-6
-- object, or www/admin.html.

create or replace function "public"."profiles_guard_mfa_columns"()
returns trigger
language plpgsql
set search_path to ''
as $$
declare
  v_mfa_change boolean :=
       new.mfa_secret is distinct from old.mfa_secret
    or new.two_factor_secret is distinct from old.two_factor_secret
    or new.two_factor_enabled is distinct from old.two_factor_enabled;
begin
  -- mfa_enabled is GENERATED ALWAYS AS (mfa_secret IS NOT NULL) STORED —
  -- no caller can ever set it directly (confirmed live: a direct UPDATE
  -- of it errors with "can only be updated to DEFAULT"), and NEW.<a
  -- generated column> cannot be assigned inside a trigger either, so it
  -- is deliberately left out of both the change-check and the reset
  -- below. Protecting mfa_secret automatically protects it by
  -- construction, since it's derived from mfa_secret alone.
  if not v_mfa_change then
    return new;
  end if;

  if auth.role() = 'service_role' then
    return new;
  end if;

  if auth.uid() = old.id then
    return new;
  end if;

  -- Not the row owner and not service_role: re-pin silently (not raise)
  -- so an UPDATE that also legitimately touches other allowed fields in
  -- the same statement still succeeds, matching profiles_guard_privileged's
  -- existing convention for guarded fields.
  new.mfa_secret := old.mfa_secret;
  new.two_factor_secret := old.two_factor_secret;
  new.two_factor_enabled := old.two_factor_enabled;
  return new;
end;
$$;

drop trigger if exists "trg_profiles_guard_mfa_columns" on "public"."profiles";
create trigger "trg_profiles_guard_mfa_columns"
  before update on "public"."profiles"
  for each row execute function "public"."profiles_guard_mfa_columns"();
