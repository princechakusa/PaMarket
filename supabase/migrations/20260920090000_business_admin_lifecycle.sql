-- Admin business suspension and evidence-preserving deletion.
-- Existing owner update RLS is broad, so guard these transitions server-side.
begin;

alter table public.businesses add column if not exists deleted_at timestamptz;
alter table public.businesses add column if not exists deletion_reason text;

create or replace function public.guard_business_admin_lifecycle()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.deleted_at is not null then
    raise exception 'archived business is immutable' using errcode = '42501';
  end if;

  if new.deleted_at is distinct from old.deleted_at then
    if new.deleted_at is null or new.status <> 'suspended'
       or not public.is_super_admin() or not public.has_mfa_aal2() then
      raise exception 'Super Admin with AAL2 required to archive a business' using errcode = '42501';
    end if;
  elsif new.deletion_reason is distinct from old.deletion_reason then
    raise exception 'deletion reason can only change during archival' using errcode = '42501';
  end if;

  if (old.status = 'suspended' or new.status = 'suspended')
     and new.status is distinct from old.status
     and not public.has_admin_privilege('admin') then
    raise exception 'admin role required to suspend or restore a business' using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists guard_business_admin_lifecycle on public.businesses;
create trigger guard_business_admin_lifecycle before update on public.businesses
for each row execute function public.guard_business_admin_lifecycle();
revoke all on function public.guard_business_admin_lifecycle() from public;

create or replace function public.record_business_admin_lifecycle()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_role text;
begin
  if new.status is not distinct from old.status and new.deleted_at is not distinct from old.deleted_at then
    return new;
  end if;
  if new.status = 'suspended' then
    update public.listings set status = 'paused'
    where business_id = new.id and status = 'active';
  end if;
  select role into v_role from public.profiles where id = auth.uid();
  insert into public.admin_audit_logs(actor_id, actor_role, action, entity, entity_id, before_state, after_state, reason)
  values (auth.uid(), v_role,
    case when new.deleted_at is not null then 'business_archive'
         when new.status = 'suspended' then 'business_suspend'
         else 'business_restore' end,
    'businesses', new.id::text,
    jsonb_build_object('status', old.status, 'deleted_at', old.deleted_at),
    jsonb_build_object('status', new.status, 'deleted_at', new.deleted_at),
    new.deletion_reason);
  return new;
end $$;

drop trigger if exists record_business_admin_lifecycle on public.businesses;
create trigger record_business_admin_lifecycle after update of status, deleted_at on public.businesses
for each row execute function public.record_business_admin_lifecycle();
revoke all on function public.record_business_admin_lifecycle() from public;

create or replace function public.guard_suspended_business_listing()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.business_id is not null and new.status = 'active' and exists (
    select 1 from public.businesses b
    where b.id = new.business_id and (b.status = 'suspended' or b.deleted_at is not null)
  ) then
    raise exception 'a suspended or archived business cannot publish listings' using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists guard_suspended_business_listing on public.listings;
create trigger guard_suspended_business_listing before insert or update of status, business_id on public.listings
for each row execute function public.guard_suspended_business_listing();
revoke all on function public.guard_suspended_business_listing() from public;

notify pgrst, 'reload schema';
commit;
