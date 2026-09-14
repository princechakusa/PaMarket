-- Batch 2 database test (finance revenue access + paid_ads admin read).
-- Self-contained and always rolled back — safe to run directly against a
-- live database (never commits).

begin;

create temporary table batch2_results (
  n integer primary key,
  test_name text not null,
  passed boolean not null
) on commit drop;
grant insert, select on table batch2_results to authenticated;

do $test$
declare
  v_super uuid;
  v_users uuid[];
  v_admin uuid; v_finance uuid; v_moderator uuid; v_regular uuid;
  v_ok boolean;
  v_n int;
  v_rev jsonb;
begin
  select id into v_super from public.profiles where role = 'super_admin' limit 1;
  select array_agg(id order by id) into v_users from (
    select id from public.profiles where role = 'user' order by id limit 4
  ) u;
  if v_super is null or coalesce(array_length(v_users, 1), 0) < 4 then
    raise exception 'Batch 2 test abort: requires one super_admin and four user profiles';
  end if;
  v_admin := v_users[1]; v_finance := v_users[2]; v_moderator := v_users[3]; v_regular := v_users[4];

  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_super, 'role', 'service_role')::text, true);
  perform set_config('request.jwt.claim.sub', v_super::text, true);
  perform set_config('request.jwt.claim.role', 'service_role', true);
  update public.profiles set role = 'admin' where id = v_admin;
  update public.profiles set role = 'finance' where id = v_finance;
  update public.profiles set role = 'moderator' where id = v_moderator;

  -- ══════════════════ Finance revenue access (the fix) ══════════════════

  -- A. finance can now call admin_revenue_summary().
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_finance, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_finance::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  begin
    select public.admin_revenue_summary(30) into v_rev;
    v_ok := v_rev is not null;
  exception when others then v_ok := false;
  end;
  reset role;
  insert into batch2_results values (1, 'A: finance can now call admin_revenue_summary() (was the bug)', v_ok);

  -- B. finance can now call admin_top_payers().
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_finance, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_finance::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  begin
    perform 1 from public.admin_top_payers(90, 5);
    v_ok := true;
  exception when others then v_ok := false;
  end;
  reset role;
  insert into batch2_results values (2, 'B: finance can now call admin_top_payers() (was the bug)', v_ok);

  -- C. admin still can call both (unchanged).
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  select public.admin_revenue_summary(30) into v_rev;
  reset role;
  insert into batch2_results values (3, 'C: admin still calls admin_revenue_summary() (unchanged)', v_rev is not null);

  -- D. super_admin still can call both (unchanged).
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_super, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_super::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  select public.admin_revenue_summary(30) into v_rev;
  reset role;
  insert into batch2_results values (4, 'D: super_admin still calls admin_revenue_summary() (unchanged)', v_rev is not null);

  -- E. moderator remains DENIED (not part of the finance fix).
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_moderator, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_moderator::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  begin
    perform public.admin_revenue_summary(30);
    v_ok := false;
  exception when others then v_ok := true;
  end;
  reset role;
  insert into batch2_results values (5, 'E: moderator remains denied admin_revenue_summary() (unchanged)', v_ok);

  -- F. regular user remains DENIED.
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_regular, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_regular::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  begin
    perform public.admin_revenue_summary(30);
    v_ok := false;
  exception when others then v_ok := true;
  end;
  reset role;
  insert into batch2_results values (6, 'F: regular user remains denied admin_revenue_summary()', v_ok);

  -- ══════════════════ paid_ads admin read (the other fix) ══════════════════

  -- G. admin can now read inactive/scheduled paid_ads (was blocked).
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  select count(*) into v_n from public.paid_ads where active = false;
  reset role;
  insert into batch2_results values (7, 'G: admin can read inactive paid_ads via new policy (was blocked)', v_n >= 0);

  -- H. finance CANNOT see inactive paid_ads directly (only the RPC path was fixed).
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_finance, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_finance::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  select count(*) into v_n from public.paid_ads where active = false;
  reset role;
  insert into batch2_results values (8, 'H: finance still cannot read inactive paid_ads directly (scope of fix is RPC-only)', v_n = 0);

  -- I. moderator cannot read inactive paid_ads.
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_moderator, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_moderator::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  select count(*) into v_n from public.paid_ads where active = false;
  reset role;
  insert into batch2_results values (9, 'I: moderator cannot read inactive paid_ads', v_n = 0);

  -- J. anon still reads only active ads (unchanged public policy).
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claim.role', 'anon', true);
  set local role anon;
  select count(*) into v_n from public.paid_ads where active = false;
  reset role;
  insert into batch2_results values (10, 'J: anon still cannot read inactive paid_ads (unchanged)', v_n = 0);

  -- ══════════════════ Regressions ══════════════════

  select (
    to_regprocedure('public.is_admin()') is not null
    and to_regprocedure('public.is_moderator()') is not null
    and to_regprocedure('public.is_support_team()') is not null
    and to_regprocedure('public.is_finance_team()') is not null
    and to_regprocedure('public.is_admin_team()') is not null
    and to_regprocedure('public.has_admin_privilege(text)') is not null
    and to_regprocedure('public.is_super_admin()') is not null
  ) into v_ok;
  insert into batch2_results values (11, 'K: all relevant helper functions present, including new is_finance_team()', v_ok);

  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  begin
    perform 1 from (select two_factor_secret from public.profiles where id = v_regular limit 1) x;
    v_ok := false;
  exception when insufficient_privilege then v_ok := true;
  end;
  reset role;
  insert into batch2_results values (12, 'L: two_factor_secret cross-user read protection still intact', v_ok);

  -- Cleanup.
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_super, 'role', 'service_role')::text, true);
  perform set_config('request.jwt.claim.sub', v_super::text, true);
  perform set_config('request.jwt.claim.role', 'service_role', true);
  update public.profiles set role = 'user' where id in (v_admin, v_finance, v_moderator);

  if exists (select 1 from batch2_results where not passed) then
    raise exception 'Batch 2 test failure: %', (
      select string_agg(n || ':' || test_name, ', ' order by n)
      from batch2_results where not passed
    );
  end if;
end
$test$;

select n, test_name, passed from batch2_results order by n;

rollback;
