-- ============================================================
-- Rental Phase 1: professional booking core
--
-- Builds a real rental_bookings entity on top of Phase 0
-- (20260924120000_rental_phase0_private_fields_and_availability.sql).
-- Does not touch rental_vehicle_leads (analytics/inquiry funnel — kept
-- exactly as-is) or rental_vehicle_states (the per-vehicle
-- available/unavailable/maintenance/inactive machine — a different
-- concept from a booking's own lifecycle, not reused or duplicated here).
--
-- 1. rental_bookings — one row per booking request/confirmed/active rental.
-- 2. Server-only creation: request_rental_booking() derives the customer
--    from auth.uid(), verifies the vehicle, re-checks availability under
--    lock, computes the quote server-side, and inserts. No direct insert
--    grant exists for anon/authenticated.
-- 3. Lifecycle: requested -> confirmed -> picked_up -> active -> returned
--    -> completed, with declined/cancelled off the front of the flow.
--    One transition table + one guard trigger, mirroring the existing
--    rental_state_transitions / rental_state_machine_guard pattern.
-- 4. Double-booking prevented at the database level with a btree_gist
--    EXCLUDE constraint over (listing_id, date range) for every "holds the
--    calendar" status — not just checked in the RPC.
-- 5. rental_vehicle_busy_ranges() (Phase 0) now unions confirmed/active
--    bookings with the provider's manual blocks, so every existing caller
--    (RN, web) picks this up with no client change.
-- 6. Notifications reuse the existing public.notifications table, which
--    already dispatches a push automatically (notification_push_dispatch_
--    trigger.sql) — no new push mechanism needed. Provider-facing booking
--    alerts use category='rental' (the existing "belongs to the rental
--    business platform" convention — see rentals-business.js
--    RentalNotifications / rental_notify_new_lead). Customer-facing
--    booking alerts use no category (the ordinary personal feed), the
--    same convention job application status notifications already use.
--
-- Additive and idempotent. Safe to re-run.
-- ============================================================

create extension if not exists btree_gist with schema extensions;

-- ── 1. Table ─────────────────────────────────────────────────────────────
create table if not exists public.rental_bookings (
  id                  uuid primary key default gen_random_uuid(),

  listing_id          uuid not null references public.rental_vehicle_listings(id) on delete restrict,
  company_id          uuid not null references public.rental_companies(id) on delete restrict,
  customer_id         uuid not null references auth.users(id) on delete cascade,

  pickup_at           timestamptz not null,
  return_at           timestamptz not null,
  pickup_date         date not null,   -- generated-free duplicate for the exclusion
                                        -- constraint/index (date, not timestamptz —
                                        -- availability is tracked in whole days,
                                        -- matching rental_vehicle_availability).
  return_date         date not null,

  fulfillment         text not null default 'pickup'
                        check (fulfillment in ('pickup', 'delivery')),
  delivery_address    text,
  with_driver         boolean not null default false,

  -- Price breakdown — every component the server computed, snapshotted at
  -- request time so a later rate change never rewrites an existing booking.
  daily_rate          numeric(10,2) not null check (daily_rate >= 0),
  rental_days         integer not null check (rental_days >= 1),
  rate_subtotal       numeric(10,2) not null check (rate_subtotal >= 0),
  driver_fee          numeric(10,2) not null default 0 check (driver_fee >= 0),
  extras_fee          numeric(10,2) not null default 0 check (extras_fee >= 0),
  deposit             numeric(10,2) not null default 0 check (deposit >= 0),
  total_amount        numeric(10,2) not null check (total_amount >= 0),
  currency            text not null default 'USD',

  status              text not null default 'requested'
                        check (status in (
                          'requested', 'confirmed', 'picked_up', 'active',
                          'returned', 'completed', 'declined', 'cancelled'
                        )),
  previous_status     text,
  status_changed_at   timestamptz not null default now(),

  decline_reason      text,
  cancelled_by        uuid references auth.users(id) on delete set null,
  cancellation_reason text,
  cancelled_at        timestamptz,

  customer_note       text,
  conversation_id     text references public.conversations(id) on delete set null,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  check (return_at > pickup_at),
  check (return_date >= pickup_date),
  check (fulfillment <> 'delivery' or delivery_address is not null)
);

comment on table public.rental_bookings is
  'Rental Phase 1: one row per booking request/confirmed/active rental. '
  'Distinct from rental_vehicle_leads (analytics/inquiry funnel, unaffected) '
  'and rental_vehicle_states (per-vehicle state machine, unaffected).';

create index if not exists rb_listing_status_idx
  on public.rental_bookings (listing_id, status);
create index if not exists rb_company_status_idx
  on public.rental_bookings (company_id, status, created_at desc);
create index if not exists rb_customer_idx
  on public.rental_bookings (customer_id, created_at desc);
create index if not exists rb_pending_pickup_idx
  on public.rental_bookings (pickup_at)
  where status in ('confirmed');
create index if not exists rb_active_return_idx
  on public.rental_bookings (return_at)
  where status in ('picked_up', 'active');

-- Only one row per (listing, active date range) may HOLD the calendar.
-- 'requested' does not hold it (many customers can request overlapping
-- dates; the provider picks one), matching a real commercial rental flow —
-- an unconfirmed request never blocks other customers from asking too.
create index if not exists rb_holding_status_partial_idx
  on public.rental_bookings (listing_id)
  where status in ('confirmed', 'picked_up', 'active');

alter table public.rental_bookings
  drop constraint if exists rb_no_double_booking;
alter table public.rental_bookings
  add constraint rb_no_double_booking
  exclude using gist (
    listing_id with =,
    daterange(pickup_date, return_date, '[]') with &&
  )
  where (status in ('confirmed', 'picked_up', 'active'));

drop trigger if exists rental_bookings_set_updated_at on public.rental_bookings;
create trigger rental_bookings_set_updated_at
  before update on public.rental_bookings
  for each row execute function public.set_updated_at();

-- ── 2. Lifecycle transition registry + guard ────────────────────────────
create table if not exists public.rental_booking_transitions (
  from_state text not null,
  to_state   text not null,
  actor      text not null check (actor in ('customer', 'provider', 'system')),
  primary key (from_state, to_state, actor),
  check (from_state <> to_state)
);

insert into public.rental_booking_transitions (from_state, to_state, actor) values
  ('requested', 'confirmed',  'provider'),
  ('requested', 'declined',   'provider'),
  ('requested', 'cancelled',  'customer'),
  ('confirmed', 'cancelled',  'customer'),
  ('confirmed', 'cancelled',  'provider'),
  ('confirmed', 'picked_up',  'provider'),
  ('picked_up', 'active',     'system'),
  ('picked_up', 'returned',   'provider'),
  ('active',    'returned',   'provider'),
  ('returned',  'completed',  'provider'),
  ('returned',  'completed',  'system')
on conflict do nothing;

alter table public.rental_booking_transitions enable row level security;
drop policy if exists "rbt: public read" on public.rental_booking_transitions;
create policy "rbt: public read" on public.rental_booking_transitions for select using (true);
grant select on public.rental_booking_transitions to anon, authenticated;

create or replace function public.rental_booking_guard_transition()
returns trigger
language plpgsql
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

  if new.status = old.status then
    return new;
  end if;

  if not exists (
    select 1 from public.rental_booking_transitions
    where from_state = old.status and to_state = new.status
  ) then
    raise exception 'Invalid booking status transition: % -> %.', old.status, new.status
      using errcode = '22023';
  end if;

  new.previous_status := old.status;
  new.status_changed_at := now();
  return new;
end;
$$;

drop trigger if exists trg_rental_booking_guard_transition on public.rental_bookings;
create trigger trg_rental_booking_guard_transition
  before insert or update on public.rental_bookings
  for each row execute function public.rental_booking_guard_transition();

-- ── 3. RLS: read-only for customer/provider/admin; all writes via RPC ───
alter table public.rental_bookings enable row level security;

drop policy if exists "rb: customer or provider read" on public.rental_bookings;
create policy "rb: customer or provider read"
  on public.rental_bookings for select to authenticated
  using (
    customer_id = auth.uid()
    or public.owns_rental_company(company_id)
    or public.is_admin()
  );

-- No insert/update/delete policy for anon/authenticated: every write goes
-- through a security-definer RPC below, which is the only place identity,
-- pricing, and availability are authoritative.
revoke all on public.rental_bookings from anon, authenticated;
grant select on public.rental_bookings to authenticated;

-- ── 4. Quote calculation (server-side, no client-supplied prices) ──────
create or replace function public.rental_quote_booking(
  p_listing_id  uuid,
  p_pickup_at   timestamptz,
  p_return_at   timestamptz,
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
  v_use_weekly integer;
  v_use_daily integer;
  v_rate_subtotal numeric;
  v_driver_fee numeric := 0;
begin
  if p_pickup_at is null or p_return_at is null then
    raise exception 'Pick-up and return times are required.' using errcode = '22023';
  end if;
  if p_return_at <= p_pickup_at then
    raise exception 'The return time must be after the pick-up time.' using errcode = '22023';
  end if;

  select l.daily_rate, l.weekly_rate, l.monthly_rate, l.deposit, l.driver_rate, l.min_rental_days
    into v_listing
  from public.rental_vehicle_listings l
  where l.id = p_listing_id;

  if not found then
    raise exception 'Vehicle not found.' using errcode = '23503';
  end if;

  v_days := ceil(extract(epoch from (p_return_at - p_pickup_at)) / 86400.0)::int;
  v_days := greatest(v_days, coalesce(v_listing.min_rental_days, 1));

  -- Best available rate: prefer monthly/weekly blocks over the plain daily
  -- rate when they are cheaper for the requested duration, same idea as
  -- the "best of daily/weekly/monthly" pricing already promised to the user
  -- in the app (weekly_rate/monthly_rate are already shown on the listing).
  if v_listing.monthly_rate is not null and v_days >= 28 then
    v_rate_subtotal := ceil(v_days / 30.0) * v_listing.monthly_rate;
  elsif v_listing.weekly_rate is not null and v_days >= 7 then
    v_use_weekly := v_days / 7;
    v_use_daily := v_days % 7;
    v_rate_subtotal := (v_use_weekly * v_listing.weekly_rate) + (v_use_daily * v_listing.daily_rate);
  else
    v_rate_subtotal := v_days * v_listing.daily_rate;
  end if;

  if p_with_driver then
    if v_listing.driver_rate is null then
      raise exception 'A driver is not available for this vehicle.' using errcode = '22023';
    end if;
    v_driver_fee := v_days * v_listing.driver_rate;
  end if;

  return query select
    v_listing.daily_rate,
    v_days,
    round(v_rate_subtotal, 2),
    round(v_driver_fee, 2),
    0::numeric,
    round(coalesce(v_listing.deposit, 0), 2),
    round(v_rate_subtotal + v_driver_fee + coalesce(v_listing.deposit, 0), 2),
    'USD'::text;
end;
$$;

revoke all on function public.rental_quote_booking(uuid, timestamptz, timestamptz, boolean) from public;
grant execute on function public.rental_quote_booking(uuid, timestamptz, timestamptz, boolean) to anon, authenticated;

-- ── 5. Notification helper (shared shape, matches existing rental triggers) ─
create or replace function public.rental_booking_notify(
  p_user_id uuid, p_title text, p_body text, p_type text,
  p_category text, p_booking_id uuid, p_extra jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    insert into public.notifications (id, user_id, title, body, type, category, meta)
    values (
      gen_random_uuid()::text, p_user_id, p_title, p_body, p_type, p_category,
      (jsonb_build_object('booking_id', p_booking_id, 'deepLink', 'rentalBooking:' || p_booking_id) || p_extra)
    );
  exception when others then
    raise warning 'rental_booking_notify failed for %: %', p_booking_id, sqlerrm;
  end;
end;
$$;

-- ── 6. request_rental_booking() — the only way a booking is created ────
create or replace function public.request_rental_booking(
  p_listing_id       uuid,
  p_pickup_at        timestamptz,
  p_return_at        timestamptz,
  p_fulfillment      text default 'pickup',
  p_delivery_address text default null,
  p_with_driver      boolean default false,
  p_customer_note    text default null,
  p_conversation_id  text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_listing record;
  v_owner_id uuid;
  v_quote record;
  v_booking_id uuid;
  v_pickup_date date;
  v_return_date date;
begin
  if v_uid is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  if p_pickup_at is null or p_return_at is null then
    raise exception 'Pick-up and return times are required.' using errcode = '22023';
  end if;
  -- Checked here, before any date-range/exclusion-constraint code path
  -- touches these values (daterange() raises its own unfriendly error for
  -- an inverted range) — rental_quote_booking() re-checks this too, but
  -- that call happens later, after the availability check below.
  if p_return_at <= p_pickup_at then
    raise exception 'The return time must be after the pick-up time.' using errcode = '22023';
  end if;

  if p_fulfillment not in ('pickup', 'delivery') then
    raise exception 'Invalid fulfillment option.' using errcode = '22023';
  end if;
  if p_fulfillment = 'delivery' and nullif(btrim(coalesce(p_delivery_address, '')), '') is null then
    raise exception 'A delivery address is required for delivery.' using errcode = '22023';
  end if;

  select l.*, b.owner_user_id into v_listing
  from public.rental_vehicle_listings l
  join public.rental_companies rc on rc.id = l.company_id
  join public.businesses b on b.id = rc.business_id
  where l.id = p_listing_id;

  if not found then
    raise exception 'Vehicle not found.' using errcode = '23503';
  end if;
  v_owner_id := v_listing.owner_user_id;

  if v_listing.status <> 'active' or v_listing.admin_status <> 'approved' or v_listing.deleted_at is not null then
    raise exception 'This vehicle is not accepting booking requests.' using errcode = '22023';
  end if;
  if not v_listing.is_available then
    raise exception 'This vehicle is not taking new requests right now.' using errcode = '22023';
  end if;
  if v_uid = v_owner_id then
    raise exception 'You cannot book your own rental company''s vehicle.' using errcode = '22023';
  end if;

  v_pickup_date := p_pickup_at::date;
  v_return_date := p_return_at::date;
  if v_pickup_date < public.rental_today() then
    raise exception 'The pick-up date cannot be in the past.' using errcode = '22023';
  end if;
  if v_return_date > public.rental_today() + 730 then
    raise exception 'Rental dates must be within the next two years.' using errcode = '22023';
  end if;

  -- Serialize concurrent requests for the same vehicle so two customers
  -- cannot both pass the availability check for the same dates before
  -- either has inserted — the exclusion constraint is the final backstop,
  -- but this avoids surfacing a raw constraint-violation error to the
  -- second caller in the common case.
  perform pg_advisory_xact_lock(hashtext('rental_booking:' || p_listing_id::text));

  -- rental_vehicle_range_is_busy() checks both provider-blocked availability
  -- rows and confirmed/picked_up/active bookings (see section 7b below,
  -- which overrides the Phase 0 version of this function) — this is a
  -- friendly pre-check only; the exclusion constraint on rental_bookings
  -- (rb_no_double_booking) is the actual, final backstop against a race.
  if public.rental_vehicle_range_is_busy(p_listing_id, v_pickup_date, v_return_date) then
    raise exception 'The vehicle is unavailable for some of the selected dates.'
      using errcode = '23P01',
            hint = 'Reload availability and choose dates outside the unavailable periods.';
  end if;

  select * into v_quote
  from public.rental_quote_booking(p_listing_id, p_pickup_at, p_return_at, coalesce(p_with_driver, false));

  insert into public.rental_bookings (
    listing_id, company_id, customer_id, pickup_at, return_at, pickup_date, return_date,
    fulfillment, delivery_address, with_driver,
    daily_rate, rental_days, rate_subtotal, driver_fee, extras_fee, deposit, total_amount, currency,
    customer_note, conversation_id
  ) values (
    p_listing_id, v_listing.company_id, v_uid, p_pickup_at, p_return_at, v_pickup_date, v_return_date,
    p_fulfillment, nullif(btrim(coalesce(p_delivery_address, '')), ''), coalesce(p_with_driver, false),
    v_quote.daily_rate, v_quote.rental_days, v_quote.rate_subtotal, v_quote.driver_fee, v_quote.extras_fee,
    v_quote.deposit, v_quote.total_amount, v_quote.currency,
    nullif(btrim(coalesce(p_customer_note, '')), ''), p_conversation_id
  ) returning id into v_booking_id;

  perform public.rental_booking_notify(
    v_owner_id, 'New booking request',
    coalesce((select name from public.profiles where id = v_uid), 'A customer')
      || ' requested to book the ' || v_listing.model || ' from '
      || to_char(p_pickup_at, 'DD Mon') || ' to ' || to_char(p_return_at, 'DD Mon') || '.',
    'rental_booking_requested', 'rental', v_booking_id
  );

  return v_booking_id;
exception
  when exclusion_violation then
    raise exception 'The vehicle is unavailable for some of the selected dates.'
      using errcode = '23P01',
            hint = 'Reload availability and choose dates outside the unavailable periods.';
end;
$$;

revoke all on function public.request_rental_booking(uuid, timestamptz, timestamptz, text, text, boolean, text, text) from public, anon;
grant execute on function public.request_rental_booking(uuid, timestamptz, timestamptz, text, text, boolean, text, text) to authenticated;

-- ── 7. Status-change RPCs ────────────────────────────────────────────────
-- One shared internal worker so every transition applies the same
-- authorization + transition-table check before mutating the row, and the
-- exact same notification/audit hook fires from a single place.
create or replace function public.rental_booking_transition(
  p_booking_id uuid,
  p_new_status text,
  p_actor      text,   -- 'customer' | 'provider'
  p_reason     text default null
)
returns public.rental_bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_booking public.rental_bookings%rowtype;
  v_owner_id uuid;
  v_customer_name text;
  v_vehicle_model text;
begin
  if v_uid is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  select * into v_booking from public.rental_bookings where id = p_booking_id for update;
  if not found then
    raise exception 'Booking not found.' using errcode = '23503';
  end if;

  select b.owner_user_id into v_owner_id
  from public.rental_companies rc join public.businesses b on b.id = rc.business_id
  where rc.id = v_booking.company_id;

  if p_actor = 'customer' then
    if v_uid <> v_booking.customer_id then
      raise exception 'Not authorized to change this booking.' using errcode = '42501';
    end if;
  elsif p_actor = 'provider' then
    if v_uid <> v_owner_id and not public.is_admin() then
      raise exception 'Not authorized to change this booking.' using errcode = '42501';
    end if;
  else
    raise exception 'Invalid actor.' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.rental_booking_transitions
    where from_state = v_booking.status and to_state = p_new_status and actor = p_actor
  ) then
    raise exception 'This booking cannot move from % to % as %.', v_booking.status, p_new_status, p_actor
      using errcode = '22023';
  end if;

  update public.rental_bookings
  set status = p_new_status,
      decline_reason = case when p_new_status = 'declined' then p_reason else decline_reason end,
      cancellation_reason = case when p_new_status = 'cancelled' then p_reason else cancellation_reason end,
      cancelled_by = case when p_new_status = 'cancelled' then v_uid else cancelled_by end,
      cancelled_at = case when p_new_status = 'cancelled' then now() else cancelled_at end
  where id = p_booking_id
  returning * into v_booking;

  select coalesce(name, 'The customer') into v_customer_name from public.profiles where id = v_booking.customer_id;
  v_vehicle_model := coalesce((select model from public.rental_vehicle_listings where id = v_booking.listing_id), 'the vehicle');

  if p_new_status = 'confirmed' then
    perform public.rental_booking_notify(v_booking.customer_id, 'Booking confirmed',
      'Your booking for the ' || v_vehicle_model || ' has been confirmed.', 'rental_booking_confirmed', null, v_booking.id);
  elsif p_new_status = 'declined' then
    perform public.rental_booking_notify(v_booking.customer_id, 'Booking declined',
      'Your booking request for the ' || v_vehicle_model
        || coalesce(' was declined: ' || p_reason, ' was declined.'), 'rental_booking_declined', null, v_booking.id);
  elsif p_new_status = 'cancelled' then
    if p_actor = 'customer' then
      perform public.rental_booking_notify(v_owner_id, 'Booking cancelled',
        v_customer_name || ' cancelled their booking for the ' || v_vehicle_model || '.',
        'rental_booking_cancelled', 'rental', v_booking.id);
    else
      perform public.rental_booking_notify(v_booking.customer_id, 'Booking cancelled',
        'Your booking for the ' || v_vehicle_model
          || coalesce(' was cancelled by the provider: ' || p_reason, ' was cancelled by the provider.'),
        'rental_booking_cancelled', null, v_booking.id);
    end if;
  elsif p_new_status = 'picked_up' then
    perform public.rental_booking_notify(v_booking.customer_id, 'Vehicle picked up',
      'Your rental of the ' || v_vehicle_model || ' has started.', 'rental_booking_picked_up', null, v_booking.id);
  elsif p_new_status = 'returned' then
    perform public.rental_booking_notify(v_booking.customer_id, 'Vehicle returned',
      'The return of the ' || v_vehicle_model || ' has been recorded.', 'rental_booking_returned', null, v_booking.id);
  elsif p_new_status = 'completed' then
    perform public.rental_booking_notify(v_booking.customer_id, 'Rental completed',
      'Your rental of the ' || v_vehicle_model || ' is complete. Thanks for renting with PaMarket.',
      'rental_booking_completed', null, v_booking.id);
  end if;

  return v_booking;
end;
$$;

-- SECURITY DEFINER changes whose privileges the body runs with, not whether
-- a role may call it — EXECUTE must still be granted. Safe to grant broadly
-- to authenticated because the function performs its own actor/ownership
-- authorization internally (it is never given a free-form status by the
-- client; only the narrow wrappers below call it, each with a fixed
-- to_state and actor baked in).
revoke all on function public.rental_booking_transition(uuid, text, text, text) from public, anon;
grant execute on function public.rental_booking_transition(uuid, text, text, text) to authenticated;

-- Thin, narrowly-scoped wrappers — each callable only by the right actor
-- and only for the transitions that make sense for it, rather than handing
-- the client a free-form "set any status" RPC.
create or replace function public.accept_rental_booking(p_booking_id uuid)
returns public.rental_bookings language sql security invoker as $$
  select public.rental_booking_transition(p_booking_id, 'confirmed', 'provider', null);
$$;

create or replace function public.decline_rental_booking(p_booking_id uuid, p_reason text default null)
returns public.rental_bookings language sql security invoker as $$
  select public.rental_booking_transition(p_booking_id, 'declined', 'provider', p_reason);
$$;

-- security definer (unlike the other wrappers) because it must look up
-- whether the caller is the customer or the provider before it knows which
-- actor to pass through — a security invoker read here would be blocked by
-- RLS for anyone who is not already a party to the booking, which would
-- surface a misleading "not found" instead of "not authorized" for e.g. a
-- different company's owner. rental_booking_transition() still performs
-- the real, authoritative authorization check.
create or replace function public.cancel_rental_booking(p_booking_id uuid, p_reason text default null)
returns public.rental_bookings language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_is_customer boolean;
begin
  if v_uid is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;
  select (customer_id = v_uid) into v_is_customer from public.rental_bookings where id = p_booking_id;
  if v_is_customer is null then
    raise exception 'Booking not found.' using errcode = '23503';
  end if;
  return public.rental_booking_transition(p_booking_id, 'cancelled', case when v_is_customer then 'customer' else 'provider' end, p_reason);
end;
$$;

create or replace function public.mark_rental_picked_up(p_booking_id uuid)
returns public.rental_bookings language sql security invoker as $$
  select public.rental_booking_transition(p_booking_id, 'picked_up', 'provider', null);
$$;

create or replace function public.mark_rental_returned(p_booking_id uuid)
returns public.rental_bookings language sql security invoker as $$
  select public.rental_booking_transition(p_booking_id, 'returned', 'provider', null);
$$;

create or replace function public.complete_rental_booking(p_booking_id uuid)
returns public.rental_bookings language sql security invoker as $$
  select public.rental_booking_transition(p_booking_id, 'completed', 'provider', null);
$$;

grant execute on function public.accept_rental_booking(uuid) to authenticated;
grant execute on function public.decline_rental_booking(uuid, text) to authenticated;
grant execute on function public.cancel_rental_booking(uuid, text) to authenticated;
grant execute on function public.mark_rental_picked_up(uuid) to authenticated;
grant execute on function public.mark_rental_returned(uuid) to authenticated;
grant execute on function public.complete_rental_booking(uuid) to authenticated;

-- 'active' is a system transition (picked_up -> active once the pickup
-- date has actually arrived) rather than a manual provider action — the
-- provider already pressed "picked up"; a cron/edge function later moving
-- confirmed-but-future pickups into 'active' on their pickup day is a
-- reasonable Phase 2 addition, deliberately not built here since nothing
-- in this phase depends on distinguishing picked_up from active yet.

-- ── 8. Integrate bookings into the shared internal busy-check helper ───
-- rental_vehicle_range_is_busy() (Phase 0) is the single function both the
-- legacy lead-based booking_request guard trigger (rental_leads_guard_
-- booking_dates, still live from Phase 0 — the chat/lead "Request to Book"
-- path some older clients may still call) and request_rental_booking()
-- above call to ask "is this vehicle busy on these dates". Phase 0 only
-- knew about provider-blocked availability rows; overriding it here to
-- also count confirmed/picked_up/active bookings means both callers pick
-- this up automatically, with no change needed to the Phase 0 trigger
-- itself and no second, divergent copy of this logic.
create or replace function public.rental_vehicle_range_is_busy(
  p_listing_id uuid,
  p_start date,
  p_end   date
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.rental_vehicle_availability a
    where a.listing_id = p_listing_id
      and a.starts_on <= p_end
      and a.ends_on   >= p_start
  ) or exists (
    select 1 from public.rental_bookings b
    where b.listing_id = p_listing_id
      and b.status in ('confirmed', 'picked_up', 'active')
      and b.pickup_date <= p_end
      and b.return_date >= p_start
  );
$$;

revoke all on function public.rental_vehicle_range_is_busy(uuid, date, date) from public, anon, authenticated;

-- ── 9. Integrate bookings into the Phase 0 public availability RPC ─────
-- Same signature and contract as Phase 0's version: still exposes only
-- starts_on/ends_on, still respects the visibility check. The only change
-- is unioning confirmed/picked_up/active bookings' date ranges into the
-- blocks before merging, so this becomes the single source of truth for
-- "is this vehicle free on this date" everywhere.
create or replace function public.rental_vehicle_busy_ranges(
  p_listing_id uuid,
  p_from date default null,
  p_to   date default null
)
returns table (starts_on date, ends_on date)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_from date := coalesce(p_from, public.rental_today());
  v_to   date;
  v_visible boolean;
begin
  if p_listing_id is null then
    return;
  end if;

  v_from := greatest(v_from, public.rental_today());
  v_to   := least(coalesce(p_to, v_from + 365), v_from + 730);
  if v_to < v_from then
    return;
  end if;

  select (
           (l.status = 'active' and l.admin_status = 'approved' and l.deleted_at is null)
           or public.owns_rental_company(l.company_id)
           or public.is_admin()
         )
    into v_visible
  from public.rental_vehicle_listings l
  where l.id = p_listing_id;

  if not coalesce(v_visible, false) then
    return;
  end if;

  return query
    with blocks as (
      select a.starts_on as s, a.ends_on as e
      from public.rental_vehicle_availability a
      where a.listing_id = p_listing_id
        and a.ends_on   >= v_from
        and a.starts_on <= v_to
      union all
      select b.pickup_date as s, b.return_date as e
      from public.rental_bookings b
      where b.listing_id = p_listing_id
        and b.status in ('confirmed', 'picked_up', 'active')
        and b.return_date >= v_from
        and b.pickup_date <= v_to
    ),
    ordered as (
      select s, e,
             max(e) over (order by s, e rows between unbounded preceding and 1 preceding) as prev_end
      from blocks
    ),
    grouped as (
      select s, e,
             sum(case when prev_end is null or s > prev_end + 1 then 1 else 0 end)
               over (order by s, e) as grp
      from ordered
    )
    select greatest(min(s), v_from), least(max(e), v_to)
    from grouped
    group by grp
    order by 1;
end;
$$;

revoke all on function public.rental_vehicle_busy_ranges(uuid, date, date) from public;
grant execute on function public.rental_vehicle_busy_ranges(uuid, date, date) to anon, authenticated;

-- ── 10. Customer "My Rentals" list RPC ──────────────────────────────────
-- A thin, safe read: the RLS select policy already scopes rows to the
-- caller, but the customer view also wants the vehicle/provider display
-- fields in one round trip.
create or replace function public.list_my_rental_bookings(p_status text default null)
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
  order by b.created_at desc;
$$;

revoke all on function public.list_my_rental_bookings(text) from public, anon;
grant execute on function public.list_my_rental_bookings(text) to authenticated;

-- ── 11. Provider bookings inbox RPC ─────────────────────────────────────
create or replace function public.list_company_rental_bookings(p_company_id uuid, p_status text default null)
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
    order by b.created_at desc;
end;
$$;

revoke all on function public.list_company_rental_bookings(uuid, text) from public, anon;
grant execute on function public.list_company_rental_bookings(uuid, text) to authenticated;

notify pgrst, 'reload schema';

-- ── VERIFY (read-only; run after applying) ──────────────────────────────
-- select conrelid::regclass, conname from pg_constraint where conname = 'rb_no_double_booking';
-- select * from rental_vehicle_busy_ranges('<a real approved listing id>');
-- select has_table_privilege('authenticated', 'public.rental_bookings', 'INSERT'); -- expect false
-- ============================================================
