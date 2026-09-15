-- Content editor fix regression test. content_pages has a real
-- BEFORE UPDATE trigger (content_pages_before_update) that archives the
-- pre-edit row into content_page_versions and increments `version`
-- itself. The admin's updateContentPage() used to ALSO manually insert a
-- version row and set `version` explicitly, fighting the trigger and
-- producing a duplicate/off-by-one history row on every save. This
-- confirms the fixed behaviour: a plain UPDATE produces exactly one new,
-- correctly-content-archived history row and a single version increment.
-- Self-contained and always rolled back.

begin;

create temporary table content_version_results (
  n integer primary key,
  test_name text not null,
  passed boolean not null
) on commit drop;
grant insert, select on table content_version_results to authenticated;

do $test$
declare
  v_admin uuid;
  v_page_id uuid;
  v_before_version int;
  v_after_version int;
  v_history_before int;
  v_history_after int;
  v_archived_body text;
begin
  select id into v_admin from public.profiles where role in ('admin', 'super_admin') limit 1;
  if v_admin is null then
    raise exception 'content_pages version trigger test abort: requires an admin/super_admin profile';
  end if;

  insert into public.content_pages (slug, content_type, title, short_description, body, status, version)
    values ('batch-e2e-test-doc', 'faq', 'Batch E2E Test Doc', 'original description', '{"items": []}'::jsonb, 'draft', 1)
    returning id into v_page_id;

  select version into v_before_version from public.content_pages where id = v_page_id;
  select count(*) into v_history_before from public.content_page_versions where content_page_id = v_page_id;

  -- Exactly what the fixed updateContentPage() does: a plain UPDATE, no
  -- manual content_page_versions insert, no manual version field.
  update public.content_pages set short_description = 'edited description', updated_by = v_admin where id = v_page_id;

  select version into v_after_version from public.content_pages where id = v_page_id;
  select count(*) into v_history_after from public.content_page_versions where content_page_id = v_page_id;
  select short_description into v_archived_body from public.content_page_versions where content_page_id = v_page_id and version = v_before_version;

  insert into content_version_results values (1, 'version increments by exactly 1 on a plain UPDATE', v_after_version = v_before_version + 1);
  insert into content_version_results values (2, 'exactly one new history row is created (not two)', v_history_after = v_history_before + 1);
  insert into content_version_results values (3, 'the archived history row holds the OLD content, not the new edit', v_archived_body = 'original description');

  -- Cleanup: real deletes here (not a rollback-only test row), so remove
  -- the temporary doc and its history explicitly before the rollback --
  -- belt-and-braces since this whole block still rolls back regardless.
  delete from public.content_page_versions where content_page_id = v_page_id;
  delete from public.content_pages where id = v_page_id;

  if exists (select 1 from content_version_results where not passed) then
    raise exception 'content_pages version trigger test failure: %', (
      select string_agg(n || ':' || test_name, ', ' order by n)
      from content_version_results where not passed
    );
  end if;
end
$test$;

select n, test_name, passed from content_version_results order by n;

rollback;
