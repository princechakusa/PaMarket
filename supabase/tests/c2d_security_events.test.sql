-- C2D test script — repeatable, self-contained, NEVER commits.
-- Applies the full C2D forward migration DDL in-transaction, runs the
-- required SQL assertions against real production data (only transient,
-- rolled-back mutations, same technique as the C2B/C2C-2 test scripts),
-- then rolls back. Run:
--   supabase db query --linked -f supabase/tests/c2d_security_events.test.sql

begin;

-- PaMarket C2D: server-owned security evidence store.
--
-- public.security_events is investigation-grade evidence, distinct from:
--   - admin_audit_logs      — operational notes, browser-inserted with
--                              client-supplied actor/before/after JSON
--                              (ADMIN_ENTERPRISE_UPGRADE.sql). Kept as-is;
--                              not touched by this migration.
--   - error_logs / app_error_events — application crash/bug telemetry,
--                              not security-relevant, browser-writable by
--                              design (`error_logs: anyone insert`).
--   - security_events (this table) — append-only, server-attributed only,
--                              no browser INSERT/UPDATE/DELETE path exists
--                              at any layer.
--   - security_event_legal_holds — a *separate* table so a hold never
--                              requires editing an evidence row.
--
-- See admin/docs/c2d-security-evidence-results.md for the full threat
-- model, retention policy, and known limitations (including IP
-- attribution and the honeypot's actual evidentiary weight).


do $preflight$
begin
  if to_regclass('public.security_events') is not null then
    raise exception 'C2D abort: public.security_events already exists';
  end if;
  if to_regprocedure('public.has_mfa_aal2()') is null then
    raise exception 'C2D abort: has_mfa_aal2() is missing (C2C-2 must be applied first)';
  end if;
  if to_regprocedure('public.is_super_admin()') is null then
    raise exception 'C2D abort: is_super_admin() is missing (C2B must be applied first)';
  end if;
  if to_regprocedure('public.has_admin_privilege(text)') is null then
    raise exception 'C2D abort: has_admin_privilege(text) is missing (C2B must be applied first)';
  end if;
end
$preflight$;

-- ── 1. security_events ──────────────────────────────────────────────────
create table public.security_events (
  id                   uuid primary key default gen_random_uuid(),

  event_type           text not null,
  severity             text not null,
  source               text not null,

  occurred_at          timestamptz not null default now(),
  received_at          timestamptz not null default now(),

  actor_user_id        uuid references public.profiles(id) on delete set null,
  actor_role           text,
  actor_authenticated  boolean not null default false,
  session_id           text,
  assurance_level      text not null default 'aal1',

  target_type          text,
  target_id            text,

  action               text not null,
  outcome              text not null,
  reason_code          text,
  correlation_id       uuid,

  request_path         text,
  request_method       text,
  ip_address           inet,
  ip_source            text not null default 'unavailable',
  user_agent           text,

  event_key            text,
  metadata             jsonb not null default '{}'::jsonb,

  retention_until      timestamptz not null default (now() + interval '24 months'),
  created_at           timestamptz not null default now(),

  constraint security_events_event_type_len   check (char_length(event_type) between 1 and 64),
  constraint security_events_severity_check   check (severity in ('info','notice','warning','high','critical')),
  constraint security_events_source_check     check (source in ('edge_function','database')),
  constraint security_events_actor_role_len   check (actor_role is null or char_length(actor_role) <= 32),
  constraint security_events_session_id_len   check (session_id is null or char_length(session_id) <= 128),
  constraint security_events_assurance_check  check (assurance_level in ('aal1','aal2','unknown')),
  constraint security_events_target_type_len  check (target_type is null or char_length(target_type) <= 64),
  constraint security_events_target_id_len    check (target_id is null or char_length(target_id) <= 128),
  constraint security_events_action_len       check (char_length(action) between 1 and 64),
  constraint security_events_outcome_check    check (outcome in ('success','failure','blocked','suspicious')),
  constraint security_events_reason_code_len  check (reason_code is null or char_length(reason_code) <= 64),
  constraint security_events_request_path_len check (request_path is null or char_length(request_path) <= 512),
  -- Defence in depth: the writer function already strips query strings —
  -- this rejects a path containing one outright rather than silently
  -- truncating stored data.
  constraint security_events_no_query_string  check (request_path is null or position('?' in request_path) = 0),
  constraint security_events_request_method_len check (request_method is null or char_length(request_method) <= 8),
  constraint security_events_ip_source_len    check (char_length(ip_source) <= 32),
  constraint security_events_user_agent_len   check (user_agent is null or char_length(user_agent) <= 300),
  constraint security_events_event_key_len    check (event_key is null or char_length(event_key) <= 200),
  -- Object only, and bounded — never an arbitrary array/scalar or an
  -- unbounded nested payload.
  constraint security_events_metadata_object  check (jsonb_typeof(metadata) = 'object'),
  constraint security_events_metadata_size    check (pg_column_size(metadata) <= 4096)
);

comment on table public.security_events is
  'C2D: append-only security evidence. No browser role holds INSERT/UPDATE/DELETE at any layer — see record_security_event() and the block-mutation trigger below. A PostgreSQL database owner can still alter rows directly; this table is not cryptographically tamper-evident. See admin/docs/c2d-security-evidence-results.md.';

-- Indexes chosen against the Security Events page's actual filters
-- (date range + severity/type/source/outcome/actor/correlation), not
-- created speculatively per column:
create index security_events_occurred_at_idx           on public.security_events (occurred_at desc);
create index security_events_event_type_occurred_idx    on public.security_events (event_type, occurred_at desc);
create index security_events_severity_occurred_idx      on public.security_events (severity, occurred_at desc);
create index security_events_outcome_occurred_idx       on public.security_events (outcome, occurred_at desc);
create index security_events_actor_occurred_idx         on public.security_events (actor_user_id, occurred_at desc) where actor_user_id is not null;
create index security_events_target_idx                 on public.security_events (target_type, target_id) where target_type is not null;
create index security_events_correlation_id_idx         on public.security_events (correlation_id) where correlation_id is not null;
create index security_events_retention_until_idx        on public.security_events (retention_until);
-- `source` has only two possible values today; the time-ordered index
-- above already makes a source-filtered, newest-first scan cheap without a
-- dedicated composite — not adding one keeps the index list lean.

-- Idempotency: exactly one row per non-null event_key.
create unique index security_events_event_key_key on public.security_events (event_key) where event_key is not null;

-- ── 2. Append-only enforcement (RLS + a mutation-blocking trigger) ──────
alter table public.security_events enable row level security;
alter table public.security_events force row level security;

-- No INSERT/UPDATE/DELETE policy exists for any role — the default with
-- RLS enabled is deny-all, so this is a structural absence, not a rule
-- that could be loosened by mistake later without someone adding one.
create policy "security_events: admin team aal2 read"
  on public.security_events
  for select
  to authenticated
  using (public.has_admin_privilege('admin') and public.has_mfa_aal2());

revoke all on public.security_events from public, anon, authenticated;
grant select on public.security_events to authenticated;
-- service_role is not given a browser-reachable grant here — it is a
-- server credential, and the writer/cleanup functions below (SECURITY
-- DEFINER, owned by the migration role) do not need a direct table grant
-- to service_role to do their own inserts/deletes.

create or replace function public.security_events_block_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- The one deliberate, narrow exception: security_events_cleanup_expired()
  -- sets this transaction-local flag immediately before its own retention
  -- delete, and clears it immediately after. Nothing else — including a
  -- privileged application bug running as service_role — can delete or
  -- update a row through this trigger.
  if tg_op = 'DELETE' and coalesce(current_setting('security_events.allow_retention_cleanup', true), 'off') = 'on' then
    return old;
  end if;
  raise exception 'security_events rows are append-only; % is not permitted outside the retention cleanup function', tg_op
    using errcode = '42501';
end;
$$;

comment on function public.security_events_block_mutation() is
  'C2D: defense-in-depth append-only guard. Fires for every caller including service_role (RLS bypass does not exempt a caller from a trigger). A PostgreSQL superuser/database owner altering rows directly, outside normal application access, is not prevented by this trigger — see table comment.';

create trigger trg_security_events_block_update
  before update on public.security_events
  for each row execute function public.security_events_block_mutation();

create trigger trg_security_events_block_delete
  before delete on public.security_events
  for each row execute function public.security_events_block_mutation();

-- ── 3. record_security_event() — the only INSERT path ───────────────────
-- Callable only by service_role, i.e. only from the record-security-event
-- Edge Function. That function is the actual trust boundary: it verifies
-- the caller's JWT, loads profiles.role itself, derives aal from the
-- verified JWT, and reads IP/user-agent from request headers — never from
-- request JSON. By the time any of those values reach this function they
-- are already server-derived; this function's own job is input validation,
-- bounding, redaction, and idempotency, not identity verification (it has
-- no HTTP context to verify anything itself).
create or replace function public.record_security_event(
  p_event_type          text,
  p_severity             text,
  p_source               text,
  p_actor_user_id        uuid,
  p_actor_role           text,
  p_actor_authenticated  boolean,
  p_assurance_level      text,
  p_target_type          text,
  p_target_id            text,
  p_action               text,
  p_outcome              text,
  p_reason_code          text,
  p_correlation_id       uuid,
  p_request_path         text,
  p_request_method       text,
  p_ip_address           inet,
  p_ip_source            text,
  p_user_agent           text,
  p_event_key            text,
  p_metadata             jsonb
)
returns table(id uuid, status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_allowed_event_types constant text[] := array[
    'admin_login_honeypot','admin_login_failed','admin_login_succeeded',
    'admin_mfa_challenge_failed','admin_mfa_challenge_succeeded','admin_logout'
  ];
  v_prohibited_metadata_keys constant text[] := array[
    'password','otp','otp_code','code','secret','totp_secret','qr','qr_code',
    'token','access_token','refresh_token','authorization','honeypot',
    'honeypot_value','card','cvv','card_number','email','query'
  ];
  v_metadata jsonb;
  v_path     text;
  v_ua       text;
  v_id       uuid;
  v_status   text;
  k          text;
begin
  if p_event_type is null or not (p_event_type = any(v_allowed_event_types)) then
    raise exception 'record_security_event: unsupported event_type' using errcode = '22023';
  end if;
  if p_severity is null or not (p_severity in ('info','notice','warning','high','critical')) then
    raise exception 'record_security_event: unsupported severity' using errcode = '22023';
  end if;
  if p_source is null or not (p_source in ('edge_function','database')) then
    raise exception 'record_security_event: unsupported source' using errcode = '22023';
  end if;
  if p_outcome is null or not (p_outcome in ('success','failure','blocked','suspicious')) then
    raise exception 'record_security_event: unsupported outcome' using errcode = '22023';
  end if;
  if p_action is null or length(p_action) = 0 then
    raise exception 'record_security_event: action is required' using errcode = '22023';
  end if;

  v_path := p_request_path;
  if v_path is not null then
    v_path := split_part(v_path, '?', 1);
    if length(v_path) > 512 then v_path := left(v_path, 512); end if;
  end if;

  v_ua := p_user_agent;
  if v_ua is not null and length(v_ua) > 300 then v_ua := left(v_ua, 300); end if;

  if p_metadata is null then
    v_metadata := '{}'::jsonb;
  else
    if jsonb_typeof(p_metadata) <> 'object' then
      raise exception 'record_security_event: metadata must be a JSON object' using errcode = '22023';
    end if;
    v_metadata := p_metadata;
    foreach k in array v_prohibited_metadata_keys loop
      v_metadata := v_metadata - k;
    end loop;
    if pg_column_size(v_metadata) > 4096 then
      raise exception 'record_security_event: metadata too large' using errcode = '22023';
    end if;
  end if;

  if p_event_key is not null and length(p_event_key) > 200 then
    raise exception 'record_security_event: event_key too long' using errcode = '22023';
  end if;

  insert into public.security_events (
    event_type, severity, source, actor_user_id, actor_role, actor_authenticated,
    assurance_level, target_type, target_id, action, outcome, reason_code,
    correlation_id, request_path, request_method, ip_address, ip_source,
    user_agent, event_key, metadata
  ) values (
    p_event_type, p_severity, p_source, p_actor_user_id,
    left(nullif(p_actor_role, ''), 32),
    coalesce(p_actor_authenticated, false),
    coalesce(nullif(p_assurance_level, ''), 'aal1'),
    left(nullif(p_target_type, ''), 64),
    left(nullif(p_target_id, ''), 128),
    left(p_action, 64),
    p_outcome,
    left(nullif(p_reason_code, ''), 64),
    p_correlation_id,
    v_path,
    left(nullif(p_request_method, ''), 8),
    p_ip_address,
    coalesce(nullif(p_ip_source, ''), 'unavailable'),
    v_ua,
    p_event_key,
    v_metadata
  )
  on conflict (event_key) where event_key is not null do nothing
  returning security_events.id into v_id;

  if v_id is null and p_event_key is not null then
    select se.id into v_id from public.security_events se where se.event_key = p_event_key limit 1;
    v_status := 'duplicate';
  else
    v_status := 'recorded';
  end if;

  return query select v_id, v_status;
end;
$$;

comment on function public.record_security_event is
  'C2D: the only INSERT path into security_events. Timestamps are always server-generated by the table default — no timestamp parameter exists. Rejects unknown event_type/severity/source/outcome, strips query strings from request_path, redacts a fixed set of prohibited metadata keys, bounds metadata to 4KB, and is idempotent on event_key via ON CONFLICT DO NOTHING. Callable only by service_role.';

revoke all on function public.record_security_event(
  text, text, text, uuid, text, boolean, text, text, text, text, text, text,
  uuid, text, text, inet, text, text, text, jsonb
) from public;
revoke execute on function public.record_security_event(
  text, text, text, uuid, text, boolean, text, text, text, text, text, text,
  uuid, text, text, inet, text, text, text, jsonb
) from anon, authenticated;
grant execute on function public.record_security_event(
  text, text, text, uuid, text, boolean, text, text, text, text, text, text,
  uuid, text, text, inet, text, text, text, jsonb
) to service_role;

-- ── 4. security_event_legal_holds ───────────────────────────────────────
-- A hold is scoped to exactly one event OR one correlation_id (an entire
-- investigation thread) — never created by editing an evidence row.
create table public.security_event_legal_holds (
  id             uuid primary key default gen_random_uuid(),
  -- CASCADE, not RESTRICT: retention cleanup only ever deletes an event
  -- with no ACTIVE hold, so a surviving row here is necessarily a
  -- released (historical) hold whose subject event no longer exists —
  -- once the event itself is legitimately purged, that history is no
  -- longer meaningful either.
  event_id       uuid references public.security_events(id) on delete cascade,
  correlation_id uuid,
  reason         text not null,
  status         text not null default 'active',
  placed_by      uuid not null references public.profiles(id),
  placed_at      timestamptz not null default now(),
  released_by    uuid references public.profiles(id),
  released_at    timestamptz,
  created_at     timestamptz not null default now(),

  constraint security_event_legal_holds_scope check (
    (event_id is not null and correlation_id is null) or
    (event_id is null and correlation_id is not null)
  ),
  constraint security_event_legal_holds_reason_len check (char_length(reason) between 1 and 500),
  constraint security_event_legal_holds_status_check check (status in ('active','released')),
  constraint security_event_legal_holds_release_consistency check (
    (status = 'active' and released_by is null and released_at is null) or
    (status = 'released' and released_by is not null and released_at is not null)
  )
);

comment on table public.security_event_legal_holds is
  'C2D: legal holds on security_events, as a separate table so no evidence row is ever edited to create one. Placed/released only via place_legal_hold()/release_legal_hold() (super_admin + aal2). A hold suspends retention cleanup for the matching event(s) — see security_events_cleanup_expired().';

create index security_event_legal_holds_event_idx on public.security_event_legal_holds (event_id) where event_id is not null;
create index security_event_legal_holds_correlation_idx on public.security_event_legal_holds (correlation_id) where correlation_id is not null;
create index security_event_legal_holds_status_idx on public.security_event_legal_holds (status);

alter table public.security_event_legal_holds enable row level security;
alter table public.security_event_legal_holds force row level security;

create policy "security_event_legal_holds: admin team aal2 read"
  on public.security_event_legal_holds
  for select
  to authenticated
  using (public.has_admin_privilege('admin') and public.has_mfa_aal2());

revoke all on public.security_event_legal_holds from public, anon, authenticated;
grant select on public.security_event_legal_holds to authenticated;

create or replace function public.place_legal_hold(
  p_event_id       uuid,
  p_correlation_id uuid,
  p_reason         text
)
returns table(id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare v_id uuid;
begin
  if auth.role() <> 'service_role' then
    if not public.is_super_admin() then
      raise exception 'Only super_admin can place a legal hold' using errcode = '42501';
    end if;
    if not public.has_mfa_aal2() then
      raise exception 'mfa_required' using errcode = '42501';
    end if;
  end if;

  if p_reason is null or length(btrim(p_reason)) = 0 then
    raise exception 'A reason is required' using errcode = '22023';
  end if;
  if length(p_reason) > 500 then
    raise exception 'Reason is too long' using errcode = '22023';
  end if;
  if (p_event_id is null) = (p_correlation_id is null) then
    raise exception 'Provide exactly one of event_id or correlation_id' using errcode = '22023';
  end if;
  if p_event_id is not null and not exists (select 1 from public.security_events se where se.id = p_event_id) then
    raise exception 'Unknown event' using errcode = '22023';
  end if;

  insert into public.security_event_legal_holds (event_id, correlation_id, reason, placed_by)
  values (p_event_id, p_correlation_id, left(btrim(p_reason), 500), auth.uid())
  returning security_event_legal_holds.id into v_id;

  return query select v_id;
end;
$$;

comment on function public.place_legal_hold is
  'C2D: creates a legal hold row. Never edits public.security_events. super_admin + aal2 only (service_role exempt for future server-initiated holds, not currently invoked from any client).';

revoke all on function public.place_legal_hold(uuid, uuid, text) from public;
revoke execute on function public.place_legal_hold(uuid, uuid, text) from anon;
grant execute on function public.place_legal_hold(uuid, uuid, text) to authenticated, service_role;

create or replace function public.release_legal_hold(
  p_hold_id uuid
)
returns table(id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare v_id uuid;
begin
  if auth.role() <> 'service_role' then
    if not public.is_super_admin() then
      raise exception 'Only super_admin can release a legal hold' using errcode = '42501';
    end if;
    if not public.has_mfa_aal2() then
      raise exception 'mfa_required' using errcode = '42501';
    end if;
  end if;

  update public.security_event_legal_holds
  set status = 'released', released_by = auth.uid(), released_at = now()
  where security_event_legal_holds.id = p_hold_id and status = 'active'
  returning security_event_legal_holds.id into v_id;

  if v_id is null then
    raise exception 'Hold not found or already released' using errcode = '22023';
  end if;

  return query select v_id;
end;
$$;

comment on function public.release_legal_hold is
  'C2D: releases (does not delete) a legal hold row. super_admin + aal2 only.';

revoke all on function public.release_legal_hold(uuid) from public;
revoke execute on function public.release_legal_hold(uuid) from anon;
grant execute on function public.release_legal_hold(uuid) to authenticated, service_role;

-- ── 5. Retention cleanup — server-only, not scheduled by this migration ─
-- pg_cron is an established pattern in this project (weekly-log-cleanup,
-- purge-old-notifications), so a scheduled job would be a justified choice
-- later; this migration deliberately does not schedule one. Every
-- security_event defaults retention_until to +24 months, so nothing is
-- eligible for deletion for two years regardless — there is no urgency,
-- and wiring a schedule is left to a separately approved stage once the
-- evidence pipeline itself has been observed in production. Run manually,
-- as service_role, when retention cleanup is actually wanted:
--   select * from public.security_events_cleanup_expired();
create or replace function public.security_events_cleanup_expired()
returns table(deleted_count bigint)
language plpgsql
security definer
set search_path = ''
as $$
declare v_count bigint;
begin
  if auth.role() <> 'service_role' then
    raise exception 'security_events_cleanup_expired: service_role only' using errcode = '42501';
  end if;

  perform set_config('security_events.allow_retention_cleanup', 'on', true);

  with eligible as (
    select se.id
    from public.security_events se
    where se.retention_until < now()
      and not exists (
        select 1
        from public.security_event_legal_holds h
        where h.status = 'active'
          and (
            h.event_id = se.id
            or (h.correlation_id is not null and h.correlation_id = se.correlation_id)
          )
      )
  ),
  deleted as (
    delete from public.security_events se
    using eligible e
    where se.id = e.id
    returning se.id
  )
  select count(*) into v_count from deleted;

  perform set_config('security_events.allow_retention_cleanup', 'off', true);

  return query select v_count;
end;
$$;

comment on function public.security_events_cleanup_expired is
  'C2D: deletes security_events rows past retention_until with no active legal hold (matched by event_id or correlation_id). service_role only; not scheduled by this migration. The 24-month default is an operational policy, not legal advice — review with counsel before relying on it for a specific jurisdiction or matter.';

revoke all on function public.security_events_cleanup_expired() from public;
revoke execute on function public.security_events_cleanup_expired() from anon, authenticated;
grant execute on function public.security_events_cleanup_expired() to service_role;

notify pgrst, 'reload schema';


-- ── test body ─────────────────────────────────────────────────────────
create temporary table results (n int primary key, name text, expected text, actual text, passed boolean);

do $$
declare
  v_super uuid := 'e79039a4-2216-4526-81e1-c8c25e688834';
  v_user1 uuid; v_admin_test uuid;
  v_visible_count int;
  v_event_id uuid; v_event_id2 uuid; v_status text; v_status2 text;
  v_hold_id uuid; v_expired_id uuid; v_dupe_key text;
  v_ok boolean;
  v_err text;
  v_row_count int;
  v_before_count bigint; v_after_count bigint;
  v_r1 boolean; v_r2 boolean; v_r3 int; v_r4 boolean;
begin
  select id into v_user1 from (select id from public.profiles where role='user' order by id limit 1 offset 0) t;
  select id into v_admin_test from (select id from public.profiles where role='user' order by id limit 1 offset 1) t;

  -- transient setup: promote a disposable account to 'admin' under
  -- service_role bypass; rolled back at the end, never persisted.
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_super::text, 'role','service_role')::text, true);
  update public.profiles set role = 'admin' where id = v_admin_test;
  perform set_config('request.jwt.claims', '', true);

  -- seed one real event as service_role (table owner; no role switch
  -- needed) so read-permission tests have a row to look for.
  select r.id into v_event_id from public.record_security_event(
    'admin_login_succeeded','info','edge_function', v_super, 'super_admin', true, 'aal2',
    null, null, 'login', 'success', null, gen_random_uuid(),
    '/login', 'POST', '203.0.113.5'::inet, 'cf-connecting-ip', 'vitest-agent',
    'c2d-test-seed-' || gen_random_uuid()::text, '{}'::jsonb
  ) r;

  -- ══ 1-2: anonymous ══
  perform set_config('request.jwt.claims', jsonb_build_object('role','anon')::text, true);
  set local role anon;
  begin
    select count(*) into v_visible_count from public.security_events;
    v_err := null;
  exception when others then v_visible_count := -1; v_err := sqlerrm;
  end;
  begin
    insert into public.security_events (event_type, severity, source, action, outcome) values ('admin_login_failed','info','edge_function','x','failure');
    v_r1 := true;
  exception when others then v_r1 := false;
  end;
  reset role;
  insert into results values (1, 'anonymous table read denied', '0 rows or permission error', coalesce(v_err, v_visible_count::text), v_visible_count <= 0);
  insert into results values (2, 'anonymous direct insert denied', 'rejected', case when v_r1 then 'UNEXPECTED_SUCCESS' else 'rejected' end, not v_r1);

  -- ══ 3-4: authenticated ordinary user ══
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_user1::text, 'role','authenticated','aal','aal1')::text, true);
  set local role authenticated;
  begin
    select count(*) into v_visible_count from public.security_events;
  exception when others then v_visible_count := -1;
  end;
  begin
    insert into public.security_events (event_type, severity, source, action, outcome) values ('admin_login_failed','info','edge_function','x','failure');
    v_r1 := true;
  exception when others then v_r1 := false;
  end;
  reset role;
  insert into results values (3, 'authenticated ordinary-user read denied', '0', v_visible_count::text, v_visible_count = 0);
  insert into results values (4, 'authenticated ordinary-user direct insert denied', 'rejected', case when v_r1 then 'UNEXPECTED_SUCCESS' else 'rejected' end, not v_r1);

  -- ══ 5: admin aal1 read denied ══
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_admin_test::text, 'role','authenticated','aal','aal1')::text, true);
  set local role authenticated;
  select count(*) into v_visible_count from public.security_events;
  reset role;
  insert into results values (5, 'admin AAL1 read denied', '0', v_visible_count::text, v_visible_count = 0);

  -- ══ 6: admin aal2 read permitted ══
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_admin_test::text, 'role','authenticated','aal','aal2')::text, true);
  set local role authenticated;
  select count(*) into v_visible_count from public.security_events where id = v_event_id;
  reset role;
  insert into results values (6, 'admin AAL2 read permitted', '1', v_visible_count::text, v_visible_count = 1);

  -- ══ 7: super_admin aal2 read permitted ══
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_super::text, 'role','authenticated','aal','aal2')::text, true);
  set local role authenticated;
  select count(*) into v_visible_count from public.security_events where id = v_event_id;

  -- ══ 8-9: update/delete denied, even for super_admin aal2, same session ══
  begin
    update public.security_events set severity = 'critical' where id = v_event_id;
    v_r1 := true;
  exception when others then v_r1 := false;
  end;
  begin
    delete from public.security_events where id = v_event_id;
    v_r2 := true;
  exception when others then v_r2 := false;
  end;

  -- ══ 10: writer unavailable to browser roles (still super_admin aal2) ══
  begin
    perform public.record_security_event(
      'admin_login_succeeded','info','edge_function', v_super, 'super_admin', true, 'aal2',
      null, null, 'login', 'success', null, null, null, null, null, null, null, null, '{}'::jsonb
    );
    v_r4 := true;
  exception when others then v_r4 := false;
  end;
  reset role;
  insert into results values (7, 'super_admin AAL2 read permitted', '1', v_visible_count::text, v_visible_count = 1);
  insert into results values (8, 'update denied (even to super_admin aal2)', 'rejected', case when v_r1 then 'UNEXPECTED_SUCCESS' else 'rejected' end, not v_r1);
  insert into results values (9, 'delete denied (even to super_admin aal2)', 'rejected', case when v_r2 then 'UNEXPECTED_SUCCESS' else 'rejected' end, not v_r2);
  insert into results values (10, 'writer unavailable to browser roles (super_admin authenticated)', 'permission denied', case when v_r4 then 'UNEXPECTED_SUCCESS' else 'rejected' end, not v_r4);

  -- ══ 11: server writer accepts an allowed event (table owner; no switch) ══
  select r.id, r.status into v_event_id2, v_status from public.record_security_event(
    'admin_mfa_challenge_succeeded','info','edge_function', v_super, 'super_admin', true, 'aal2',
    null, null, 'mfa_challenge', 'success', null, gen_random_uuid(),
    '/mfa/challenge?x=1', 'POST', '203.0.113.9'::inet, 'cf-connecting-ip', 'vitest-agent',
    'c2d-test-' || gen_random_uuid()::text, jsonb_build_object('factor_type','totp')
  ) r;
  insert into results values (11, 'server writer accepts an allowed event', 'recorded', v_status, v_status = 'recorded' and v_event_id2 is not null);

  select request_path into v_err from public.security_events where id = v_event_id2;
  insert into results values (111, 'writer strips query string from request_path', '/mfa/challenge', v_err, v_err = '/mfa/challenge');

  -- ══ 12: server writer rejects an unknown event type ══
  begin
    perform public.record_security_event(
      'totally_unknown_event','info','edge_function', null, null, false, 'aal1',
      null, null, 'x', 'success', null, null, null, null, null, null, null, null, '{}'::jsonb
    );
    v_r1 := true;
  exception when others then v_r1 := false;
  end;
  insert into results values (12, 'server writer rejects an unknown event type', 'rejected', case when v_r1 then 'UNEXPECTED_SUCCESS' else 'rejected' end, not v_r1);

  -- ══ 13: server writer rejects oversized metadata ══
  begin
    perform public.record_security_event(
      'admin_login_failed','info','edge_function', null, null, false, 'aal1',
      null, null, 'login', 'failure', null, null, null, null, null, null, null, null,
      jsonb_build_object('blob', repeat('x', 5000))
    );
    v_r1 := true;
  exception when others then v_r1 := false;
  end;
  insert into results values (13, 'server writer rejects oversized metadata', 'rejected', case when v_r1 then 'UNEXPECTED_SUCCESS' else 'rejected' end, not v_r1);

  -- ══ 14: duplicate event_key creates one row ══
  v_dupe_key := 'c2d-dupe-test-' || gen_random_uuid()::text;
  perform public.record_security_event('admin_login_failed','info','edge_function', null, null, false, 'aal1', null, null, 'login', 'failure', 'invalid_credentials', null, '/login', 'POST', null, 'unavailable', 'vitest-agent', v_dupe_key, '{}'::jsonb);
  select r.status into v_status2 from public.record_security_event('admin_login_failed','info','edge_function', null, null, false, 'aal1', null, null, 'login', 'failure', 'invalid_credentials', null, '/login', 'POST', null, 'unavailable', 'vitest-agent', v_dupe_key, '{}'::jsonb) r;
  select count(*) into v_row_count from public.security_events where event_key = v_dupe_key;
  insert into results values (14, 'duplicate event_key creates exactly one row', '1 row, second call status=duplicate', v_row_count::text || ' row(s), status=' || v_status2, v_row_count = 1 and v_status2 = 'duplicate');

  -- ══ 15: server timestamps override client attempts (no param exists) ══
  select (pg_get_function_arguments(oid) ilike '%occurred_at%' or pg_get_function_arguments(oid) ilike '%timestamp%')
    into v_r4 from pg_proc where proname='record_security_event' and pronamespace='public'::regnamespace;
  insert into results values (15, 'writer accepts no client timestamp parameter at all', 'false', coalesce(v_r4,false)::text, coalesce(v_r4,false) = false);

  -- ══ 16: client actor ID/role cannot be forged (no browser EXECUTE grant) ══
  select not (
    has_function_privilege('anon', 'public.record_security_event(text,text,text,uuid,text,boolean,text,text,text,text,text,text,uuid,text,text,inet,text,text,text,jsonb)', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.record_security_event(text,text,text,uuid,text,boolean,text,text,text,text,text,text,uuid,text,text,inet,text,text,text,jsonb)', 'EXECUTE')
  ) into v_r4;
  insert into results values (16, 'client actor identity cannot be forged (no anon/authenticated EXECUTE)', 'true', v_r4::text, v_r4);

  -- ══ 17: missing AAL treated as aal1 ══
  select r.id into v_event_id2 from public.record_security_event('admin_logout','info','edge_function', v_super, 'super_admin', true, null, null, null, 'logout', 'success', null, null, null, null, null, null, null, null, '{}'::jsonb) r;
  select assurance_level into v_err from public.security_events where id = v_event_id2;
  insert into results values (17, 'missing assurance_level defaults to aal1', 'aal1', v_err, v_err = 'aal1');

  -- ══ 18: legal hold requires super_admin + aal2 ══
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_admin_test::text, 'role','authenticated','aal','aal2')::text, true);
  set local role authenticated;
  begin
    perform public.place_legal_hold(v_event_id, null, 'test hold attempt by admin, not super_admin');
    v_r1 := true;
  exception when others then v_r1 := false;
  end;
  reset role;

  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_super::text, 'role','authenticated','aal','aal1')::text, true);
  set local role authenticated;
  begin
    perform public.place_legal_hold(v_event_id, null, 'test hold attempt at aal1');
    v_r2 := true;
  exception when others then v_r2 := false;
  end;
  reset role;

  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_super::text, 'role','authenticated','aal','aal2')::text, true);
  set local role authenticated;
  select h.id into v_hold_id from public.place_legal_hold(v_event_id, null, 'c2d test hold — verifying retention interaction, rolled back') h;
  reset role;

  insert into results values (181, 'legal hold rejected for admin (not super_admin)', 'rejected', case when v_r1 then 'UNEXPECTED_SUCCESS' else 'rejected' end, not v_r1);
  insert into results values (182, 'legal hold rejected for super_admin at aal1', 'rejected', case when v_r2 then 'UNEXPECTED_SUCCESS' else 'rejected' end, not v_r2);
  insert into results values (183, 'legal hold accepted for super_admin at aal2', 'hold id returned', coalesce(v_hold_id::text,'NULL'), v_hold_id is not null);

  -- ══ 19: legal hold prevents cleanup eligibility ══
  -- retention_until is immutable once written (the block-mutation trigger
  -- covers UPDATE unconditionally, by design), so an already-expired test
  -- row is seeded via a direct owner-level INSERT (bypassing the writer
  -- function, not the schema) rather than backdating the seeded row.
  insert into public.security_events (event_type, severity, source, action, outcome, retention_until)
  values ('admin_logout', 'info', 'edge_function', 'logout', 'success', now() - interval '1 day')
  returning id into v_expired_id;

  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_super::text, 'role','authenticated','aal','aal2')::text, true);
  set local role authenticated;
  select h.id into v_hold_id from public.place_legal_hold(v_expired_id, null, 'c2d test hold on an already-expired row, rolled back') h;
  reset role;

  select count(*) into v_before_count from public.security_events where id = v_expired_id;
  perform set_config('request.jwt.claims', jsonb_build_object('role','service_role')::text, true);
  perform public.security_events_cleanup_expired();
  select count(*) into v_after_count from public.security_events where id = v_expired_id;
  insert into results values (19, 'legal hold prevents retention cleanup for the held event', '1 (still present)', v_after_count::text, v_before_count = 1 and v_after_count = 1);

  -- release the hold and re-run cleanup to confirm the mechanism actually
  -- deletes once the hold is released (proves #19 isn't just "cleanup
  -- never deletes anything").
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_super::text, 'role','authenticated','aal','aal2')::text, true);
  set local role authenticated;
  perform public.release_legal_hold(v_hold_id);
  reset role;
  perform set_config('request.jwt.claims', jsonb_build_object('role','service_role')::text, true);
  perform public.security_events_cleanup_expired();
  select count(*) into v_after_count from public.security_events where id = v_expired_id;
  insert into results values (191, 'releasing the hold allows cleanup to delete the expired event', '0', v_after_count::text, v_after_count = 0);

end $$;

select n, name, expected, actual, passed from results order by n;

rollback;
