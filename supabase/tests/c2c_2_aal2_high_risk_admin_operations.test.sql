-- C2C-2 database test. Self-contained and always rolled back.
-- It installs the candidate function bodies inside this transaction so the
-- complete suite can run before or after the forward migration is applied.

begin;

create or replace function public.has_mfa_aal2()
returns boolean
language sql stable security invoker set search_path = ''
as $$ select coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2' $$;
revoke all on function public.has_mfa_aal2() from public;
revoke execute on function public.has_mfa_aal2() from anon;
grant execute on function public.has_mfa_aal2() to authenticated;

create or replace function public.profiles_guard_privileged()
returns trigger
language plpgsql security invoker set search_path = ''
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
  if not v_guarded_change then return new; end if;
  if auth.role() = 'service_role' then return new; end if;
  if public.is_admin() then
    if not public.has_mfa_aal2() then
      raise exception 'mfa_required' using errcode = '42501';
    end if;
    return new;
  end if;
  new.role := old.role;
  new.verified := old.verified;
  new.company_verified := old.company_verified;
  new.status := old.status;
  new.ban_reason := old.ban_reason;
  new.ban_until := old.ban_until;
  new.verification_pending := old.verification_pending;
  new.admin_notes := old.admin_notes;
  return new;
end;
$$;

create or replace function public.amos_set_integration_credential(
  p_provider text, p_secret_name text, p_secret_value text
)
returns void
language plpgsql security definer set search_path = 'public', 'vault'
as $$
declare v_secret_id uuid;
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
  set status='connected', credentials_ref=p_secret_name,
      consecutive_failures=0, auto_disabled=false, updated_at=now()
  where provider=p_provider;
end;
$$;

create temporary table c2c2_results (
  n integer primary key,
  test_name text not null,
  passed boolean not null
) on commit drop;
grant insert, select on table c2c2_results to authenticated;

do $test$
declare
  v_super uuid;
  v_users uuid[];
  v_admin uuid; v_moderator uuid; v_support uuid; v_finance uuid;
  v_user uuid; v_target uuid;
  v_before record; v_after record;
  v_blocked boolean; v_ok boolean; v_count integer; v_audit_before integer;
  v_actor uuid; v_role_name text;
