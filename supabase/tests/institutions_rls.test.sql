-- Institutions Phase 1 database test (public.institutions RLS + validation).
-- Self-contained and always rolled back -- safe to run directly against a
-- live database (never commits). Covers checks 1-20 of the Institutions
-- Phase 1 database-foundation test matrix.

begin;

create temporary table institutions_results (
  n integer primary key,
  test_name text not null,
  passed boolean not null
) on commit drop;
grant insert, select on table institutions_results to authenticated;

do $test$
declare
  v_super uuid;
  v_users uuid[];
  v_admin uuid; v_regular uuid;
  v_harare_province uuid; v_bulawayo_province uuid;
  v_harare_city uuid; v_bulawayo_city uuid;
  v_uni_id uuid; v_hs_id uuid; v_org_id uuid;
  v_ok boolean;
  v_n int;
begin
  select id into v_super from public.profiles where role = 'super_admin' limit 1;
  select array_agg(id order by id) into v_users from (
    select id from public.profiles where role = 'user' order by id limit 2
  ) u;
  if v_super is null or coalesce(array_length(v_users, 1), 0) < 2 then
    raise exception 'Institutions test abort: requires one super_admin and two user profiles';
  end if;
  v_admin := v_users[1]; v_regular := v_users[2];

  select id into v_harare_province from public.provinces where code = 'harare';
  select id into v_bulawayo_province from public.provinces where code = 'bulawayo';
  select id into v_harare_city from public.cities where province_id = v_harare_province limit 1;
  select id into v_bulawayo_city from public.cities where province_id = v_bulawayo_province limit 1;
  if v_harare_province is null or v_bulawayo_province is null or v_harare_city is null or v_bulawayo_city is null then
    raise exception 'Institutions test abort: requires seeded Harare/Bulawayo provinces and at least one city each';
  end if;

  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_super, 'role', 'service_role')::text, true);
  perform set_config('request.jwt.claim.sub', v_super::text, true);
  perform set_config('request.jwt.claim.role', 'service_role', true);
  update public.profiles set role = 'admin' where id = v_admin;
  update public.profiles set role = 'user' where id = v_regular;

  -- ══════════════════ 1. Table exists ═══════════════════════════════════
  insert into institutions_results values (1, 'Table public.institutions exists', to_regclass('public.institutions') is not null);

  -- ══════════════════ 2-4. Valid type inserts succeed (as admin) ════════
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  begin
    insert into public.institutions (type, official_name, province_id, city_id, created_by)
    values ('university', 'Test University (institutions_rls test)', v_harare_province, v_harare_city, v_admin)
    returning id into v_uni_id;
    v_ok := v_uni_id is not null;
  exception when others then v_ok := false;
  end;
  insert into institutions_results values (2, 'Admin: valid university insert succeeds', v_ok);

  begin
    insert into public.institutions (type, official_name, province_id, city_id, created_by)
    values ('high_school', 'Test High School (institutions_rls test)', v_harare_province, v_harare_city, v_admin)
    returning id into v_hs_id;
    v_ok := v_hs_id is not null;
  exception when others then v_ok := false;
  end;
  insert into institutions_results values (3, 'Admin: valid high_school insert succeeds', v_ok);

  begin
    insert into public.institutions (type, official_name, province_id, city_id, is_active, created_by)
    values ('organization', 'Test Organization (institutions_rls test)', v_bulawayo_province, v_bulawayo_city, false, v_admin)
    returning id into v_org_id;
    v_ok := v_org_id is not null;
  exception when others then v_ok := false;
  end;
  insert into institutions_results values (4, 'Admin: valid organization insert succeeds', v_ok);
  reset role;

  -- ══════════════════ 5. Invalid type fails ══════════════════════════════
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  begin
    insert into public.institutions (type, official_name, province_id, city_id)
    values ('college', 'Invalid Type Test', v_harare_province, v_harare_city);
    v_ok := false;
  exception when check_violation then v_ok := true;
  when others then v_ok := false;
  end;
  insert into institutions_results values (5, 'Invalid type value is rejected by CHECK constraint', v_ok);

  -- ══════════════════ 6. Blank/whitespace official name fails ═══════════
  begin
    insert into public.institutions (type, official_name, province_id, city_id)
    values ('university', '   ', v_harare_province, v_harare_city);
    v_ok := false;
  exception when check_violation then v_ok := true;
  when others then v_ok := false;
  end;
  insert into institutions_results values (6, 'Blank/whitespace official_name is rejected by CHECK constraint', v_ok);

  -- ══════════════════ 7-8. Valid province/city FK succeeds ══════════════
  insert into institutions_results values (7, 'Valid province_id FK (used in check 2 insert)', v_uni_id is not null);
  insert into institutions_results values (8, 'Valid city_id FK (used in check 2 insert)', v_uni_id is not null);

  -- ══════════════════ 9. Invalid province FK fails ═══════════════════════
  begin
    insert into public.institutions (type, official_name, province_id, city_id)
    values ('university', 'Bad Province FK Test', gen_random_uuid(), v_harare_city);
    v_ok := false;
  exception when foreign_key_violation then v_ok := true;
  when others then v_ok := false;
  end;
  insert into institutions_results values (9, 'Invalid province_id is rejected by FK constraint', v_ok);

  -- ══════════════════ 10. Invalid city FK fails ══════════════════════════
  begin
    insert into public.institutions (type, official_name, province_id, city_id)
    values ('university', 'Bad City FK Test', v_harare_province, gen_random_uuid());
    v_ok := false;
  exception when foreign_key_violation then v_ok := true;
  when others then v_ok := false;
  end;
  insert into institutions_results values (10, 'Invalid city_id is rejected by FK constraint', v_ok);
  reset role;

  -- ══════════════════ 11. Public (anon) can read active institution ═════
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claim.role', 'anon', true);
  set local role anon;
  select count(*) into v_n from public.institutions where id = v_uni_id;
  reset role;
  insert into institutions_results values (11, 'Public (anon) can read an active institution', v_n = 1);

  -- ══════════════════ 12. Public (anon) cannot read inactive institution ═
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claim.role', 'anon', true);
  set local role anon;
  select count(*) into v_n from public.institutions where id = v_org_id;
  reset role;
  insert into institutions_results values (12, 'Public (anon) cannot read an inactive institution', v_n = 0);

  -- ══════════════════ 13-15. Non-admin cannot insert/update/delete ══════
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_regular, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_regular::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  begin
    insert into public.institutions (type, official_name, province_id, city_id)
    values ('university', 'Regular User Insert Attempt', v_harare_province, v_harare_city);
    v_ok := false;
  exception when insufficient_privilege then v_ok := true;
  when others then v_ok := false;
  end;
  insert into institutions_results values (13, 'Non-admin (regular user) cannot INSERT into institutions', v_ok);

  begin
    update public.institutions set official_name = 'Hacked Name' where id = v_uni_id;
    v_ok := (select official_name from public.institutions where id = v_uni_id) = 'Hacked Name';
  exception when insufficient_privilege then v_ok := false;
  end;
  insert into institutions_results values (14, 'Non-admin (regular user) cannot UPDATE institutions', not coalesce(v_ok, false));

  begin
    delete from public.institutions where id = v_uni_id;
    select count(*) into v_n from public.institutions where id = v_uni_id;
    v_ok := (v_n = 0);
  exception when insufficient_privilege then v_ok := false;
  end;
  insert into institutions_results values (15, 'Non-admin (regular user) cannot DELETE institutions', not coalesce(v_ok, false));
  reset role;

  -- ══════════════════ 16-18. Admin can insert/update/deactivate ═════════
  insert into institutions_results values (16, 'Admin can INSERT institutions (checks 2-4 above)', v_uni_id is not null and v_hs_id is not null and v_org_id is not null);

  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  begin
    update public.institutions set short_name = 'TU' where id = v_uni_id;
    v_ok := (select short_name from public.institutions where id = v_uni_id) = 'TU';
  exception when others then v_ok := false;
  end;
  insert into institutions_results values (17, 'Admin can UPDATE an institution', v_ok);

  begin
    update public.institutions set is_active = false, updated_by = v_admin where id = v_uni_id;
    v_ok := (select not is_active from public.institutions where id = v_uni_id);
  exception when others then v_ok := false;
  end;
  insert into institutions_results values (18, 'Admin can deactivate an institution', v_ok);
  reset role;

  -- ══════════════════ 19. Admin can access inactive institution ═════════
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  select count(*) into v_n from public.institutions where id in (v_uni_id, v_org_id);
  reset role;
  insert into institutions_results values (19, 'Admin can read inactive institutions (both v_uni_id [just deactivated] and v_org_id)', v_n = 2);

  -- ══════════════════ 20. Duplicate protection behaves as intended ══════
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  begin
    insert into public.institutions (type, official_name, province_id, city_id)
    values ('high_school', 'test high school (institutions_rls test)', v_harare_province, v_harare_city);
    v_ok := false;
  exception when unique_violation then v_ok := true;
  when others then v_ok := false;
  end;
  insert into institutions_results values (20, 'Duplicate (case-insensitive official_name + city_id) is rejected', v_ok);
  reset role;

  -- ══════════════════ Cleanup ═════════════════════════════════════════
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_super, 'role', 'service_role')::text, true);
  perform set_config('request.jwt.claim.sub', v_super::text, true);
  perform set_config('request.jwt.claim.role', 'service_role', true);
  delete from public.institutions where id in (v_uni_id, v_hs_id, v_org_id);
  update public.profiles set role = 'user' where id in (v_admin, v_regular);

  if exists (select 1 from institutions_results where not passed) then
    raise exception 'Institutions RLS test failure: %', (
      select string_agg(n || ':' || test_name, ', ' order by n)
      from institutions_results where not passed
    );
  end if;
end
$test$;

select n, test_name, passed from institutions_results order by n;

rollback;
