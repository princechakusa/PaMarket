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

begin;

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
  hold_status         text,
  hold_id             uuid
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
    case when h.id is not null then 'active' else 'none' end as hold_status,
    h.id as hold_id
  from public.security_events se
  left join public.security_event_legal_holds h
    on h.status = 'active'
   and (h.event_id = se.id or (h.correlation_id is not null and h.correlation_id = se.correlation_id))
  where se.id = p_event_id
  order by h.placed_at desc nulls last
  limit 1;
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

commit;
