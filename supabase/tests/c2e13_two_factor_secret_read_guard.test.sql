-- C2E-13 database test. Self-contained and always rolled back — safe to run
-- directly against a live database (never commits).

begin;

create temporary table c2e13_results (
  n integer primary key,
  test_name text not null,
  passed boolean not null
) on commit drop;
grant insert, select on table c2e13_results to authenticated;

do $test$
declare
  v_super uuid;
  v_users uuid[];
  v_owner uuid; v_admin uuid; v_moderator uuid; v_support uuid;
  v_ok boolean;
  v_secret text;
begin
  select id into v_super from public.profiles where role = 'super_admin' limit 1;
  select array_agg(id order by id) into v_users from (
    select id from public.profiles where role = 'user' order by id limit 4
  ) u;
  if v_super is null or coalesce(array_length(v_users, 1), 0) < 4 then
    raise exception 'C2E-13 test abort: requires one super_admin and four user profiles';
  end if;
  v_owner := v_users[1]; v_admin := v_users[2]; v_moderator := v_users[3]; v_support := v_users[4];

  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_super, 'role', 'service_role')::text, true);
  perform set_config('request.jwt.claim.role', 'service_role', true);
  update public.profiles set role = 'admin' where id = v_admin;
  update public.profiles set role = 'moderator' where id = v_moderator;
  update public.profiles set role = 'support' where id = v_support;
  update public.profiles set two_factor_secret = 'c2e13-owner-secret', two_factor_enabled = true where id = v_owner;

  -- ══════════════════ Direct database reads ══════════════════

  -- A. anon cannot select two_factor_secret at all.
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  set local role anon;
  begin
    perform 1 from (select two_factor_secret from public.profiles where id = v_owner limit 1) x;
    v_ok := false;
  exception when insufficient_privilege then v_ok := true;
  end;
  reset role;
  insert into c2e13_results values (1, 'A: anon cannot select two_factor_secret', v_ok);

  -- B. Regular authenticated user cannot select another user's secret.
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_users[2], 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_users[2]::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  begin
    perform 1 from (select two_factor_secret from public.profiles where id = v_owner limit 1) x;
    v_ok := false;
  exception when insufficient_privilege then v_ok := true;
  end;
  reset role;
  insert into c2e13_results values (2, 'B: regular user cannot select another user''s two_factor_secret', v_ok);

  -- C. moderator cannot select another user's secret.
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_moderator, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_moderator::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  begin
    perform 1 from (select two_factor_secret from public.profiles where id = v_owner limit 1) x;
    v_ok := false;
  exception when insufficient_privilege then v_ok := true;
  end;
  reset role;
  insert into c2e13_results values (3, 'C: moderator cannot select another user''s two_factor_secret', v_ok);

  -- D. support cannot select another user's secret.
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_support, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_support::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  begin
    perform 1 from (select two_factor_secret from public.profiles where id = v_owner limit 1) x;
    v_ok := false;
  exception when insufficient_privilege then v_ok := true;
  end;
  reset role;
  insert into c2e13_results values (4, 'D: support cannot select another user''s two_factor_secret', v_ok);

  -- E. admin cannot select another user's secret.
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_admin, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  begin
    perform 1 from (select two_factor_secret from public.profiles where id = v_owner limit 1) x;
    v_ok := false;
  exception when insufficient_privilege then v_ok := true;
  end;
  reset role;
  insert into c2e13_results values (5, 'E: admin (even AAL2) cannot select another user''s two_factor_secret', v_ok);

  -- F. super_admin cannot select another user's secret.
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_super, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  perform set_config('request.jwt.claim.sub', v_super::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  begin
    perform 1 from (select two_factor_secret from public.profiles where id = v_owner limit 1) x;
    v_ok := false;
  exception when insufficient_privilege then v_ok := true;
  end;
  reset role;
  insert into c2e13_results values (6, 'F: super_admin cannot select another user''s two_factor_secret', v_ok);

  -- ══════════════════ Owner access via the new RPC ══════════════════

  -- G. Owner retrieves their own secret via get_my_two_factor_secret().
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_owner, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  select public.get_my_two_factor_secret() into v_secret;
  reset role;
  insert into c2e13_results values (7, 'G: owner retrieves own secret via RPC', v_secret = 'c2e13-owner-secret');

  -- H. A different user's RPC call returns only their own (null) secret,
  -- never the target owner's -- confirms no parameter/bypass path exists
  -- (the function takes no arguments at all).
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  select public.get_my_two_factor_secret() into v_secret;
  reset role;
  insert into c2e13_results values (8, 'H: another authenticated caller''s RPC call returns their own (null) secret, not the owner''s', v_secret is null);

  -- I. anon cannot execute the RPC at all.
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  set local role anon;
  begin
    perform public.get_my_two_factor_secret();
    v_ok := false;
  exception when insufficient_privilege then v_ok := true;
  end;
  reset role;
  insert into c2e13_results values (9, 'I: anon cannot execute get_my_two_factor_secret()', v_ok);

  -- ══════════════════ Writes (C2E-7 write guard, unchanged) ══════════════════

  -- J. Owner can still write their own two_factor_secret.
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_owner, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  update public.profiles set two_factor_secret = 'c2e13-owner-rotated' where id = v_owner;
  reset role;
  select two_factor_secret into v_secret from public.profiles where id = v_owner;
  insert into c2e13_results values (10, 'J: owner can still write their own two_factor_secret', v_secret = 'c2e13-owner-rotated');

  -- K. moderator cannot write another user's secret (C2E-7 trigger).
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_moderator, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_moderator::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  update public.profiles set two_factor_secret = 'c2e13-attacker' where id = v_owner;
  reset role;
  select two_factor_secret into v_secret from public.profiles where id = v_owner;
  insert into c2e13_results values (11, 'K: moderator cannot write another user''s two_factor_secret (C2E-7 unchanged)', v_secret = 'c2e13-owner-rotated');

  -- L. support cannot write another user's secret.
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_support, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_support::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  update public.profiles set two_factor_secret = 'c2e13-attacker' where id = v_owner;
  reset role;
  select two_factor_secret into v_secret from public.profiles where id = v_owner;
  insert into c2e13_results values (12, 'L: support cannot write another user''s two_factor_secret', v_secret = 'c2e13-owner-rotated');

  -- M. admin cannot write another user's secret.
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_admin, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  update public.profiles set two_factor_secret = 'c2e13-attacker' where id = v_owner;
  reset role;
  select two_factor_secret into v_secret from public.profiles where id = v_owner;
  insert into c2e13_results values (13, 'M: admin (even AAL2) cannot write another user''s two_factor_secret', v_secret = 'c2e13-owner-rotated');

  -- N. super_admin cannot write another user's secret.
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_super, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  perform set_config('request.jwt.claim.sub', v_super::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  update public.profiles set two_factor_secret = 'c2e13-attacker' where id = v_owner;
  reset role;
  select two_factor_secret into v_secret from public.profiles where id = v_owner;
  insert into c2e13_results values (14, 'N: super_admin cannot write another user''s two_factor_secret', v_secret = 'c2e13-owner-rotated');

  -- ══════════════════ mfa_secret (C2E-8) regression ══════════════════

  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_super, 'role', 'service_role')::text, true);
  perform set_config('request.jwt.claim.sub', v_super::text, true);
  perform set_config('request.jwt.claim.role', 'service_role', true);
  update public.profiles set mfa_secret = 'c2e13-owner-mfa' where id = v_owner;
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_admin, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  begin
    perform 1 from (select mfa_secret from public.profiles where id = v_owner limit 1) x;
    v_ok := false;
  exception when insufficient_privilege then v_ok := true;
  end;
  reset role;
  insert into c2e13_results values (15, 'O: C2E-8 mfa_secret cross-user read protection still intact', v_ok);

  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_owner, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  select public.get_my_mfa_secret() into v_secret;
  reset role;
  insert into c2e13_results values (16, 'P: owner mfa_secret access via get_my_mfa_secret() still functional', v_secret = 'c2e13-owner-mfa');

  -- ══════════════════ Admin protection ══════════════════

  select not exists (
    select 1 from information_schema.columns
    where table_name = 'profiles' and column_name = 'two_factor_secret'
      and has_column_privilege('authenticated', 'public.profiles', 'two_factor_secret', 'SELECT')
  ) into v_ok;
  insert into c2e13_results values (17, 'Q: authenticated has no SELECT on two_factor_secret at the grant level', v_ok);

  select has_column_privilege('authenticated', 'public.profiles', 'two_factor_secret', 'UPDATE') into v_ok;
  insert into c2e13_results values (18, 'R: authenticated retains UPDATE on two_factor_secret (own-row writes still function)', v_ok);

  -- Cleanup.
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_super, 'role', 'service_role')::text, true);
  perform set_config('request.jwt.claim.role', 'service_role', true);
  update public.profiles set two_factor_secret = null, two_factor_enabled = false, mfa_secret = null
    where id in (v_owner, v_admin);

  if exists (select 1 from c2e13_results where not passed) then
    raise exception 'C2E-13 test failure: %', (
      select string_agg(n || ':' || test_name, ', ' order by n)
      from c2e13_results where not passed
    );
  end if;
end
$test$;

select n, test_name, passed from c2e13_results order by n;

rollback;
