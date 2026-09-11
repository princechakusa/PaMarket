-- PaMarket C2C-2: require native Supabase MFA assurance for the first
-- high-risk admin mutations. Ordinary profile edits and read paths are
-- deliberately outside this migration.

begin;

do $preflight$
begin
  if to_regprocedure('public.profiles_guard_privileged()') is null then
    raise exception 'C2C-2 abort: profiles_guard_privileged() is missing';
  end if;
  if to_regprocedure('public.amos_set_integration_credential(text,text,text)') is null then
    raise exception 'C2C-2 abort: AMOS credential function is missing';
  end if;
  if (select count(*) from public.profiles where role = 'super_admin') <> 1 then
    raise exception 'C2C-2 abort: expected exactly one super_admin profile';
  end if;
  if exists (
    select 1
    from public.profiles p
    where p.role = 'super_admin'
      and not exists (
        select 1
        from auth.mfa_factors f
        where f.user_id = p.id
          and f.factor_type = 'totp'
          and f.status = 'verified'
      )
  ) then
    raise exception 'C2C-2 abort: super_admin has no verified TOTP factor';
  end if;
end
$preflight$;

create or replace function public.has_mfa_aal2()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2';
$$;

comment on function public.has_mfa_aal2() is
  'C2C-2: true only when the trusted request JWT carries aal=aal2. A missing claim is treated as aal1. Reads no user_metadata.';

revoke all on function public.has_mfa_aal2() from public;
revoke execute on function public.has_mfa_aal2() from anon;
grant execute on function public.has_mfa_aal2() to authenticated;

create or replace function public.profiles_guard_privileged()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_guarded_change boolean :=
       new.role is distinct from old.role
    or new.verified is distinct from old.verified
    or new.company_verified is distinct from old.company_verified
    or new.status is distinct from old.status
    or new.ban_reason is distinct from old.ban_reason
    or new.ban_until is distinct from old.ban_until
    or new.verification_pending is distinct from old.verification_pending
    or new.admin_notes is distinct from old.admin_notes;
begin
  if not v_guarded_change then
    return new;
  end if;

  if auth.role() = 'service_role' then
    return new;
  end if;

  if public.is_admin() then
    if not public.has_mfa_aal2() then
      raise exception 'mfa_required' using errcode = '42501';
    end if;
    return new;
  end if;

  -- Preserve the C2B behavior for ordinary and specialist roles: guarded
  -- values are re-pinned while an allowed field in the same UPDATE can pass.
  new.role                 := old.role;
  new.verified             := old.verified;
  new.company_verified     := old.company_verified;
  new.status               := old.status;
  new.ban_reason           := old.ban_reason;
  new.ban_until            := old.ban_until;
  new.verification_pending := old.verification_pending;
  new.admin_notes          := old.admin_notes;
  return new;
end;
$$;

comment on function public.profiles_guard_privileged() is
  'C2C-2: preserves the C2B guarded profile fields. Admin and super_admin require aal2 when a guarded value changes; service_role bypasses; all other roles have guarded values re-pinned.';

revoke all on function public.profiles_guard_privileged() from public;
revoke execute on function public.profiles_guard_privileged() from anon;
revoke execute on function public.profiles_guard_privileged() from authenticated;
grant execute on function public.profiles_guard_privileged() to service_role;

create or replace function public.amos_set_integration_credential(
  p_provider text,
  p_secret_name text,
  p_secret_value text
)
returns void
language plpgsql
security definer
set search_path = 'public', 'vault'
as $$
declare
  v_secret_id uuid;
begin
  if auth.role() <> 'service_role' then
    if not public.is_super_admin() then
      raise exception 'Only super_admin can connect AMOS integrations';
    end if;
    if not public.has_mfa_aal2() then
      raise exception 'mfa_required' using errcode = '42501';
    end if;
  end if;

  select id into v_secret_id from vault.secrets where name = p_secret_name;
  if v_secret_id is null then
    perform vault.create_secret(p_secret_value, p_secret_name, 'AMOS integration credential: ' || p_provider);
  else
    perform vault.update_secret(v_secret_id, p_secret_value);
  end if;

  update public.amos_integrations
  set status = 'connected', credentials_ref = p_secret_name,
      consecutive_failures = 0, auto_disabled = false, updated_at = now()
  where provider = p_provider;
end;
$$;

comment on function public.amos_set_integration_credential(text,text,text) is
  'C2C-2: authenticated callers must be super_admin with aal2. Trusted service_role remains available. Credential values are never included in errors.';

revoke execute on function public.amos_set_integration_credential(text,text,text) from public;
revoke execute on function public.amos_set_integration_credential(text,text,text) from anon;
grant execute on function public.amos_set_integration_credential(text,text,text) to authenticated;
grant execute on function public.amos_set_integration_credential(text,text,text) to service_role;

notify pgrst, 'reload schema';

commit;
