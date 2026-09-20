-- Record each downloadable security evidence snapshot without changing the event.
begin;

create table if not exists public.security_evidence_exports (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.security_events(id),
  exported_by uuid not null references public.profiles(id),
  exported_at timestamptz not null default now()
);
create index if not exists security_evidence_exports_event_idx on public.security_evidence_exports(event_id, exported_at desc);
alter table public.security_evidence_exports enable row level security;
alter table public.security_evidence_exports force row level security;
revoke all on public.security_evidence_exports from public, anon, authenticated;

create or replace function public.record_security_evidence_export(p_event_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if not public.is_super_admin() or not public.has_mfa_aal2() then
    raise exception 'Super Admin with AAL2 required' using errcode = '42501';
  end if;
  if not exists (select 1 from public.security_events where id = p_event_id) then
    raise exception 'security event not found' using errcode = '22023';
  end if;
  insert into public.security_evidence_exports(event_id, exported_by)
    values (p_event_id, auth.uid()) returning id into v_id;
  return v_id;
end $$;
revoke all on function public.record_security_evidence_export(uuid) from public, anon;
grant execute on function public.record_security_evidence_export(uuid) to authenticated;

notify pgrst, 'reload schema';
commit;
