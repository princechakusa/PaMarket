-- rental_capture_lead accepted a client-supplied p_company_id and trusted it
-- as-is, with no check that it matched the listing's actual owner. Since
-- rental_companies is publicly readable, any authenticated client could pass
-- a real listing_id alongside an unrelated company_id, attributing a lead to
-- the wrong company. Fix: derive company_id from the listing row itself.

create or replace function public.rental_capture_lead(
  p_listing_id uuid,
  p_lead_source text,
  p_conversation_id text default null,
  p_requested_start_date date default null,
  p_requested_end_date date default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_company_id uuid;
  v_lead_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required.';
  end if;

  if p_lead_source not in ('chat', 'whatsapp_click', 'call_click', 'favorite', 'share', 'view_detail', 'booking_request') then
    raise exception 'Invalid rental lead source.';
  end if;

  if p_requested_start_date is not null
     and p_requested_end_date is not null
     and p_requested_end_date < p_requested_start_date then
    raise exception 'Invalid requested rental dates.';
  end if;

  select company_id into v_company_id
  from public.rental_vehicle_listings
  where id = p_listing_id;

  if v_company_id is null then
    raise exception 'Listing not found.';
  end if;

  insert into public.rental_vehicle_leads (
    listing_id,
    company_id,
    user_id,
    lead_source,
    status,
    conversation_id,
    requested_start_date,
    requested_end_date
  )
  values (
    p_listing_id,
    v_company_id,
    v_user_id,
    p_lead_source,
    'new',
    p_conversation_id,
    p_requested_start_date,
    p_requested_end_date
  )
  returning id into v_lead_id;

  return v_lead_id;
exception
  when unique_violation then
    update public.rental_vehicle_leads
    set
      lead_source = p_lead_source,
      status = case
        when status = 'converted' then status
        else 'new'
      end,
      conversation_id = coalesce(p_conversation_id, conversation_id),
      requested_start_date = coalesce(p_requested_start_date, requested_start_date),
      requested_end_date = coalesce(p_requested_end_date, requested_end_date),
      contacted_at = case
        when status = 'converted' then contacted_at
        else null
      end,
      updated_at = now()
    where listing_id = p_listing_id
      and user_id = v_user_id
    returning id into v_lead_id;

    if v_lead_id is null then
      raise;
    end if;

    return v_lead_id;
end;
$$;

revoke all on function public.rental_capture_lead(uuid, uuid, text, text, date, date) from public, anon, authenticated;
drop function if exists public.rental_capture_lead(uuid, uuid, text, text, date, date);

revoke all on function public.rental_capture_lead(uuid, text, text, date, date) from public;
grant execute on function public.rental_capture_lead(uuid, text, text, date, date) to authenticated;
