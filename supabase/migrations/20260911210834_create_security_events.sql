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

begin;

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

commit;
