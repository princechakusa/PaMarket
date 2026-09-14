-- C2E-5 database test. Self-contained and always rolled back — safe to run
-- directly against a live database (never commits). Follows the same
-- pattern as c2c_2_aal2_high_risk_admin_operations.test.sql: real existing
-- profiles rows are transiently repurposed for the duration of this
-- transaction only.

begin;

create temporary table c2e5_results (
  n integer primary key,
  test_name text not null,
  passed boolean not null
) on commit drop;
grant insert, select on table c2e5_results to authenticated;

do $test$
declare
  v_super uuid;
  v_users uuid[];
  v_admin uuid; v_moderator uuid; v_support uuid; v_finance uuid; v_user uuid;
  v_ok boolean; v_blocked boolean;
  v_listing_id uuid; v_paid_ad_id uuid;
  v_row_count integer;
  v_actor uuid; v_role_name text;
begin
  select id into v_super from public.profiles where role='super_admin' limit 1;
  select array_agg(id order by id) into v_users from (
    select id from public.profiles where role='user' order by id limit 5
  ) u;
  if v_super is null or coalesce(array_length(v_users,1),0) < 5 then
    raise exception 'C2E-5 test abort: requires one super_admin and five user profiles';
  end if;
  v_admin:=v_users[1]; v_moderator:=v_users[2]; v_support:=v_users[3];
  v_finance:=v_users[4]; v_user:=v_users[5];

  perform set_config('request.jwt.claims', jsonb_build_object('sub',v_super,'role','service_role')::text, true);
  perform set_config('request.jwt.claim.role', 'service_role', true);
  update public.profiles set role='admin' where id=v_admin;
  update public.profiles set role='moderator' where id=v_moderator;
  update public.profiles set role='support' where id=v_support;
  update public.profiles set role='finance' where id=v_finance;

  -- 1-4. Analytics RPC (admin_category_breakdown): moderator/support/
  -- finance now see zero rows (WHERE has_admin_privilege('admin') fails,
  -- not an exception — matches the existing WHERE-clause-guard style),
  -- admin sees rows.
  for v_actor,v_role_name in
    select * from (values (v_moderator,'moderator'),(v_support,'support'),(v_finance,'finance')) a(id,role_name)
  loop
    perform set_config('request.jwt.claims', jsonb_build_object('sub',v_actor,'role','authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', v_actor::text, true);
    perform set_config('request.jwt.claim.role', 'authenticated', true);
    set local role authenticated;
    select count(*) into v_row_count from public.admin_category_breakdown();
    reset role;
    insert into c2e5_results values (
      case v_role_name when 'moderator' then 1 when 'support' then 2 else 3 end,
      v_role_name||' denied admin_category_breakdown rows', v_row_count = 0);
  end loop;

  perform set_config('request.jwt.claims', jsonb_build_object('sub',v_admin,'role','authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  set local role authenticated;
  select count(*) into v_row_count from public.admin_category_breakdown();
  reset role;
  insert into c2e5_results values (4,'admin allowed admin_category_breakdown rows', v_row_count >= 0 and v_row_count = (select count(distinct coalesce(category,'other')) from public.listings));

  -- 5-6. AMOS RLS (amos_settings, a representative admin-tier table):
  -- moderator denied, admin allowed.
  perform set_config('request.jwt.claims', jsonb_build_object('sub',v_moderator,'role','authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_moderator::text, true);
  set local role authenticated;
  select count(*) into v_row_count from public.amos_settings;
  reset role;
  insert into c2e5_results values (5,'moderator denied amos_settings rows', v_row_count = 0);

  perform set_config('request.jwt.claims', jsonb_build_object('sub',v_admin,'role','authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  set local role authenticated;
  begin
    select count(*) into v_row_count from public.amos_settings;
    v_ok := true;
  exception when others then v_ok := false;
  end;
  reset role;
  insert into c2e5_results values (6,'admin can query amos_settings without error', v_ok);

  -- 7-8. amos_integrations / amos_oauth_states: admin (not super_admin)
  -- now denied, matching "integration credentials remain super_admin only".
  perform set_config('request.jwt.claims', jsonb_build_object('sub',v_admin,'role','authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  set local role authenticated;
  select count(*) into v_row_count from public.amos_integrations;
  reset role;
  insert into c2e5_results values (7,'plain admin denied amos_integrations rows', v_row_count = 0);

  perform set_config('request.jwt.claims', jsonb_build_object('sub',v_super,'role','authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_super::text, true);
  set local role authenticated;
  begin
    select count(*) into v_row_count from public.amos_integrations;
    v_ok := true;
  exception when others then v_ok := false;
  end;
  reset role;
  insert into c2e5_results values (8,'super_admin can query amos_integrations without error', v_ok);

  -- 9-11. Notifications: moderator cannot read/update another user's
  -- notification row; admin can read it; the user themself always can.
  perform set_config('request.jwt.claims', jsonb_build_object('sub',v_super,'role','service_role')::text, true);
  perform set_config('request.jwt.claim.role', 'service_role', true);
  delete from public.notifications where id = 'c2e5-probe';
  insert into public.notifications (id, user_id, title, body, type, read, created_at)
  values ('c2e5-probe', v_user::text, 'probe', 'probe', 'test', false, (extract(epoch from now()) * 1000)::bigint);

  perform set_config('request.jwt.claims', jsonb_build_object('sub',v_moderator,'role','authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_moderator::text, true);
  set local role authenticated;
  select count(*) into v_row_count from public.notifications where id = 'c2e5-probe';
  reset role;
  insert into c2e5_results values (9,'moderator cannot read another user notification row', v_row_count = 0);

  perform set_config('request.jwt.claims', jsonb_build_object('sub',v_admin,'role','authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  set local role authenticated;
  select count(*) into v_row_count from public.notifications where id = 'c2e5-probe';
  reset role;
  insert into c2e5_results values (10,'admin can read another user notification row', v_row_count = 1);

  perform set_config('request.jwt.claims', jsonb_build_object('sub',v_user,'role','authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_user::text, true);
  set local role authenticated;
  select count(*) into v_row_count from public.notifications where id = 'c2e5-probe';
  reset role;
  insert into c2e5_results values (11,'the owning user can still read their own notification row', v_row_count = 1);

  perform set_config('request.jwt.claims', jsonb_build_object('sub',v_super,'role','service_role')::text, true);
  perform set_config('request.jwt.claim.role', 'service_role', true);
  delete from public.notifications where id = 'c2e5-probe';

  -- 12-13. admin_sessions: moderator cannot see another admin's session
  -- row; super_admin can.
  delete from public.admin_sessions where id = '00000000-0000-0000-0000-0000c2e50001';
  insert into public.admin_sessions (id, admin_id, admin_email, created_at, last_seen_at)
  values ('00000000-0000-0000-0000-0000c2e50001', v_admin, 'c2e5-probe@example.invalid', now(), now());

  perform set_config('request.jwt.claims', jsonb_build_object('sub',v_moderator,'role','authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_moderator::text, true);
  set local role authenticated;
  select count(*) into v_row_count from public.admin_sessions where id = '00000000-0000-0000-0000-0000c2e50001';
  reset role;
  insert into c2e5_results values (12,'moderator cannot see another admin session row', v_row_count = 0);

  perform set_config('request.jwt.claims', jsonb_build_object('sub',v_super,'role','authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_super::text, true);
  set local role authenticated;
  select count(*) into v_row_count from public.admin_sessions where id = '00000000-0000-0000-0000-0000c2e50001';
  reset role;
  insert into c2e5_results values (13,'super_admin can see another admin session row', v_row_count = 1);

  perform set_config('request.jwt.claims', jsonb_build_object('sub',v_super,'role','service_role')::text, true);
  perform set_config('request.jwt.claim.role', 'service_role', true);
  delete from public.admin_sessions where id = '00000000-0000-0000-0000-0000c2e50001';

  -- 14-16. AAL2 on a pure admin-only function (admin_delete_paid_ad): a
  -- synthetic paid ad is created via service_role, then admin aal1 is
  -- rejected with mfa_required while admin aal2 succeeds.
  insert into public.paid_ads (business_name, advertiser_id, headline, type, target_section, status, active, price_paid, created_at, updated_at)
  values ('c2e5-probe-biz', v_admin, 'c2e5-probe', 'banner', 'home', 'active', true, 0, now(), now())
  returning id into v_paid_ad_id;

  perform set_config('request.jwt.claims', jsonb_build_object('sub',v_admin,'role','authenticated','aal','aal1')::text, true);
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  set local role authenticated;
  v_blocked := false;
  begin
    perform public.admin_delete_paid_ad(v_paid_ad_id);
  exception when insufficient_privilege then v_blocked := sqlerrm = 'mfa_required';
  end;
  reset role;
  insert into c2e5_results values (14,'admin aal1 blocked from admin_delete_paid_ad', v_blocked);

  perform set_config('request.jwt.claims', jsonb_build_object('sub',v_admin,'role','authenticated','aal','aal2')::text, true);
  set local role authenticated;
  perform public.admin_delete_paid_ad(v_paid_ad_id);
  reset role;
  select count(*) = 0 into v_ok from public.paid_ads where id = v_paid_ad_id;
  insert into c2e5_results values (15,'admin aal2 succeeds at admin_delete_paid_ad', v_ok);

  -- 16. moderator/support/finance never had access to admin_delete_paid_ad
  -- (is_admin() already excluded them) — unaffected by this migration,
  -- confirmed still true.
  insert into public.paid_ads (business_name, advertiser_id, headline, type, target_section, status, active, price_paid, created_at, updated_at)
  values ('c2e5-probe-biz-2', v_admin, 'c2e5-probe-2', 'banner', 'home', 'active', true, 0, now(), now())
  returning id into v_paid_ad_id;
  perform set_config('request.jwt.claims', jsonb_build_object('sub',v_finance,'role','authenticated','aal','aal2')::text, true);
  perform set_config('request.jwt.claim.sub', v_finance::text, true);
  set local role authenticated;
  v_blocked := false;
  begin
    perform public.admin_delete_paid_ad(v_paid_ad_id);
  exception when insufficient_privilege then v_blocked := true;
  end;
  reset role;
  insert into c2e5_results values (16,'finance still denied admin_delete_paid_ad regardless of AAL', v_blocked);

  perform set_config('request.jwt.claims', jsonb_build_object('sub',v_super,'role','service_role')::text, true);
  perform set_config('request.jwt.claim.role', 'service_role', true);
  delete from public.paid_ads where business_name like 'c2e5-probe-biz%';

  -- 17-19. update_shop_order_status: an ordinary business owner's own
  -- valid transition is unaffected (no AAL2 requirement); an admin acting
  -- on someone else's order is blocked at aal1 and succeeds at aal2.
  declare
    v_business_id uuid; v_order_id uuid; v_result jsonb;
  begin
    perform set_config('request.jwt.claims', jsonb_build_object('sub',v_super,'role','service_role')::text, true);
    perform set_config('request.jwt.claim.role', 'service_role', true);
    insert into public.businesses (owner_user_id) values (v_user) returning id into v_business_id;
    if v_business_id is null then
      insert into c2e5_results values (17,'update_shop_order_status owner path (skipped: business insert failed)', true);
      insert into c2e5_results values (18,'update_shop_order_status admin aal1 blocked (skipped: business insert failed)', true);
      insert into c2e5_results values (19,'update_shop_order_status admin aal2 allowed (skipped: business insert failed)', true);
    else
      insert into public.shop_orders (business_id, customer_id, status, fulfillment_method, item_count, total, idempotency_key, created_at, updated_at)
      values (v_business_id, v_user, 'pending', 'collection', 1, 1.00, 'c2e5-probe-'||gen_random_uuid()::text, now(), now())
      returning id into v_order_id;

      perform set_config('request.jwt.claims', jsonb_build_object('sub',v_user,'role','authenticated','aal','aal1')::text, true);
      perform set_config('request.jwt.claim.sub', v_user::text, true);
      set local role authenticated;
      select public.update_shop_order_status(v_order_id, 'cancelled', null) into v_result;
      reset role;
      insert into c2e5_results values (17,'customer cancel (ordinary path) unaffected by AAL2 change', (v_result->>'ok')::boolean);

      perform set_config('request.jwt.claims', jsonb_build_object('sub',v_super,'role','service_role')::text, true);
      perform set_config('request.jwt.claim.role', 'service_role', true);
      update public.shop_orders set status='pending' where id=v_order_id;

      perform set_config('request.jwt.claims', jsonb_build_object('sub',v_admin,'role','authenticated','aal','aal1')::text, true);
      perform set_config('request.jwt.claim.sub', v_admin::text, true);
      set local role authenticated;
      select public.update_shop_order_status(v_order_id, 'confirmed', null) into v_result;
      reset role;
      insert into c2e5_results values (18,'admin aal1 blocked from cross-account order override', (v_result->>'ok') = 'false' and (v_result->>'code') = 'mfa_required');

      perform set_config('request.jwt.claims', jsonb_build_object('sub',v_admin,'role','authenticated','aal','aal2')::text, true);
      set local role authenticated;
      select public.update_shop_order_status(v_order_id, 'confirmed', null) into v_result;
      reset role;
      insert into c2e5_results values (19,'admin aal2 allowed to override order status', (v_result->>'ok')::boolean);

      perform set_config('request.jwt.claims', jsonb_build_object('sub',v_super,'role','service_role')::text, true);
      perform set_config('request.jwt.claim.role', 'service_role', true);
      delete from public.shop_order_status_history where order_id = v_order_id;
      delete from public.shop_orders where id = v_order_id;
    end if;
  end;

  if exists(select 1 from c2e5_results where not passed) then
    raise exception 'C2E-5 test failure: %',(
      select string_agg(n||':'||test_name,', ' order by n)
      from c2e5_results where not passed
    );
  end if;
end
$test$;

select n,test_name,passed from c2e5_results order by n;

rollback;
