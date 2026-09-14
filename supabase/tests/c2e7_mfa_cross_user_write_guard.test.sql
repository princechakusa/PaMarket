-- C2E-7 database test. Self-contained and always rolled back — safe to run
-- directly against a live database (never commits).

begin;

create temporary table c2e7_results (
  n integer primary key,
  test_name text not null,
  passed boolean not null
) on commit drop;
grant insert, select on table c2e7_results to authenticated;

do $test$
declare
  v_super uuid;
  v_users uuid[];
  v_owner uuid; v_admin uuid; v_moderator uuid;
  v_ok boolean;
begin
  select id into v_super from public.profiles where role = 'super_admin' limit 1;
  select array_agg(id order by id) into v_users from (
    select id from public.profiles where role = 'user' order by id limit 3
  ) u;
  if v_super is null or coalesce(array_length(v_users, 1), 0) < 3 then
    raise exception 'C2E-7 test abort: requires one super_admin and three user profiles';
  end if;
  v_owner := v_users[1]; v_admin := v_users[2]; v_moderator := v_users[3];

  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_super, 'role', 'service_role')::text, true);
  perform set_config('request.jwt.claim.role', 'service_role', true);
  update public.profiles set role = 'admin' where id = v_admin;
  update public.profiles set role = 'moderator' where id = v_moderator;
  -- Clean starting state for the owner row under test. mfa_enabled is a
  -- generated column (derived from mfa_secret) and cannot be set directly.
  update public.profiles set two_factor_secret = null, two_factor_enabled = false,
    mfa_secret = null where id = v_owner;

  -- A. Owner updates their own two_factor_secret -> PASS.
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_owner, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  update public.profiles set two_factor_secret = 'c2e7-owner-secret' where id = v_owner;
  reset role;
  select two_factor_secret = 'c2e7-owner-secret' into v_ok from public.profiles where id = v_owner;
  insert into c2e7_results values (1, 'A: owner updates own two_factor_secret', v_ok);

  -- B. Owner updates their own two_factor_enabled -> PASS.
  set local role authenticated;
  update public.profiles set two_factor_enabled = true where id = v_owner;
  reset role;
  select two_factor_enabled = true into v_ok from public.profiles where id = v_owner;
  insert into c2e7_results values (2, 'B: owner updates own two_factor_enabled', v_ok);

  -- C. Staff (moderator) attempts to update owner's two_factor_secret -> BLOCKED.
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_moderator, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_moderator::text, true);
  set local role authenticated;
  update public.profiles set two_factor_secret = 'c2e7-attacker-secret' where id = v_owner;
  reset role;
  select two_factor_secret = 'c2e7-owner-secret' into v_ok from public.profiles where id = v_owner;
  insert into c2e7_results values (3, 'C: staff blocked from writing another user''s two_factor_secret', v_ok);

  -- D. Staff (moderator) attempts to update owner's two_factor_enabled -> BLOCKED.
  set local role authenticated;
  update public.profiles set two_factor_enabled = false where id = v_owner;
  reset role;
  select two_factor_enabled = true into v_ok from public.profiles where id = v_owner;
  insert into c2e7_results values (4, 'D: staff blocked from writing another user''s two_factor_enabled', v_ok);

  -- E. Staff (admin, higher rank) attempts to update owner's mfa_secret -> BLOCKED.
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_admin, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  set local role authenticated;
  update public.profiles set mfa_secret = 'c2e7-attacker-mfa' where id = v_owner;
  reset role;
  select mfa_secret is null into v_ok from public.profiles where id = v_owner;
  insert into c2e7_results values (5, 'E: admin (even at AAL2) blocked from writing another user''s mfa_secret', v_ok);

  -- F. mfa_enabled is GENERATED ALWAYS AS (mfa_secret IS NOT NULL) STORED
  -- — nobody can write it directly (confirmed live: a direct UPDATE of it
  -- errors). Since E already proved the attacker's mfa_secret write was
  -- blocked, mfa_enabled is protected by construction: it stays derived
  -- from the real (unchanged) mfa_secret value.
  select mfa_enabled = false into v_ok from public.profiles where id = v_owner;
  insert into c2e7_results values (6, 'F: mfa_enabled stays correctly derived (generated column, no direct write possible)', v_ok);

  -- G. Administrator's own legacy mfa_secret flow (www/admin.html's own
  -- write, always scoped to the caller's own uid) remains functional.
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  set local role authenticated;
  update public.profiles set mfa_secret = 'c2e7-admin-own-secret' where id = v_admin;
  reset role;
  select mfa_secret = 'c2e7-admin-own-secret' into v_ok from public.profiles where id = v_admin;
  insert into c2e7_results values (7, 'G: admin can still set their OWN legacy mfa_secret (admin.html flow)', v_ok);

  -- H. Native Supabase MFA unaffected: has_mfa_aal2() still present/callable.
  select (to_regprocedure('public.has_mfa_aal2()') is not null) into v_ok;
  insert into c2e7_results values (8, 'H: has_mfa_aal2() still present (native MFA unaffected)', v_ok);

  -- I. C2E-4: admin-login-guard policy helper unaffected.
  select (to_regprocedure('public.is_admin_team()') is not null) into v_ok;
  insert into c2e7_results values (9, 'I: C2E-4-adjacent helpers unaffected', v_ok);

  -- J. C2E-5: spot-check amos_settings/admin_sessions policies unchanged.
  select (
    exists (select 1 from pg_policies where tablename = 'amos_settings' and policyname = 'amos_settings team' and qual ilike '%has_admin_privilege%')
    and exists (select 1 from pg_policies where tablename = 'admin_sessions' and policyname = 'admin_sessions team' and qual ilike '%is_super_admin%')
  ) into v_ok;
  insert into c2e7_results values (10, 'J: C2E-5 RLS policies unchanged', v_ok);

  -- K. C2E-6: profiles_public view still has its narrowed column set.
  select not exists (
    select 1 from information_schema.columns
    where table_name = 'profiles_public' and column_name in ('role','status','privacy')
  ) into v_ok;
  insert into c2e7_results values (11, 'K: C2E-6 profiles_public narrowing unchanged', v_ok);

  -- Cleanup: restore the owner row's MFA/2FA columns and role assignments.
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_super, 'role', 'service_role')::text, true);
  perform set_config('request.jwt.claim.role', 'service_role', true);
  update public.profiles set two_factor_secret = null, two_factor_enabled = false,
    mfa_secret = null where id in (v_owner, v_admin);

  if exists (select 1 from c2e7_results where not passed) then
    raise exception 'C2E-7 test failure: %', (
      select string_agg(n || ':' || test_name, ', ' order by n)
      from c2e7_results where not passed
    );
  end if;
end
$test$;

select n, test_name, passed from c2e7_results order by n;

rollback;
