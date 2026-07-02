-- ============================================================
-- fix_rental_access_multi_business.sql
--
-- BUG: get_user_rental_access() picked the caller's business with
--   select id from businesses where owner_user_id = auth.uid() limit 1
-- No ORDER BY, no join to rental_companies. A user who owns more than
-- one business (verified live: "Hella boss" + "Prince", rental company
-- attached to "Prince") gets an arbitrary business back — when it's the
-- wrong one the RPC reports has_rental_company=false and the rental
-- dashboard bounces to setup / renders blank, even though the company
-- exists and is ACTIVE.
--
-- FIX: prefer the business that has a rental company; fall back to the
-- newest business when none do. Same output shape as before.
--
-- Run once in Supabase SQL Editor.
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

  -- Pick the business WITH a rental company first; newest business otherwise
  select b.id, rc.id, rc.status
    into v_business_id, v_company_id, v_status
  from businesses b
  left join rental_companies rc on rc.business_id = b.id
  where b.owner_user_id = v_user_id
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
-- ============================================================