begin
  select id into v_super from public.profiles where role='super_admin' limit 1;
  select array_agg(id order by id) into v_users from (
    select id from public.profiles where role='user' order by id limit 6
  ) users;
  if v_super is null or coalesce(array_length(v_users,1),0) < 6 then
    raise exception 'C2C-2 test abort: requires one super_admin and six user profiles';
  end if;
  v_admin:=v_users[1]; v_moderator:=v_users[2]; v_support:=v_users[3];
  v_finance:=v_users[4]; v_user:=v_users[5]; v_target:=v_users[6];

  -- Transaction-only role setup through the explicit service-role path.
  perform set_config('request.jwt.claims', jsonb_build_object('sub',v_super,'role','service_role')::text, true);
  perform set_config('request.jwt.claim.sub', v_super::text, true);
  perform set_config('request.jwt.claim.role', 'service_role', true);
  update public.profiles set role='admin' where id=v_admin;
  update public.profiles set role='moderator' where id=v_moderator;
  update public.profiles set role='support' where id=v_support;
  update public.profiles set role='finance' where id=v_finance;

  select verified, company_verified, status, ban_reason, ban_until,
         verification_pending, admin_notes, bio, role
  into v_before from public.profiles where id=v_target;

  -- 1. Missing aal is treated as aal1.
  perform set_config('request.jwt.claims', jsonb_build_object('sub',v_user,'role','authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_user::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  select not public.has_mfa_aal2() into v_ok;
  reset role;
  insert into c2c2_results values (1,'missing aal fails as aal1',v_ok);

  -- 2-3. User at aal1 or aal2 cannot change guarded own fields.
  foreach v_role_name in array array['aal1','aal2'] loop
    perform set_config('request.jwt.claims', jsonb_build_object('sub',v_user,'role','authenticated','aal',v_role_name)::text, true);
    perform set_config('request.jwt.claim.sub', v_user::text, true);
    set local role authenticated;
    select verified into v_ok from public.profiles where id=v_user;
    update public.profiles set verified=not coalesce(verified,false) where id=v_user;
    reset role;
    select verified is not distinct from v_ok into v_blocked from public.profiles where id=v_user;
    insert into c2c2_results values (
      case v_role_name when 'aal1' then 2 else 3 end,
      'user '||v_role_name||' cannot change guarded fields',v_blocked);
  end loop;

  -- 4-6. Specialist roles at aal2 still have guarded values re-pinned.
  for v_actor,v_role_name in
    select * from (values
      (v_moderator,'moderator'),(v_support,'support'),(v_finance,'finance')
    ) actors(id,role_name)
  loop
    perform set_config('request.jwt.claims', jsonb_build_object('sub',v_actor,'role','authenticated','aal','aal2')::text, true);
    perform set_config('request.jwt.claim.sub', v_actor::text, true);
    set local role authenticated;
    update public.profiles set admin_notes='c2c2-specialist-probe' where id=v_target;
    reset role;
    select admin_notes is not distinct from v_before.admin_notes into v_ok from public.profiles where id=v_target;
    insert into c2c2_results values (
      case v_role_name when 'moderator' then 4 when 'support' then 5 else 6 end,
      v_role_name||' aal2 cannot change guarded fields',v_ok);
  end loop;

  -- 7. Admin at aal1 receives the safe MFA-required error.
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_admin,'role','authenticated','aal','aal1')::text,true);
  perform set_config('request.jwt.claim.sub',v_admin::text,true);
  set local role authenticated;
  v_blocked:=false;
  begin
    update public.profiles set admin_notes='c2c2-admin-aal1' where id=v_target;
  exception when insufficient_privilege then v_blocked:=sqlerrm='mfa_required';
  end;
  reset role;
  insert into c2c2_results values (7,'admin aal1 requires MFA',v_blocked);

  -- 8. Admin at aal2 can change a guarded field.
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_admin,'role','authenticated','aal','aal2')::text,true);
  set local role authenticated;
  update public.profiles set admin_notes='c2c2-admin-aal2' where id=v_target;
  reset role;
  select admin_notes='c2c2-admin-aal2' into v_ok from public.profiles where id=v_target;
  insert into c2c2_results values (8,'admin aal2 changes guarded fields',v_ok);

  -- 9. Super-admin at aal1 receives the same safe error.
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_super,'role','authenticated','aal','aal1')::text,true);
  perform set_config('request.jwt.claim.sub',v_super::text,true);
  v_blocked:=false;
  set local role authenticated;
  begin
    update public.profiles set status='c2c2-super-aal1' where id=v_target;
  exception when insufficient_privilege then v_blocked:=sqlerrm='mfa_required';
  end;
  reset role;
  insert into c2c2_results values (9,'super_admin aal1 requires MFA',v_blocked);

  -- 10 and 13. Super-admin aal2 role change succeeds and is audited.
  select count(*) into v_audit_before from public.role_audit_log where target_id=v_target;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_super,'role','authenticated','aal','aal2')::text,true);
  set local role authenticated;
  update public.profiles set role='moderator' where id=v_target;
  reset role;
  select role='moderator' into v_ok from public.profiles where id=v_target;
  insert into c2c2_results values (10,'super_admin aal2 changes guarded fields',v_ok);
  select count(*)=v_audit_before+1 into v_ok
  from public.role_audit_log where target_id=v_target;
  insert into c2c2_results values (13,'role audit remains active',v_ok);

  -- 11. Service role remains functional for guarded fields.
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_super,'role','service_role')::text,true);
  perform set_config('request.jwt.claim.role','service_role',true);
  update public.profiles set company_verified=not coalesce(company_verified,false) where id=v_target;
  select company_verified is distinct from v_before.company_verified into v_ok from public.profiles where id=v_target;
  insert into c2c2_results values (11,'service_role changes guarded fields',v_ok);

  -- 12. Ordinary user can still edit an allowed own field.
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_user,'role','authenticated','aal','aal1')::text,true);
  perform set_config('request.jwt.claim.sub',v_user::text,true);
  perform set_config('request.jwt.claim.role','authenticated',true);
  set local role authenticated;
  update public.profiles set bio='c2c2-allowed-bio' where id=v_user;
  reset role;
  select bio='c2c2-allowed-bio' into v_ok from public.profiles where id=v_user;
  insert into c2c2_results values (12,'ordinary user edits allowed profile field',v_ok);

  -- 14. Failed privileged writes left the protected target values intact.
  select status is not distinct from v_before.status
     and ban_reason is not distinct from v_before.ban_reason
     and ban_until is not distinct from v_before.ban_until
     and verified is not distinct from v_before.verified
     and verification_pending is not distinct from v_before.verification_pending
    into v_ok from public.profiles where id=v_target;
  insert into c2c2_results values (14,'failed privileged changes leave values unchanged',v_ok);

  -- 15. Super-admin aal1 cannot reach the credential operation.
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_super,'role','authenticated','aal','aal1')::text,true);
  perform set_config('request.jwt.claim.sub',v_super::text,true);
  perform set_config('request.jwt.claim.role','authenticated',true);
  set local role authenticated;
  v_blocked:=false;
  begin
    perform public.amos_set_integration_credential('c2c2_probe','c2c2_rollback_probe',md5(random()::text));
  exception when insufficient_privilege then v_blocked:=sqlerrm='mfa_required';
  end;
  reset role;
  insert into c2c2_results values (15,'super_admin aal1 cannot set AMOS credential',v_blocked);

  -- 16. Super-admin aal2 reaches Vault; the surrounding rollback removes it.
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_super,'role','authenticated','aal','aal2')::text,true);
  set local role authenticated;
  perform public.amos_set_integration_credential('c2c2_probe','c2c2_rollback_probe',md5(random()::text));
  reset role;
  select count(*)=1 into v_ok from vault.secrets where name='c2c2_rollback_probe';
  insert into c2c2_results values (16,'super_admin aal2 reaches AMOS credential operation',v_ok);

  -- 17. Every non-super role remains rejected by the credential RPC.
  v_ok:=true;
  for v_actor,v_role_name in
    select * from (values
      (v_admin,'admin'),(v_moderator,'moderator'),(v_support,'support'),
      (v_finance,'finance'),(v_user,'user')
    ) actors(id,role_name)
  loop
    perform set_config('request.jwt.claims',jsonb_build_object('sub',v_actor,'role','authenticated','aal','aal2')::text,true);
    perform set_config('request.jwt.claim.sub',v_actor::text,true);
    set local role authenticated;
    v_blocked:=false;
    begin
      perform public.amos_set_integration_credential('c2c2_probe','c2c2_rejected_probe',md5(random()::text));
    exception when others then
      v_blocked:=sqlerrm='Only super_admin can connect AMOS integrations';
    end;
    reset role;
    v_ok:=v_ok and v_blocked;
  end loop;
  insert into c2c2_results values (17,'all non-super roles rejected by AMOS credential RPC',v_ok);

  -- 18. C2B/C2B-FIX role helpers retain their hierarchy.
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_super,'role','authenticated','aal','aal2')::text,true);
  perform set_config('request.jwt.claim.sub',v_super::text,true);
  set local role authenticated;
  select public.is_admin() and public.is_moderator() and public.is_super_admin() into v_ok;
  reset role;
  insert into c2c2_results values (18,'C2B-FIX helpers still recognize super_admin',v_ok);

  -- 19. Trusted service-role automation can still reach the credential path.
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_super,'role','service_role')::text,true);
  perform set_config('request.jwt.claim.role','service_role',true);
  perform public.amos_set_integration_credential(
    'c2c2_service_probe','c2c2_service_rollback_probe',md5(random()::text)
  );
  select count(*)=1 into v_ok from vault.secrets where name='c2c2_service_rollback_probe';
  insert into c2c2_results values (19,'service_role reaches AMOS credential operation',v_ok);

  if exists(select 1 from c2c2_results where not passed) then
    raise exception 'C2C-2 test failure: %',(
      select string_agg(n||':'||test_name,', ' order by n)
      from c2c2_results where not passed
    );
  end if;
