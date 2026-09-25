-- ============================================================
-- Rental Phase 0: private vehicle identifiers + real customer availability
--
-- 1. PRIVATE VEHICLE DATA
--    rental_vehicle_specs.vin / engine_number and
--    rental_vehicle_listings.registration were readable by anon and every
--    authenticated user for any approved listing: specs_select allows the
--    row, and RLS cannot hide columns. Supabase grants table-level SELECT
--    to anon/authenticated by default, and a column-level REVOKE has no
--    effect while a table-level grant exists — so the table-level SELECT
--    is revoked and SELECT is re-granted on every other column. The column
--    list is read from the live catalog, so columns added outside the repo
--    migrations keep working. INSERT/UPDATE/DELETE grants are unchanged:
--    owners can still write these fields; only reading them is restricted.
--    Owners/admins read them through rental_vehicle_private_details().
--
--    Client impact (shipped alongside): any select=* / RETURNING * on these
--    two tables now fails with "permission denied", so every client read
--    uses an explicit column list. Checked: apps/mobile, www/js (legacy
--    app), js/, admin/src, tools/prerender.js.
--    Any column added to these tables in future must be granted explicitly:
--      grant select (new_col) on public.<table> to anon, authenticated;
--
-- 2. CUSTOMER AVAILABILITY
--    rental_vehicle_availability is owner-only (avail_select), so customer
--    screens that read it directly got [] and treated every day as free.
--    The table stays private (its note/reason can name customers).
--    rental_vehicle_busy_ranges() returns only merged date ranges.
--
-- 3. SERVER ENFORCEMENT
--    A booking_request lead can no longer be written for dates that overlap
--    a busy range, are in the past, or are shorter than the vehicle's
--    minimum rental. Enforced by trigger so it covers rental_capture_lead()
--    and any direct insert allowed by the leads RLS policy.
--
-- Additive and idempotent. Safe to re-run.
-- ============================================================

-- ── 1. Column privileges ────────────────────────────────────────────────
do $$
declare
  v_spec record;
  v_role text;
  v_cols text;
begin
  for v_spec in
    select * from (values
      ('rental_vehicle_listings', array['registration']),
      ('rental_vehicle_specs',    array['vin', 'engine_number'])
    ) as t(tbl, private_cols)
  loop
    select string_agg(quote_ident(a.attname), ', ' order by a.attnum)
      into v_cols
    from pg_attribute a
    where a.attrelid = ('public.' || v_spec.tbl)::regclass
      and a.attnum > 0
      and not a.attisdropped
      and a.attname <> all (v_spec.private_cols);

    foreach v_role in array array['anon', 'authenticated'] loop
      -- Only touch roles that could read the table before, so this never
      -- widens access for a role that had none.
      if has_any_column_privilege(v_role, ('public.' || v_spec.tbl)::regclass, 'SELECT') then
        execute format('revoke select on public.%I from %I', v_spec.tbl, v_role);
        execute format('grant select (%s) on public.%I to %I', v_cols, v_spec.tbl, v_role);
      end if;
      -- Drop any lingering column-level grant on the private columns.
      execute format(
        'revoke select (%s) on public.%I from %I',
        (select string_agg(quote_ident(c), ', ') from unnest(v_spec.private_cols) c),
        v_spec.tbl, v_role
      );
    end loop;
  end loop;
end $$;

-- Owner/admin access to the private identifiers.
create or replace function public.rental_vehicle_private_details(p_listing_id uuid)
returns table (listing_id uuid, registration text, vin text, engine_number text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_company_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  select l.company_id into v_company_id
  from public.rental_vehicle_listings l
  where l.id = p_listing_id;

  if v_company_id is null
     or not (public.owns_rental_company(v_company_id) or public.is_admin()) then
    raise exception 'Not authorized to view this vehicle''s private details.' using errcode = '42501';
  end if;

  return query
    select l.id, l.registration, s.vin, s.engine_number
    from public.rental_vehicle_listings l
    left join public.rental_vehicle_specs s on s.listing_id = l.id
    where l.id = p_listing_id;
end;
$$;

revoke all on function public.rental_vehicle_private_details(uuid) from public, anon;
grant execute on function public.rental_vehicle_private_details(uuid) to authenticated;

-- ── 2. Public busy ranges ───────────────────────────────────────────────
-- Zimbabwe has no DST; the business day is Africa/Harare (UTC+2).
create or replace function public.rental_today()
returns date
language sql
stable
set search_path = public
as $$
  select (now() at time zone 'Africa/Harare')::date;
$$;

grant execute on function public.rental_today() to anon, authenticated;

-- Returns merged, window-clipped [starts_on, ends_on] ranges (inclusive)
-- during which the vehicle cannot be rented. Exposes nothing else: no
-- reason, note, customer, or how many separate blocks make up a range.
-- Only for vehicles the caller could already see (approved + active), or
-- the owner/admin. Phase 1 (bookings) will union held bookings in here so
-- every caller picks them up without client changes.
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

  -- Past dates are never bookable, so never reveal them; cap at 2 years.
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

-- Internal: true when any day in [p_start, p_end] is busy. Not exposed to
-- clients (they use busy ranges); used by the lead guard below.
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
  );
