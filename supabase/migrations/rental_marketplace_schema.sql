-- ═══════════════════════════════════════════════════════════════════
-- PAMARKET — VEHICLE RENTAL MARKETPLACE MODULE
-- Phase 2: Database Architecture + Indexing Strategy
-- Migration: rental_marketplace_schema.sql
--
-- DESIGN PRINCIPLES:
--   • 3NF normalization — no repeating groups, no transitive deps
--   • Zero duplication of existing tables (profiles, businesses,
--     conversations, messages, listings, reviews, notifications)
--   • Soft deletes via deleted_at (NULL = live)
--   • Audit trail on every write via rental_audit_logs
--   • RLS on every table — anon, authenticated, business owner, admin
--   • All FK constraints with appropriate ON DELETE behaviour
--   • Composite + partial indexes for production query patterns
--
-- TABLE ORDER (respects FK dependencies):
--   1.  rental_categories
--   2.  rental_brands
--   3.  rental_locations
--   4.  rental_companies          → businesses
--   5.  rental_company_profiles   → rental_companies
--   6.  rental_vehicle_listings   → rental_companies, rental_categories,
--                                    rental_brands, rental_locations
--   7.  rental_vehicle_media      → rental_vehicle_listings
--   8.  rental_vehicle_specs      → rental_vehicle_listings
--   9.  rental_vehicle_features   → rental_vehicle_listings
--  10.  rental_vehicle_availability → rental_vehicle_listings
--  11.  rental_reviews            → rental_companies, profiles
--  12.  rental_favorites          → rental_vehicle_listings, profiles
--  13.  rental_reports            → rental_vehicle_listings, profiles
--  14.  rental_promotions         → rental_companies
--  15.  rental_featured_listings  → rental_vehicle_listings, rental_promotions
--  16.  rental_activity_logs      → rental_vehicle_listings
--  17.  rental_audit_logs         (append-only, admin-read)
-- ═══════════════════════════════════════════════════════════════════

-- ── Shared helper: reuse existing set_updated_at() ─────────────
-- Already defined in profiles.sql — not redefined here.

-- ── Admin helper (already defined in businesses.sql) ───────────
-- public.is_admin() already exists — not redefined.

-- ── Idempotency: drop all rental RLS policies before recreating ─
-- PostgreSQL has no "CREATE POLICY IF NOT EXISTS". Running this file
-- a second time would fail on duplicate policy names. Drop them all
-- first so the file is safe to re-run on an existing schema.
do $drop_rental_policies$ declare r record; begin
  for r in
    select policyname, tablename
    from pg_policies
    where schemaname = 'public'
      and tablename like 'rental_%'
  loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $drop_rental_policies$;