end
$test$;

-- Rehearse the paired rollback inside this same outer transaction.
create or replace function public.profiles_guard_privileged()
returns trigger
language plpgsql security invoker set search_path = 'public'
as $$
begin
  if public.is_admin_team() or auth.role() = 'service_role' then return new; end if;
  new.role := old.role;
  new.verified := old.verified;
  new.company_verified := old.company_verified;
  new.status := old.status;
  new.ban_reason := old.ban_reason;
  new.ban_until := old.ban_until;
  new.verification_pending := old.verification_pending;
  new.admin_notes := old.admin_notes;
  return new;
end;
$$;
revoke all on function public.profiles_guard_privileged() from public;
grant execute on function public.profiles_guard_privileged() to public;
grant execute on function public.profiles_guard_privileged() to anon;
grant execute on function public.profiles_guard_privileged() to authenticated;
grant execute on function public.profiles_guard_privileged() to service_role;

create or replace function public.amos_set_integration_credential(
  p_provider text, p_secret_name text, p_secret_value text
)
returns void
language plpgsql security definer set search_path = 'public', 'vault'
as $$
declare v_secret_id uuid;
begin
  if not public.is_super_admin() then
    raise exception 'Only super_admin can connect AMOS integrations';
  end if;
  select id into v_secret_id from vault.secrets where name=p_secret_name;
  if v_secret_id is null then
    perform vault.create_secret(p_secret_value,p_secret_name,'AMOS integration credential: '||p_provider);
  else
    perform vault.update_secret(v_secret_id,p_secret_value);
  end if;
  update public.amos_integrations
  set status='connected', credentials_ref=p_secret_name,
      consecutive_failures=0, auto_disabled=false, updated_at=now()
  where provider=p_provider;
