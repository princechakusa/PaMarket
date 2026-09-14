-- C2E-19 database test. Self-contained and always rolled back — safe to run
-- directly against a live database (never commits).

begin;

create temporary table c2e19_results (
  n integer primary key,
  test_name text not null,
  passed boolean not null
) on commit drop;
grant insert, select on table c2e19_results to authenticated;

do $test$
declare
  v_super uuid;
  v_users uuid[];
  v_target uuid; v_admin uuid; v_moderator uuid; v_support uuid; v_finance uuid; v_regular uuid;
  v_ok boolean;
  v_n int;
begin
  select id into v_super from public.profiles where role = 'super_admin' limit 1;
  select array_agg(id order by id) into v_users from (
    select id from public.profiles where role = 'user' order by id limit 6
  ) u;
  if v_super is null or coalesce(array_length(v_users, 1), 0) < 6 then
    raise exception 'C2E-19 test abort: requires one super_admin and six user profiles';
  end if;
  v_target := v_users[1]; v_admin := v_users[2]; v_moderator := v_users[3];
  v_support := v_users[4]; v_finance := v_users[5]; v_regular := v_users[6];

  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_super, 'role', 'service_role')::text, true);
  perform set_config('request.jwt.claim.sub', v_super::text, true);
  perform set_config('request.jwt.claim.role', 'service_role', true);
  update public.profiles set role = 'admin' where id = v_admin;
  update public.profiles set role = 'moderator' where id = v_moderator;
  update public.profiles set role = 'support' where id = v_support;
  update public.profiles set role = 'finance' where id = v_finance;

  -- ══════════════════ Final documented authorization model ══════════════════
  -- Decision: admin, super_admin, moderator, support are all authorized.
  -- finance and regular users are not.

  -- A. admin can read another user's profile row.
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  select count(*) into v_n from public.profiles where id = v_target;
  reset role;
  insert into c2e19_results values (1, 'A: admin authorized to read profiles (documented)', v_n = 1);

  -- B. super_admin can read another user's profile row.
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_super, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_super::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  select count(*) into v_n from public.profiles where id = v_target;
  reset role;
  insert into c2e19_results values (2, 'B: super_admin authorized to read profiles (documented)', v_n = 1);

  -- C. moderator can read another user's profile row (documented: retained
  -- for live legacy-Admin ensureProfiles() compatibility in Reports/
  -- Moderation screens).
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_moderator, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_moderator::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  select count(*) into v_n from public.profiles where id = v_target;
  reset role;
  insert into c2e19_results values (3, 'C: moderator authorized to read profiles (documented, retained)', v_n = 1);

  -- D. support can NOW read another user's profile row (documented: the
  -- actual fix -- previously blocked despite having users.view client-side).
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_support, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_support::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  select count(*) into v_n from public.profiles where id = v_target;
  reset role;
  insert into c2e19_results values (4, 'D: support now authorized to read profiles (was the bug)', v_n = 1);

  -- E. finance is NOT authorized (documented: no finance permission touches
  -- any user-profile-resolving screen).
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_finance, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_finance::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  select count(*) into v_n from public.profiles where id = v_target;
  reset role;
  insert into c2e19_results values (5, 'E: finance remains NOT authorized to read other profiles (documented)', v_n = 0);

  -- ══════════════════ Regular user / anonymous ══════════════════

  -- F. Regular user cannot read an arbitrary other user's profile.
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_regular, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_regular::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  select count(*) into v_n from public.profiles where id = v_target;
  reset role;
  insert into c2e19_results values (6, 'F: regular user cannot read another user''s profile', v_n = 0);

  -- G. Regular user can still read their OWN profile (unchanged).
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_regular, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_regular::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  select count(*) into v_n from public.profiles where id = v_regular;
  reset role;
  insert into c2e19_results values (7, 'G: regular user still reads their own profile (unchanged)', v_n = 1);

  -- H. anon cannot access staff profile data (anon has no table-level grant
  -- on profiles at all -- stricter than RLS, a hard permission-denied
  -- rather than a filtered zero-row result; both count as "cannot access").
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claim.role', 'anon', true);
  set local role anon;
  begin
    select count(*) into v_n from public.profiles where id = v_target;
    v_ok := (v_n = 0);
  exception when insufficient_privilege then v_ok := true;
  end;
  reset role;
  insert into c2e19_results values (8, 'H: anon cannot read profile data', v_ok);

  -- ══════════════════ Sensitive columns remain protected ══════════════════

  -- I. support (newly authorized for row access) still cannot select
  -- mfa_secret -- column-level protection (C2E-8) is independent of this
  -- row-level policy change.
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_support, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_support::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  begin
    perform 1 from (select mfa_secret from public.profiles where id = v_target limit 1) x;
    v_ok := false;
  exception when insufficient_privilege then v_ok := true;
  end;
  reset role;
  insert into c2e19_results values (9, 'I: support still cannot select mfa_secret (C2E-8 column protection independent of row policy)', v_ok);

  -- J. support still cannot select two_factor_secret.
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_support, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_support::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  begin
    perform 1 from (select two_factor_secret from public.profiles where id = v_target limit 1) x;
    v_ok := false;
  exception when insufficient_privilege then v_ok := true;
  end;
  reset role;
  insert into c2e19_results values (10, 'J: support still cannot select two_factor_secret (C2E-13 column protection independent of row policy)', v_ok);

  -- K. moderator (already authorized before this stage) still cannot select
  -- either secret column.
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_moderator, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_moderator::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  begin
    perform 1 from (select mfa_secret from public.profiles where id = v_target limit 1) x;
    v_ok := false;
  exception when insufficient_privilege then v_ok := true;
  end;
  reset role;
  insert into c2e19_results values (11, 'K: moderator still cannot select mfa_secret', v_ok);

  -- ══════════════════ C2E-10 User Directory compatibility ══════════════════

  -- L. The exact C2E-10 User Directory column set succeeds for support (the
  -- newly-authorized role) -- confirms real compatibility, not just a
  -- synthetic row count.
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_support, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_support::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  begin
    perform 1 from (
      select id, name, email, phone, role, status, verified, city, province,
             company, company_verified, created_at, last_seen, last_active_at, mfa_enabled
      from public.profiles where id = v_target limit 1
    ) x;
    v_ok := true;
  exception when others then v_ok := false;
  end;
  reset role;
  insert into c2e19_results values (12, 'L: C2E-10 User Directory column set succeeds for support (newly authorized)', v_ok);

  -- M. Same column set still succeeds for moderator (unchanged).
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_moderator, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_moderator::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  begin
    perform 1 from (
      select id, name, email, phone, role, status, verified, city, province,
             company, company_verified, created_at, last_seen, last_active_at, mfa_enabled
      from public.profiles where id = v_target limit 1
    ) x;
    v_ok := true;
  exception when others then v_ok := false;
  end;
  reset role;
  insert into c2e19_results values (13, 'M: C2E-10 User Directory column set still succeeds for moderator', v_ok);

  -- ══════════════════ Regressions ══════════════════

  select (
    to_regprocedure('public.is_admin()') is not null
    and to_regprocedure('public.is_moderator()') is not null
    and to_regprocedure('public.is_support_team()') is not null
    and to_regprocedure('public.is_admin_team()') is not null
    and to_regprocedure('public.has_admin_privilege(text)') is not null
    and to_regprocedure('public.is_super_admin()') is not null
    and to_regprocedure('public.get_my_mfa_secret()') is not null
    and to_regprocedure('public.get_my_two_factor_secret()') is not null
  ) into v_ok;
  insert into c2e19_results values (14, 'N: all relevant helper/RPC functions still present', v_ok);

  select exists (
    select 1 from pg_policies where tablename = 'business_staff' and policyname = 'business_staff: admin read' and qual ilike '%is_admin%'
  ) into v_ok;
  insert into c2e19_results values (15, 'O: C2E-14 business_staff admin read policy unchanged', v_ok);

  select exists (
    select 1 from pg_policies where tablename = 'business_payments' and policyname = 'admin_read_all_payments' and qual ilike '%is_admin%' and qual not ilike '%role = ''admin''%'
  ) into v_ok;
  insert into c2e19_results values (16, 'P: C2E-15 business_payments super_admin fix unchanged', v_ok);

  -- Cleanup.
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_super, 'role', 'service_role')::text, true);
  perform set_config('request.jwt.claim.sub', v_super::text, true);
  perform set_config('request.jwt.claim.role', 'service_role', true);

  if exists (select 1 from c2e19_results where not passed) then
    raise exception 'C2E-19 test failure: %', (
      select string_agg(n || ':' || test_name, ', ' order by n)
      from c2e19_results where not passed
    );
  end if;
end
$test$;

select n, test_name, passed from c2e19_results order by n;

rollback;
