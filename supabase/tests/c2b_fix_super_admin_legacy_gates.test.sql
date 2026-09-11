-- C2B-FIX live verification. Every temporary role change, Vault probe, and
-- representative update is enclosed in this transaction and rolled back.

begin;

create temporary table c2b_fix_results (
  n integer primary key,
  test_name text not null,
  passed boolean not null
) on commit drop;

grant insert, select on table c2b_fix_results to authenticated;

do $test$
declare
  v_super uuid;
  v_users uuid[];
  v_admin uuid;
  v_moderator uuid;
  v_support uuid;
  v_finance uuid;
  v_user uuid;
  v_count integer;
  v_rows integer;
  v_rejected boolean;
  v_actor uuid;
begin
  select id into v_super
  from public.profiles where role = 'super_admin' limit 1;

  select array_agg(id order by id) into v_users
  from (
    select id from public.profiles where role = 'user' order by id limit 5
  ) users;

  if v_super is null or coalesce(array_length(v_users, 1), 0) < 5 then
    raise exception 'C2B-FIX test abort: requires one super_admin and five user profiles';
  end if;

  v_admin := v_users[1];
  v_moderator := v_users[2];
  v_support := v_users[3];
  v_finance := v_users[4];
  v_user := v_users[5];

  -- Test-only specialist roles. The C2B trigger requires the service_role
  -- claim for setup; the enclosing ROLLBACK restores all rows and audit rows.
  perform set_config('request.jwt.claim.role', 'service_role', true);
  perform set_config('request.jwt.claim.sub', v_super::text, true);
  update public.profiles set role = 'admin' where id = v_admin;
  update public.profiles set role = 'moderator' where id = v_moderator;
  update public.profiles set role = 'support' where id = v_support;
  update public.profiles set role = 'finance' where id = v_finance;

  perform set_config('request.jwt.claim.role', 'authenticated', true);

  perform set_config('request.jwt.claim.sub', v_super::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_super, 'role', 'authenticated', 'aal', 'aal2')::text,
    true
  );
  set local role authenticated;
  insert into c2b_fix_results values (1, 'super_admin passes is_admin', public.is_admin());
  insert into c2b_fix_results values (2, 'super_admin passes is_moderator', public.is_moderator());
  select count(*) into v_count from public.profiles where id = v_user;
  insert into c2b_fix_results values (10, 'super_admin reads another profile through legacy staff policy', v_count = 1);
  update public.profiles set admin_notes = admin_notes where id = v_user;
  get diagnostics v_rows = row_count;
  insert into c2b_fix_results values (11, 'super_admin performs representative guarded profile action', v_rows = 1);
  begin
    perform public.amos_set_integration_credential(
      'c2b_fix_rollback_probe', 'c2b_fix_rollback_probe_super', md5(random()::text)
    );
    insert into c2b_fix_results values (14, 'AMOS credential setter accepts super_admin', true);
  exception when others then
    insert into c2b_fix_results values (14, 'AMOS credential setter accepts super_admin', false);
  end;
  reset role;

  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  set local role authenticated;
  insert into c2b_fix_results values (3, 'admin still passes is_admin', public.is_admin());
  insert into c2b_fix_results values (4, 'admin still passes is_moderator', public.is_moderator());
  reset role;

  perform set_config('request.jwt.claim.sub', v_moderator::text, true);
  set local role authenticated;
  insert into c2b_fix_results values (5, 'moderator still passes is_moderator', public.is_moderator());
  insert into c2b_fix_results values (6, 'moderator does not pass is_admin', not public.is_admin());
  reset role;

  perform set_config('request.jwt.claim.sub', v_support::text, true);
  set local role authenticated;
  insert into c2b_fix_results values (7, 'support does not pass is_admin or is_moderator', not public.is_admin() and not public.is_moderator());
  reset role;

  perform set_config('request.jwt.claim.sub', v_finance::text, true);
  set local role authenticated;
  insert into c2b_fix_results values (8, 'finance does not pass is_admin or is_moderator', not public.is_admin() and not public.is_moderator());
  reset role;

  perform set_config('request.jwt.claim.sub', v_user::text, true);
  set local role authenticated;
  insert into c2b_fix_results values (9, 'normal user passes neither helper', not public.is_admin() and not public.is_moderator());
  select count(*) into v_count from public.profiles where id = v_super;
  update public.profiles set admin_notes = admin_notes where id = v_super;
  get diagnostics v_rows = row_count;
  insert into c2b_fix_results values (12, 'normal user cannot read or update another admin profile', v_count = 0 and v_rows = 0);
  reset role;

  -- Every non-super role must still be rejected by the C2B credential gate.
  foreach v_actor in array array[v_admin, v_moderator, v_support, v_finance]
  loop
    perform set_config('request.jwt.claim.sub', v_actor::text, true);
    set local role authenticated;
    v_rejected := false;
    begin
      perform public.amos_set_integration_credential(
        'c2b_fix_rollback_probe', 'c2b_fix_rollback_probe_rejected', md5(random()::text)
      );
    exception when others then
      v_rejected := sqlerrm = 'Only super_admin can connect AMOS integrations';
    end;
    reset role;
    if not v_rejected then
      raise exception 'C2B-FIX test failed: non-super role unexpectedly passed AMOS credential guard';
    end if;
  end loop;
  insert into c2b_fix_results values (13, 'AMOS credential setter rejects admin and all specialists', true);

  select count(*) into v_count
  from pg_policies
  where schemaname = 'public'
    and (tablename, policyname) in (
      ('company_verifications', 'companyverif admin read'),
      ('company_verifications', 'companyverif admin select'),
      ('company_verifications', 'companyverif admin update'),
      ('verifications', 'verif admin select'),
      ('verifications', 'verif admin update'),
      ('scheduled_notifications', 'scheduled notifications admin read'),
      ('scheduled_notifications', 'scheduled notifications admin update')
    )
    and coalesce(qual, '') = 'is_admin()';
  insert into c2b_fix_results values (15, 'seven active inline policies now use the compatibility helper', v_count = 7);

  if exists (select 1 from c2b_fix_results where not passed) then
    raise exception 'C2B-FIX test failure: %', (
      select string_agg(n || ':' || test_name, ', ' order by n)
      from c2b_fix_results where not passed
    );
  end if;
end
$test$;

select n, test_name, passed from c2b_fix_results order by n;

rollback;
