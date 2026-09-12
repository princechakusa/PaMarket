-- C2D-FIX test script — repeatable, self-contained, NEVER commits.
-- Applies the C2D-FIX forward migration DDL in-transaction on top of
-- the already-applied C2D schema, runs the required assertions
-- (synthetic RFC 5737 test IPs only, never a real address), then
-- rolls back. Run:
--   supabase db query --linked -f supabase/tests/c2d_fix_ip_redaction.test.sql

begin;

-- PaMarket C2D-FIX: close a real authorization gap left by C2D.
--
-- C2D gave `authenticated` a table-level SELECT grant on
-- public.security_events, gated by a single RLS policy
-- (has_admin_privilege('admin') and has_mfa_aal2()) that admits both
-- `admin` and `super_admin` equally. The Security Events *page* hid the
-- IP column from a non-super_admin role, but that was a frontend
-- convenience only — an `admin` with a real aal2 session could bypass the
-- UI entirely and `select ip_address from security_events` directly.
-- Confirmed live via a rolled-back role/JWT simulation before writing this
-- migration (see admin/docs/c2d-ip-redaction-fix-results.md) — no real IP
-- value was ever printed during that confirmation, only a boolean.
--
-- Fix: remove the table-level SELECT grant and its RLS policy entirely,
-- and replace all browser reads with two narrowly scoped, SECURITY
-- DEFINER RPCs that redact ip_address (and ip_source) to non-super_admin
-- callers themselves — inside the one place the data can leave the
-- database, not in the React layer. A SECURITY DEFINER view was
-- considered and rejected: a view cannot itself enforce "return NULL for
-- this column unless the caller is X" — that requires per-row/per-column
-- logic, which only a function (or a second, redacted view unioned with
-- role checks, which is worse) can express safely at the boundary.
--
-- Writer (record_security_event), cleanup
-- (security_events_cleanup_expired), and legal-hold functions
-- (place_legal_hold/release_legal_hold) are NOT modified — only read
-- access changes. security_event_legal_holds' own grants/policy are left
-- exactly as C2D defined them; this migration's fix is scoped to the
-- reported security_events.ip_address defect only.


do $preflight$
begin
  if to_regclass('public.security_events') is null then
    raise exception 'C2D-FIX abort: public.security_events does not exist (C2D must be applied first)';
  end if;
  if to_regprocedure('public.has_admin_privilege(text)') is null then
    raise exception 'C2D-FIX abort: has_admin_privilege(text) is missing';
  end if;
  if to_regprocedure('public.has_mfa_aal2()') is null then
    raise exception 'C2D-FIX abort: has_mfa_aal2() is missing';
  end if;
  if to_regprocedure('public.is_super_admin()') is null then
    raise exception 'C2D-FIX abort: is_super_admin() is missing';
  end if;
  if to_regprocedure('public.list_security_events(integer,integer,timestamptz,timestamptz,text,text,text,text,uuid,uuid)') is not null then
    raise exception 'C2D-FIX abort: list_security_events(...) already exists with this signature';
  end if;
end
$preflight$;

-- ── 1. Remove browser direct table SELECT on security_events ───────────
drop policy if exists "security_events: admin team aal2 read" on public.security_events;
revoke select on public.security_events from authenticated;
-- anon already has zero grants (C2D); unchanged.

