-- ============================================================
-- Rental Phase 1 fix: list_my_rental_bookings() and
-- list_company_rental_bookings() had no LIMIT/OFFSET at all — found during
-- the Phase 1 verification pass (section 8, "confirm booking lists are
-- paginated"). A customer or provider with a long booking history would
-- have every row returned in one call. Adds the same clamp pattern already
-- used by other paginated RPCs in this project (e.g.
-- 202608200002_release_blocker_recruitment_hardening.sql).
--
-- Two mistakes were made and caught (by this migration's own PGlite test)
-- before this ever reached Supabase:
--
-- 1. Appending p_limit/p_offset with CREATE OR REPLACE does NOT alter the
--    existing 1-arg function in place — appending parameters is not a
--    same-signature replace in Postgres (matching the exact warning
--    already on record in this repo, see 20260916150000_create_job_
--    listing_institution_aware.sql), so it silently creates a SECOND,
--    overloaded function instead. Both a 1-arg and a 3-arg
--    list_my_rental_bookings then existed at once.
-- 2. Because p_limit/p_offset both have defaults, calling the 3-arg
--    version with only p_status supplied looks identical to calling the
--    1-arg version — Postgres reports `is not unique` and refuses the call.
--
-- The fix is the explicit DROP below before CREATE, exactly as that
-- referenced migration's own comment prescribes: this guarantees exactly
-- one list_my_rental_bookings (and one list_company_rental_bookings)
-- exists afterward, so a caller passing only p_status keeps working
-- against the one function that has p_limit/p_offset defaults built in.
--
-- Additive and idempotent. Safe to re-run.
-- ============================================================

-- Drops only the stale 1-arg shape if it's still there (a fresh run right
-- after Phase 1); once the 3-arg version below exists, this is a no-op, so
-- CREATE OR REPLACE on the 3-arg signature stays valid on every re-run.
drop function if exists public.list_my_rental_bookings(text);

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
    b.id, b.listing_id, b.company_id, b.status, b.pickup_at, b.return_at, b.fulfillment,
    b.with_driver, b.total_amount, b.currency, b.conversation_id, b.created_at,
    l.model, l.year,
    (select url from public.rental_vehicle_media m where m.listing_id = l.id and m.is_cover = true limit 1),
    coalesce(rc.trading_name, biz.name, 'Rental company')
  from public.rental_bookings b
  join public.rental_vehicle_listings l on l.id = b.listing_id
  join public.rental_companies rc on rc.id = b.company_id
  join public.businesses biz on biz.id = rc.business_id
  where b.customer_id = auth.uid()
    and (p_status is null or b.status = p_status)
  order by b.created_at desc
  limit least(greatest(coalesce(p_limit, 50), 1), 200)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

revoke all on function public.list_my_rental_bookings(text, integer, integer) from public, anon;
grant execute on function public.list_my_rental_bookings(text, integer, integer) to authenticated;

-- Same reasoning as list_my_rental_bookings above: only drops the stale
-- 2-arg shape if it's still there; a no-op on re-run.
drop function if exists public.list_company_rental_bookings(uuid, text);

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
      b.id, b.listing_id, b.customer_id, b.status, b.pickup_at, b.return_at,
      b.fulfillment, b.delivery_address, b.with_driver, b.rate_subtotal, b.driver_fee, b.deposit,
      b.total_amount, b.currency, b.customer_note, b.conversation_id,
      b.decline_reason, b.cancellation_reason, b.created_at,
      l.model, coalesce(p.name, 'Customer')
    from public.rental_bookings b
    join public.rental_vehicle_listings l on l.id = b.listing_id
    left join public.profiles p on p.id = b.customer_id
    where b.company_id = p_company_id
      and (p_status is null or b.status = p_status)
    order by b.created_at desc
    limit least(greatest(coalesce(p_limit, 100), 1), 300)
    offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

revoke all on function public.list_company_rental_bookings(uuid, text, integer, integer) from public, anon;
grant execute on function public.list_company_rental_bookings(uuid, text, integer, integer) to authenticated;

notify pgrst, 'reload schema';

-- ── VERIFY (read-only; run after applying) ──────────────────────────────
-- select list_my_rental_bookings('requested');                    -- still works, unchanged call shape
-- select list_my_rental_bookings('requested', 10, 0);              -- new: explicit page
-- select list_company_rental_bookings('<company id>', null, 20, 0);
-- ============================================================
