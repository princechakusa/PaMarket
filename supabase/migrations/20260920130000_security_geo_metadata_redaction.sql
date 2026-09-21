-- Keep Cloudflare's approximate network location behind the same role gate as IP.
begin;

create or replace function public.get_security_event(p_event_id uuid)
returns table (
  id uuid, event_type text, severity text, source text, occurred_at timestamptz,
  received_at timestamptz, actor_user_id uuid, actor_role text,
  actor_authenticated boolean, assurance_level text, target_type text,
  target_id text, action text, outcome text, reason_code text,
  correlation_id uuid, request_path text, request_method text, ip_address inet,
  ip_source text, user_agent text, metadata jsonb, retention_until timestamptz,
  created_at timestamptz, hold_status text, hold_id uuid
)
language plpgsql security definer set search_path = '' as $$
declare v_include_ip boolean;
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
  select se.id, se.event_type, se.severity, se.source, se.occurred_at, se.received_at,
    se.actor_user_id, se.actor_role, se.actor_authenticated, se.assurance_level,
    se.target_type, se.target_id, se.action, se.outcome, se.reason_code,
    se.correlation_id, se.request_path, se.request_method,
    case when v_include_ip then se.ip_address else null end,
    case when v_include_ip then se.ip_source else 'restricted' end,
    se.user_agent,
    case when v_include_ip then se.metadata else se.metadata - 'network_location' end,
    se.retention_until, se.created_at,
    case when h.id is not null then 'active' else 'none' end,
    h.id
  from public.security_events se
  left join public.security_event_legal_holds h
    on h.status = 'active'
   and (h.event_id = se.id or (h.correlation_id is not null and h.correlation_id = se.correlation_id))
  where se.id = p_event_id
  order by h.placed_at desc nulls last
  limit 1;
exception when others then
  if sqlstate in ('42501', '22023') then raise; end if;
  raise exception 'security event could not be loaded' using errcode = 'P0001';
end $$;
revoke all on function public.get_security_event(uuid) from public, anon;
grant execute on function public.get_security_event(uuid) to authenticated;
notify pgrst, 'reload schema';
commit;
