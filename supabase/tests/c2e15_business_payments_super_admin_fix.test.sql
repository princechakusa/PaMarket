-- C2E-15 database test. Self-contained and always rolled back — safe to run
-- directly against a live database (never commits).

begin;

create temporary table c2e15_results (
  n integer primary key,
  test_name text not null,
  passed boolean not null
) on commit drop;
grant insert, select on table c2e15_results to authenticated;

do $test$
declare
  v_super uuid;
  v_users uuid[];
  v_owner uuid; v_admin uuid; v_moderator uuid; v_support uuid; v_outsider uuid;
  v_business_id uuid;
  v_payment_id uuid;
  v_ok boolean;
  v_n int;
begin
  select id into v_super from public.profiles where role = 'super_admin' limit 1;
  select array_agg(id order by id) into v_users from (
    select id from public.profiles where role = 'user' order by id limit 5
  ) u;
  if v_super is null or coalesce(array_length(v_users, 1), 0) < 5 then
    raise exception 'C2E-15 test abort: requires one super_admin and five user profiles';
  end if;
  v_owner := v_users[1]; v_admin := v_users[2]; v_moderator := v_users[3];
  v_support := v_users[4]; v_outsider := v_users[5];

  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_super, 'role', 'service_role')::text, true);
  perform set_config('request.jwt.claim.sub', v_super::text, true);
  perform set_config('request.jwt.claim.role', 'service_role', true);
  update public.profiles set role = 'admin' where id = v_admin;
  update public.profiles set role = 'moderator' where id = v_moderator;
  update public.profiles set role = 'support' where id = v_support;

  insert into public.businesses (owner_user_id, name, status)
    values (v_owner, 'C2E-15 Test Business', 'draft')
    returning id into v_business_id;
  insert into public.business_payments (business_id, type, amount, status)
    values (v_business_id, 'subscription', 42, 'pending')
    returning id into v_payment_id;

  -- ══════════════════ Admin ══════════════════

  -- A. admin can read the payment (was previously true -- confirms no regression).
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  select count(*) into v_n from public.business_payments where id = v_payment_id;
  reset role;
  insert into c2e15_results values (1, 'A: admin can read business_payments row (unchanged)', v_n = 1);

  -- B. admin can update the payment (unchanged).
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  update public.business_payments set status = 'paid' where id = v_payment_id;
  reset role;
  select (status = 'paid') into v_ok from public.business_payments where id = v_payment_id;
  insert into c2e15_results values (2, 'B: admin can update business_payments row (unchanged)', v_ok);

  -- ══════════════════ Super Admin (the actual fix) ══════════════════

  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_super, 'role', 'service_role')::text, true);
  perform set_config('request.jwt.claim.sub', v_super::text, true);
  perform set_config('request.jwt.claim.role', 'service_role', true);
  update public.business_payments set status = 'pending' where id = v_payment_id;

  -- C. super_admin can now read the payment (was BLOCKED before this fix).
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_super, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_super::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  select count(*) into v_n from public.business_payments where id = v_payment_id;
  reset role;
  insert into c2e15_results values (3, 'C: super_admin can now read business_payments row (was the bug)', v_n = 1);

  -- D. super_admin can now update the payment (was BLOCKED before this fix).
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_super, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_super::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  update public.business_payments set status = 'paid' where id = v_payment_id;
  reset role;
  select (status = 'paid') into v_ok from public.business_payments where id = v_payment_id;
  insert into c2e15_results values (4, 'D: super_admin can now update business_payments row (was the bug)', v_ok);

  -- ══════════════════ Moderator / Support (still excluded) ══════════════════

  -- E. moderator remains denied.
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_moderator, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_moderator::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  select count(*) into v_n from public.business_payments where id = v_payment_id;
  reset role;
  insert into c2e15_results values (5, 'E: moderator remains denied read access', v_n = 0);

  -- F. support remains denied.
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_support, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_support::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  select count(*) into v_n from public.business_payments where id = v_payment_id;
  reset role;
  insert into c2e15_results values (6, 'F: support remains denied read access', v_n = 0);

  -- ══════════════════ Regular user / anon ══════════════════

  -- G. Unrelated authenticated user cannot read another business's payment.
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_outsider, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_outsider::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  select count(*) into v_n from public.business_payments where id = v_payment_id;
  reset role;
  insert into c2e15_results values (7, 'G: unrelated authenticated user cannot read another business''s payment', v_n = 0);

  -- H. Business owner still reads their own payment (unchanged).
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_owner, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  select count(*) into v_n from public.business_payments where id = v_payment_id;
  reset role;
  insert into c2e15_results values (8, 'H: business owner still reads their own payment (unchanged)', v_n = 1);

  -- I. anon cannot read payment data.
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claim.role', 'anon', true);
  set local role anon;
  select count(*) into v_n from public.business_payments where id = v_payment_id;
  reset role;
  insert into c2e15_results values (9, 'I: anon cannot read business_payments row', v_n = 0);

  -- ══════════════════ Writes: no new write path granted ══════════════════

  -- J. INSERT policy is unchanged (owner-only) -- verified via definition,
  -- not a live write, since inserting is unrelated to this migration's
  -- scope (only the read/update literal-role defect was in scope).
  select (
    with_check = '(business_id IN ( SELECT businesses.id
   FROM businesses
  WHERE (businesses.owner_user_id = auth.uid())))'
  ) into v_ok
  from pg_policies where tablename = 'business_payments' and policyname = 'owner_insert_payments';
  insert into c2e15_results values (10, 'J: INSERT policy (owner-only) is unchanged by this migration', coalesce(v_ok, false));

  -- K. No DELETE policy exists -- confirms DELETE remains fully blocked
  -- (no write access was broadened by this migration).
  select not exists (select 1 from pg_policies where tablename = 'business_payments' and cmd = 'DELETE') into v_ok;
  insert into c2e15_results values (11, 'K: no DELETE policy exists on business_payments (unchanged, still fully blocked)', v_ok);

  -- L. moderator cannot write to the payment either (matches its read denial).
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_moderator, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_moderator::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  update public.business_payments set status = 'failed' where id = v_payment_id;
  reset role;
  select (status = 'paid') into v_ok from public.business_payments where id = v_payment_id;
  insert into c2e15_results values (12, 'L: moderator cannot write to business_payments (write access not broadened)', v_ok);

  -- ══════════════════ Regressions: C2E-6/7/8/13/14 spot-checks ══════════════════

  select (
    to_regprocedure('public.is_admin()') is not null
    and to_regprocedure('public.is_moderator()') is not null
    and to_regprocedure('public.is_admin_team()') is not null
    and to_regprocedure('public.has_admin_privilege(text)') is not null
    and to_regprocedure('public.is_super_admin()') is not null
    and to_regprocedure('public.get_my_mfa_secret()') is not null
    and to_regprocedure('public.get_my_two_factor_secret()') is not null
  ) into v_ok;
  insert into c2e15_results values (13, 'M: C2E-5/8/13 helper/RPC functions still present', v_ok);

  select exists (
    select 1 from pg_policies where tablename = 'business_staff' and policyname = 'business_staff: admin read' and qual ilike '%is_admin%'
  ) into v_ok;
  insert into c2e15_results values (14, 'N: C2E-14 business_staff admin read policy unchanged', v_ok);

  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  begin
    perform 1 from (select two_factor_secret from public.profiles where id = v_owner limit 1) x;
    v_ok := false;
  exception when insufficient_privilege then v_ok := true;
  end;
  reset role;
  insert into c2e15_results values (15, 'O: C2E-13 two_factor_secret cross-user read protection still intact', v_ok);

  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  begin
    perform 1 from (select mfa_secret from public.profiles where id = v_owner limit 1) x;
    v_ok := false;
  exception when insufficient_privilege then v_ok := true;
  end;
  reset role;
  insert into c2e15_results values (16, 'P: C2E-8 mfa_secret cross-user read protection still intact', v_ok);

  -- Cleanup.
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_super, 'role', 'service_role')::text, true);
  perform set_config('request.jwt.claim.sub', v_super::text, true);
  perform set_config('request.jwt.claim.role', 'service_role', true);
  delete from public.business_payments where business_id = v_business_id;
  delete from public.businesses where id = v_business_id;

  if exists (select 1 from c2e15_results where not passed) then
    raise exception 'C2E-15 test failure: %', (
      select string_agg(n || ':' || test_name, ', ' order by n)
      from c2e15_results where not passed
    );
  end if;
end
$test$;

select n, test_name, passed from c2e15_results order by n;

rollback;
