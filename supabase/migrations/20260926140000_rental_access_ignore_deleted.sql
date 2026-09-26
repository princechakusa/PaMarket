-- ============================================================
-- get_user_rental_access() ignored archived businesses and deleted rental
-- companies, so an owner who deleted a (test) business still got
-- has_rental_company=true / can_create_vehicle=true for it, and the fleet
-- dashboard kept opening. Archived businesses (businesses.deleted_at) and
-- deleted rental companies (rental_companies.deleted_at) are now skipped,
-- exactly as the public rental search already does. Same output shape.
-- ============================================================

create or replace function public.get_user_rental_access()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id     uuid;
  v_business_id uuid;
  v_company_id  uuid;
  v_status      text;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    return jsonb_build_object(
      'has_business',         false,
      'has_rental_company',   false,
      'company_status',       null,
      'can_access_dashboard', false,
      'can_create_fleet',     false,
      'can_create_vehicle',   false
    );
  end if;

  select b.id, rc.id, rc.status
    into v_business_id, v_company_id, v_status
  from businesses b
  left join rental_companies rc on rc.business_id = b.id and rc.deleted_at is null
  where b.owner_user_id = v_user_id
    and b.deleted_at is null
  order by (rc.id is null) asc, b.created_at desc
  limit 1;

  if v_business_id is null then
    return jsonb_build_object(
      'has_business',         false,
      'has_rental_company',   false,
      'company_status',       null,
      'can_access_dashboard', false,
      'can_create_fleet',     false,
      'can_create_vehicle',   false
    );
  end if;

  if v_company_id is null then
    return jsonb_build_object(
      'has_business',         true,
      'business_id',          v_business_id,
      'has_rental_company',   false,
      'company_status',       null,
      'can_access_dashboard', false,
      'can_create_fleet',     false,
      'can_create_vehicle',   false
    );
  end if;

  return jsonb_build_object(
    'has_business',         true,
    'business_id',          v_business_id,
    'has_rental_company',   true,
    'company_id',           v_company_id,
    'company_status',       v_status,
    'can_access_dashboard', v_status in ('active', 'pending'),
    'can_create_fleet',     v_status = 'active',
    'can_create_vehicle',   v_status = 'active'
  );
end;
$$;

grant execute on function public.get_user_rental_access() to authenticated;
