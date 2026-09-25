-- Car Rental production hardening
-- - one date-aware marketplace search for web and mobile
-- - correct cheapest server-side pricing
-- - lifecycle timing guards
-- - correct volatility for time-derived display state

drop function if exists public.rental_search_listings(
  text, text, text, numeric, numeric, text, text, text,
  boolean, boolean, integer, integer
);

create function public.rental_search_listings(
  p_category_slug text default null,
  p_city text default null,
  p_brand_slug text default null,
  p_price_min numeric default null,
  p_price_max numeric default null,
  p_transmission text default null,
  p_fuel_type text default null,
  p_drive_type text default null,
  p_available_only boolean default false,
  p_featured_first boolean default true,
  p_limit integer default 20,
  p_offset integer default 0,
  p_start_date date default null,
  p_end_date date default null
)
returns table (
  id uuid, model text, year smallint, daily_rate numeric,
  is_available boolean, view_count bigint, category_slug text,
  brand_slug text, city text, company_name text, cover_url text,
  is_featured boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_start date := coalesce(p_start_date, public.rental_today());
  v_end date := coalesce(p_end_date, coalesce(p_start_date, public.rental_today()));
begin
  if v_start < public.rental_today() then
    raise exception 'Availability dates cannot be in the past.' using errcode = '22023';
  end if;
  if v_end < v_start then
    raise exception 'The end date must be on or after the start date.' using errcode = '22023';
  end if;
  if v_end > public.rental_today() + 730 then
    raise exception 'Availability dates must be within the next two years.' using errcode = '22023';
  end if;

  return query
  select
    l.id, l.model, l.year, l.daily_rate,
    (l.is_available and not public.rental_vehicle_range_is_busy(l.id, v_start, v_end)),
    l.view_count, cat.slug, br.slug, loc.city,
    coalesce(rc.trading_name, b.name),
    (select m.url from public.rental_vehicle_media m
      where m.listing_id = l.id
      order by m.is_cover desc, m.sort_order asc nulls last limit 1),
    exists (
      select 1 from public.rental_featured_listings f
      where f.listing_id = l.id and f.is_active and f.ends_at > now()
    )
  from public.rental_vehicle_listings l
  join public.rental_categories cat on cat.id = l.category_id
  join public.rental_brands br on br.id = l.brand_id
  join public.rental_locations loc on loc.id = l.location_id
  join public.rental_companies rc on rc.id = l.company_id
  join public.businesses b on b.id = rc.business_id
  where l.status = 'active'
    and l.admin_status = 'approved'
    and l.deleted_at is null
    and rc.status = 'active'
    and rc.deleted_at is null
    and (p_category_slug is null or cat.slug = p_category_slug)
    and (p_city is null or loc.city ilike p_city)
    and (p_brand_slug is null or br.slug = p_brand_slug)
    and (p_price_min is null or l.daily_rate >= p_price_min)
    and (p_price_max is null or l.daily_rate <= p_price_max)
    and (not coalesce(p_available_only, false) or (
      l.is_available and not public.rental_vehicle_range_is_busy(l.id, v_start, v_end)
    ))
    and (p_transmission is null or exists (
      select 1 from public.rental_vehicle_specs s
      where s.listing_id = l.id and s.transmission = p_transmission
    ))
    and (p_fuel_type is null or exists (
      select 1 from public.rental_vehicle_specs s
      where s.listing_id = l.id and s.fuel_type = p_fuel_type
    ))
    and (p_drive_type is null or exists (
      select 1 from public.rental_vehicle_specs s
      where s.listing_id = l.id and s.drive_type = p_drive_type
    ))
  order by
    (coalesce(p_featured_first, true) and exists (
      select 1 from public.rental_featured_listings f
      where f.listing_id = l.id and f.is_active and f.ends_at > now()
    )) desc,
    l.created_at desc
  limit least(greatest(coalesce(p_limit, 20), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

revoke all on function public.rental_search_listings(
  text, text, text, numeric, numeric, text, text, text,
  boolean, boolean, integer, integer, date, date
) from public;
grant execute on function public.rental_search_listings(
  text, text, text, numeric, numeric, text, text, text,
  boolean, boolean, integer, integer, date, date
) to anon, authenticated;

create or replace function public.rental_quote_booking(
  p_listing_id uuid,
  p_pickup_at timestamptz,
  p_return_at timestamptz,
  p_with_driver boolean default false
)
returns table (
  daily_rate numeric, rental_days integer, rate_subtotal numeric,
  driver_fee numeric, extras_fee numeric, deposit numeric,
  total_amount numeric, currency text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_listing record;
  v_days integer;
  v_daily_total numeric;
  v_weekly_total numeric;
  v_monthly_total numeric;
  v_month_remainder integer;
  v_remainder_total numeric;
  v_rate_subtotal numeric;
  v_driver_fee numeric := 0;
begin
  if p_pickup_at is null or p_return_at is null or p_return_at <= p_pickup_at then
    raise exception 'A valid pick-up and return time is required.' using errcode = '22023';
  end if;

  select l.daily_rate, l.weekly_rate, l.monthly_rate, l.deposit,
         l.driver_rate, l.min_rental_days
    into v_listing
  from public.rental_vehicle_listings l
  join public.rental_companies rc on rc.id = l.company_id
  where l.id = p_listing_id
    and l.status = 'active'
    and l.admin_status = 'approved'
    and l.deleted_at is null
    and l.is_available
    and rc.status = 'active'
    and rc.deleted_at is null;

  if not found then
    raise exception 'This vehicle is not accepting bookings.' using errcode = '22023';
  end if;

  v_days := ceil(extract(epoch from (p_return_at - p_pickup_at)) / 86400.0)::integer;
  if v_days < greatest(coalesce(v_listing.min_rental_days, 1), 1) then
    raise exception 'This vehicle has a minimum rental period of % day(s).',
      greatest(coalesce(v_listing.min_rental_days, 1), 1) using errcode = '22023';
  end if;

  v_daily_total := v_days * v_listing.daily_rate;
  v_weekly_total := case when v_listing.weekly_rate is null then null
    else (v_days / 7) * v_listing.weekly_rate + (v_days % 7) * v_listing.daily_rate end;

  if v_listing.monthly_rate is not null then
    v_month_remainder := v_days % 30;
    v_remainder_total := v_month_remainder * v_listing.daily_rate;
    if v_listing.weekly_rate is not null then
      v_remainder_total := least(v_remainder_total,
        (v_month_remainder / 7) * v_listing.weekly_rate
        + (v_month_remainder % 7) * v_listing.daily_rate);
    end if;
    v_monthly_total := (v_days / 30) * v_listing.monthly_rate + v_remainder_total;
  end if;

  v_rate_subtotal := least(v_daily_total,
    coalesce(v_weekly_total, v_daily_total),
    coalesce(v_monthly_total, v_daily_total));

  if coalesce(p_with_driver, false) then
    if v_listing.driver_rate is null then
      raise exception 'A driver is not available for this vehicle.' using errcode = '22023';
    end if;
    v_driver_fee := v_days * v_listing.driver_rate;
  end if;

  return query select v_listing.daily_rate, v_days,
    round(v_rate_subtotal, 2), round(v_driver_fee, 2), 0::numeric,
    round(coalesce(v_listing.deposit, 0), 2),
    round(v_rate_subtotal + v_driver_fee + coalesce(v_listing.deposit, 0), 2),
    'USD'::text;
end;
$$;

revoke all on function public.rental_quote_booking(uuid, timestamptz, timestamptz, boolean) from public;
grant execute on function public.rental_quote_booking(uuid, timestamptz, timestamptz, boolean) to anon, authenticated;

create or replace function public.rental_booking_guard_transition()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.status <> 'requested' then
      raise exception 'A new booking must start as requested.' using errcode = '22023';
    end if;
    new.previous_status := null;
    new.status_changed_at := now();
    return new;
  end if;
  if new.status = old.status then return new; end if;
  if not exists (select 1 from public.rental_booking_transitions
    where from_state = old.status and to_state = new.status) then
    raise exception 'Invalid booking status transition: % -> %.', old.status, new.status using errcode = '22023';
  end if;
  if old.status = 'confirmed' and new.status = 'cancelled'
     and new.cancelled_by = old.customer_id and now() >= old.pickup_at then
    raise exception 'A rental cannot be cancelled after its pick-up time.' using errcode = '22023';
  end if;
  if old.status = 'confirmed' and new.status = 'picked_up'
     and now() < old.pickup_at - interval '12 hours' then
    raise exception 'Pick-up can only be recorded within 12 hours of the scheduled time.' using errcode = '22023';
  end if;
  if old.status in ('picked_up', 'active') and new.status = 'returned'
     and now() < old.pickup_at then
    raise exception 'Return cannot be recorded before the rental starts.' using errcode = '22023';
  end if;
  new.previous_status := old.status;
  new.status_changed_at := now();
  return new;
end;
$$;

create or replace function public.rental_booking_display_status(p_status text, p_pickup_at timestamptz)
returns text
language sql
stable
set search_path = public
as $$
  select case when p_status = 'picked_up' and p_pickup_at <= now() then 'active' else p_status end;
$$;

revoke all on function public.rental_booking_display_status(text, timestamptz) from public;
grant execute on function public.rental_booking_display_status(text, timestamptz) to anon, authenticated;

notify pgrst, 'reload schema';
