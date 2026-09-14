-- C2E-6 database test. Self-contained and always rolled back — safe to run
-- directly against a live database (never commits).

begin;

create temporary table c2e6_results (
  n integer primary key,
  test_name text not null,
  passed boolean not null
) on commit drop;
grant insert, select on table c2e6_results to authenticated;

do $test$
declare
  v_probe_id uuid;
  v_ok boolean;
  v_cols text[];
begin
  select id into v_probe_id from public.profiles limit 1;
  if v_probe_id is null then
    raise exception 'C2E-6 test abort: requires at least one profiles row';
  end if;

  -- 1. profiles_public view no longer exposes role/status/privacy/
  -- updated_at/language as columns at all.
  select array_agg(column_name order by column_name) into v_cols
  from information_schema.columns where table_name = 'profiles_public';
  insert into c2e6_results values (1, 'role/status/privacy/updated_at/language dropped from profiles_public',
    not (v_cols && array['role','status','privacy','updated_at','language']));

  -- 2. profiles_public still exposes the real consumer columns.
  insert into c2e6_results values (2, 'profiles_public keeps id/name/avatar/verified/bio/city/created_at/last_seen/phone',
    v_cols @> array['id','name','avatar','verified','bio','city','created_at','last_seen','phone']);

  -- 3. Anonymous public-profile viewing still works (the core regression
  -- risk of this whole change).
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  set local role anon;
  select (name is not distinct from name) into v_ok from public.profiles_public where id = v_probe_id;
  reset role;
  insert into c2e6_results values (3, 'anon can still read a profiles_public row', v_ok);

  -- 4. anon cannot select role/status/privacy directly off profiles_public
  -- (columns no longer exist to select at all).
  begin
    perform 1 from (select role from public.profiles_public limit 1) x;
    v_ok := false;
  exception when undefined_column then v_ok := true;
  end;
  insert into c2e6_results values (4, 'role column no longer selectable from profiles_public', v_ok);

  -- 5. anon has no column privileges on the four MFA/2FA columns.
  select not (
    has_column_privilege('anon', 'public.profiles', 'mfa_secret', 'SELECT') or
    has_column_privilege('anon', 'public.profiles', 'mfa_secret', 'UPDATE') or
    has_column_privilege('anon', 'public.profiles', 'mfa_enabled', 'SELECT') or
    has_column_privilege('anon', 'public.profiles', 'mfa_enabled', 'UPDATE') or
    has_column_privilege('anon', 'public.profiles', 'two_factor_secret', 'SELECT') or
    has_column_privilege('anon', 'public.profiles', 'two_factor_secret', 'UPDATE') or
    has_column_privilege('anon', 'public.profiles', 'two_factor_enabled', 'SELECT') or
    has_column_privilege('anon', 'public.profiles', 'two_factor_enabled', 'UPDATE')
  ) into v_ok;
  insert into c2e6_results values (5, 'anon has no SELECT/UPDATE on any MFA/2FA column', v_ok);

  -- 6. authenticated's two_factor_secret/two_factor_enabled access.
  -- SUPERSEDED NOTE (C2E-13): direct SELECT on two_factor_secret was
  -- intentionally revoked in C2E-13 (owner reads now go through
  -- get_my_two_factor_secret()) — this assertion originally expected
  -- SELECT=true; updated to expect SELECT=false so this test doesn't
  -- permanently report a false regression against C2E-13's own change.
  -- UPDATE and two_factor_enabled SELECT/UPDATE remain unchanged.
  select (
    not has_column_privilege('authenticated', 'public.profiles', 'two_factor_secret', 'SELECT') and
    has_column_privilege('authenticated', 'public.profiles', 'two_factor_secret', 'UPDATE') and
    has_column_privilege('authenticated', 'public.profiles', 'two_factor_enabled', 'SELECT') and
    has_column_privilege('authenticated', 'public.profiles', 'two_factor_enabled', 'UPDATE')
  ) into v_ok;
  insert into c2e6_results values (6, 'authenticated: two_factor_secret SELECT revoked (C2E-13), UPDATE/enabled unaffected', v_ok);

  -- 7. authenticated's mfa_secret access.
  -- SUPERSEDED NOTE (C2E-8, discovered stale while re-running this file for
  -- C2E-13's regression pass): direct SELECT on mfa_secret was revoked in
  -- C2E-8 (admin.html's own MFA toggle now goes through get_my_mfa_secret()
  -- instead) — this assertion originally expected SELECT=true; updated to
  -- expect false so this test doesn't permanently report a false
  -- regression against C2E-8's already-shipped change. UPDATE is unaffected.
  select (
    not has_column_privilege('authenticated', 'public.profiles', 'mfa_secret', 'SELECT') and
    has_column_privilege('authenticated', 'public.profiles', 'mfa_secret', 'UPDATE')
  ) into v_ok;
  insert into c2e6_results values (7, 'authenticated: mfa_secret SELECT revoked (C2E-8), UPDATE unaffected', v_ok);

  -- 8. profiles_public grants are SELECT-only for both roles (the fresh
  -- CREATE VIEW picked up this project's default-privileges ALL grant;
  -- caught and corrected during verification).
  select not (
    has_table_privilege('anon', 'public.profiles_public', 'INSERT') or
    has_table_privilege('anon', 'public.profiles_public', 'UPDATE') or
    has_table_privilege('anon', 'public.profiles_public', 'DELETE') or
    has_table_privilege('authenticated', 'public.profiles_public', 'INSERT') or
    has_table_privilege('authenticated', 'public.profiles_public', 'UPDATE') or
    has_table_privilege('authenticated', 'public.profiles_public', 'DELETE')
  ) into v_ok;
  insert into c2e6_results values (8, 'profiles_public grants are SELECT-only for anon and authenticated', v_ok);

  -- 9. Native MFA / C2E-5 helpers unaffected — still present and callable.
  select (to_regprocedure('public.has_mfa_aal2()') is not null
      and to_regprocedure('public.is_admin()') is not null
      and to_regprocedure('public.is_admin_team()') is not null
      and to_regprocedure('public.has_admin_privilege(text)') is not null
      and to_regprocedure('public.is_super_admin()') is not null)
    into v_ok;
  insert into c2e6_results values (9, 'C2E-5/native-MFA helper functions still present', v_ok);

  -- 10. C2E-5 RLS objects spot-check: amos_settings and admin_sessions
  -- policies still reference the C2E-5 functions, unchanged by this stage.
  select (
    exists (select 1 from pg_policies where tablename = 'amos_settings' and policyname = 'amos_settings team' and qual ilike '%has_admin_privilege%')
    and exists (select 1 from pg_policies where tablename = 'admin_sessions' and policyname = 'admin_sessions team' and qual ilike '%is_super_admin%')
  ) into v_ok;
  insert into c2e6_results values (10, 'C2E-5 RLS policies (amos_settings, admin_sessions) unchanged', v_ok);

  if exists(select 1 from c2e6_results where not passed) then
    raise exception 'C2E-6 test failure: %',(
      select string_agg(n||':'||test_name,', ' order by n)
      from c2e6_results where not passed
    );
  end if;
end
$test$;

select n,test_name,passed from c2e6_results order by n;

rollback;
