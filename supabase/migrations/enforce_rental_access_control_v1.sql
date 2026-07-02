-- ============================================================
-- enforce_rental_access_control_v1.sql
--
-- Enforces a 3-level access model across all rental tables:
--
--   Level 1: user owns a record in businesses
--   Level 2: that business has a rental_companies record
--   Level 3: rental_companies.status = 'active' for any write op
--
-- States:
--   pending  → owner can read dashboard; ALL writes blocked
--   active   → full read + write access
--   rejected → all access blocked (read-only via owner SELECT)
--
-- Safety: no rows are deleted. All constraints are additive.
-- Existing listings from non-active companies become read-only.
-- ============================================================

-- ── SECURITY DEFINER HELPERS ──────────────────────────────────────────────
-- These run as the function owner, bypassing RLS on businesses and
-- rental_companies so the policy subquery itself is never blocked.

-- True if auth.uid() owns this rental company (any status)
create or replace function public.owns_rental_company(p_company_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from rental_companies rc
    join businesses b on b.id = rc.business_id
    where rc.id = p_company_id
      and b.owner_user_id = auth.uid()
  );
$$;

-- True if auth.uid() owns this rental company AND it is active
create or replace function public.owns_active_rental_company(p_company_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from rental_companies rc
    join businesses b on b.id = rc.business_id
    where rc.id = p_company_id
      and b.owner_user_id = auth.uid()
      and rc.status = 'active'
  );
$$;

grant execute on function public.owns_rental_company(uuid)        to authenticated;
grant execute on function public.owns_active_rental_company(uuid) to authenticated;


-- ── RPC: get_user_rental_access ───────────────────────────────────────────
-- Single source of truth for access state. Frontend calls this on every
-- rental business page load. Returns a jsonb describing what the current
-- user is allowed to do.

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

  -- Not authenticated
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

  -- Level 1: business ownership
  select id into v_business_id
  from businesses
  where owner_user_id = v_user_id
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

  -- Level 2: rental company existence
  select id, status into v_company_id, v_status
  from rental_companies
  where business_id = v_business_id
  limit 1;

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

  -- Level 3: status gate
  -- pending  → dashboard visible, no write operations
  -- active   → full access
  -- rejected → no access (owner can still SELECT their own rows)
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


-- ── RLS: rental_vehicle_listings ─────────────────────────────────────────

alter table public.rental_vehicle_listings enable row level security;

drop policy if exists "listings_select_public"       on public.rental_vehicle_listings;
drop policy if exists "listings_select_owner"        on public.rental_vehicle_listings;
drop policy if exists "listings_select"              on public.rental_vehicle_listings;
drop policy if exists "listings_insert"              on public.rental_vehicle_listings;
drop policy if exists "listings_insert_active_owner" on public.rental_vehicle_listings;
drop policy if exists "listings_update"              on public.rental_vehicle_listings;
drop policy if exists "listings_update_active_owner" on public.rental_vehicle_listings;
drop policy if exists "listings_delete"              on public.rental_vehicle_listings;

-- SELECT: anonymous/authenticated can see approved+active listings;
--         owner can always see their own (any status)
create policy "listings_select"
  on public.rental_vehicle_listings
  for select
  using (
    (status = 'active' and admin_status = 'approved' and deleted_at is null)
    or owns_rental_company(company_id)
  );

-- INSERT: ONLY when company is active — pending companies are fully blocked
create policy "listings_insert"
  on public.rental_vehicle_listings
  for insert
  with check (
    owns_active_rental_company(company_id)
  );

-- UPDATE: ONLY when company is active
create policy "listings_update"
  on public.rental_vehicle_listings
  for update
  using  (owns_active_rental_company(company_id))
  with check (owns_active_rental_company(company_id));

-- No DELETE policy → hard deletes impossible via API (soft delete via UPDATE only)


-- ── RLS: rental_vehicle_specs ─────────────────────────────────────────────

alter table public.rental_vehicle_specs enable row level security;

