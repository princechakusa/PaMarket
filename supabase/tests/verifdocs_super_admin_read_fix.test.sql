-- Fix test: "verifdocs admin select" on storage.objects previously checked
-- profiles.role = 'admin' literally, blocking every super_admin session
-- from reading verification-docs (the only staff role in production).
-- Self-contained and always rolled back.

begin;

create temporary table verifdocs_results (
  n integer primary key,
  test_name text not null,
  passed boolean not null
) on commit drop;
grant insert, select on table verifdocs_results to authenticated;

do $test$
declare
  v_super uuid;
  v_users uuid[];
  v_admin uuid; v_moderator uuid; v_outsider uuid;
  v_object_path text := 'verification/test-fixture-user/id_test.jpg';
  v_object_id uuid;
  v_n int;
begin
  select id into v_super from public.profiles where role = 'super_admin' limit 1;
  select array_agg(id order by id) into v_users from (
    select id from public.profiles where role = 'user' order by id limit 3
  ) u;
  if v_super is null or coalesce(array_length(v_users, 1), 0) < 3 then
    raise exception 'verifdocs fix test abort: requires one super_admin and three user profiles';
  end if;
  v_admin := v_users[1]; v_moderator := v_users[2]; v_outsider := v_users[3];

  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_super, 'role', 'service_role')::text, true);
  perform set_config('request.jwt.claim.sub', v_super::text, true);
  perform set_config('request.jwt.claim.role', 'service_role', true);
  update public.profiles set role = 'admin' where id = v_admin;
  update public.profiles set role = 'moderator' where id = v_moderator;

  insert into storage.objects (bucket_id, name, owner)
    values ('verification-docs', v_object_path, v_super)
    returning id into v_object_id;

  -- A. super_admin (the actual production bug) can now read the object row.
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_super, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_super::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  select count(*) into v_n from storage.objects where id = v_object_id;
  reset role;
  insert into verifdocs_results values (1, 'super_admin can now read verification-docs objects (was the bug)', v_n = 1);

  -- B. literal 'admin' role still works (no regression).
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  select count(*) into v_n from storage.objects where id = v_object_id;
  reset role;
  insert into verifdocs_results values (2, 'admin can read verification-docs objects (unchanged)', v_n = 1);

  -- C. moderator (not admin-team) still denied.
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_moderator, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_moderator::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  select count(*) into v_n from storage.objects where id = v_object_id;
  reset role;
  insert into verifdocs_results values (3, 'moderator still denied read on verification-docs (not broadened)', v_n = 0);

  -- D. unrelated regular user still denied.
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_outsider, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_outsider::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  select count(*) into v_n from storage.objects where id = v_object_id;
  reset role;
  insert into verifdocs_results values (4, 'unrelated user still denied read on another user''s verification doc', v_n = 0);

  -- E. anon still denied.
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claim.role', 'anon', true);
  set local role anon;
  select count(*) into v_n from storage.objects where id = v_object_id;
  reset role;
  insert into verifdocs_results values (5, 'anon still denied read on verification-docs', v_n = 0);

  -- No cleanup delete needed/possible -- storage.objects has a
  -- protect_delete() trigger that blocks direct DELETE even for
  -- service_role; the enclosing transaction's rollback removes the test
  -- row instead.

  if exists (select 1 from verifdocs_results where not passed) then
    raise exception 'verifdocs fix test failure: %', (
      select string_agg(n || ':' || test_name, ', ' order by n)
      from verifdocs_results where not passed
    );
  end if;
end
$test$;

select n, test_name, passed from verifdocs_results order by n;

rollback;
