-- Institutions Phase 4 database test: search_active_jobs() institution
-- visibility exclusion. Self-contained and always rolled back -- safe to
-- run directly against a live database (never commits). The Post Ad UI
-- changes (attributes.institution_visibility, institution_id association)
-- have no schema/RLS surface of their own to test -- both columns already
-- existed and were already covered by Phase 1's tests -- so this is the
-- one genuinely new server-side behaviour this phase introduced.

begin;

create temporary table inst_vis_results (
  n integer primary key,
  test_name text not null,
  passed boolean not null
) on commit drop;
grant insert, select on table inst_vis_results to authenticated;

do $test$
declare
  v_super uuid;
  v_seller uuid;
  v_public_job uuid;
  v_institution_only_job uuid;
  v_normal_job_no_attrs uuid;
  v_found_public boolean;
  v_found_institution_only boolean;
  v_found_no_attrs boolean;
begin
  select id into v_super from public.profiles where role = 'super_admin' limit 1;
  select id into v_seller from public.profiles where role = 'user' limit 1;
  if v_super is null or v_seller is null then
    raise exception 'institution_visibility test abort: requires one super_admin and one user profile';
  end if;

  -- Test fixture setup only -- category='jobs' listings can only be
  -- inserted directly by service_role/admin (trg_enforce_job_insert_via_rpc
  -- blocks every other authenticated insert, by design, to close a real
  -- revenue bypass around create_job_listing's credit/entitlement checks).
  -- This confirms that trigger is itself working correctly, and is exactly
  -- why Phase 4 does not attempt a direct-insert institution/jobs path.
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_super, 'role', 'service_role')::text, true);
  perform set_config('request.jwt.claim.sub', v_super::text, true);
  perform set_config('request.jwt.claim.role', 'service_role', true);

  insert into public.listings (seller_id, title, category, price, status, attributes)
  values (v_seller, 'Test Job PUBLIC (institution_visibility test)', 'jobs', 1, 'active', '{"institution_visibility":"public"}'::jsonb)
  returning id into v_public_job;

  insert into public.listings (seller_id, title, category, price, status, attributes)
  values (v_seller, 'Test Job INSTITUTION ONLY (institution_visibility test)', 'jobs', 1, 'active', '{"institution_visibility":"institution_only"}'::jsonb)
  returning id into v_institution_only_job;

  -- A normal, pre-existing-shape job with no institution_visibility key at
  -- all -- the case that must NOT be silently excluded (the whole reason
  -- the fix uses coalesce(...) <> 'institution_only' rather than a bare
  -- not-equal against a column that's NULL for every ordinary listing).
  insert into public.listings (seller_id, title, category, price, status, attributes)
  values (v_seller, 'Test Job NO ATTRS (institution_visibility test)', 'jobs', 1, 'active', '{}'::jsonb)
  returning id into v_normal_job_no_attrs;

  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_seller, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_seller::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;

  select exists(select 1 from public.search_active_jobs('institution_visibility test', null, 50, 0) j where j.id = v_public_job) into v_found_public;
  select exists(select 1 from public.search_active_jobs('institution_visibility test', null, 50, 0) j where j.id = v_institution_only_job) into v_found_institution_only;
  select exists(select 1 from public.search_active_jobs('institution_visibility test', null, 50, 0) j where j.id = v_normal_job_no_attrs) into v_found_no_attrs;

  insert into inst_vis_results values (1, 'search_active_jobs still returns a "public" institution-visibility job', v_found_public);
  insert into inst_vis_results values (2, 'search_active_jobs excludes an "institution_only" job', not v_found_institution_only);
  insert into inst_vis_results values (3, 'search_active_jobs still returns a normal job with no institution_visibility key at all (regression guard)', v_found_no_attrs);

  -- Cleanup.
  delete from public.listings where id in (v_public_job, v_institution_only_job, v_normal_job_no_attrs);
  reset role;

  if exists (select 1 from inst_vis_results where not passed) then
    raise exception 'institution_visibility test failure: %', (
      select string_agg(n || ':' || test_name, ', ' order by n)
      from inst_vis_results where not passed
    );
  end if;
end
$test$;

select n, test_name, passed from inst_vis_results order by n;

rollback;
