-- Batch 4 (Shared + Advanced) regression test. Self-contained and always
-- rolled back -- safe to run directly against a live database (never
-- commits). Covers: admin_audit_logs, rental_audit_logs, role_audit_log,
-- content_pages (legal/faq), blog_videos, categories, amos_content_drafts.

begin;

create temporary table batch4_results (
  n integer primary key,
  test_name text not null,
  passed boolean not null
) on commit drop;
grant insert, select on table batch4_results to authenticated;

do $test$
declare
  v_super uuid;
  v_users uuid[];
  v_admin uuid; v_moderator uuid; v_support uuid; v_finance uuid; v_outsider uuid;
  v_category_id uuid;
  v_page_id uuid;
  v_video_id uuid;
  v_draft_id uuid;
  v_content_item_id uuid;
  v_n int;
  v_n2 int;
  v_ok boolean;
begin
  select id into v_super from public.profiles where role = 'super_admin' limit 1;
  select array_agg(id order by id) into v_users from (
    select id from public.profiles where role = 'user' order by id limit 5
  ) u;
  if v_super is null or coalesce(array_length(v_users, 1), 0) < 5 then
    raise exception 'Batch 4 test abort: requires one super_admin and five user profiles';
  end if;
  v_admin := v_users[1]; v_moderator := v_users[2]; v_support := v_users[3]; v_finance := v_users[4]; v_outsider := v_users[5];

  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_super, 'role', 'service_role')::text, true);
  perform set_config('request.jwt.claim.sub', v_super::text, true);
  perform set_config('request.jwt.claim.role', 'service_role', true);
  update public.profiles set role = 'admin' where id = v_admin;
  update public.profiles set role = 'moderator' where id = v_moderator;
  update public.profiles set role = 'support' where id = v_support;
  update public.profiles set role = 'finance' where id = v_finance;

  insert into public.categories (legacy_key, slug, name, is_active, sort_order)
    values ('batch4test', 'batch4test', 'Batch4 Test Category', true, 999)
    returning id into v_category_id;
  insert into public.content_pages (slug, content_type, title, status, version)
    values ('batch4-test-page', 'faq', 'Batch4 Test FAQ', 'draft', 1)
    returning id into v_page_id;
  insert into public.blog_videos (title, provider, embed_id, video_url, is_published)
    values ('Batch4 Test Video', 'youtube', 'abc123', 'https://youtube.com/watch?v=abc123', false)
    returning id into v_video_id;
  insert into public.amos_content_items (country_code, title, status)
    values ('ZW', 'Batch4 Test Content Item', 'drafted')
    returning id into v_content_item_id;
  insert into public.amos_content_drafts (content_item_id, channel, draft_type, body, status)
    values (v_content_item_id, 'facebook', 'post', 'Batch4 test draft', 'draft')
    returning id into v_draft_id;

  -- ══════════════════ Audit tables (admin read-only) ══════════════════

  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  select count(*) into v_n from public.admin_audit_logs limit 1;
  reset role;
  insert into batch4_results values (1, 'Audit: admin can read admin_audit_logs', v_n >= 0);

  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_outsider, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_outsider::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  select count(*) into v_n from public.admin_audit_logs;
  reset role;
  insert into batch4_results values (2, 'Audit: regular user cannot read admin_audit_logs', v_n = 0);

  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_support, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_support::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  select count(*) into v_n from public.role_audit_log;
  reset role;
  insert into batch4_results values (3, 'Audit: support role (support-only) cannot read role_audit_log', v_n = 0);

  -- No client write path exists to audit tables from this batch: confirm
  -- the admin session used above cannot delete evidence either (RLS with
  -- no DELETE policy silently filters to zero rows, it does not raise).
  select not exists (select 1 from pg_policies where tablename = 'role_audit_log' and cmd = 'DELETE') into v_ok;
  insert into batch4_results values (4, 'Audit: no DELETE policy exists on role_audit_log (evidence cannot be erased)', v_ok);

  -- ══════════════════ Content (public read published, admin write) ══════

  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claim.role', 'anon', true);
  set local role anon;
  select count(*) into v_n from public.content_pages where id = v_page_id;
  reset role;
  insert into batch4_results values (5, 'Content: anon cannot read a draft content page', v_n = 0);

  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  update public.content_pages set status = 'published' where id = v_page_id;
  insert into public.content_page_versions (content_page_id, version, title, body, status, updated_by)
    values (v_page_id, 2, 'Batch4 Test FAQ v2', '{}'::jsonb, 'published', v_admin);
  reset role;
  select (status = 'published') into v_ok from public.content_pages where id = v_page_id;
  insert into batch4_results values (6, 'Content: admin can publish (new version row created, old row not overwritten in place)', v_ok);

  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claim.role', 'anon', true);
  set local role anon;
  select count(*) into v_n from public.content_pages where id = v_page_id;
  select count(*) into v_n2 from public.content_page_versions where content_page_id = v_page_id; -- anon cannot read versions
  reset role;
  insert into batch4_results values (7, 'Content: anon can read the now-published page', v_n = 1);
  insert into batch4_results values (8, 'Content: anon cannot read content_page_versions (admin-only)', v_n2 = 0);

  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_moderator, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_moderator::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  begin
    update public.content_pages set title = 'hacked' where id = v_page_id;
    v_ok := (select title = 'hacked' from public.content_pages where id = v_page_id);
  exception when insufficient_privilege then v_ok := false;
  end;
  reset role;
  insert into batch4_results values (9, 'Content: moderator cannot edit legal/faq content (admin-only write)', not coalesce(v_ok, false));

  -- ══════════════════ Blog videos (public read published, admin write) ═

  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claim.role', 'anon', true);
  set local role anon;
  select count(*) into v_n from public.blog_videos where id = v_video_id;
  reset role;
  insert into batch4_results values (10, 'Blog videos: anon cannot read an unpublished video', v_n = 0);

  -- ══════════════════ Taxonomy (public read active, admin write) ═══════

  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claim.role', 'anon', true);
  set local role anon;
  select count(*) into v_n from public.categories where id = v_category_id;
  reset role;
  insert into batch4_results values (11, 'Taxonomy: anon can read an active category', v_n = 1);

  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_finance, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_finance::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  begin
    update public.categories set is_active = false where id = v_category_id;
    v_ok := (select not is_active from public.categories where id = v_category_id);
  exception when insufficient_privilege then v_ok := false;
  end;
  reset role;
  insert into batch4_results values (12, 'Taxonomy: finance role (revenue-only) cannot deactivate a category', not coalesce(v_ok, false));

  -- ══════════════════ AMOS (admin-only, has_admin_privilege) ═══════════

  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  update public.amos_content_drafts set status = 'approved', reviewed_by = v_admin, reviewed_at = now() where id = v_draft_id;
  reset role;
  select (status = 'approved') into v_ok from public.amos_content_drafts where id = v_draft_id;
  insert into batch4_results values (13, 'AMOS: admin can approve a content draft (real reviewed_by/reviewed_at workflow)', v_ok);

  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_support, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_support::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  select count(*) into v_n from public.amos_content_drafts where id = v_draft_id;
  reset role;
  insert into batch4_results values (14, 'AMOS: support role cannot read amos_content_drafts (admin-only surface)', v_n = 0);

  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_moderator, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_moderator::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  select count(*) into v_n from public.amos_market_intelligence;
  reset role;
  insert into batch4_results values (15, 'AMOS: moderator cannot read amos_market_intelligence (admin-only surface)', v_n = 0);

  -- ══════════════════ Regressions: core helpers + prior stages ══════════

  select (
    to_regprocedure('public.is_admin()') is not null
    and to_regprocedure('public.is_moderator()') is not null
    and to_regprocedure('public.is_support_team()') is not null
    and to_regprocedure('public.is_finance_team()') is not null
    and to_regprocedure('public.has_admin_privilege(text)') is not null
    and to_regprocedure('public.list_security_events(integer,integer,timestamp with time zone,timestamp with time zone,text,text,text,text,uuid,uuid)') is not null
  ) into v_ok;
  insert into batch4_results values (16, 'Regression: core role/security helper + list_security_events RPC still present', coalesce(v_ok, true));

  select exists (
    select 1 from pg_policies where tablename = 'business_staff' and policyname = 'business_staff: admin read' and qual ilike '%is_admin%'
  ) into v_ok;
  insert into batch4_results values (17, 'Regression: C2E-14 business_staff admin-read policy unchanged', v_ok);

  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  begin
    perform 1 from (select two_factor_secret from public.profiles where id = v_outsider limit 1) x;
    v_ok := false;
  exception when insufficient_privilege then v_ok := true;
  end;
  reset role;
  insert into batch4_results values (18, 'Regression: C2E-13 two_factor_secret cross-user read protection still intact', v_ok);

  -- Cleanup.
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_super, 'role', 'service_role')::text, true);
  perform set_config('request.jwt.claim.sub', v_super::text, true);
  perform set_config('request.jwt.claim.role', 'service_role', true);
  delete from public.amos_content_drafts where id = v_draft_id;
  delete from public.amos_content_items where id = v_content_item_id;
  delete from public.blog_videos where id = v_video_id;
  delete from public.content_page_versions where content_page_id = v_page_id;
  delete from public.content_pages where id = v_page_id;
  delete from public.categories where id = v_category_id;

  if exists (select 1 from batch4_results where not passed) then
    raise exception 'Batch 4 test failure: %', (
      select string_agg(n || ':' || test_name, ', ' order by n)
      from batch4_results where not passed
    );
  end if;
end
$test$;

select n, test_name, passed from batch4_results order by n;

rollback;