-- ═══════════════════════════════════════════════════════════════
-- TABLE 1 — rental_categories
-- Lookup table for vehicle types shown in filters / dropdowns.
-- Managed by admin; no user writes.
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.rental_categories (
  id          uuid    primary key default gen_random_uuid(),
  slug        text    not null unique,          -- 'suv', 'sedan', 'pickup', etc.
  label       text    not null,                 -- display label
  icon_svg    text,                             -- inline SVG string
  sort_order  smallint not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

create index if not exists rental_categories_active_sort_idx
  on public.rental_categories (is_active, sort_order);

-- Seed standard categories (idempotent via ON CONFLICT DO NOTHING)
insert into public.rental_categories (slug, label, sort_order) values
  ('suv',      'SUV / 4x4',        1),
  ('sedan',    'Sedan',            2),
  ('pickup',   'Pickup / Truck',   3),
  ('minibus',  'Minibus / Van',    4),
  ('luxury',   'Luxury',           5),
  ('bus',      'Bus / Coach',      6),
  ('motorbike','Motorbike',        7),
  ('other',    'Other',            99)
on conflict (slug) do nothing;

alter table public.rental_categories enable row level security;

-- Public read, admin write
create policy "rental_categories: public read"
  on public.rental_categories for select using (true);

create policy "rental_categories: admin write"
  on public.rental_categories for all
  using (public.is_admin()) with check (public.is_admin());


-- ═══════════════════════════════════════════════════════════════
-- TABLE 2 — rental_brands
-- Vehicle makes (Toyota, Honda, Mercedes, etc.)
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.rental_brands (
  id          uuid  primary key default gen_random_uuid(),
  slug        text  not null unique,
  label       text  not null,
  logo_url    text,
  is_active   boolean not null default true,
  sort_order  smallint not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists rental_brands_active_idx
  on public.rental_brands (is_active, sort_order);

insert into public.rental_brands (slug, label, sort_order) values
  ('toyota',       'Toyota',        1),
  ('honda',        'Honda',         2),
  ('nissan',       'Nissan',        3),
  ('mercedes',     'Mercedes-Benz', 4),
  ('bmw',          'BMW',           5),
  ('ford',         'Ford',          6),
  ('isuzu',        'Isuzu',         7),
  ('mitsubishi',   'Mitsubishi',    8),
  ('hyundai',      'Hyundai',       9),
  ('volkswagen',   'Volkswagen',    10),
  ('land-rover',   'Land Rover',    11),
  ('other',        'Other',         99)
on conflict (slug) do nothing;

alter table public.rental_brands enable row level security;

create policy "rental_brands: public read"
  on public.rental_brands for select using (true);

create policy "rental_brands: admin write"
  on public.rental_brands for all
  using (public.is_admin()) with check (public.is_admin());


-- ═══════════════════════════════════════════════════════════════
-- TABLE 3 — rental_locations
-- City-level service area registry with geographic metadata.
-- Normalised from listings to avoid city string drift.
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.rental_locations (
  id          uuid  primary key default gen_random_uuid(),
  city        text  not null unique,
  province    text  not null default 'Harare',
  country     text  not null default 'Zimbabwe',
  is_active   boolean not null default true,
  sort_order  smallint not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists rental_locations_city_idx
  on public.rental_locations (city) where is_active = true;

insert into public.rental_locations (city, province, sort_order) values
  ('Harare',        'Harare',         1),
  ('Bulawayo',      'Matabeleland',   2),
  ('Mutare',        'Manicaland',     3),
  ('Gweru',         'Midlands',       4),
  ('Masvingo',      'Masvingo',       5),
  ('Victoria Falls','Matabeleland',   6),
  ('Chinhoyi',      'Mashonaland West',7),
  ('Kwekwe',        'Midlands',       8)
on conflict (city) do nothing;

alter table public.rental_locations enable row level security;

create policy "rental_locations: public read"
  on public.rental_locations for select using (true);

create policy "rental_locations: admin write"
  on public.rental_locations for all
  using (public.is_admin()) with check (public.is_admin());


-- ═══════════════════════════════════════════════════════════════
-- TABLE 4 — rental_companies
-- One row per rental company.  Links to existing `businesses` table
-- so auth, staff, subscriptions, and verifications already work.
-- Adds rental-specific metadata without duplicating business core fields.
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.rental_companies (
  id                  uuid  primary key default gen_random_uuid(),
  business_id         uuid  not null unique
                        references public.businesses(id) on delete cascade,

  -- Rental-specific identity
  trading_name        text,                          -- public-facing name override
  year_established    smallint,

  -- Operational settings
  min_rental_days     smallint  not null default 1
                        check (min_rental_days >= 1),
  deposit_policy      text,                          -- free-text policy description
  driver_available    boolean not null default false,
  cross_border        boolean not null default false,
  insurance_included  boolean not null default false,

  -- Contact shortcuts (may differ from business.phone)
  rental_phone        text,
  rental_whatsapp     text,
  rental_email        text,

  -- Operating hours (stored as HH:MM strings for simplicity)
  opens_at            time,
  closes_at           time,
  days_open           text[] not null default '{"Mon","Tue","Wed","Thu","Fri","Sat"}',

  -- Admin lifecycle
  status              text not null default 'pending'
                        check (status in ('pending','active','suspended','rejected')),
  admin_note          text,
  approved_at         timestamptz,
  approved_by         uuid references public.profiles(id) on delete set null,

  -- Aggregated denormalised stats (updated by trigger / cron — avoids COUNT(*) on every read)
  fleet_count         integer not null default 0 check (fleet_count >= 0),
  avg_rating          numeric(3,2) check (avg_rating between 0 and 5),
  review_count        integer not null default 0 check (review_count >= 0),
  total_views         bigint  not null default 0,

  -- Soft delete
  deleted_at          timestamptz,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists rental_companies_business_idx
  on public.rental_companies (business_id);
create index if not exists rental_companies_status_idx
  on public.rental_companies (status) where deleted_at is null;
create index if not exists rental_companies_active_idx
  on public.rental_companies (id) where status = 'active' and deleted_at is null;

drop trigger if exists rental_companies_updated_at on public.rental_companies;
create trigger rental_companies_updated_at
  before update on public.rental_companies
  for each row execute function public.set_updated_at();

alter table public.rental_companies enable row level security;

-- Active companies publicly readable
create policy "rental_companies: public read"
  on public.rental_companies for select
  using (
    (status = 'active' and deleted_at is null)
    or exists (
      select 1 from public.businesses b
      where b.id = business_id and b.owner_user_id = auth.uid()
    )
  );

-- Business owner inserts their own company row
create policy "rental_companies: owner insert"
  on public.rental_companies for insert
  with check (
    exists (
      select 1 from public.businesses b
      where b.id = business_id and b.owner_user_id = auth.uid()
    )
  );

-- Owner updates their own row
create policy "rental_companies: owner update"
  on public.rental_companies for update
  using (
    exists (
      select 1 from public.businesses b
      where b.id = business_id and b.owner_user_id = auth.uid()
    )
  );

-- Admin full access
create policy "rental_companies: admin all"
  on public.rental_companies for all
  using (public.is_admin()) with check (public.is_admin());


-- ═══════════════════════════════════════════════════════════════
-- TABLE 5 — rental_company_profiles
-- Extended public-facing profile: bio, social links, service areas.
-- 1-to-1 with rental_companies.
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.rental_company_profiles (
  id                  uuid  primary key default gen_random_uuid(),
  company_id          uuid  not null unique
                        references public.rental_companies(id) on delete cascade,

  -- Extended bio / about
  about               text,
  tagline             text,

  -- Media
  cover_url           text,
  logo_url            text,

  -- Service area (city IDs from rental_locations)
  service_location_ids uuid[] not null default '{}',

  -- Social / web
  website_url         text,
  facebook_url        text,
  instagram_url       text,

  -- Amenities offered company-wide
  airport_transfer    boolean not null default false,
  long_term_rental    boolean not null default false,
  corporate_accounts  boolean not null default false,
  fleet_management    boolean not null default false,

  -- Verification documents (paths in Supabase Storage)
  business_reg_doc    text,
  owner_id_doc        text,
  tax_clearance_doc   text,
  fleet_insurance_doc text,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists rental_profiles_company_idx
  on public.rental_company_profiles (company_id);
-- GIN index for service area lookups
create index if not exists rental_profiles_locations_gin
  on public.rental_company_profiles using gin (service_location_ids);

drop trigger if exists rental_company_profiles_updated_at on public.rental_company_profiles;
create trigger rental_company_profiles_updated_at
  before update on public.rental_company_profiles
  for each row execute function public.set_updated_at();

alter table public.rental_company_profiles enable row level security;

create policy "rental_company_profiles: public read"
  on public.rental_company_profiles for select using (true);

create policy "rental_company_profiles: owner write"
  on public.rental_company_profiles for all
  using (
    exists (
      select 1 from public.rental_companies rc
      join public.businesses b on b.id = rc.business_id
      where rc.id = company_id and b.owner_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.rental_companies rc
      join public.businesses b on b.id = rc.business_id
      where rc.id = company_id and b.owner_user_id = auth.uid()
    )
  );

create policy "rental_company_profiles: admin all"
  on public.rental_company_profiles for all
  using (public.is_admin()) with check (public.is_admin());


-- ═══════════════════════════════════════════════════════════════
-- TABLE 6 — rental_vehicle_listings
-- Core listing record. Fully normalised — specs, features, and
-- media live in their own child tables.
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.rental_vehicle_listings (
  id              uuid  primary key default gen_random_uuid(),
  company_id      uuid  not null
                    references public.rental_companies(id) on delete cascade,
  category_id     uuid  not null
                    references public.rental_categories(id),
  brand_id        uuid  not null
                    references public.rental_brands(id),
  location_id     uuid  not null
                    references public.rental_locations(id),

  -- Identity
  model           text  not null,
  year            smallint not null check (year between 1990 and 2100),
  registration    text,                           -- plate (optional, shown to inquirers)
  colour          text,

  -- Pricing (all USD)
  daily_rate      numeric(10,2) not null check (daily_rate > 0),
  weekly_rate     numeric(10,2) check (weekly_rate > 0),
  monthly_rate    numeric(10,2) check (monthly_rate > 0),
  deposit         numeric(10,2) not null default 0 check (deposit >= 0),

  -- Rental terms
  min_rental_days smallint not null default 1 check (min_rental_days >= 1),
  driver_rate     numeric(10,2),                  -- NULL = no driver available
  cross_border    boolean not null default false,
  insurance_included boolean not null default false,
  fuel_policy     text not null default 'full-to-full'
                    check (fuel_policy in ('full-to-full','full-to-empty','pre-purchase')),

  -- Suburb / pickup point (suburb within the city)
  pickup_suburb   text,
  pickup_notes    text,

  -- Description
  description     text,

  -- Status lifecycle
  status          text not null default 'draft'
                    check (status in ('draft','active','paused','archived','removed')),
  admin_status    text not null default 'approved'
                    check (admin_status in ('approved','pending_review','rejected')),
  admin_note      text,

  -- Availability flag (denormalised for fast list-page queries)
  is_available    boolean not null default true,

  -- Performance counters (updated by trigger)
  view_count      bigint  not null default 0,
  inquiry_count   integer not null default 0,
  save_count      integer not null default 0,

  -- Soft delete
  deleted_at      timestamptz,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ── Primary query indexes ──────────────────────────────────────

-- List page: active listings by company
create index if not exists rvl_company_status_idx
  on public.rental_vehicle_listings (company_id, status)
  where deleted_at is null;

-- Browse filters: category + location + availability
create index if not exists rvl_browse_idx
  on public.rental_vehicle_listings (category_id, location_id, is_available, status)
  where status = 'active' and deleted_at is null;

-- Price range filter
create index if not exists rvl_price_idx
  on public.rental_vehicle_listings (daily_rate)
  where status = 'active' and deleted_at is null;

-- Brand filter
create index if not exists rvl_brand_idx
  on public.rental_vehicle_listings (brand_id, status)
  where deleted_at is null;

-- Admin moderation queue
create index if not exists rvl_admin_status_idx
  on public.rental_vehicle_listings (admin_status, created_at desc)
  where deleted_at is null;

-- Newest first (default sort)
create index if not exists rvl_created_desc_idx
  on public.rental_vehicle_listings (created_at desc)
  where status = 'active' and deleted_at is null;

-- Full-text search on model + description
create index if not exists rvl_fts_idx
  on public.rental_vehicle_listings
  using gin (to_tsvector('english', coalesce(model,'') || ' ' || coalesce(description,'')));

drop trigger if exists rental_vehicle_listings_updated_at on public.rental_vehicle_listings;
create trigger rental_vehicle_listings_updated_at
  before update on public.rental_vehicle_listings
  for each row execute function public.set_updated_at();

alter table public.rental_vehicle_listings enable row level security;

-- Anyone can read active, approved, non-deleted listings
create policy "rvl: public read active"
  on public.rental_vehicle_listings for select
  using (
    (status = 'active' and admin_status = 'approved' and deleted_at is null)
    or exists (
      select 1 from public.rental_companies rc
      join public.businesses b on b.id = rc.business_id
      where rc.id = company_id and b.owner_user_id = auth.uid()
    )
    or public.is_admin()
  );

-- Company owner inserts
create policy "rvl: owner insert"
  on public.rental_vehicle_listings for insert
  with check (
    exists (
      select 1 from public.rental_companies rc
      join public.businesses b on b.id = rc.business_id
      where rc.id = company_id and b.owner_user_id = auth.uid()
    )
  );

-- Company owner updates (cannot change admin_status)
create policy "rvl: owner update"
  on public.rental_vehicle_listings for update
  using (
    exists (
      select 1 from public.rental_companies rc
      join public.businesses b on b.id = rc.business_id
      where rc.id = company_id and b.owner_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.rental_companies rc
      join public.businesses b on b.id = rc.business_id
      where rc.id = company_id and b.owner_user_id = auth.uid()
    )
    and admin_status = (select admin_status from public.rental_vehicle_listings where id = rental_vehicle_listings.id)
  );

create policy "rvl: admin all"
  on public.rental_vehicle_listings for all
  using (public.is_admin()) with check (public.is_admin());


-- ═══════════════════════════════════════════════════════════════
-- TABLE 7 — rental_vehicle_media
-- Ordered media items (photos / video thumbnails) for a listing.
-- Normalised out of listings to allow reordering without full-row updates.
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.rental_vehicle_media (
  id              uuid    primary key default gen_random_uuid(),
  listing_id      uuid    not null
                    references public.rental_vehicle_listings(id) on delete cascade,
  url             text    not null,
  thumbnail_url   text,
  media_type      text    not null default 'photo'
                    check (media_type in ('photo','video_thumb')),
  sort_order      smallint not null default 0,
  is_cover        boolean not null default false,
  file_size_bytes integer,
  width_px        smallint,
  height_px       smallint,
  created_at      timestamptz not null default now()
);

create index if not exists rvm_listing_order_idx
  on public.rental_vehicle_media (listing_id, sort_order asc);

-- Only one cover per listing
create unique index if not exists rvm_cover_unique_idx
  on public.rental_vehicle_media (listing_id)
  where is_cover = true;

alter table public.rental_vehicle_media enable row level security;

create policy "rvm: public read"
  on public.rental_vehicle_media for select using (true);

create policy "rvm: owner write"
  on public.rental_vehicle_media for all
  using (
    exists (
      select 1 from public.rental_vehicle_listings l
      join public.rental_companies rc on rc.id = l.company_id
      join public.businesses b on b.id = rc.business_id
      where l.id = listing_id and b.owner_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.rental_vehicle_listings l
      join public.rental_companies rc on rc.id = l.company_id
      join public.businesses b on b.id = rc.business_id
      where l.id = listing_id and b.owner_user_id = auth.uid()
    )
  );

create policy "rvm: admin all"
  on public.rental_vehicle_media for all
  using (public.is_admin()) with check (public.is_admin());


-- ═══════════════════════════════════════════════════════════════
-- TABLE 8 — rental_vehicle_specs
-- Technical specifications. One row per listing (1-to-1).
-- Separate table keeps rental_vehicle_listings lean and allows
-- spec columns to evolve independently.
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.rental_vehicle_specs (
  id                uuid    primary key default gen_random_uuid(),
  listing_id        uuid    not null unique
                      references public.rental_vehicle_listings(id) on delete cascade,

  -- Mechanical
  engine_capacity   text,                         -- '2.8L', '1.5L'
  fuel_type         text    check (fuel_type in ('petrol','diesel','hybrid','electric','other')),
  transmission      text    check (transmission in ('automatic','manual')),
  drive_type        text    check (drive_type in ('4wd','awd','fwd','rwd')),
  mileage_km        integer check (mileage_km >= 0),
  seats             smallint check (seats between 1 and 60),
  doors             smallint check (doors between 2 and 6),
  cargo_capacity    text,                         -- '500L', '1 tonne'

  -- Identification
  vin               text,
  engine_number     text,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists rvs_listing_idx on public.rental_vehicle_specs (listing_id);

-- Indexed for transmission + fuel filter combos
create index if not exists rvs_transmission_fuel_idx
  on public.rental_vehicle_specs (transmission, fuel_type);

-- Drive type filter
create index if not exists rvs_drive_idx
  on public.rental_vehicle_specs (drive_type);

-- Seat count filter
create index if not exists rvs_seats_idx
  on public.rental_vehicle_specs (seats);

drop trigger if exists rental_vehicle_specs_updated_at on public.rental_vehicle_specs;
create trigger rental_vehicle_specs_updated_at
  before update on public.rental_vehicle_specs
  for each row execute function public.set_updated_at();

alter table public.rental_vehicle_specs enable row level security;

create policy "rvs: public read" on public.rental_vehicle_specs for select using (true);

create policy "rvs: owner write"
  on public.rental_vehicle_specs for all
  using (
    exists (
      select 1 from public.rental_vehicle_listings l
      join public.rental_companies rc on rc.id = l.company_id
      join public.businesses b on b.id = rc.business_id
      where l.id = listing_id and b.owner_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.rental_vehicle_listings l
      join public.rental_companies rc on rc.id = l.company_id
      join public.businesses b on b.id = rc.business_id
      where l.id = listing_id and b.owner_user_id = auth.uid()
    )
  );

create policy "rvs: admin all"
  on public.rental_vehicle_specs for all
  using (public.is_admin()) with check (public.is_admin());


-- ═══════════════════════════════════════════════════════════════
-- TABLE 9 — rental_vehicle_features
-- Many-to-one: each row is one feature tag on a listing.
-- e.g. 'Air Conditioning', 'GPS Navigation', 'Child Seat'
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.rental_vehicle_features (
  id          uuid  primary key default gen_random_uuid(),
  listing_id  uuid  not null
                references public.rental_vehicle_listings(id) on delete cascade,
  feature     text  not null,
  created_at  timestamptz not null default now(),

  -- Prevent duplicate features per listing
  unique (listing_id, feature)
);

create index if not exists rvf_listing_idx on public.rental_vehicle_features (listing_id);
-- GIN index for feature-based filter queries
create index if not exists rvf_feature_idx on public.rental_vehicle_features (feature);

alter table public.rental_vehicle_features enable row level security;

create policy "rvf: public read" on public.rental_vehicle_features for select using (true);

create policy "rvf: owner write"
  on public.rental_vehicle_features for all
  using (
    exists (
      select 1 from public.rental_vehicle_listings l
      join public.rental_companies rc on rc.id = l.company_id
      join public.businesses b on b.id = rc.business_id
      where l.id = listing_id and b.owner_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.rental_vehicle_listings l
      join public.rental_companies rc on rc.id = l.company_id
      join public.businesses b on b.id = rc.business_id
      where l.id = listing_id and b.owner_user_id = auth.uid()
    )
  );

create policy "rvf: admin all"
  on public.rental_vehicle_features for all
  using (public.is_admin()) with check (public.is_admin());


-- ═══════════════════════════════════════════════════════════════
-- TABLE 10 — rental_vehicle_availability
-- Blocked / rented date ranges for calendar UI.
-- No booking system — visual display only.
-- Overlapping ranges for the same listing are allowed
-- (multiple rentals tracked by company externally).
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.rental_vehicle_availability (
  id              uuid  primary key default gen_random_uuid(),
  listing_id      uuid  not null
                    references public.rental_vehicle_listings(id) on delete cascade,
  starts_on       date  not null,
  ends_on         date  not null,
  reason          text  check (reason in ('rented','blocked','maintenance','personal')),
  note            text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  check (ends_on >= starts_on)
);

create index if not exists rva_listing_dates_idx
  on public.rental_vehicle_availability (listing_id, starts_on, ends_on);

-- Range query: find blocked periods that overlap a given date window
create index if not exists rva_range_idx
  on public.rental_vehicle_availability (starts_on, ends_on);

drop trigger if exists rental_vehicle_availability_updated_at on public.rental_vehicle_availability;
create trigger rental_vehicle_availability_updated_at
  before update on public.rental_vehicle_availability
  for each row execute function public.set_updated_at();

alter table public.rental_vehicle_availability enable row level security;

-- Public can read availability (to see calendar)
create policy "rva: public read" on public.rental_vehicle_availability for select using (true);

create policy "rva: owner write"
  on public.rental_vehicle_availability for all
  using (
    exists (
      select 1 from public.rental_vehicle_listings l
      join public.rental_companies rc on rc.id = l.company_id
      join public.businesses b on b.id = rc.business_id
      where l.id = listing_id and b.owner_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.rental_vehicle_listings l
      join public.rental_companies rc on rc.id = l.company_id
      join public.businesses b on b.id = rc.business_id
      where l.id = listing_id and b.owner_user_id = auth.uid()
    )
  );

create policy "rva: admin all"
  on public.rental_vehicle_availability for all
  using (public.is_admin()) with check (public.is_admin());


-- ═══════════════════════════════════════════════════════════════
-- TABLE 11 — rental_reviews
-- Reviews of rental companies by authenticated customers.
-- Separate from public.reviews (which is per-seller, not per company).
-- One review per user per company; enforced by unique constraint.
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.rental_reviews (
  id              uuid    primary key default gen_random_uuid(),
  company_id      uuid    not null
                    references public.rental_companies(id) on delete cascade,
  reviewer_id     uuid    not null
                    references public.profiles(id) on delete cascade,
  reviewer_name   text    not null default '',
  rating          smallint not null check (rating between 1 and 5),
  title           text,
  body            text    not null default '',
  helpful_count   integer not null default 0,

  -- Admin moderation
  status          text    not null default 'published'
                    check (status in ('published','hidden','removed')),
  admin_note      text,

  -- Soft delete
  deleted_at      timestamptz,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  -- One review per user per company
  unique (company_id, reviewer_id)
);

-- Enforce: reviewer cannot be the company owner (subqueries are not
-- allowed in CHECK constraints, so this guard lives in a trigger).
create or replace function public.rental_reviews_no_self_review()
returns trigger language plpgsql as $$
begin
  if exists (
    select 1
    from public.rental_companies rc
    join public.businesses b on b.id = rc.business_id
    where rc.id = new.company_id
      and b.owner_user_id = new.reviewer_id
  ) then
    raise exception 'Company owners cannot review their own company.';
  end if;
  return new;
end;
$$;

drop trigger if exists rental_reviews_no_self_review on public.rental_reviews;
create trigger rental_reviews_no_self_review
  before insert on public.rental_reviews
  for each row execute function public.rental_reviews_no_self_review();

create index if not exists rr_company_rating_idx
  on public.rental_reviews (company_id, rating, created_at desc)
  where status = 'published' and deleted_at is null;

create index if not exists rr_reviewer_idx
  on public.rental_reviews (reviewer_id);

drop trigger if exists rental_reviews_updated_at on public.rental_reviews;
create trigger rental_reviews_updated_at
  before update on public.rental_reviews
  for each row execute function public.set_updated_at();

alter table public.rental_reviews enable row level security;

create policy "rental_reviews: public read"
  on public.rental_reviews for select
  using (status = 'published' and deleted_at is null);

create policy "rental_reviews: auth insert"
  on public.rental_reviews for insert to authenticated
  with check (auth.uid() = reviewer_id);

create policy "rental_reviews: own delete"
  on public.rental_reviews for delete
  using (auth.uid() = reviewer_id);

create policy "rental_reviews: admin all"
  on public.rental_reviews for all
  using (public.is_admin()) with check (public.is_admin());


-- ── Trigger: update rental_companies.avg_rating + review_count ─
create or replace function public.refresh_company_rating()
returns trigger language plpgsql security definer as $$
declare
  v_company_id uuid := coalesce(new.company_id, old.company_id);
begin
  update public.rental_companies set
    avg_rating   = (
      select round(avg(rating)::numeric, 2)
      from public.rental_reviews
      where company_id = v_company_id
        and status = 'published'
        and deleted_at is null
    ),
    review_count = (
      select count(*)
      from public.rental_reviews
      where company_id = v_company_id
        and status = 'published'
        and deleted_at is null
    )
  where id = v_company_id;
  return coalesce(new, old);
end;
$$;

drop trigger if exists rental_reviews_refresh_rating on public.rental_reviews;
create trigger rental_reviews_refresh_rating
  after insert or update or delete on public.rental_reviews
  for each row execute function public.refresh_company_rating();


-- ═══════════════════════════════════════════════════════════════
-- TABLE 12 — rental_favorites
-- User saves / wishlist for rental listings.
-- Separate from public.user_saves (which saves general listings).
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.rental_favorites (
  id          uuid  primary key default gen_random_uuid(),
  user_id     uuid  not null references public.profiles(id) on delete cascade,
  listing_id  uuid  not null
                references public.rental_vehicle_listings(id) on delete cascade,
  created_at  timestamptz not null default now(),

  unique (user_id, listing_id)
);

create index if not exists rfav_user_idx    on public.rental_favorites (user_id, created_at desc);
create index if not exists rfav_listing_idx on public.rental_favorites (listing_id);

alter table public.rental_favorites enable row level security;

create policy "rental_favorites: own read"
  on public.rental_favorites for select
  using (auth.uid() = user_id);

create policy "rental_favorites: own write"
  on public.rental_favorites for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── Trigger: update listing save_count ─────────────────────────
create or replace function public.refresh_listing_save_count()
returns trigger language plpgsql security definer as $$
declare v_listing_id uuid := coalesce(new.listing_id, old.listing_id);
begin
  update public.rental_vehicle_listings
  set save_count = (select count(*) from public.rental_favorites where listing_id = v_listing_id)
  where id = v_listing_id;
  return coalesce(new, old);
end;
$$;

drop trigger if exists rental_favorites_save_count on public.rental_favorites;
create trigger rental_favorites_save_count
  after insert or delete on public.rental_favorites
  for each row execute function public.refresh_listing_save_count();


-- ═══════════════════════════════════════════════════════════════
-- TABLE 13 — rental_reports
-- User-submitted reports on rental listings.
-- Separate from public.reports (general listings).
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.rental_reports (
  id              uuid  primary key default gen_random_uuid(),
  listing_id      uuid  not null
                    references public.rental_vehicle_listings(id) on delete cascade,
  reporter_id     uuid  not null
                    references public.profiles(id) on delete cascade,
  reason          text  not null
                    check (reason in (
                      'fraudulent','wrong_category','offensive',
                      'unavailable','duplicate','other'
                    )),
  detail          text,

  -- Admin resolution
  status          text  not null default 'open'
                    check (status in ('open','reviewing','resolved','dismissed')),
  resolved_by     uuid  references public.profiles(id) on delete set null,
  resolved_at     timestamptz,
  admin_note      text,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  -- One report per user per listing per reason
  unique (listing_id, reporter_id, reason)
);

create index if not exists rrep_listing_idx    on public.rental_reports (listing_id);
create index if not exists rrep_status_idx     on public.rental_reports (status, created_at desc);
create index if not exists rrep_reporter_idx   on public.rental_reports (reporter_id);

-- Partial index for admin open queue
create index if not exists rrep_open_queue_idx
  on public.rental_reports (created_at desc)
  where status = 'open';

drop trigger if exists rental_reports_updated_at on public.rental_reports;
create trigger rental_reports_updated_at
  before update on public.rental_reports
  for each row execute function public.set_updated_at();

alter table public.rental_reports enable row level security;

create policy "rental_reports: auth insert"
  on public.rental_reports for insert to authenticated
  with check (auth.uid() = reporter_id);

create policy "rental_reports: own read"
  on public.rental_reports for select
  using (auth.uid() = reporter_id or public.is_admin());

create policy "rental_reports: admin all"
  on public.rental_reports for all
  using (public.is_admin()) with check (public.is_admin());


-- ═══════════════════════════════════════════════════════════════
-- TABLE 14 — rental_promotions
-- Company-level promotional campaigns (discount banners, seasonal offers).
-- Not a payment system — purely informational banners on profiles/listings.
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.rental_promotions (
  id              uuid  primary key default gen_random_uuid(),
  company_id      uuid  not null
                    references public.rental_companies(id) on delete cascade,
  title           text  not null,
  description     text,
  promo_type      text  not null default 'banner'
                    check (promo_type in ('banner','discount','seasonal','announcement')),
  discount_pct    smallint check (discount_pct between 1 and 100),
  banner_url      text,

  -- Schedule
  starts_at       timestamptz not null default now(),
  ends_at         timestamptz,

  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  check (ends_at is null or ends_at > starts_at)
);

create index if not exists rprom_company_active_idx
  on public.rental_promotions (company_id, is_active, starts_at);

-- Live promotions filter
create index if not exists rprom_live_idx
  on public.rental_promotions (starts_at, ends_at)
  where is_active = true;

drop trigger if exists rental_promotions_updated_at on public.rental_promotions;
create trigger rental_promotions_updated_at
  before update on public.rental_promotions
  for each row execute function public.set_updated_at();

alter table public.rental_promotions enable row level security;

create policy "rental_promotions: public read"
  on public.rental_promotions for select
  using (is_active = true);

create policy "rental_promotions: owner write"
  on public.rental_promotions for all
  using (
    exists (
      select 1 from public.rental_companies rc
      join public.businesses b on b.id = rc.business_id
      where rc.id = company_id and b.owner_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.rental_companies rc
      join public.businesses b on b.id = rc.business_id
      where rc.id = company_id and b.owner_user_id = auth.uid()
    )
  );

create policy "rental_promotions: admin all"
  on public.rental_promotions for all
  using (public.is_admin()) with check (public.is_admin());


-- ═══════════════════════════════════════════════════════════════
-- TABLE 15 — rental_featured_listings
-- Tracks which listings are currently featured (boosted to top of search).
-- Admin-managed. One active featured slot per listing.
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.rental_featured_listings (
  id              uuid  primary key default gen_random_uuid(),
  listing_id      uuid  not null
                    references public.rental_vehicle_listings(id) on delete cascade,
  company_id      uuid  not null
                    references public.rental_companies(id) on delete cascade,
  promotion_id    uuid  references public.rental_promotions(id) on delete set null,

  -- Feature window
  starts_at       timestamptz not null default now(),
  ends_at         timestamptz not null,
  priority        smallint not null default 1 check (priority between 1 and 10),

  -- Who approved this feature slot
  approved_by     uuid references public.profiles(id) on delete set null,
  is_active       boolean not null default true,

  created_at      timestamptz not null default now(),

  check (ends_at > starts_at)
);

-- Live featured listings query
create index if not exists rfl_active_priority_idx
  on public.rental_featured_listings (priority desc, starts_at)
  where is_active = true;

create index if not exists rfl_listing_idx   on public.rental_featured_listings (listing_id);
create index if not exists rfl_company_idx   on public.rental_featured_listings (company_id);
create index if not exists rfl_ends_at_idx   on public.rental_featured_listings (ends_at);

alter table public.rental_featured_listings enable row level security;

create policy "rfl: public read"
  on public.rental_featured_listings for select
  using (is_active = true and ends_at > now());

create policy "rfl: owner read own"
  on public.rental_featured_listings for select
  using (
    exists (
      select 1 from public.rental_companies rc
      join public.businesses b on b.id = rc.business_id
      where rc.id = company_id and b.owner_user_id = auth.uid()
    )
  );

create policy "rfl: admin all"
  on public.rental_featured_listings for all
  using (public.is_admin()) with check (public.is_admin());


-- ═══════════════════════════════════════════════════════════════
-- TABLE 16 — rental_activity_logs
-- Per-listing interaction tracking: views, WhatsApp clicks, calls, chats.
-- Used for business analytics dashboard.
-- Append-only (no updates). Indexed by listing + event + date.
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.rental_activity_logs (
  id              uuid  primary key default gen_random_uuid(),
  listing_id      uuid  not null
                    references public.rental_vehicle_listings(id) on delete cascade,
  company_id      uuid  not null
                    references public.rental_companies(id) on delete cascade,
  user_id         uuid  references public.profiles(id) on delete set null, -- NULL = anon
  event_type      text  not null
                    check (event_type in ('view','whatsapp_click','call_click','chat_open','save','unsave')),
  session_id      text,           -- anonymous session fingerprint (no PII)
  user_agent_hint text,           -- 'mobile' | 'desktop' (no UA string stored)
  created_at      timestamptz not null default now()
);

-- Business analytics: events per listing per day
create index if not exists ral_listing_event_date_idx
  on public.rental_activity_logs (listing_id, event_type, created_at desc);

-- Company-level rollup
create index if not exists ral_company_date_idx
  on public.rental_activity_logs (company_id, created_at desc);

-- Date-range queries (admin analytics)
create index if not exists ral_created_idx
  on public.rental_activity_logs (created_at desc);

alter table public.rental_activity_logs enable row level security;

-- Anyone (incl. anon) can insert a view event
create policy "ral: anon insert"
  on public.rental_activity_logs for insert
  with check (true);

-- Business owner reads their own company's logs
create policy "ral: owner read"
  on public.rental_activity_logs for select
  using (
    exists (
      select 1 from public.rental_companies rc
      join public.businesses b on b.id = rc.business_id
      where rc.id = company_id and b.owner_user_id = auth.uid()
    )
  );

create policy "ral: admin all"
  on public.rental_activity_logs for all
  using (public.is_admin()) with check (public.is_admin());


-- ═══════════════════════════════════════════════════════════════
-- TABLE 17 — rental_audit_logs
-- Immutable audit trail of admin and system actions.
-- Append-only; no UPDATE or DELETE policies.
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.rental_audit_logs (
  id              uuid  primary key default gen_random_uuid(),
  actor_id        uuid  references public.profiles(id) on delete set null,
  actor_role      text  not null default 'system',
  action          text  not null,  -- e.g. 'company.approved', 'listing.removed'
  target_table    text  not null,  -- e.g. 'rental_companies'
  target_id       uuid,
  before_state    jsonb,           -- snapshot of row before change
  after_state     jsonb,           -- snapshot of row after change
  ip_hint         text,            -- hashed/truncated IP (no full IP stored)
  created_at      timestamptz not null default now()
);

-- No UPDATE or DELETE indexes needed — append-only
create index if not exists ralog_actor_idx  on public.rental_audit_logs (actor_id, created_at desc);
create index if not exists ralog_action_idx on public.rental_audit_logs (action, created_at desc);
create index if not exists ralog_target_idx on public.rental_audit_logs (target_table, target_id, created_at desc);
create index if not exists ralog_date_idx   on public.rental_audit_logs (created_at desc);

alter table public.rental_audit_logs enable row level security;

-- Insert allowed from service-role (system) and admin users
create policy "ralog: admin insert"
  on public.rental_audit_logs for insert
  with check (public.is_admin());

create policy "ralog: admin read"
  on public.rental_audit_logs for select
  using (public.is_admin());

-- No update or delete policies — audit logs are immutable


-- ═══════════════════════════════════════════════════════════════
-- HELPER: increment listing view_count
-- Called by the client after a listing detail page load.
-- Accepts an anonymous call; no RLS restriction on this RPC.
-- ═══════════════════════════════════════════════════════════════

create or replace function public.rental_increment_view(p_listing_id uuid)
returns void language plpgsql security definer as $$
begin
  update public.rental_vehicle_listings
  set view_count = view_count + 1
  where id = p_listing_id
    and status = 'active'
    and deleted_at is null;

  insert into public.rental_activity_logs (listing_id, company_id, event_type)
  select p_listing_id, company_id, 'view'
  from public.rental_vehicle_listings
  where id = p_listing_id;
end;
$$;


-- ═══════════════════════════════════════════════════════════════
-- HELPER: increment rental_companies.fleet_count
-- Called after listing insert/delete/archive.
-- ═══════════════════════════════════════════════════════════════

create or replace function public.refresh_company_fleet_count()
returns trigger language plpgsql security definer as $$
declare v_company_id uuid := coalesce(new.company_id, old.company_id);
begin
  update public.rental_companies
  set fleet_count = (
    select count(*) from public.rental_vehicle_listings
    where company_id = v_company_id
      and status in ('active','paused')
      and deleted_at is null
  )
  where id = v_company_id;
  return coalesce(new, old);
end;
$$;

drop trigger if exists rvl_refresh_fleet_count on public.rental_vehicle_listings;
create trigger rvl_refresh_fleet_count
  after insert or update of status, deleted_at or delete
  on public.rental_vehicle_listings
  for each row execute function public.refresh_company_fleet_count();


-- ═══════════════════════════════════════════════════════════════
-- HELPER: company_search RPC
-- Efficient search + filter for the Rentals browse page.
-- Returns listings with joined company name + cover, for the
-- listing card component, avoiding N+1 queries.
-- ═══════════════════════════════════════════════════════════════

create or replace function public.rental_search_listings(
  p_category_slug text    default null,
  p_city          text    default null,
  p_brand_slug    text    default null,
  p_price_min     numeric default null,
  p_price_max     numeric default null,
  p_transmission  text    default null,
  p_fuel_type     text    default null,
  p_drive_type    text    default null,
  p_available_only boolean default false,
  p_featured_first boolean default true,
  p_limit         integer default 20,
  p_offset        integer default 0
)
returns table (
  id              uuid,
  model           text,
  year            smallint,
  daily_rate      numeric,
  is_available    boolean,
  view_count      bigint,
  category_slug   text,
  brand_slug      text,
  city            text,
  company_name    text,
  cover_url       text,
  is_featured     boolean
)
language sql stable as $$
  select
    l.id,
    l.model,
    l.year,
    l.daily_rate,
    l.is_available,
    l.view_count,
    cat.slug       as category_slug,
    br.slug        as brand_slug,
    loc.city,
    b.name         as company_name,
    (select url from public.rental_vehicle_media m
     where m.listing_id = l.id and m.is_cover = true limit 1) as cover_url,
    exists (
      select 1 from public.rental_featured_listings f
      where f.listing_id = l.id and f.is_active = true and f.ends_at > now()
    ) as is_featured
  from public.rental_vehicle_listings l
  join public.rental_categories cat  on cat.id = l.category_id
  join public.rental_brands     br   on br.id  = l.brand_id
  join public.rental_locations  loc  on loc.id = l.location_id
  join public.rental_companies  rc   on rc.id  = l.company_id
  join public.businesses        b    on b.id   = rc.business_id
  where
    l.status       = 'active'
    and l.admin_status = 'approved'
    and l.deleted_at is null
    and (p_category_slug is null or cat.slug = p_category_slug)
    and (p_city         is null or loc.city  = p_city)
    and (p_brand_slug   is null or br.slug   = p_brand_slug)
    and (p_price_min    is null or l.daily_rate >= p_price_min)
    and (p_price_max    is null or l.daily_rate <= p_price_max)
    and (p_available_only = false or l.is_available = true)
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
    (p_featured_first and exists (
      select 1 from public.rental_featured_listings f
      where f.listing_id = l.id and f.is_active = true and f.ends_at > now()
    )) desc,
    l.created_at desc
  limit  p_limit
  offset p_offset;
$$;


-- ═══════════════════════════════════════════════════════════════
-- GRANT: service-role bypass for edge functions / cron jobs
-- (anon + authenticated grants are handled by RLS policies above)
-- ═══════════════════════════════════════════════════════════════

grant usage on schema public to anon, authenticated;

grant select on public.rental_categories         to anon, authenticated;
grant select on public.rental_brands             to anon, authenticated;
grant select on public.rental_locations          to anon, authenticated;
grant select on public.rental_vehicle_listings   to anon, authenticated;
grant select on public.rental_vehicle_media      to anon, authenticated;
grant select on public.rental_vehicle_specs      to anon, authenticated;
grant select on public.rental_vehicle_features   to anon, authenticated;
grant select on public.rental_vehicle_availability to anon, authenticated;
grant select on public.rental_reviews            to anon, authenticated;
grant select on public.rental_promotions         to anon, authenticated;
grant select on public.rental_featured_listings  to anon, authenticated;
grant select on public.rental_companies          to anon, authenticated;
grant select on public.rental_company_profiles   to anon, authenticated;

grant insert, select, update, delete
  on public.rental_favorites             to authenticated;
grant insert
  on public.rental_reports               to authenticated;
grant insert
  on public.rental_reviews               to authenticated;
grant insert
  on public.rental_activity_logs         to anon, authenticated;

grant execute on function public.rental_increment_view(uuid) to anon, authenticated;
grant execute on function public.rental_search_listings      to anon, authenticated;


-- ═══════════════════════════════════════════════════════════════
-- REALTIME: enable postgres_changes for tables the app subscribes to
-- Run these in Supabase Dashboard → Database → Replication,
-- or uncomment if using the CLI:
--
--   alter publication supabase_realtime add table public.rental_vehicle_listings;
--   alter publication supabase_realtime add table public.rental_vehicle_availability;
--   alter publication supabase_realtime add table public.rental_reviews;
--   alter publication supabase_realtime add table public.rental_featured_listings;
-- ═══════════════════════════════════════════════════════════════