drop policy if exists "specs_select" on public.rental_vehicle_specs;
drop policy if exists "specs_insert" on public.rental_vehicle_specs;
drop policy if exists "specs_update" on public.rental_vehicle_specs;

create policy "specs_select"
  on public.rental_vehicle_specs
  for select
  using (
    exists (
      select 1 from rental_vehicle_listings l
      where l.id = rental_vehicle_specs.listing_id
        and (
          (l.status = 'active' and l.admin_status = 'approved' and l.deleted_at is null)
          or owns_rental_company(l.company_id)
        )
    )
  );

create policy "specs_insert"
  on public.rental_vehicle_specs
  for insert
  with check (
    exists (
      select 1 from rental_vehicle_listings l
      where l.id = rental_vehicle_specs.listing_id
        and owns_active_rental_company(l.company_id)
    )
  );

create policy "specs_update"
  on public.rental_vehicle_specs
  for update
  using (
    exists (
      select 1 from rental_vehicle_listings l
      where l.id = rental_vehicle_specs.listing_id
        and owns_active_rental_company(l.company_id)
    )
  );


-- ── RLS: rental_vehicle_features ──────────────────────────────────────────

alter table public.rental_vehicle_features enable row level security;

drop policy if exists "features_select" on public.rental_vehicle_features;
drop policy if exists "features_insert" on public.rental_vehicle_features;
drop policy if exists "features_delete" on public.rental_vehicle_features;

create policy "features_select"
  on public.rental_vehicle_features
  for select
  using (
    exists (
      select 1 from rental_vehicle_listings l
      where l.id = rental_vehicle_features.listing_id
        and (
          (l.status = 'active' and l.admin_status = 'approved' and l.deleted_at is null)
          or owns_rental_company(l.company_id)
        )
    )
  );

create policy "features_insert"
  on public.rental_vehicle_features
  for insert
  with check (
    exists (
      select 1 from rental_vehicle_listings l
      where l.id = rental_vehicle_features.listing_id
        and owns_active_rental_company(l.company_id)
    )
  );

create policy "features_delete"
  on public.rental_vehicle_features
  for delete
  using (
    exists (
      select 1 from rental_vehicle_listings l
      where l.id = rental_vehicle_features.listing_id
        and owns_active_rental_company(l.company_id)
    )
  );


-- ── RLS: rental_vehicle_media ─────────────────────────────────────────────

alter table public.rental_vehicle_media enable row level security;

drop policy if exists "media_select" on public.rental_vehicle_media;
drop policy if exists "media_insert" on public.rental_vehicle_media;
drop policy if exists "media_update" on public.rental_vehicle_media;
drop policy if exists "media_delete" on public.rental_vehicle_media;

create policy "media_select"
  on public.rental_vehicle_media
  for select
  using (
    exists (
      select 1 from rental_vehicle_listings l
      where l.id = rental_vehicle_media.listing_id
        and (
          (l.status = 'active' and l.admin_status = 'approved' and l.deleted_at is null)
          or owns_rental_company(l.company_id)
        )
    )
  );

create policy "media_insert"
  on public.rental_vehicle_media
  for insert
  with check (
    exists (
      select 1 from rental_vehicle_listings l
      where l.id = rental_vehicle_media.listing_id
        and owns_active_rental_company(l.company_id)
    )
  );

create policy "media_update"
  on public.rental_vehicle_media
  for update
  using (
    exists (
      select 1 from rental_vehicle_listings l
      where l.id = rental_vehicle_media.listing_id
        and owns_active_rental_company(l.company_id)
    )
  );

create policy "media_delete"
  on public.rental_vehicle_media
  for delete
  using (
    exists (
      select 1 from rental_vehicle_listings l
      where l.id = rental_vehicle_media.listing_id
        and owns_active_rental_company(l.company_id)
    )
  );


-- ── RLS: rental_vehicle_availability ─────────────────────────────────────

alter table public.rental_vehicle_availability enable row level security;

