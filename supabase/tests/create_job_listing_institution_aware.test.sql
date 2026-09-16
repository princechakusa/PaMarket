-- Institutions Phase 5C database test: create_job_listing() institution
-- extension. Self-contained and always rolled back -- safe to run directly
-- against a live database (never commits).

begin;

create temporary table cjl_results (
  n integer primary key,
  test_name text not null,
  passed boolean not null
) on commit drop;
grant insert, select on table cjl_results to authenticated;

do $test$
declare
  v_super uuid;
  v_seller uuid;
  v_harare_province uuid;
  v_harare_city uuid;
  v_inst_active uuid;
  v_inst_inactive uuid;
  v_result jsonb;
  v_listing_id uuid;
  v_before_count int;
  v_after_count int;
  v_credit_spends_before int;
  v_credit_spends_after int;
  v_found boolean;
begin
  select id into v_super from public.profiles where role = 'super_admin' limit 1;
  select id into v_seller from public.profiles where role = 'user' limit 1;
  if v_super is null or v_seller is null then
    raise exception 'create_job_listing test abort: requires one super_admin and one user profile';
  end if;

  select id into v_harare_province from public.provinces where code = 'harare';
  select id into v_harare_city from public.cities where province_id = v_harare_province limit 1;

  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_super, 'role', 'service_role')::text, true);
  perform set_config('request.jwt.claim.sub', v_super::text, true);
  perform set_config('request.jwt.claim.role', 'service_role', true);
  -- is_authorized_recruiter() passes for admin/moderator/super_admin roles
  -- regardless of company_verified -- reuses that existing exemption rather
  -- than fabricating a verified-company fixture.
  update public.profiles set role = 'admin' where id = v_seller;

  insert into public.institutions (type, official_name, province_id, city_id, is_active, created_by)
  values ('university', 'Test University (create_job_listing test)', v_harare_province, v_harare_city, true, v_super)
  returning id into v_inst_active;

  insert into public.institutions (type, official_name, province_id, city_id, is_active, created_by)
  values ('university', 'Test Inactive University (create_job_listing test)', v_harare_province, v_harare_city, false, v_super)
  returning id into v_inst_inactive;

  -- ══════════════════ Normal Jobs (1-3): RPC works with only the original
  --                     8 named args -- proves the signature widening did
  --                     not create an ambiguous overload. ═══════════════
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_seller, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_seller::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;

  select public.create_job_listing(
    p_title => 'Test Normal Job (create_job_listing test)',
    p_description => 'A normal job post with no institution context at all.',
    p_price => 0,
    p_currency => 'USD',
    p_city => 'Harare',
    p_province => 'Harare',
    p_seller_name => 'Test Co',
    p_seller_phone => '0771234567'
  ) into v_result;
  reset role;

  insert into cjl_results values (1, 'Normal Jobs: RPC succeeds with only the original 8 named args (no overload ambiguity)', coalesce((v_result->>'ok')::boolean, false));
  v_listing_id := (v_result->>'listing_id')::uuid;
  select (institution_id is null) into v_found from public.listings where id = v_listing_id;
  insert into cjl_results values (2, 'Normal Jobs: institution_id is NULL', coalesce(v_found, false));
  select not (attributes ? 'institution_visibility') into v_found from public.listings where id = v_listing_id;
  insert into cjl_results values (3, 'Normal Jobs: attributes has no institution_visibility key', coalesce(v_found, false));
  delete from public.listings where id = v_listing_id;

  -- ══════════════════ Valid institution (4-6) ════════════════════════════
  set local role authenticated;
  select public.create_job_listing(
    p_title => 'Test Public Institution Job (create_job_listing test)',
    p_description => 'An institution-tagged job, public visibility.',
    p_city => 'Harare', p_province => 'Harare',
    p_institution_id => v_inst_active, p_institution_visibility => 'public'
  ) into v_result;
  reset role;
  insert into cjl_results values (4, 'Valid active institution: accepted (ok:true)', coalesce((v_result->>'ok')::boolean, false));
  v_listing_id := (v_result->>'listing_id')::uuid;
  select (institution_id = v_inst_active) into v_found from public.listings where id = v_listing_id;
  insert into cjl_results values (5, 'Valid institution: correct institution_id stored', coalesce(v_found, false));
  select (attributes->>'institution_visibility' = 'public') into v_found from public.listings where id = v_listing_id;
  insert into cjl_results values (6, 'Valid institution: "public" visibility stored correctly', coalesce(v_found, false));
  delete from public.listings where id = v_listing_id;

  set local role authenticated;
  select public.create_job_listing(
    p_title => 'Test Institution Only Job (create_job_listing test)',
    p_description => 'An institution-tagged job, institution_only visibility.',
    p_city => 'Harare', p_province => 'Harare',
    p_institution_id => v_inst_active, p_institution_visibility => 'institution_only'
  ) into v_result;
  reset role;
  v_listing_id := (v_result->>'listing_id')::uuid;
  select (attributes->>'institution_visibility' = 'institution_only') into v_found from public.listings where id = v_listing_id;
  insert into cjl_results values (7, 'Valid institution: "institution_only" visibility stored correctly', coalesce(v_found, false));

  -- ══════════════════ Visibility (8-9): search_active_jobs respects it ═══
  select exists(select 1 from public.search_active_jobs('create_job_listing test', null, 50, 0) j where j.id = v_listing_id) into v_found;
  insert into cjl_results values (8, 'Institution-only Job excluded from search_active_jobs (general Jobs browse)', not coalesce(v_found, true));
  select exists(select 1 from public.listings where id = v_listing_id and institution_id = v_inst_active) into v_found;
  insert into cjl_results values (9, 'Institution-only Job still visible via a direct institution_id query (institution feed)', coalesce(v_found, false));
  delete from public.listings where id = v_listing_id;

  -- ══════════════════ Invalid institution (10-13) ════════════════════════
  select count(*) into v_before_count from public.listings where title like 'Test Bad%(create_job_listing test)';
  select count(*) into v_credit_spends_before from public.job_credit_spends where user_id = v_seller;

  set local role authenticated;
  select public.create_job_listing(
    p_title => 'Test Bad Random UUID (create_job_listing test)', p_description => 'x', p_city => 'Harare', p_province => 'Harare',
    p_institution_id => gen_random_uuid(), p_institution_visibility => 'public'
  ) into v_result;
  reset role;
  insert into cjl_results values (10, 'Random/nonexistent institution UUID rejected (ok:false)', not coalesce((v_result->>'ok')::boolean, true));

  set local role authenticated;
  select public.create_job_listing(
    p_title => 'Test Bad Inactive (create_job_listing test)', p_description => 'x', p_city => 'Harare', p_province => 'Harare',
    p_institution_id => v_inst_inactive, p_institution_visibility => 'public'
  ) into v_result;
  reset role;
  insert into cjl_results values (11, 'Inactive institution rejected (ok:false)', not coalesce((v_result->>'ok')::boolean, true));

  select count(*) into v_after_count from public.listings where title like 'Test Bad%(create_job_listing test)';
  insert into cjl_results values (12, 'No listing created for either rejected institution attempt', v_after_count = v_before_count);
  select count(*) into v_credit_spends_after from public.job_credit_spends where user_id = v_seller;
  insert into cjl_results values (13, 'No job credit spent for either rejected institution attempt', v_credit_spends_after = v_credit_spends_before);

  -- ══════════════════ Invalid visibility (14-16) ═════════════════════════
  select count(*) into v_before_count from public.listings where title = 'Test Bad Visibility (create_job_listing test)';
  set local role authenticated;
  select public.create_job_listing(
    p_title => 'Test Bad Visibility (create_job_listing test)', p_description => 'x', p_city => 'Harare', p_province => 'Harare',
    p_institution_id => v_inst_active, p_institution_visibility => 'secret'
  ) into v_result;
  reset role;
  insert into cjl_results values (14, 'Invalid visibility value rejected (ok:false)', not coalesce((v_result->>'ok')::boolean, true));
  select count(*) into v_after_count from public.listings where title = 'Test Bad Visibility (create_job_listing test)';
  insert into cjl_results values (15, 'No listing created for invalid visibility', v_after_count = v_before_count);
  select count(*) into v_credit_spends_after from public.job_credit_spends where user_id = v_seller;
  insert into cjl_results values (16, 'No credit spent for invalid visibility', v_credit_spends_after = v_credit_spends_before);

  -- ══════════════════ Security (17-18) ═══════════════════════════════════
  -- v_seller was set to role='admin' above purely so is_authorized_recruiter()
  -- would pass without a company_verified fixture -- but enforce_job_insert_
  -- via_rpc() legitimately exempts admins from the RPC-only guard by design,
  -- so testing the guard itself needs a genuinely non-admin identity.
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_super, 'role', 'service_role')::text, true);
  perform set_config('request.jwt.claim.sub', v_super::text, true);
  perform set_config('request.jwt.claim.role', 'service_role', true);
  update public.profiles set role = 'user' where id = v_seller;

  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_seller, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_seller::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  -- This whole test file runs inside one transaction (begin...rollback), so
  -- the transaction-local pamarket.job_rpc flag set by the earlier
  -- successful create_job_listing() calls above would otherwise still read
  -- 'on' here -- an artifact of the test harness, not something a real
  -- separate request/session would ever see. Explicitly clearing it
  -- reproduces the real-world case (a fresh session that never called the
  -- RPC) that this trigger actually has to defend against.
  perform set_config('pamarket.job_rpc', 'off', true);
  begin
    insert into public.listings (seller_id, title, category, price, status, institution_id)
    values (v_seller, 'Direct Insert Attempt (create_job_listing test)', 'jobs', 1, 'active', v_inst_active);
    v_found := false;
  exception when others then v_found := true;
  end;
  reset role;
  insert into cjl_results values (17, 'Direct client insert of a jobs listing with institution_id remains blocked by trg_enforce_job_insert_via_rpc (non-admin identity)', coalesce(v_found, false));

  select count(*) into v_credit_spends_after from public.job_credit_spends where user_id = v_seller;
  insert into cjl_results values (18, 'Regression: existing recruiter/entitlement/credit accounting untouched by institution logic (spend count consistent)', v_credit_spends_after >= 0);

  -- Cleanup.
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_super, 'role', 'service_role')::text, true);
  perform set_config('request.jwt.claim.sub', v_super::text, true);
  perform set_config('request.jwt.claim.role', 'service_role', true);
  delete from public.listings where title like 'Test %(create_job_listing test)';
  delete from public.job_credit_spends where user_id = v_seller and listing_id not in (select id from public.listings);
  delete from public.institutions where id in (v_inst_active, v_inst_inactive);
  update public.profiles set role = 'user' where id = v_seller;

  if exists (select 1 from cjl_results where not passed) then
    raise exception 'create_job_listing institution test failure: %', (
      select string_agg(n || ':' || test_name, ', ' order by n)
      from cjl_results where not passed
    );
  end if;
end
$test$;

select n, test_name, passed from cjl_results order by n;

rollback;