$$;

revoke all on function public.rental_vehicle_range_is_busy(uuid, date, date) from public, anon, authenticated;

-- ── 3. Booking-request guard ────────────────────────────────────────────
create or replace function public.rental_leads_guard_booking_dates()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_listing record;
  v_days int;
begin
  if new.lead_source is distinct from 'booking_request' then
    return new;
  end if;

  -- Status-only updates (owner marking contacted/converted/lost) must never
  -- be blocked by dates that became busy after the request was made.
  if tg_op = 'UPDATE'
     and new.lead_source is not distinct from old.lead_source
     and new.requested_start_date is not distinct from old.requested_start_date
     and new.requested_end_date   is not distinct from old.requested_end_date then
    return new;
  end if;

  if new.requested_start_date is null or new.requested_end_date is null then
    raise exception 'Choose both a pick-up and a return date.' using errcode = '22023';
  end if;
  if new.requested_end_date < new.requested_start_date then
    raise exception 'The return date must be on or after the pick-up date.' using errcode = '22023';
  end if;
  if new.requested_start_date < public.rental_today() then
    raise exception 'The pick-up date cannot be in the past.' using errcode = '22023';
  end if;
  if new.requested_end_date > public.rental_today() + 730 then
    raise exception 'Rental dates must be within the next two years.' using errcode = '22023';
  end if;

  select l.status, l.admin_status, l.deleted_at, l.min_rental_days
    into v_listing
  from public.rental_vehicle_listings l
  where l.id = new.listing_id;

  if not found
     or v_listing.status <> 'active'
     or v_listing.admin_status <> 'approved'
     or v_listing.deleted_at is not null then
    raise exception 'This vehicle is not accepting booking requests.' using errcode = '22023';
  end if;

  v_days := (new.requested_end_date - new.requested_start_date) + 1;
  if v_days < coalesce(v_listing.min_rental_days, 1) then
    raise exception 'This vehicle has a minimum rental of % days.', v_listing.min_rental_days
      using errcode = '22023';
  end if;

  if public.rental_vehicle_range_is_busy(new.listing_id, new.requested_start_date, new.requested_end_date) then
    raise exception 'The vehicle is unavailable for some of the selected dates.'
      using errcode = '23P01',
            hint = 'Reload availability and choose dates outside the unavailable periods.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_rental_leads_guard_booking_dates on public.rental_vehicle_leads;
create trigger trg_rental_leads_guard_booking_dates
  before insert or update on public.rental_vehicle_leads
  for each row execute function public.rental_leads_guard_booking_dates();

notify pgrst, 'reload schema';

-- ── VERIFY (read-only; run after applying) ─────────────────────────────
-- Expect all false:
-- select has_column_privilege('anon',          'public.rental_vehicle_specs',    'vin',           'select') as anon_vin,
--        has_column_privilege('anon',          'public.rental_vehicle_specs',    'engine_number', 'select') as anon_engine,
--        has_column_privilege('anon',          'public.rental_vehicle_listings', 'registration',  'select') as anon_reg,
--        has_column_privilege('authenticated', 'public.rental_vehicle_specs',    'vin',           'select') as auth_vin,
--        has_column_privilege('authenticated', 'public.rental_vehicle_specs',    'engine_number', 'select') as auth_engine,
--        has_column_privilege('authenticated', 'public.rental_vehicle_listings', 'registration',  'select') as auth_reg;
-- Expect true (public columns still readable):
-- select has_column_privilege('anon', 'public.rental_vehicle_listings', 'daily_rate', 'select'),
--        has_column_privilege('anon', 'public.rental_vehicle_specs',    'seats',      'select');
-- Busy ranges for a real listing (as anon, e.g. via REST):
--   POST /rest/v1/rpc/rental_vehicle_busy_ranges {"p_listing_id":"<uuid>"}
-- ============================================================