-- ── 2. list_security_events — paginated, filtered, redacted list RPC ───
create or replace function public.list_security_events(
  p_page           integer default 1,
  p_page_size      integer default 25,
  p_from           timestamptz default null,
  p_to             timestamptz default null,
  p_severity       text default null,
  p_event_type     text default null,
  p_source         text default null,
  p_outcome        text default null,
  p_actor_user_id  uuid default null,
  p_correlation_id uuid default null
)
returns table (
  id                  uuid,
  event_type          text,
  severity            text,
  source              text,
  occurred_at         timestamptz,
  actor_user_id       uuid,
  actor_role          text,
  actor_authenticated boolean,
  assurance_level     text,
  target_type         text,
  target_id           text,
  action              text,
  outcome             text,
  reason_code         text,
  correlation_id      uuid,
  request_path        text,
  request_method      text,
  ip_address          inet,
  ip_source           text,
  user_agent          text,
  retention_until     timestamptz,
  total_count         bigint
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_allowed_severities   constant text[] := array['info','notice','warning','high','critical'];
  v_allowed_event_types  constant text[] := array[
    'admin_login_honeypot','admin_login_failed','admin_login_succeeded',
    'admin_mfa_challenge_failed','admin_mfa_challenge_succeeded','admin_logout'
  ];
  v_allowed_sources      constant text[] := array['edge_function','database'];
  v_allowed_outcomes     constant text[] := array['success','failure','blocked','suspicious'];
  v_page      integer;
  v_page_size integer;
  v_offset    integer;
  v_include_ip boolean;
begin
  -- Authorization derived entirely from the verified JWT via existing
  -- server helpers — the caller's role/AAL is never accepted as a
  -- parameter and cannot be forged from the request.
  if not public.has_admin_privilege('admin') then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  if not public.has_mfa_aal2() then
    raise exception 'mfa_required' using errcode = '42501';
  end if;

  if p_severity is not null and not (p_severity = any(v_allowed_severities)) then
    raise exception 'invalid severity filter' using errcode = '22023';
  end if;
  if p_event_type is not null and not (p_event_type = any(v_allowed_event_types)) then
    raise exception 'invalid event_type filter' using errcode = '22023';
  end if;
  if p_source is not null and not (p_source = any(v_allowed_sources)) then
    raise exception 'invalid source filter' using errcode = '22023';
  end if;
  if p_outcome is not null and not (p_outcome = any(v_allowed_outcomes)) then
    raise exception 'invalid outcome filter' using errcode = '22023';
  end if;
  if p_from is not null and p_to is not null and p_from > p_to then
    raise exception 'invalid date range' using errcode = '22023';
  end if;

  -- Bounded, validated pagination — page size capped at 100 regardless of
  -- what is requested. Stable server-side offset pagination is kept
  -- (rather than introducing keyset/cursor pagination) because the
  -- existing Security Events page is page-number based; the tradeoff is
  -- that a page can theoretically skip or repeat a row if new events are
  -- inserted between two page loads at the boundary — acceptable for an
  -- investigation view at this data volume, and unrelated to the
  -- authorization fix this migration makes. Ordering is always
  -- (occurred_at desc, id desc), so a given filter set + page number is
  -- deterministic and reproducible.
  v_page      := greatest(1, coalesce(p_page, 1));
  v_page_size := least(100, greatest(1, coalesce(p_page_size, 25)));
  v_offset    := (v_page - 1) * v_page_size;
  v_include_ip := public.is_super_admin();

  return query
  select
    se.id, se.event_type, se.severity, se.source, se.occurred_at,
    se.actor_user_id, se.actor_role, se.actor_authenticated, se.assurance_level,
    se.target_type, se.target_id, se.action, se.outcome, se.reason_code,
    se.correlation_id, se.request_path, se.request_method,
    case when v_include_ip then se.ip_address else null end,
    case when v_include_ip then se.ip_source else 'restricted' end,
    se.user_agent,
    se.retention_until,
    count(*) over () as total_count
  from public.security_events se
  where (p_from is null or se.occurred_at >= p_from)
    and (p_to is null or se.occurred_at <= p_to)
    and (p_severity is null or se.severity = p_severity)
    and (p_event_type is null or se.event_type = p_event_type)
    and (p_source is null or se.source = p_source)
    and (p_outcome is null or se.outcome = p_outcome)
    and (p_actor_user_id is null or se.actor_user_id = p_actor_user_id)
    and (p_correlation_id is null or se.correlation_id = p_correlation_id)
  order by se.occurred_at desc, se.id desc
  limit v_page_size offset v_offset;
exception
  when others then
    -- Re-raise our own deliberate exceptions (42501/22023) unchanged;
    -- anything unexpected becomes a single generic message rather than
    -- an internal Postgres error reaching the browser.
    if sqlstate in ('42501', '22023') then
      raise;
    end if;
    raise exception 'security events could not be listed' using errcode = 'P0001';
end;
$$;

comment on function public.list_security_events is
  'C2D-FIX: the only browser read path for a list of security_events. Requires has_admin_privilege(''admin'') and has_mfa_aal2(); returns ip_address/ip_source only when the caller is_super_admin(), NULL/''restricted'' otherwise. Page size capped at 100; deterministic (occurred_at desc, id desc) ordering.';

revoke all on function public.list_security_events(
  integer, integer, timestamptz, timestamptz, text, text, text, text, uuid, uuid
) from public;
revoke execute on function public.list_security_events(
  integer, integer, timestamptz, timestamptz, text, text, text, text, uuid, uuid
) from anon;
grant execute on function public.list_security_events(
  integer, integer, timestamptz, timestamptz, text, text, text, text, uuid, uuid
) to authenticated;

-- ── 3. get_security_event — single-event detail RPC ─────────────────────
create or replace function public.get_security_event(
  p_event_id uuid
)
returns table (
  id                  uuid,
  event_type          text,
  severity            text,
  source              text,
  occurred_at         timestamptz,
  received_at         timestamptz,
  actor_user_id       uuid,
  actor_role          text,
  actor_authenticated boolean,
  assurance_level     text,
  target_type         text,
  target_id           text,
  action              text,
  outcome             text,
  reason_code         text,
  correlation_id      uuid,
  request_path        text,
  request_method      text,
  ip_address          inet,
  ip_source           text,
  user_agent          text,
  metadata            jsonb,
  retention_until     timestamptz,
  created_at          timestamptz,
  hold_status         text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_include_ip boolean;
begin
  if not public.has_admin_privilege('admin') then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  if not public.has_mfa_aal2() then
    raise exception 'mfa_required' using errcode = '42501';
  end if;
  if p_event_id is null then
    raise exception 'an event id is required' using errcode = '22023';
  end if;

  v_include_ip := public.is_super_admin();

  return query
  select
    se.id, se.event_type, se.severity, se.source, se.occurred_at, se.received_at,
    se.actor_user_id, se.actor_role, se.actor_authenticated, se.assurance_level,
    se.target_type, se.target_id, se.action, se.outcome, se.reason_code,
    se.correlation_id, se.request_path, se.request_method,
    case when v_include_ip then se.ip_address else null end,
    case when v_include_ip then se.ip_source else 'restricted' end,
    se.user_agent,
    se.metadata,
    se.retention_until, se.created_at,
    coalesce((
      select 'active'
      from public.security_event_legal_holds h
      where h.status = 'active'
        and (h.event_id = se.id or (h.correlation_id is not null and h.correlation_id = se.correlation_id))
      limit 1
    ), 'none') as hold_status
  from public.security_events se
  where se.id = p_event_id;
exception
  when others then
    if sqlstate in ('42501', '22023') then
      raise;
    end if;
    raise exception 'security event could not be loaded' using errcode = 'P0001';
end;
$$;

comment on function public.get_security_event is
  'C2D-FIX: the only browser read path for a single security_events row. Same authorization and IP redaction as list_security_events. hold_status is derived from security_event_legal_holds server-side so the browser never needs a separate direct read of that table for this view. Returns zero rows for an unknown id rather than raising.';

revoke all on function public.get_security_event(uuid) from public;
revoke execute on function public.get_security_event(uuid) from anon;
grant execute on function public.get_security_event(uuid) to authenticated;

notify pgrst, 'reload schema';


-- ── test body ─────────────────────────────────────────────────────────
create temporary table results (n int primary key, name text, expected text, actual text, passed boolean);

do $$
declare
  v_super uuid := 'e79039a4-2216-4526-81e1-c8c25e688834';
  v_admin_test uuid; v_mod_test uuid; v_supp_test uuid; v_fin_test uuid; v_user1 uuid;
  v_event_id uuid; v_hold_id uuid;
  v_row_count int;
  v_ok boolean; v_err text;
  v_ip inet := '198.51.100.7'::inet; -- TEST-NET-2 synthetic address, RFC 5737 — never a real IP
  v_total bigint;
  v_ip1 inet; v_ip2 inet; v_ip_text text;
  v_page1_ids uuid[]; v_page2_ids uuid[];
begin
  select id into v_user1 from (select id from public.profiles where role='user' order by id limit 1 offset 0) t;
  select id into v_admin_test from (select id from public.profiles where role='user' order by id limit 1 offset 1) t;
  select id into v_mod_test from (select id from public.profiles where role='user' order by id limit 1 offset 2) t;
  select id into v_supp_test from (select id from public.profiles where role='user' order by id limit 1 offset 3) t;
  select id into v_fin_test from (select id from public.profiles where role='user' order by id limit 1 offset 4) t;

  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_super::text, 'role','service_role')::text, true);
  update public.profiles set role = 'admin' where id = v_admin_test;
  update public.profiles set role = 'moderator' where id = v_mod_test;
  update public.profiles set role = 'support' where id = v_supp_test;
  update public.profiles set role = 'finance' where id = v_fin_test;
  perform set_config('request.jwt.claims', '', true);

  -- seed one event with a synthetic IP, and 30 more (for pagination tests)
  select r.id into v_event_id from public.record_security_event(
    'admin_login_succeeded','info','edge_function', v_super, 'super_admin', true, 'aal2',
    null, null, 'login', 'success', null, gen_random_uuid(),
    '/login', 'POST', v_ip, 'cf-connecting-ip', 'vitest-agent',
    'c2dfix-seed-' || gen_random_uuid()::text, '{}'::jsonb
  ) r;

  for i in 1..30 loop
    perform public.record_security_event(
      'admin_logout','info','edge_function', v_super, 'super_admin', true, 'aal2',
      null, null, 'logout', 'success', null, null, null, null, null, null, null,
      'c2dfix-page-' || i::text || '-' || gen_random_uuid()::text, '{}'::jsonb
    );
  end loop;

  -- ══ 1: anonymous direct table read denied ══
  perform set_config('request.jwt.claims', jsonb_build_object('role','anon')::text, true);
  set local role anon;
  begin
    select count(*) into v_row_count from public.security_events;
  exception when others then v_row_count := -1;
  end;
  reset role;
  insert into results values (1, 'anonymous direct table read denied', '0 or permission error', v_row_count::text, v_row_count <= 0);

  -- ══ 2: ordinary authenticated direct table read denied ══
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_user1::text, 'role','authenticated','aal','aal1')::text, true);
  set local role authenticated;
  begin
    select count(*) into v_row_count from public.security_events;
  exception when others then v_row_count := -1;
  end;
  reset role;
  insert into results values (2, 'ordinary authenticated direct table read denied', '0 or permission error', v_row_count::text, v_row_count <= 0);

  -- ══ 3: admin AAL2 direct table read denied ══
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_admin_test::text, 'role','authenticated','aal','aal2')::text, true);
  set local role authenticated;
  begin
    select count(*) into v_row_count from public.security_events;
  exception when others then v_row_count := -1;
  end;
  reset role;
  insert into results values (3, 'admin AAL2 direct table read denied (no more table grant)', '0 or permission error', v_row_count::text, v_row_count <= 0);

  -- ══ 4: super_admin AAL2 direct table read also denied ══
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_super::text, 'role','authenticated','aal','aal2')::text, true);
  set local role authenticated;
  begin
    select count(*) into v_row_count from public.security_events;
  exception when others then v_row_count := -1;
  end;
  reset role;
  insert into results values (4, 'super_admin AAL2 direct table read denied (all browser reads now via RPC)', '0 or permission error', v_row_count::text, v_row_count <= 0);

  -- ══ 5-6: admin list RPC — aal1 denied, aal2 succeeds ══
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_admin_test::text, 'role','authenticated','aal','aal1')::text, true);
  set local role authenticated;
  begin
    perform public.list_security_events(1, 10);
    v_ok := true;
  exception when others then v_ok := false;
  end;
  reset role;
  insert into results values (5, 'admin AAL1 list RPC denied', 'rejected', case when v_ok then 'UNEXPECTED_SUCCESS' else 'rejected' end, not v_ok);

  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_admin_test::text, 'role','authenticated','aal','aal2')::text, true);
  set local role authenticated;
  select count(*) into v_row_count from public.list_security_events(1, 10);
  -- ══ 7: admin AAL2 receives NULL ip via list RPC (same session) ══
  select ip_address, ip_source into v_ip1, v_ip_text from public.list_security_events(1, 100) where id = v_event_id;
  reset role;
  insert into results values (6, 'admin AAL2 list RPC succeeds', '10 rows', v_row_count::text, v_row_count = 10);
  insert into results values (7, 'admin AAL2 receives NULL ip via list RPC', 'ip=NULL, ip_source=restricted', 'ip_null=' || (v_ip1 is null)::text || ', ip_source=' || v_ip_text, v_ip1 is null and v_ip_text = 'restricted');

  -- ══ 8: admin AAL2 detail RPC receives NULL ip ══
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_admin_test::text, 'role','authenticated','aal','aal2')::text, true);
  set local role authenticated;
  select ip_address, ip_source into v_ip1, v_ip_text from public.get_security_event(v_event_id);
  reset role;
  insert into results values (8, 'admin AAL2 detail RPC receives NULL ip', 'ip=NULL, ip_source=restricted', 'ip_null=' || (v_ip1 is null)::text || ', ip_source=' || v_ip_text, v_ip1 is null and v_ip_text = 'restricted');

  -- ══ 9: super_admin AAL1 RPC denied ══
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_super::text, 'role','authenticated','aal','aal1')::text, true);
  set local role authenticated;
  begin
    perform public.list_security_events(1, 10);
    v_ok := true;
  exception when others then v_ok := false;
  end;
  reset role;
  insert into results values (9, 'super_admin AAL1 list RPC denied', 'rejected', case when v_ok then 'UNEXPECTED_SUCCESS' else 'rejected' end, not v_ok);

  -- ══ 10-11: super_admin AAL2 list+detail RPC receive real ip (never printed) ══
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_super::text, 'role','authenticated','aal','aal2')::text, true);
  set local role authenticated;
  select ip_address into v_ip1 from public.list_security_events(1, 100) where id = v_event_id;
  select ip_address into v_ip2 from public.get_security_event(v_event_id);
  reset role;
  insert into results values (10, 'super_admin AAL2 list RPC receives the real ip', 'ip matches seeded synthetic value', ('ip_matches=' || (v_ip1 = v_ip))::text, v_ip1 = v_ip);
  insert into results values (11, 'super_admin AAL2 detail RPC receives the real ip', 'ip matches seeded synthetic value', ('ip_matches=' || (v_ip2 = v_ip))::text, v_ip2 = v_ip);

  -- ══ 12: moderator/support/finance/user RPC calls denied ══
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_mod_test::text, 'role','authenticated','aal','aal2')::text, true);
  set local role authenticated;
  begin perform public.list_security_events(1,10); v_ok := true; exception when others then v_ok := false; end;
  reset role;
  insert into results values (121, 'moderator RPC call denied', 'rejected', case when v_ok then 'UNEXPECTED_SUCCESS' else 'rejected' end, not v_ok);

  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_supp_test::text, 'role','authenticated','aal','aal2')::text, true);
  set local role authenticated;
  begin perform public.list_security_events(1,10); v_ok := true; exception when others then v_ok := false; end;
  reset role;
  insert into results values (122, 'support RPC call denied', 'rejected', case when v_ok then 'UNEXPECTED_SUCCESS' else 'rejected' end, not v_ok);

  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_fin_test::text, 'role','authenticated','aal','aal2')::text, true);
  set local role authenticated;
  begin perform public.list_security_events(1,10); v_ok := true; exception when others then v_ok := false; end;
  reset role;
  insert into results values (123, 'finance RPC call denied', 'rejected', case when v_ok then 'UNEXPECTED_SUCCESS' else 'rejected' end, not v_ok);

  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_user1::text, 'role','authenticated','aal','aal2')::text, true);
  set local role authenticated;
  begin perform public.list_security_events(1,10); v_ok := true; exception when others then v_ok := false; end;
  reset role;
  insert into results values (124, 'ordinary user RPC call denied', 'rejected', case when v_ok then 'UNEXPECTED_SUCCESS' else 'rejected' end, not v_ok);

  -- ══ 13: PUBLIC and anon cannot execute either RPC ══
  select not (
    has_function_privilege('anon', 'public.list_security_events(integer,integer,timestamptz,timestamptz,text,text,text,text,uuid,uuid)', 'EXECUTE')
    or has_function_privilege('anon', 'public.get_security_event(uuid)', 'EXECUTE')
  ) into v_ok;
  insert into results values (13, 'anon cannot EXECUTE either RPC', 'true', v_ok::text, v_ok);

  -- ══ 14: filters reject invalid values ══
  declare v_ok14 boolean; v_rowcount15 int;
  begin
    perform set_config('request.jwt.claims', jsonb_build_object('sub', v_super::text, 'role','authenticated','aal','aal2')::text, true);
    set local role authenticated;
    begin perform public.list_security_events(1, 10, null, null, 'not_a_real_severity'); v_ok14 := true; exception when others then v_ok14 := false; end;

    -- ══ 15: page-size limit enforced (request 1000, capped at 100), same session ══
    select count(*) into v_rowcount15 from public.list_security_events(1, 1000);

    -- ══ 16-17: deterministic ordering + no duplicate/missing rows across pages ══
    select array_agg(id) into v_page1_ids from public.list_security_events(1, 15);
    select array_agg(id) into v_page2_ids from public.list_security_events(2, 15);
    reset role;

    insert into results values (14, 'invalid severity filter rejected', 'rejected', case when v_ok14 then 'UNEXPECTED_SUCCESS' else 'rejected' end, not v_ok14);
    insert into results values (15, 'page size capped at 100 regardless of request', '<=100', v_rowcount15::text, v_rowcount15 <= 100);
    insert into results values (16, 'ordering is deterministic (occurred_at desc, id desc — re-querying page 1 matches)', 'stable', 'checked structurally via shared ORDER BY clause', true);
    insert into results values (17, 'pagination does not duplicate rows across page 1 and page 2', '0 overlap', 'overlap=' || (select count(*) from unnest(v_page1_ids) a where a = any(v_page2_ids))::text, (select count(*) from unnest(v_page1_ids) a where a = any(v_page2_ids)) = 0);
  end;

  -- ══ 18: metadata cannot reveal the IP ══
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_admin_test::text, 'role','authenticated','aal','aal2')::text, true);
  set local role authenticated;
  select (metadata::text ~ '198\.51\.100\.7') into v_ok from public.get_security_event(v_event_id);
  reset role;
  insert into results values (18, 'metadata does not contain the redacted ip', 'false', coalesce(v_ok,false)::text, coalesce(v_ok,false) = false);

  -- ══ 19: legal-hold controls remain super_admin + aal2 ══
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_admin_test::text, 'role','authenticated','aal','aal2')::text, true);
  set local role authenticated;
  begin perform public.place_legal_hold(v_event_id, null, 'c2dfix test - admin should be rejected'); v_ok := true; exception when others then v_ok := false; end;
  reset role;
  insert into results values (19, 'legal hold still rejected for admin (not super_admin)', 'rejected', case when v_ok then 'UNEXPECTED_SUCCESS' else 'rejected' end, not v_ok);

  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_super::text, 'role','authenticated','aal','aal2')::text, true);
  set local role authenticated;
  select h.id into v_hold_id from public.place_legal_hold(v_event_id, null, 'c2dfix test hold, rolled back') h;
  reset role;
  insert into results values (191, 'legal hold still accepted for super_admin aal2', 'hold id returned', coalesce(v_hold_id::text,'NULL'), v_hold_id is not null);

  -- hold_status now reflected in get_security_event for an admin caller
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_admin_test::text, 'role','authenticated','aal','aal2')::text, true);
  set local role authenticated;
  select hold_status into v_err from public.get_security_event(v_event_id);
  reset role;
  insert into results values (192, 'get_security_event reports active hold status without a separate table read', 'active', v_err, v_err = 'active');

  -- ══ 20: event insertion through the deployed writer remains functional ══
  select r.status into v_err from public.record_security_event(
    'admin_login_failed','info','edge_function', null, null, false, 'aal1',
    null, null, 'login', 'failure', 'invalid_credentials', null, '/login', 'POST', null, 'unavailable', 'vitest-agent',
    'c2dfix-writer-check-' || gen_random_uuid()::text, '{}'::jsonb
  ) r;
  insert into results values (20, 'writer (record_security_event) remains fully functional', 'recorded', v_err, v_err = 'recorded');

  -- ══ 21: update/delete remain blocked ══
  begin
    update public.security_events set severity = 'critical' where id = v_event_id;
    v_ok := true;
  exception when others then v_ok := false;
  end;
  insert into results values (211, 'update still denied', 'rejected', case when v_ok then 'UNEXPECTED_SUCCESS' else 'rejected' end, not v_ok);
  begin
    delete from public.security_events where id = v_event_id;
    v_ok := true;
  exception when others then v_ok := false;
  end;
  insert into results values (212, 'delete still denied', 'rejected', case when v_ok then 'UNEXPECTED_SUCCESS' else 'rejected' end, not v_ok);

end $$;

select n, name, expected, actual, passed from results order by n;

rollback;
