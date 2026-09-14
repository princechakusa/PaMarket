-- Batch 3 (Platform + Operations) regression test. Self-contained and always
-- rolled back -- safe to run directly against a live database (never commits).
-- Covers: businesses, support_tickets/support_ticket_messages,
-- contact_requests, app_error_events, app_settings, notifications.

begin;

create temporary table batch3_results (
  n integer primary key,
  test_name text not null,
  passed boolean not null
) on commit drop;
grant insert, select on table batch3_results to authenticated;

do $test$
declare
  v_super uuid;
  v_users uuid[];
  v_owner uuid; v_admin uuid; v_moderator uuid; v_support uuid; v_finance uuid; v_outsider uuid;
  v_business_id uuid;
  v_ticket_id uuid;
  v_error_id uuid;
  v_contact_id uuid;
  v_notif_id text;
  v_ok boolean;
  v_n int;
begin
  select id into v_super from public.profiles where role = 'super_admin' limit 1;
  select array_agg(id order by id) into v_users from (
    select id from public.profiles where role = 'user' order by id limit 6
  ) u;
  if v_super is null or coalesce(array_length(v_users, 1), 0) < 6 then
    raise exception 'Batch 3 test abort: requires one super_admin and six user profiles';
  end if;
  v_owner := v_users[1]; v_admin := v_users[2]; v_moderator := v_users[3];
  v_support := v_users[4]; v_finance := v_users[5]; v_outsider := v_users[6];

  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_super, 'role', 'service_role')::text, true);
  perform set_config('request.jwt.claim.sub', v_super::text, true);
  perform set_config('request.jwt.claim.role', 'service_role', true);
  update public.profiles set role = 'admin' where id = v_admin;
  update public.profiles set role = 'moderator' where id = v_moderator;
  update public.profiles set role = 'support' where id = v_support;
  update public.profiles set role = 'finance' where id = v_finance;

  insert into public.businesses (owner_user_id, name, status)
    values (v_owner, 'Batch3 Test Business', 'draft')
    returning id into v_business_id;
  insert into public.support_tickets (subject, status, priority, category)
    values ('Batch3 test ticket', 'open', 'normal', 'general')
    returning id into v_ticket_id;
  insert into public.app_error_events (fingerprint, error_type, message, status, severity)
    values ('batch3-test-' || gen_random_uuid()::text, 'Batch3TestError', 'test message', 'open', 'error')
    returning id into v_error_id;
  insert into public.contact_requests (requester_id, candidate_id, requester_name, candidate_name, status)
    values (v_owner, v_outsider, 'Batch3 Requester', 'Batch3 Candidate', 'pending')
    returning id into v_contact_id;
  v_notif_id := gen_random_uuid()::text;

  -- ══════════════════ Businesses (is_admin()) ══════════════════

  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  select count(*) into v_n from public.businesses where id = v_business_id;
  reset role;
  insert into batch3_results values (1, 'Businesses: admin can read', v_n = 1);

  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_moderator, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_moderator::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  select count(*) into v_n from public.businesses where id = v_business_id;
  reset role;
  insert into batch3_results values (2, 'Businesses: moderator cannot read another business (not admin-team)', v_n = 0);

  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claim.role', 'anon', true);
  set local role anon;
  select count(*) into v_n from public.businesses where id = v_business_id;
  reset role;
  insert into batch3_results values (3, 'Businesses: anon cannot read a draft business', v_n = 0);

  -- ══════════════════ Support tickets (is_support_team()) ══════════════════

  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_support, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_support::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  select count(*) into v_n from public.support_tickets where id = v_ticket_id;
  reset role;
  insert into batch3_results values (4, 'Support tickets: support role can read (is_support_team unchanged)', v_n = 1);

  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_support, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_support::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  insert into public.support_ticket_messages (ticket_id, author_id, author_kind, body, internal)
    values (v_ticket_id, v_support, 'staff', 'Batch3 reply', false);
  reset role;
  select count(*) into v_n from public.support_ticket_messages where ticket_id = v_ticket_id;
  insert into batch3_results values (5, 'Support tickets: support can send a ticket message', v_n = 1);

  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_finance, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_finance::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  select count(*) into v_n from public.support_tickets where id = v_ticket_id;
  reset role;
  insert into batch3_results values (6, 'Support tickets: finance role (revenue-only) cannot read tickets', v_n = 0);

  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claim.role', 'anon', true);
  set local role anon;
  select count(*) into v_n from public.support_tickets where id = v_ticket_id;
  reset role;
  insert into batch3_results values (7, 'Support tickets: anon cannot read', v_n = 0);

  -- ══════════════════ Contact requests (is_admin() only -- documented mismatch) ══════════════════

  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  select count(*) into v_n from public.contact_requests where id = v_contact_id;
  reset role;
  insert into batch3_results values (8, 'Contact requests: admin can read', v_n = 1);

  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_support, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_support::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  select count(*) into v_n from public.contact_requests where id = v_contact_id;
  reset role;
  insert into batch3_results values (9, 'Contact requests: support role CANNOT read (RLS is is_admin()-only; a real mismatch vs the support.manage nav permission, documented not fixed)', v_n = 0);

  -- ══════════════════ Error events (admin) ══════════════════

  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  select count(*) into v_n from public.app_error_events where id = v_error_id;
  reset role;
  insert into batch3_results values (10, 'Error events: admin can read', v_n = 1);

  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_outsider, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_outsider::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  select count(*) into v_n from public.app_error_events where id = v_error_id;
  reset role;
  insert into batch3_results values (11, 'Error events: regular user cannot read', v_n = 0);

  -- ══════════════════ app_settings (anon read, admin write) ══════════════════

  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claim.role', 'anon', true);
  set local role anon;
  select count(*) into v_n from public.app_settings where id = 1;
  reset role;
  insert into batch3_results values (12, 'app_settings: anon can read (public config feed, unchanged)', v_n = 1);

  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_outsider, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_outsider::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  update public.app_settings set updated_at = now() where id = 1;
  reset role;
  select (updated_at is null or updated_at < now() - interval '1 minute') into v_ok from public.app_settings where id = 1;
  insert into batch3_results values (13, 'app_settings: regular user cannot write', coalesce(v_ok, true));

  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  update public.app_settings set updated_at = now() where id = 1;
  reset role;
  select (updated_at is not null and updated_at > now() - interval '1 minute') into v_ok from public.app_settings where id = 1;
  insert into batch3_results values (14, 'app_settings: admin can write', coalesce(v_ok, false));

  -- ══════════════════ Notifications (self or admin insert; own read) ══════════════════

  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  insert into public.notifications (id, user_id, title, body, type)
    values (v_notif_id, v_outsider, 'Batch3 test', 'hello', 'admin');
  reset role;
  select count(*) into v_n from public.notifications where id = v_notif_id;
  insert into batch3_results values (15, 'Notifications: admin can send to another user', v_n = 1);

  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_outsider, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_outsider::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  select count(*) into v_n from public.notifications where id = v_notif_id;
  reset role;
  insert into batch3_results values (16, 'Notifications: recipient can read their own notification', v_n = 1);

  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_moderator, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_moderator::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  select count(*) into v_n from public.notifications where id = v_notif_id;
  reset role;
  insert into batch3_results values (17, 'Notifications: unrelated moderator cannot read another user''s notification', v_n = 0);

  -- ══════════════════ Regressions: C2E-6/7/8/13/14/15 spot-checks ══════════════════

  select (
    to_regprocedure('public.is_admin()') is not null
    and to_regprocedure('public.is_moderator()') is not null
    and to_regprocedure('public.is_support_team()') is not null
    and to_regprocedure('public.is_finance_team()') is not null
    and to_regprocedure('public.has_admin_privilege(text)') is not null
    and to_regprocedure('public.get_my_mfa_secret()') is not null
    and to_regprocedure('public.get_my_two_factor_secret()') is not null
  ) into v_ok;
  insert into batch3_results values (18, 'Regression: core role/security helper functions still present', v_ok);

  select exists (
    select 1 from pg_policies where tablename = 'business_staff' and policyname = 'business_staff: admin read' and qual ilike '%is_admin%'
  ) into v_ok;
  insert into batch3_results values (19, 'Regression: C2E-14 business_staff admin-read policy unchanged', v_ok);

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
  insert into batch3_results values (20, 'Regression: C2E-13 two_factor_secret cross-user read protection still intact', v_ok);

  -- Cleanup.
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_super, 'role', 'service_role')::text, true);
  perform set_config('request.jwt.claim.sub', v_super::text, true);
  perform set_config('request.jwt.claim.role', 'service_role', true);
  delete from public.notifications where id = v_notif_id;
  delete from public.contact_requests where id = v_contact_id;
  delete from public.app_error_events where id = v_error_id;
  delete from public.support_ticket_messages where ticket_id = v_ticket_id;
  delete from public.support_tickets where id = v_ticket_id;
  delete from public.businesses where id = v_business_id;

  if exists (select 1 from batch3_results where not passed) then
    raise exception 'Batch 3 test failure: %', (
      select string_agg(n || ':' || test_name, ', ' order by n)
      from batch3_results where not passed
    );
  end if;
end
$test$;

select n, test_name, passed from batch3_results order by n;

rollback;
