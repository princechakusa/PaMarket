-- Stage C2E: authorize and audit the admin Sentry proxy.
-- Prepared only. Do not apply without a separate production approval.

begin;

do $preflight$
begin
  if to_regclass('public.security_events') is null then
    raise exception 'C2E abort: public.security_events is missing';
  end if;
  if to_regprocedure('public.record_security_event(text,text,text,uuid,text,boolean,text,text,text,text,text,text,uuid,text,text,inet,text,text,text,jsonb)') is null then
    raise exception 'C2E abort: record_security_event(...) is missing';
  end if;
  if to_regprocedure('public.list_security_events(integer,integer,timestamp with time zone,timestamp with time zone,text,text,text,text,uuid,uuid)') is null then
    raise exception 'C2E abort: list_security_events(...) is missing';
  end if;
end
$preflight$;

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
    'admin_mfa_challenge_failed','admin_mfa_challenge_succeeded','admin_logout',
    'admin_sentry_access_denied','admin_sentry_issues_listed','admin_sentry_issue_viewed'
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
  'C2E: the only INSERT path into security_events. Timestamps are always server-generated by the table default — no timestamp parameter exists. Rejects unknown event_type/severity/source/outcome, strips query strings from request_path, redacts a fixed set of prohibited metadata keys, bounds metadata to 4KB, and is idempotent on event_key via ON CONFLICT DO NOTHING. Callable only by service_role.';

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
    'admin_mfa_challenge_failed','admin_mfa_challenge_succeeded','admin_logout',
    'admin_sentry_access_denied','admin_sentry_issues_listed','admin_sentry_issue_viewed'
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
  'C2E: the only browser read path for a list of security_events. Requires has_admin_privilege(''admin'') and has_mfa_aal2(); returns ip_address/ip_source only when the caller is_super_admin(), NULL/''restricted'' otherwise. Page size capped at 100; deterministic (occurred_at desc, id desc) ordering.';

revoke all on function public.list_security_events(
  integer, integer, timestamptz, timestamptz, text, text, text, text, uuid, uuid
) from public;
revoke execute on function public.list_security_events(
  integer, integer, timestamptz, timestamptz, text, text, text, text, uuid, uuid
) from anon;
grant execute on function public.list_security_events(
  integer, integer, timestamptz, timestamptz, text, text, text, text, uuid, uuid
) to authenticated;

notify pgrst, 'reload schema';

commit;