end;
$$;
revoke execute on function public.amos_set_integration_credential(text,text,text) from public;
revoke execute on function public.amos_set_integration_credential(text,text,text) from anon;
grant execute on function public.amos_set_integration_credential(text,text,text) to authenticated;
grant execute on function public.amos_set_integration_credential(text,text,text) to service_role;
drop function public.has_mfa_aal2();

insert into c2c2_results values (
  20,'rollback removes has_mfa_aal2',
  to_regprocedure('public.has_mfa_aal2()') is null
);
insert into c2c2_results
select 21,'rollback restores C2B profile guard',
  p.prosrc ~ 'is_admin_team' and p.prosrc !~ 'has_mfa_aal2'
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname='profiles_guard_privileged';
insert into c2c2_results
select 22,'rollback restores C2B AMOS gate',
  p.prosrc ~ 'is_super_admin' and p.prosrc !~ 'has_mfa_aal2'
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname='amos_set_integration_credential'
  and pg_get_function_identity_arguments(p.oid)='p_provider text, p_secret_name text, p_secret_value text';
insert into c2c2_results values (
  23,'rollback preserves profile guard trigger',
  exists(select 1 from pg_trigger where tgrelid='public.profiles'::regclass
    and tgname='trg_profiles_guard_privileged' and not tgisinternal)
);

do $$
begin
  if exists(select 1 from c2c2_results where not passed) then
    raise exception 'C2C-2 rollback rehearsal failure';
  end if;
end
$$;

select n,test_name,passed from c2c2_results order by n;

rollback;
