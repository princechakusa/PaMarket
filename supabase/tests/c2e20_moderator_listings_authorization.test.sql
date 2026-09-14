-- C2E-20 database test. Self-contained and always rolled back — safe to run
-- directly against a live database (never commits).

begin;

create temporary table c2e20_results (
  n integer primary key,
  test_name text not null,
  passed boolean not null
) on commit drop;
grant insert, select on table c2e20_results to authenticated;

do $test$
declare
  v_super uuid;
  v_users uuid[];
  v_seller uuid; v_admin uuid; v_moderator uuid; v_support uuid; v_regular uuid;
  v_verify_user uuid;
  v_listing_id uuid;
  v_verification_id uuid;
  v_ok boolean;
  v_n int;
begin
  select id into v_super from public.profiles where role = 'super_admin' limit 1;
  select array_agg(id order by id) into v_users from (
    select id from public.profiles where role = 'user' order by id limit 5
  ) u;
  if v_super is null or coalesce(array_length(v_users, 1), 0) < 5 then
    raise exception 'C2E-20 test abort: requires one super_admin and five user profiles';
  end if;
  v_seller := v_users[1]; v_admin := v_users[2]; v_moderator := v_users[3];
  v_support := v_users[4]; v_regular := v_users[5];

  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_super, 'role', 'service_role')::text, true);
  perform set_config('request.jwt.claim.sub', v_super::text, true);
  perform set_config('request.jwt.claim.role', 'service_role', true);
  update public.profiles set role = 'admin' where id = v_admin;
  update public.profiles set role = 'moderator' where id = v_moderator;
  update public.profiles set role = 'support' where id = v_support;

  insert into public.listings (seller_id, title, category, status, price, currency)
    values (v_seller, 'C2E-20 Test Listing', 'other', 'pending', 10, 'USD')
    returning id into v_listing_id;
  select p.id into v_verify_user from public.profiles p
    where p.role = 'user' and not exists (select 1 from public.verifications v where v.user_id = p.id)
    order by p.id limit 1;
  if v_verify_user is null then
    raise exception 'C2E-20 test abort: no user profile without an existing verification row';
  end if;
  insert into public.verifications (user_id, status)
    values (v_verify_user, 'pending')
    returning id into v_verification_id;

  -- ══════════════════ LISTINGS: moderator now authorized ══════════════════

  -- A. admin can read the pending (non-active) listing.
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  select count(*) into v_n from public.listings where id = v_listing_id;
  reset role;
  insert into c2e20_results values (1, 'A: admin reads pending listing (unchanged)', v_n = 1);

  -- B. admin can update the listing status.
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  update public.listings set status = 'active' where id = v_listing_id;
  reset role;
  select (status = 'active') into v_ok from public.listings where id = v_listing_id;
  insert into c2e20_results values (2, 'B: admin updates listing status (unchanged)', v_ok);

  -- C. super_admin can read and update.
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_super, 'role', 'service_role')::text, true);
  perform set_config('request.jwt.claim.sub', v_super::text, true);
  perform set_config('request.jwt.claim.role', 'service_role', true);
  update public.listings set status = 'pending' where id = v_listing_id;
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_super, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  select count(*) into v_n from public.listings where id = v_listing_id;
  update public.listings set status = 'flagged' where id = v_listing_id;
  reset role;
  select (status = 'flagged') into v_ok from public.listings where id = v_listing_id;
  insert into c2e20_results values (3, 'C: super_admin reads and updates listing (unchanged)', v_n = 1 and v_ok);

  -- D. moderator can NOW read the pending/flagged listing (the fix).
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_moderator, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_moderator::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  select count(*) into v_n from public.listings where id = v_listing_id;
  reset role;
  insert into c2e20_results values (4, 'D: moderator now reads non-active listing (was the bug)', v_n = 1);

  -- E. moderator can NOW update the listing status (the fix).
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_moderator, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_moderator::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  update public.listings set status = 'under_review' where id = v_listing_id;
  reset role;
  select (status = 'under_review') into v_ok from public.listings where id = v_listing_id;
  insert into c2e20_results values (5, 'E: moderator now updates listing status (was the bug)', v_ok);

  -- F. moderator still CANNOT delete a listing (unchanged, out of this fix's scope).
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_moderator, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_moderator::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  delete from public.listings where id = v_listing_id;
  reset role;
  select exists(select 1 from public.listings where id = v_listing_id) into v_ok;
  insert into c2e20_results values (6, 'F: moderator still cannot DELETE a listing (unchanged)', v_ok);

  -- G. support still cannot read/update non-active listings (not granted).
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_support, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_support::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  select count(*) into v_n from public.listings where id = v_listing_id;
  reset role;
  insert into c2e20_results values (7, 'G: support still cannot read non-active listing', v_n = 0);

  -- H. regular (non-seller) user cannot read the non-active listing.
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_regular, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_regular::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  select count(*) into v_n from public.listings where id = v_listing_id;
  reset role;
  insert into c2e20_results values (8, 'H: regular user cannot read another user''s non-active listing', v_n = 0);

  -- I. Owner (seller) can still read their own non-active listing (unchanged).
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_seller, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_seller::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  select count(*) into v_n from public.listings where id = v_listing_id;
  reset role;
  insert into c2e20_results values (9, 'I: seller still reads own non-active listing (unchanged)', v_n = 1);

  -- J. Owner cannot escalate status via the owner-scoped update path beyond
  -- what "listings: update own" already allowed (unchanged policy).
  select exists (
    select 1 from pg_policies where tablename = 'listings' and policyname = 'listings: update own' and qual = '(auth.uid() = seller_id)'
  ) into v_ok;
  insert into c2e20_results values (10, 'J: owner-scoped "listings: update own" policy is unchanged', v_ok);

  -- K. anon cannot read the listing at all (no active-public match, no grant path).
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claim.role', 'anon', true);
  set local role anon;
  select count(*) into v_n from public.listings where id = v_listing_id;
  reset role;
  insert into c2e20_results values (11, 'K: anon cannot read the non-active listing', v_n = 0);

  -- ══════════════════ VERIFICATIONS: moderator remains denied ══════════════════

  -- L. admin can still read/update verifications (unchanged).
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  select count(*) into v_n from public.verifications where id = v_verification_id;
  update public.verifications set status = 'approved' where id = v_verification_id;
  reset role;
  select (status = 'approved') into v_ok from public.verifications where id = v_verification_id;
  insert into c2e20_results values (12, 'L: admin still reads/updates verifications (unchanged)', v_n = 1 and v_ok);

  -- M. super_admin can still read/update verifications (unchanged).
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_super, 'role', 'service_role')::text, true);
  perform set_config('request.jwt.claim.sub', v_super::text, true);
  perform set_config('request.jwt.claim.role', 'service_role', true);
  update public.verifications set status = 'pending' where id = v_verification_id;
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_super, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  select count(*) into v_n from public.verifications where id = v_verification_id;
  reset role;
  insert into c2e20_results values (13, 'M: super_admin still reads verifications (unchanged)', v_n = 1);

  -- N. moderator remains DENIED read access to verifications (the deliberate non-fix).
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_moderator, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_moderator::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  select count(*) into v_n from public.verifications where id = v_verification_id;
  reset role;
  insert into c2e20_results values (14, 'N: moderator remains denied verification read access (deliberate)', v_n = 0);

  -- O. moderator remains DENIED update access to verifications.
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_moderator, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_moderator::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  update public.verifications set status = 'approved' where id = v_verification_id;
  reset role;
  select (status = 'pending') into v_ok from public.verifications where id = v_verification_id;
  insert into c2e20_results values (15, 'O: moderator remains denied verification write access (deliberate)', v_ok);

  -- P. support remains denied verification access.
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_support, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_support::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  select count(*) into v_n from public.verifications where id = v_verification_id;
  reset role;
  insert into c2e20_results values (16, 'P: support remains denied verification access', v_n = 0);

  -- Q. anon remains denied verification access.
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claim.role', 'anon', true);
  set local role anon;
  begin
    select count(*) into v_n from public.verifications where id = v_verification_id;
    v_ok := (v_n = 0);
  exception when insufficient_privilege then v_ok := true;
  end;
  reset role;
  insert into c2e20_results values (17, 'Q: anon remains denied verification access', v_ok);

  -- R. business_verifications RLS is untouched (spot-check the policy text).
  select exists (
    select 1 from pg_policies where tablename = 'business_verifications' and policyname = 'biz_verif: admin all' and qual = 'is_admin()'
  ) into v_ok;
  insert into c2e20_results values (18, 'R: business_verifications RLS unchanged (still is_admin() only)', v_ok);

  -- ══════════════════ Sensitive-data regression ══════════════════

  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_moderator, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_moderator::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  begin
    perform 1 from (select mfa_secret from public.profiles where id = v_seller limit 1) x;
    v_ok := false;
  exception when insufficient_privilege then v_ok := true;
  end;
  reset role;
  insert into c2e20_results values (19, 'S: moderator still cannot select mfa_secret', v_ok);

  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_moderator, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_moderator::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  begin
    perform 1 from (select two_factor_secret from public.profiles where id = v_seller limit 1) x;
    v_ok := false;
  exception when insufficient_privilege then v_ok := true;
  end;
  reset role;
  insert into c2e20_results values (20, 'T: moderator still cannot select two_factor_secret', v_ok);

  -- ══════════════════ Regressions ══════════════════

  select (
    to_regprocedure('public.is_admin()') is not null
    and to_regprocedure('public.is_moderator()') is not null
    and to_regprocedure('public.is_support_team()') is not null
    and to_regprocedure('public.is_admin_team()') is not null
    and to_regprocedure('public.has_admin_privilege(text)') is not null
    and to_regprocedure('public.is_super_admin()') is not null
  ) into v_ok;
  insert into c2e20_results values (21, 'U: all relevant helper functions still present', v_ok);

  select exists (
    select 1 from pg_policies where tablename = 'business_staff' and policyname = 'business_staff: admin read' and qual ilike '%is_admin%'
  ) into v_ok;
  insert into c2e20_results values (22, 'V: C2E-14 business_staff admin read policy unchanged', v_ok);

  select exists (
    select 1 from pg_policies where tablename = 'business_payments' and policyname = 'admin_read_all_payments' and qual ilike '%is_admin%' and qual not ilike '%role = ''admin''%'
  ) into v_ok;
  insert into c2e20_results values (23, 'W: C2E-15 business_payments super_admin fix unchanged', v_ok);

  select exists (
    select 1 from pg_policies where tablename = 'profiles' and policyname = 'profiles: owner or staff read' and qual = '((auth.uid() = id) OR is_moderator() OR is_support_team())'
  ) into v_ok;
  insert into c2e20_results values (24, 'X: C2E-19 profiles staff-read policy unchanged', v_ok);

  -- Cleanup.
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_super, 'role', 'service_role')::text, true);
  perform set_config('request.jwt.claim.sub', v_super::text, true);
  perform set_config('request.jwt.claim.role', 'service_role', true);
  delete from public.verifications where id = v_verification_id;
  delete from public.listings where id = v_listing_id;

  if exists (select 1 from c2e20_results where not passed) then
    raise exception 'C2E-20 test failure: %', (
      select string_agg(n || ':' || test_name, ', ' order by n)
      from c2e20_results where not passed
    );
  end if;
end
$test$;

select n, test_name, passed from c2e20_results order by n;

rollback;
