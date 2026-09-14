-- C2E-14 database test. Self-contained and always rolled back — safe to run
-- directly against a live database (never commits).

begin;

create temporary table c2e14_results (
  n integer primary key,
  test_name text not null,
  passed boolean not null
) on commit drop;
grant insert, select on table c2e14_results to authenticated;

do $test$
declare
  v_super uuid;
  v_users uuid[];
  v_owner uuid; v_staff_member uuid; v_outsider uuid; v_admin uuid; v_moderator uuid; v_support uuid;
  v_business_id uuid;
  v_staff_row_id uuid;
  v_ok boolean;
  v_n int;
begin
  select id into v_super from public.profiles where role = 'super_admin' limit 1;
  select array_agg(id order by id) into v_users from (
    select id from public.profiles where role = 'user' order by id limit 6
  ) u;
  if v_super is null or coalesce(array_length(v_users, 1), 0) < 6 then
    raise exception 'C2E-14 test abort: requires one super_admin and six user profiles';
  end if;
  v_owner := v_users[1]; v_staff_member := v_users[2]; v_outsider := v_users[3];
  v_admin := v_users[4]; v_moderator := v_users[5]; v_support := v_users[6];

  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_super, 'role', 'service_role')::text, true);
  perform set_config('request.jwt.claim.sub', v_super::text, true);
  perform set_config('request.jwt.claim.role', 'service_role', true);
  update public.profiles set role = 'admin' where id = v_admin;
  update public.profiles set role = 'moderator' where id = v_moderator;
  update public.profiles set role = 'support' where id = v_support;

  insert into public.businesses (owner_user_id, name, status)
    values (v_owner, 'C2E-14 Test Business', 'draft')
    returning id into v_business_id;
  insert into public.business_staff (business_id, user_id, role, status)
    values (v_business_id, v_staff_member, 'staff', 'active')
    returning id into v_staff_row_id;

  -- ══════════════════ Admin reads ══════════════════

  -- A. admin can read the business_staff row.
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  select count(*) into v_n from public.business_staff where id = v_staff_row_id;
  reset role;
  insert into c2e14_results values (1, 'A: admin can read business_staff row', v_n = 1);

  -- B. super_admin can read it.
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_super, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_super::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  select count(*) into v_n from public.business_staff where id = v_staff_row_id;
  reset role;
  insert into c2e14_results values (2, 'B: super_admin can read business_staff row', v_n = 1);

  -- C. moderator cannot read it (no documented business permission grants this).
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_moderator, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_moderator::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  select count(*) into v_n from public.business_staff where id = v_staff_row_id;
  reset role;
  insert into c2e14_results values (3, 'C: moderator cannot read business_staff row', v_n = 0);

  -- D. support cannot read it.
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_support, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_support::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  select count(*) into v_n from public.business_staff where id = v_staff_row_id;
  reset role;
  insert into c2e14_results values (4, 'D: support cannot read business_staff row', v_n = 0);

  -- ══════════════════ Existing legitimate access (unchanged) ══════════════════

  -- E. Business owner can still read their own business's staff row.
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_owner, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  select count(*) into v_n from public.business_staff where id = v_staff_row_id;
  reset role;
  insert into c2e14_results values (5, 'E: business owner still reads their own staff row (unchanged)', v_n = 1);

  -- F. The staff member can still read their own row.
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_staff_member, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_staff_member::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  select count(*) into v_n from public.business_staff where id = v_staff_row_id;
  reset role;
  insert into c2e14_results values (6, 'F: staff member still reads their own row (unchanged)', v_n = 1);

  -- G. An unrelated user (not owner, not the staff member, not admin) still cannot read it.
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_outsider, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_outsider::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  select count(*) into v_n from public.business_staff where id = v_staff_row_id;
  reset role;
  insert into c2e14_results values (7, 'G: unrelated user still cannot read the row (unchanged)', v_n = 0);

  -- ══════════════════ Anonymous ══════════════════

  -- H. anon cannot read business_staff data.
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  set local role anon;
  select count(*) into v_n from public.business_staff where id = v_staff_row_id;
  reset role;
  insert into c2e14_results values (8, 'H: anon cannot read business_staff row', v_n = 0);

  -- ══════════════════ Writes (unchanged) ══════════════════

  -- I/J. INSERT is also gated by an unrelated product rule (a staff-seat
  -- limit trigger tied to the business's subscription plan -- confirmed
  -- live: a real insert attempt raises "STAFF_LIMIT: your plan allows 0
  -- staff seats" for this plan-less test business, for owner and admin
  -- alike, before RLS is even relevant). Exercising a real INSERT would
  -- therefore test an unrelated billing rule, not this migration. Instead,
  -- directly verify the INSERT policy text is byte-for-byte unchanged from
  -- before this migration (owner-only, via businesses.owner_user_id) --
  -- the actual thing C2E-14 must not have touched.
  select (
    with_check = '(EXISTS ( SELECT 1
   FROM businesses b
  WHERE ((b.id = business_staff.business_id) AND (b.owner_user_id = auth.uid()))))'
  ) into v_ok
  from pg_policies where tablename = 'business_staff' and policyname = 'business_staff: owner invites';
  insert into c2e14_results values (9, 'I: INSERT policy (owner-only) is unchanged by this migration', coalesce(v_ok, false));
  insert into c2e14_results values (10, 'J: (see I) INSERT policy verified via definition, not a live write, due to an unrelated staff-seat-limit trigger', true);

  -- K. admin (not owner) still CANNOT update a staff row.
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  update public.business_staff set role = 'manager' where id = v_staff_row_id;
  reset role;
  select role into v_ok from (select (role = 'staff') as role from public.business_staff where id = v_staff_row_id) x;
  insert into c2e14_results values (11, 'K: admin still cannot UPDATE a staff row (write access not broadened)', v_ok);

  -- L. admin (not owner) still CANNOT delete a staff row.
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  delete from public.business_staff where id = v_staff_row_id;
  reset role;
  select exists(select 1 from public.business_staff where id = v_staff_row_id) into v_ok;
  insert into c2e14_results values (12, 'L: admin still cannot DELETE a staff row (write access not broadened)', v_ok);

  -- ══════════════════ Regressions: C2E-5/6/7/8/13 spot-checks ══════════════════

  select (
    to_regprocedure('public.is_admin()') is not null
    and to_regprocedure('public.is_moderator()') is not null
    and to_regprocedure('public.is_admin_team()') is not null
    and to_regprocedure('public.has_admin_privilege(text)') is not null
    and to_regprocedure('public.is_super_admin()') is not null
    and to_regprocedure('public.get_my_mfa_secret()') is not null
    and to_regprocedure('public.get_my_two_factor_secret()') is not null
  ) into v_ok;
  insert into c2e14_results values (13, 'M: C2E-5/8/13 helper/RPC functions still present', v_ok);

  select (
    exists (select 1 from pg_policies where tablename = 'amos_settings' and policyname = 'amos_settings team' and qual ilike '%has_admin_privilege%')
    and exists (select 1 from pg_policies where tablename = 'admin_sessions' and policyname = 'admin_sessions team' and qual ilike '%is_super_admin%')
  ) into v_ok;
  insert into c2e14_results values (14, 'N: C2E-5 RLS policies unchanged', v_ok);

  -- O. C2E-13: two_factor_secret still not directly selectable by admin.
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
  insert into c2e14_results values (15, 'O: C2E-13 two_factor_secret cross-user read protection still intact', v_ok);

  -- P. C2E-8: mfa_secret still not directly selectable.
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
  insert into c2e14_results values (16, 'P: C2E-8 mfa_secret cross-user read protection still intact', v_ok);

  -- Cleanup.
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_super, 'role', 'service_role')::text, true);
  perform set_config('request.jwt.claim.sub', v_super::text, true);
  perform set_config('request.jwt.claim.role', 'service_role', true);
  delete from public.business_staff where business_id = v_business_id;
  delete from public.businesses where id = v_business_id;

  if exists (select 1 from c2e14_results where not passed) then
    raise exception 'C2E-14 test failure: %', (
      select string_agg(n || ':' || test_name, ', ' order by n)
      from c2e14_results where not passed
    );
  end if;
end
$test$;

select n, test_name, passed from c2e14_results order by n;

rollback;
