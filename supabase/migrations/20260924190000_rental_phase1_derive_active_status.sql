-- ============================================================
-- Rental Phase 1: derive the picked_up -> active display transition at
-- read time instead of adding a cron job / trigger.
--
-- Phase 1 registered ('picked_up','active','system') as a valid
-- transition but nothing ever performed it — there was no time-based
-- mechanism to notice a pickup date had arrived. Investigated per the
-- Phase 1 verification brief section 7 ("if it can be implemented safely
-- without adding unnecessary infrastructure, implement it").
--
-- Every existing caller (RN app/rentals/my-bookings.tsx, app/rental-fleet/
-- bookings.tsx; web js/controllers/my-rental-bookings.js, js/rental-
-- fleet.js) already groups 'picked_up' and 'active' into one "Active"
-- bucket and never branches on which of the two it is. That means the
-- distinction is purely a display nicety, not something any workflow
-- depends on — so it doesn't need a stored value that must be kept
-- correct by a background job. It's computed here instead: a
-- 'picked_up' booking is shown as 'active' once its pickup time has
-- passed, with no write, no cron, no new trigger.
--
-- The real, stored status column is untouched — the transition table,
-- the exclusion constraint, and rental_booking_transition() still only
-- ever see 'picked_up' in the database. This only affects what the two
-- read RPCs return to a caller.
--
-- Additive and idempotent. Safe to re-run.
-- ============================================================

create or replace function public.rental_booking_display_status(p_status text, p_pickup_at timestamptz)
returns text
language sql
immutable
as $$
  select case when p_status = 'picked_up' and p_pickup_at <= now() then 'active' else p_status end;
$$;

grant execute on function public.rental_booking_display_status(text, timestamptz) to anon, authenticated;

create or replace function public.list_my_rental_bookings(
  p_status text default null,
  p_limit  integer default 50,
  p_offset integer default 0
)
returns table (
  id uuid, listing_id uuid, company_id uuid, status text,
  pickup_at timestamptz, return_at timestamptz, fulfillment text,
  with_driver boolean, total_amount numeric, currency text,
  conversation_id text, created_at timestamptz,
  vehicle_model text, vehicle_year smallint, cover_url text, company_name text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    b.id, b.listing_id, b.company_id,
    public.rental_booking_display_status(b.status, b.pickup_at),
    b.pickup_at, b.return_at, b.fulfillment,
    b.with_driver, b.total_amount, b.currency, b.conversation_id, b.created_at,
    l.model, l.year,
    (select url from public.rental_vehicle_media m where m.listing_id = l.id and m.is_cover = true limit 1),
    coalesce(rc.trading_name, biz.name, 'Rental company')
  from public.rental_bookings b
  join public.rental_vehicle_listings l on l.id = b.listing_id
  join public.rental_companies rc on rc.id = b.company_id
  join public.businesses biz on biz.id = rc.business_id
  where b.customer_id = auth.uid()
    -- Filtering by the caller-facing status: a request for 'active' must
    -- also catch rows still stored as 'picked_up' whose time has passed,
    -- and a request for 'picked_up' must exclude those (they now display
    -- as 'active'). Filtering by any other status is unaffected.
    and (
      p_status is null
      or public.rental_booking_display_status(b.status, b.pickup_at) = p_status
    )
  order by b.created_at desc
  limit least(greatest(coalesce(p_limit, 50), 1), 200)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

revoke all on function public.list_my_rental_bookings(text, integer, integer) from public, anon;
grant execute on function public.list_my_rental_bookings(text, integer, integer) to authenticated;

create or replace function public.list_company_rental_bookings(
  p_company_id uuid,
  p_status     text default null,
  p_limit      integer default 100,
  p_offset     integer default 0
)
returns table (
  id uuid, listing_id uuid, customer_id uuid, status text,
  pickup_at timestamptz, return_at timestamptz, fulfillment text, delivery_address text,
  with_driver boolean, rate_subtotal numeric, driver_fee numeric, deposit numeric,
  total_amount numeric, currency text, customer_note text, conversation_id text,
  decline_reason text, cancellation_reason text, created_at timestamptz,
  vehicle_model text, customer_name text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not (public.owns_rental_company(p_company_id) or public.is_admin()) then
    raise exception 'Not authorized to view this company''s bookings.' using errcode = '42501';
  end if;
  return query
    select
      b.id, b.listing_id, b.customer_id,
      public.rental_booking_display_status(b.status, b.pickup_at),
      b.pickup_at, b.return_at,
      b.fulfillment, b.delivery_address, b.with_driver, b.rate_subtotal, b.driver_fee, b.deposit,
      b.total_amount, b.currency, b.customer_note, b.conversation_id,
      b.decline_reason, b.cancellation_reason, b.created_at,
      l.model, coalesce(p.name, 'Customer')
    from public.rental_bookings b
    join public.rental_vehicle_listings l on l.id = b.listing_id
    left join public.profiles p on p.id = b.customer_id
    where b.company_id = p_company_id
      and (
        p_status is null
        or public.rental_booking_display_status(b.status, b.pickup_at) = p_status
      )
    order by b.created_at desc
    limit least(greatest(coalesce(p_limit, 100), 1), 300)
    offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

revoke all on function public.list_company_rental_bookings(uuid, text, integer, integer) from public, anon;
grant execute on function public.list_company_rental_bookings(uuid, text, integer, integer) to authenticated;

notify pgrst, 'reload schema';

-- ── VERIFY (read-only; run after applying) ──────────────────────────────
-- A 'picked_up' booking whose pickup_at is in the past now comes back with
-- status 'active' from both list functions, while the stored row is
-- unchanged:
-- select status from rental_bookings where id = '<a picked_up booking>';        -- still 'picked_up'
-- select status from list_my_rental_bookings('active') where id = '<same id>';  -- now 'active'
-- ============================================================