drop policy if exists "avail_select" on public.rental_vehicle_availability;
drop policy if exists "avail_insert" on public.rental_vehicle_availability;
drop policy if exists "avail_delete" on public.rental_vehicle_availability;

-- Only the company owner can see/manage blocked dates
create policy "avail_select"
  on public.rental_vehicle_availability
  for select
  using (
    exists (
      select 1 from rental_vehicle_listings l
      where l.id = rental_vehicle_availability.listing_id
        and owns_rental_company(l.company_id)
    )
  );

create policy "avail_insert"
  on public.rental_vehicle_availability
  for insert
  with check (
    exists (
      select 1 from rental_vehicle_listings l
      where l.id = rental_vehicle_availability.listing_id
        and owns_active_rental_company(l.company_id)
    )
  );

create policy "avail_delete"
  on public.rental_vehicle_availability
  for delete
  using (
    exists (
      select 1 from rental_vehicle_listings l
      where l.id = rental_vehicle_availability.listing_id
        and owns_active_rental_company(l.company_id)
    )
  );


-- ── RLS: rental_vehicle_leads ─────────────────────────────────────────────

alter table public.rental_vehicle_leads enable row level security;

drop policy if exists "leads_select" on public.rental_vehicle_leads;
drop policy if exists "leads_insert" on public.rental_vehicle_leads;
drop policy if exists "leads_update" on public.rental_vehicle_leads;

-- Company owner sees their leads
create policy "leads_select"
  on public.rental_vehicle_leads
  for select
  using (owns_rental_company(company_id));

-- Any authenticated user can create a lead (customer taps call/whatsapp/chat)
create policy "leads_insert"
  on public.rental_vehicle_leads
  for insert
  with check (auth.uid() is not null);

-- Company owner marks leads as read
create policy "leads_update"
  on public.rental_vehicle_leads
  for update
  using (owns_rental_company(company_id));


-- ── RLS: rental_companies ─────────────────────────────────────────────────

alter table public.rental_companies enable row level security;

drop policy if exists "companies_select"  on public.rental_companies;
drop policy if exists "companies_insert"  on public.rental_companies;
drop policy if exists "companies_update"  on public.rental_companies;

-- Public can see active companies (needed for customer-facing company profiles)
-- Owner can always see their own record (to check pending/rejected status)
create policy "companies_select"
  on public.rental_companies
  for select
  using (
    status = 'active'
    or exists (
      select 1 from businesses b
      where b.id = rental_companies.business_id
        and b.owner_user_id = auth.uid()
    )
  );

-- INSERT: blocked for direct API access — must go through rental_setup_company RPC
-- No INSERT policy

-- UPDATE: admin only via service_role key in admin.html
-- No UPDATE policy for authenticated role


-- ── RLS: rental_company_profiles ──────────────────────────────────────────

alter table public.rental_company_profiles enable row level security;

drop policy if exists "co_profiles_select" on public.rental_company_profiles;
drop policy if exists "co_profiles_insert" on public.rental_company_profiles;
drop policy if exists "co_profiles_update" on public.rental_company_profiles;

-- Public can see profiles for active companies; owner always
create policy "co_profiles_select"
  on public.rental_company_profiles
  for select
  using (
    owns_rental_company(company_id)
    or exists (
      select 1 from rental_companies rc
      where rc.id = rental_company_profiles.company_id
        and rc.status = 'active'
    )
  );

-- Owner can update their profile ONLY when company is active
create policy "co_profiles_update"
  on public.rental_company_profiles
  for update
  using  (owns_active_rental_company(company_id))
  with check (owns_active_rental_company(company_id));

-- INSERT: only through rental_setup_company RPC (SECURITY DEFINER)
-- No INSERT policy for authenticated role


-- ── MIGRATION NOTES ───────────────────────────────────────────────────────
-- No data is modified or deleted.
-- Owners of pending/rejected companies retain SELECT on their own rows.
-- All their existing listings become read-only until company is activated.
-- Admin retains full access via service_role key (bypasses all RLS).
-- Run this file exactly once in Supabase SQL Editor.
-- ============================================================
