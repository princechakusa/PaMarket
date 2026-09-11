-- Roll back C2C-2 only. This restores the exact C2B/C2B-FIX function
-- behavior and grants captured immediately before the forward migration.

begin;

create or replace function public.profiles_guard_privileged()
returns trigger
language plpgsql
security invoker
set search_path = 'public'
as $$
begin
  if public.is_admin_team() or auth.role() = 'service_role' then
    return new;
  end if;

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
  'C2B: BEFORE UPDATE trigger on public.profiles. Re-pins role, verified, company_verified, status, ban_reason, ban_until, verification_pending, admin_notes to their prior value unless the caller is admin-team (is_admin_team()) or the trusted service_role. Trigger-only — cannot be invoked directly (return type is trigger) and is not directly EXECUTE-granted.';

revoke all on function public.profiles_guard_privileged() from public;
grant execute on function public.profiles_guard_privileged() to public;
grant execute on function public.profiles_guard_privileged() to anon;
grant execute on function public.profiles_guard_privileged() to authenticated;
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
  if not public.is_super_admin() then
    raise exception 'Only super_admin can connect AMOS integrations';
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
  'C2B: guard narrowed from is_admin_team() to is_super_admin() per admin/docs/permissions.md ("integrations.manage ... belongs only to super_admin"). Signature, SECURITY DEFINER, search_path, and EXECUTE grants unchanged.';

revoke execute on function public.amos_set_integration_credential(text,text,text) from public;
revoke execute on function public.amos_set_integration_credential(text,text,text) from anon;
grant execute on function public.amos_set_integration_credential(text,text,text) to authenticated;
grant execute on function public.amos_set_integration_credential(text,text,text) to service_role;

drop function if exists public.has_mfa_aal2();

notify pgrst, 'reload schema';

commit;
