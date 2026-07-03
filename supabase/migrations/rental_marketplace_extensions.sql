-- ═══════════════════════════════════════════════════════════════════
-- PAMARKET — VEHICLE RENTAL MARKETPLACE
-- Phase 2 Extension: Production-Grade Architecture Layers
-- Migration: rental_marketplace_extensions.sql
--
-- RULE: Pure additive extension. Zero modifications to existing tables.
--
-- LAYERS ADDED:
--   E1.  rental_vehicle_leads           — intent tracking before messaging
--   E2.  rental_conversation_context    — conversation ↔ listing binding
--   E3.  rental_listing_search_index    — denormalised search projection
--   E4.  rental_vehicle_states          — availability state machine
--        rental_state_transitions       — allowed transition registry
--   E5.  rental_analytics_events        — structured analytics event store
--        rental_analytics_daily         — pre-aggregated daily rollups
-- ═══════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════
-- E1 — rental_vehicle_leads
-- Intent-capture layer: records user interest BEFORE a message
-- is sent. Decoupled from conversations so analytics can measure
-- intent → contact → (implied) conversion funnel independently.
--
-- One row per intent event. Multiple leads per user per listing
-- are allowed (a user can click WhatsApp, then later open chat).
-- Status column tracks funnel stage transitions.
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.rental_vehicle_leads (
  id              uuid    primary key default gen_random_uuid(),
  listing_id      uuid    not null
                    references public.rental_vehicle_listings(id) on delete cascade,
  company_id      uuid    not null
                    references public.rental_companies(id) on delete cascade,
  user_id         uuid    references public.profiles(id) on delete set null,

  -- How the user expressed intent
  lead_source     text    not null
                    check (lead_source in (
                      'chat','whatsapp_click','call_click',
                      'favorite','share','view_detail'
                    )),

  -- Funnel stage
  -- new       → lead captured, no follow-up yet
  -- contacted → company has responded (chat message sent)
  -- converted → user indicated they rented (self-reported or inferred)
  -- lost      → no activity for 30+ days (set by cron)
  status          text    not null default 'new'
                    check (status in ('new','contacted','converted','lost')),

  -- Traceability: which conversation this lead spawned (if any)
  conversation_id text    references public.conversations(id) on delete set null,

  -- Attribution metadata (no raw PII stored)
  session_id      text,
  device_hint     text    check (device_hint in ('mobile','desktop','unknown')),

  -- Soft stage timestamps for funnel time-to-contact analytics
  contacted_at    timestamptz,
  converted_at    timestamptz,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ── Indexes ────────────────────────────────────────────────────

-- Funnel query: all leads for a company, by status
create index if not exists rl_company_status_idx
  on public.rental_vehicle_leads (company_id, status, created_at desc);

-- Per-listing lead count and source breakdown (analytics)
create index if not exists rl_listing_source_idx
  on public.rental_vehicle_leads (listing_id, lead_source, created_at desc);

-- Per-user lead history (contact deduplication check)
create index if not exists rl_user_listing_idx
  on public.rental_vehicle_leads (user_id, listing_id)
  where user_id is not null;

-- Open leads queue for business portal
create index if not exists rl_new_leads_idx
  on public.rental_vehicle_leads (company_id, created_at desc)
  where status = 'new';

-- Conversion analytics: converted leads by date
create index if not exists rl_converted_idx
  on public.rental_vehicle_leads (company_id, converted_at desc)
  where status = 'converted';

drop trigger if exists rental_vehicle_leads_updated_at on public.rental_vehicle_leads;
create trigger rental_vehicle_leads_updated_at
  before update on public.rental_vehicle_leads
  for each row execute function public.set_updated_at();

-- ── Trigger: auto-update listing.inquiry_count on new chat/whatsapp/call leads
create or replace function public.rental_leads_inquiry_count()
returns trigger language plpgsql security definer as $$
begin
  if new.lead_source in ('chat','whatsapp_click','call_click') then
    update public.rental_vehicle_listings
    set inquiry_count = inquiry_count + 1
    where id = new.listing_id;
  end if;
  return new;
end;
$$;

drop trigger if exists rental_leads_increment_inquiry on public.rental_vehicle_leads;
create trigger rental_leads_increment_inquiry
  after insert on public.rental_vehicle_leads
  for each row execute function public.rental_leads_inquiry_count();

-- ── RLS ────────────────────────────────────────────────────────
alter table public.rental_vehicle_leads enable row level security;

-- Any authenticated user can create a lead for themselves
create policy "rl: auth insert"
  on public.rental_vehicle_leads for insert to authenticated
  with check (auth.uid() = user_id or user_id is null);

-- Business owner reads all leads for their company
create policy "rl: owner read"
  on public.rental_vehicle_leads for select
  using (
    exists (
      select 1 from public.rental_companies rc
      join public.businesses b on b.id = rc.business_id
      where rc.id = company_id and b.owner_user_id = auth.uid()
    )
  );

-- Business owner updates status (contacted, converted, lost)
create policy "rl: owner update"
  on public.rental_vehicle_leads for update
  using (
    exists (
      select 1 from public.rental_companies rc
      join public.businesses b on b.id = rc.business_id
      where rc.id = company_id and b.owner_user_id = auth.uid()
    )
  );

-- Users can read their own leads
create policy "rl: own read"
  on public.rental_vehicle_leads for select
  using (auth.uid() = user_id);

create policy "rl: admin all"
  on public.rental_vehicle_leads for all
  using (public.is_admin()) with check (public.is_admin());


-- ═══════════════════════════════════════════════════════════════
-- E2 — rental_conversation_context
-- Binding layer: attaches an existing conversation (from the
-- shared conversations table) to a specific rental listing.
-- Enforces one conversation per user per listing so the business
-- portal inbox never shows duplicate threads for the same enquiry.
-- Does NOT modify conversations or messages tables.
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.rental_conversation_context (
  -- conversations.id is text (not uuid) — matched exactly
  conversation_id text    not null
                    references public.conversations(id) on delete cascade,
  listing_id      uuid    not null
                    references public.rental_vehicle_listings(id) on delete cascade,
  company_id      uuid    not null
                    references public.rental_companies(id) on delete cascade,
  user_id         uuid    not null
                    references public.profiles(id) on delete cascade,

  -- Optional: which lead spawned this conversation
  lead_id         uuid    references public.rental_vehicle_leads(id) on delete set null,

  created_at      timestamptz not null default now(),

  -- One conversation per user per listing (prevents duplicate threads)
  primary key (conversation_id),
  unique (user_id, listing_id)
);

-- ── Indexes ────────────────────────────────────────────────────

-- Business portal: all conversations for a company
create index if not exists rcc_company_idx
  on public.rental_conversation_context (company_id, created_at desc);

-- Listing detail: check if current user already has a thread
create index if not exists rcc_user_listing_idx
  on public.rental_conversation_context (user_id, listing_id);

-- Lookup by conversation_id (reverse lookup for message routing)
create index if not exists rcc_conv_idx
  on public.rental_conversation_context (conversation_id);

-- ── RLS ────────────────────────────────────────────────────────
alter table public.rental_conversation_context enable row level security;

-- User sees their own conversation contexts
create policy "rcc: own read"
  on public.rental_conversation_context for select
  using (auth.uid() = user_id);

-- Business owner sees all contexts for their company
create policy "rcc: owner read"
  on public.rental_conversation_context for select
  using (
    exists (
      select 1 from public.rental_companies rc
      join public.businesses b on b.id = rc.business_id
      where rc.id = company_id and b.owner_user_id = auth.uid()
    )
  );

-- Authenticated users insert their own context rows
create policy "rcc: auth insert"
  on public.rental_conversation_context for insert to authenticated
  with check (auth.uid() = user_id);

create policy "rcc: admin all"
  on public.rental_conversation_context for all
  using (public.is_admin()) with check (public.is_admin());

-- ── Helper RPC: get_or_create_rental_conversation ──────────────
-- Called by the client when a user opens chat from a listing detail
-- page. Returns the conversation_id (existing or newly created)
-- and inserts the context binding atomically.
create or replace function public.get_or_create_rental_conversation(
  p_listing_id uuid,
  p_company_id uuid,
  p_user_id    uuid
)
returns text                            -- returns conversation_id
language plpgsql security definer as $$
declare
  v_conv_id      text;
  v_company_uid  uuid;
begin
  -- Resolve company owner's user_id (the other party in the conversation)
  select b.owner_user_id into v_company_uid
  from public.rental_companies rc
  join public.businesses b on b.id = rc.business_id
  where rc.id = p_company_id
  limit 1;

  if v_company_uid is null then
    raise exception 'Company not found or has no owner.';
  end if;

  if p_user_id = v_company_uid then
    raise exception 'Cannot open a conversation with your own company.';
  end if;

  -- Check for existing binding
  select conversation_id into v_conv_id
  from public.rental_conversation_context
  where user_id = p_user_id and listing_id = p_listing_id;

  if v_conv_id is not null then
    return v_conv_id;
  end if;

  -- Build a stable deterministic conversation_id matching the app's pattern
  v_conv_id := 'rental_' || least(p_user_id::text, v_company_uid::text)
               || '_' || greatest(p_user_id::text, v_company_uid::text)
               || '_' || p_listing_id::text;

  -- Upsert the conversation row (may already exist from a different listing)
  insert into public.conversations (id, members, listing_id)
  values (v_conv_id, array[p_user_id, v_company_uid], p_listing_id)
  on conflict (id) do nothing;

  -- Insert the context binding
  insert into public.rental_conversation_context
    (conversation_id, listing_id, company_id, user_id)
  values
    (v_conv_id, p_listing_id, p_company_id, p_user_id)
  on conflict (user_id, listing_id) do nothing;

  return v_conv_id;
end;
$$;

grant execute on function public.get_or_create_rental_conversation(uuid,uuid,uuid)
  to authenticated;


-- ═══════════════════════════════════════════════════════════════
-- E3 — rental_listing_search_index
-- Denormalised search projection table. Eliminates all multi-table
-- joins on the hot listing browse path. Updated automatically by
-- triggers on the five source tables that contribute columns.
--
-- This is NOT a materialized view (those can't be refreshed
-- incrementally per-row by triggers in PostgreSQL).
-- It is a regular table maintained to stay in sync.
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.rental_listing_search_index (
  -- PK mirrors the source listing
  listing_id          uuid    primary key
                        references public.rental_vehicle_listings(id) on delete cascade,

  -- Denormalised join fields (copied from child tables)
  brand_name          text    not null default '',
  brand_slug          text    not null default '',
  model               text    not null default '',
  year                smallint,
  category_label      text    not null default '',
  category_slug       text    not null default '',
  city                text    not null default '',
  province            text    not null default '',
  company_name        text    not null default '',
  company_id          uuid,

  -- Pricing
  daily_rate          numeric(10,2),
  weekly_rate         numeric(10,2),
  monthly_rate        numeric(10,2),

  -- Specs (denormalised from rental_vehicle_specs)
  transmission        text,
  fuel_type           text,
  drive_type          text,
  seats               smallint,

  -- State
  availability_status text    not null default 'available'
                        check (availability_status in
                          ('available','unavailable','maintenance','inactive')),
  listing_status      text    not null default 'active',
  is_available        boolean not null default true,

  -- Social proof
  avg_rating          numeric(3,2),
  review_count        integer not null default 0,
  view_count          bigint  not null default 0,
  save_count          integer not null default 0,

  -- Featured boost
  is_featured         boolean not null default false,
  featured_until      timestamptz,
  featured_priority   smallint,

  -- Media (cover photo URL cached here — avoids subquery per row)
  cover_url           text,

  -- Pre-built full-text search vector (updated by trigger)
  search_vector       tsvector,

  -- Timestamps
  listing_created_at  timestamptz,
  indexed_at          timestamptz not null default now()
);

-- ── Indexes on the search index (these are the query-time indexes) ─

-- Primary browse filter: category + city + available + status
create index if not exists rlsi_browse_idx
  on public.rental_listing_search_index
  (category_slug, city, is_available, listing_status);

-- Price range
create index if not exists rlsi_price_idx
  on public.rental_listing_search_index (daily_rate)
  where listing_status = 'active' and is_available = true;

-- Brand filter
create index if not exists rlsi_brand_idx
  on public.rental_listing_search_index (brand_slug, listing_status);

-- Transmission + fuel combo filter
create index if not exists rlsi_specs_idx
  on public.rental_listing_search_index (transmission, fuel_type, drive_type);

-- Featured-first sort
create index if not exists rlsi_featured_idx
  on public.rental_listing_search_index (is_featured desc, listing_created_at desc)
  where listing_status = 'active';

-- Rating sort (for "top rated" view)
create index if not exists rlsi_rating_idx
  on public.rental_listing_search_index (avg_rating desc nulls last)
  where listing_status = 'active';

-- Company filter (business portal overview)
create index if not exists rlsi_company_idx
  on public.rental_listing_search_index (company_id, listing_status);

-- Full-text search (GIN on pre-built tsvector — fastest possible FTS)
create index if not exists rlsi_fts_idx
  on public.rental_listing_search_index using gin (search_vector);

-- ── Trigger function: rebuild one row in the search index ──────
-- Called by all five source tables via their own triggers below.
create or replace function public.rental_rebuild_search_index_row(p_listing_id uuid)
returns void language plpgsql security definer as $$
declare
  r record;
begin
  select
    l.id,
    l.model,
    l.year,
    l.daily_rate,
    l.weekly_rate,
    l.monthly_rate,
    l.status          as listing_status,
    l.is_available,
    l.view_count,
    l.save_count,
    l.inquiry_count,
    l.created_at      as listing_created_at,
    l.company_id,
    br.label          as brand_name,
    br.slug           as brand_slug,
    cat.label         as category_label,
    cat.slug          as category_slug,
    loc.city,
    loc.province,
    b.name            as company_name,
    rc.avg_rating,
    rc.review_count,
    s.transmission,
    s.fuel_type,
    s.drive_type,
    s.seats,
    (select url from public.rental_vehicle_media m
     where m.listing_id = l.id and m.is_cover = true limit 1) as cover_url,
    (select f.ends_at from public.rental_featured_listings f
     where f.listing_id = l.id and f.is_active = true
       and f.ends_at > now() order by f.priority desc limit 1) as featured_until,
    (select f.priority from public.rental_featured_listings f
     where f.listing_id = l.id and f.is_active = true
       and f.ends_at > now() order by f.priority desc limit 1) as featured_priority
  into r
  from public.rental_vehicle_listings l
  join public.rental_categories  cat on cat.id = l.category_id
  join public.rental_brands      br  on br.id  = l.brand_id
  join public.rental_locations   loc on loc.id  = l.location_id
  join public.rental_companies   rc  on rc.id   = l.company_id
  join public.businesses         b   on b.id    = rc.business_id
  left join public.rental_vehicle_specs s on s.listing_id = l.id
  where l.id = p_listing_id;

  if not found then
    -- Listing deleted — remove from index
    delete from public.rental_listing_search_index where listing_id = p_listing_id;
    return;
  end if;

  insert into public.rental_listing_search_index (
    listing_id, brand_name, brand_slug, model, year,
    category_label, category_slug, city, province,
    company_name, company_id,
    daily_rate, weekly_rate, monthly_rate,
    transmission, fuel_type, drive_type, seats,
    listing_status, is_available,
    avg_rating, review_count, view_count, save_count,
    is_featured, featured_until, featured_priority,
    cover_url,
    listing_created_at, indexed_at,
    search_vector
  ) values (
    r.id, r.brand_name, r.brand_slug, r.model, r.year,
    r.category_label, r.category_slug, r.city, r.province,
    r.company_name, r.company_id,
    r.daily_rate, r.weekly_rate, r.monthly_rate,
    r.transmission, r.fuel_type, r.drive_type, r.seats,
    r.listing_status, r.is_available,
    r.avg_rating, r.review_count, r.view_count, r.save_count,
    (r.featured_until is not null and r.featured_until > now()),
    r.featured_until, r.featured_priority,
    r.cover_url,
    r.listing_created_at, now(),
    to_tsvector('english',
      coalesce(r.brand_name,'')  || ' ' ||
      coalesce(r.model,'')       || ' ' ||
      coalesce(r.category_label,'') || ' ' ||
      coalesce(r.city,'')        || ' ' ||
      coalesce(r.company_name,'')
    )
  )
  on conflict (listing_id) do update set
    brand_name          = excluded.brand_name,
    brand_slug          = excluded.brand_slug,
    model               = excluded.model,
    year                = excluded.year,
    category_label      = excluded.category_label,
    category_slug       = excluded.category_slug,
    city                = excluded.city,
    province            = excluded.province,
    company_name        = excluded.company_name,
    company_id          = excluded.company_id,
    daily_rate          = excluded.daily_rate,
    weekly_rate         = excluded.weekly_rate,
    monthly_rate        = excluded.monthly_rate,
    transmission        = excluded.transmission,
    fuel_type           = excluded.fuel_type,
    drive_type          = excluded.drive_type,
    seats               = excluded.seats,
    listing_status      = excluded.listing_status,
    is_available        = excluded.is_available,
    avg_rating          = excluded.avg_rating,
    review_count        = excluded.review_count,
    view_count          = excluded.view_count,
    save_count          = excluded.save_count,
    is_featured         = excluded.is_featured,
    featured_until      = excluded.featured_until,
    featured_priority   = excluded.featured_priority,
    cover_url           = excluded.cover_url,
    listing_created_at  = excluded.listing_created_at,
    indexed_at          = now(),
    search_vector       = excluded.search_vector;
end;
$$;

-- ── Per-table trigger functions that call the rebuilder ─────────

-- Source 1: rental_vehicle_listings
create or replace function public.rlsi_from_listing() returns trigger
language plpgsql as $$
begin
  perform public.rental_rebuild_search_index_row(
    coalesce(new.id, old.id)
  );
  return coalesce(new, old);
end;
$$;
drop trigger if exists rlsi_listing_sync on public.rental_vehicle_listings;
create trigger rlsi_listing_sync
  after insert or update or delete on public.rental_vehicle_listings
  for each row execute function public.rlsi_from_listing();

-- Source 2: rental_vehicle_specs
create or replace function public.rlsi_from_specs() returns trigger
language plpgsql as $$
begin
  perform public.rental_rebuild_search_index_row(
    coalesce(new.listing_id, old.listing_id)
  );
  return coalesce(new, old);
end;
$$;
drop trigger if exists rlsi_specs_sync on public.rental_vehicle_specs;
create trigger rlsi_specs_sync
  after insert or update or delete on public.rental_vehicle_specs
  for each row execute function public.rlsi_from_specs();

-- Source 3: rental_vehicle_media (cover changes)
create or replace function public.rlsi_from_media() returns trigger
language plpgsql as $$
begin
  if (coalesce(new.is_cover, false) or coalesce(old.is_cover, false)) then
    perform public.rental_rebuild_search_index_row(
      coalesce(new.listing_id, old.listing_id)
    );
  end if;
  return coalesce(new, old);
end;
$$;
drop trigger if exists rlsi_media_sync on public.rental_vehicle_media;
create trigger rlsi_media_sync
  after insert or update or delete on public.rental_vehicle_media
  for each row execute function public.rlsi_from_media();

-- Source 4: rental_featured_listings
create or replace function public.rlsi_from_featured() returns trigger
language plpgsql as $$
begin
  perform public.rental_rebuild_search_index_row(
    coalesce(new.listing_id, old.listing_id)
  );
  return coalesce(new, old);
end;
$$;
drop trigger if exists rlsi_featured_sync on public.rental_featured_listings;
create trigger rlsi_featured_sync
  after insert or update or delete on public.rental_featured_listings
  for each row execute function public.rlsi_from_featured();

-- Source 5: rental_companies (rating / name change propagation)
create or replace function public.rlsi_from_company() returns trigger
language plpgsql as $$
begin
  -- A company name or rating change must propagate to all its listings
  update public.rental_listing_search_index
  set
    company_name = (select name from public.businesses
                    where id = (select business_id from public.rental_companies
                                where id = new.id)),
    avg_rating   = new.avg_rating,
    review_count = new.review_count,
    indexed_at   = now()
  where company_id = new.id;
  return new;
end;
$$;
drop trigger if exists rlsi_company_sync on public.rental_companies;
create trigger rlsi_company_sync
  after update of avg_rating, review_count on public.rental_companies
  for each row execute function public.rlsi_from_company();

-- ── RLS ────────────────────────────────────────────────────────
alter table public.rental_listing_search_index enable row level security;

-- Public read (this is a query cache — same visibility rules as listings)
create policy "rlsi: public read"
  on public.rental_listing_search_index for select
  using (listing_status = 'active');

-- Only the system (service role) writes; triggers run as security definer
-- No user-facing insert/update/delete policies needed.
create policy "rlsi: admin read all"
  on public.rental_listing_search_index for select
  using (public.is_admin());

-- ── Grants ─────────────────────────────────────────────────────
grant select on public.rental_listing_search_index to anon, authenticated;
grant execute on function public.rental_rebuild_search_index_row(uuid) to authenticated;


-- ═══════════════════════════════════════════════════════════════
-- E4 — AVAILABILITY STATE MACHINE
-- Extends the existing rental_vehicle_availability date-range
-- system with an explicit state model per listing.
--
-- Two new tables:
--   rental_state_transitions  — registry of allowed moves
--   rental_vehicle_states     — current state per listing
--
-- A BEFORE trigger on rental_vehicle_states rejects any write
-- that would result in an invalid state transition.
-- ═══════════════════════════════════════════════════════════════

-- ── E4a — Allowed state transition registry ─────────────────────
-- Seeded once. The trigger reads this table to validate moves.
-- Changing which transitions are allowed only requires a DML change
-- here — no code change required.

create table if not exists public.rental_state_transitions (
  from_state  text not null,
  to_state    text not null,
  label       text,                     -- human-readable reason e.g. 'Vehicle rented out'
  primary key (from_state, to_state),
  check (from_state <> to_state),
  check (from_state in ('available','unavailable','maintenance','inactive')),
  check (to_state   in ('available','unavailable','maintenance','inactive'))
);

-- Seed allowed transitions
insert into public.rental_state_transitions (from_state, to_state, label) values
  -- Vehicle goes out for rental
  ('available',    'unavailable',  'Marked as rented / unavailable'),
  -- Rental period ends, back in fleet
  ('unavailable',  'available',    'Returned — available again'),
  -- Vehicle sent for maintenance
  ('available',    'maintenance',  'Sent to maintenance'),
  ('unavailable',  'maintenance',  'Sent to maintenance while rented'),
  -- Maintenance complete
  ('maintenance',  'available',    'Maintenance complete — back in fleet'),
  -- Owner deactivates listing
  ('available',    'inactive',     'Listing deactivated by owner'),
  ('unavailable',  'inactive',     'Listing deactivated while rented'),
  ('maintenance',  'inactive',     'Listing deactivated during maintenance'),
  -- Owner reactivates
  ('inactive',     'available',    'Listing reactivated by owner')
  -- NOTE: inactive → unavailable/maintenance intentionally OMITTED.
  -- An inactive listing must be made available first before other states.
on conflict do nothing;

alter table public.rental_state_transitions enable row level security;
create policy "rst: public read" on public.rental_state_transitions for select using (true);
create policy "rst: admin write" on public.rental_state_transitions for all
  using (public.is_admin()) with check (public.is_admin());

-- ── E4b — Current state per listing ────────────────────────────
create table if not exists public.rental_vehicle_states (
  listing_id      uuid    primary key
                    references public.rental_vehicle_listings(id) on delete cascade,

  current_state   text    not null default 'available'
                    check (current_state in
                      ('available','unavailable','maintenance','inactive')),

  -- Who triggered this state and why
  changed_by      uuid    references public.profiles(id) on delete set null,
  change_reason   text,

  -- Link to the availability range that caused this state (if any)
  availability_id uuid    references public.rental_vehicle_availability(id)
                            on delete set null,

  -- Scheduled auto-return: if set, a cron job will move back to 'available'
  -- at this timestamp (e.g. when a rental period ends)
  auto_return_at  timestamptz,

  previous_state  text,               -- recorded by trigger for audit
  state_entered_at timestamptz not null default now(),

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists rvst_state_idx
  on public.rental_vehicle_states (current_state);

-- Index for cron job: listings with a scheduled auto-return
create index if not exists rvst_auto_return_idx
  on public.rental_vehicle_states (auto_return_at)
  where auto_return_at is not null
    and current_state = 'unavailable';

-- ── Trigger: enforce valid transitions ─────────────────────────
create or replace function public.rental_state_machine_guard()
returns trigger language plpgsql as $$
begin
  -- On INSERT, any initial state is allowed (no previous state to validate)
  if TG_OP = 'INSERT' then
    new.previous_state    := null;
    new.state_entered_at  := now();
    return new;
  end if;

  -- On UPDATE, allow same-state writes (idempotent updates to other columns)
  if new.current_state = old.current_state then
    return new;
  end if;

  -- Validate transition exists in the registry
  if not exists (
    select 1 from public.rental_state_transitions
    where from_state = old.current_state
      and to_state   = new.current_state
  ) then
    raise exception
      'Invalid state transition: % → %. Check rental_state_transitions.',
      old.current_state, new.current_state;
  end if;

  -- Record previous state and timestamp of change
  new.previous_state   := old.current_state;
  new.state_entered_at := now();
  return new;
end;
$$;

drop trigger if exists rental_state_machine_guard on public.rental_vehicle_states;
create trigger rental_state_machine_guard
  before insert or update on public.rental_vehicle_states
  for each row execute function public.rental_state_machine_guard();

-- ── Trigger: mirror state back to listing search index ─────────
create or replace function public.rental_state_sync_to_index()
returns trigger language plpgsql security definer as $$
begin
  update public.rental_listing_search_index
  set
    availability_status = new.current_state,
    is_available        = (new.current_state = 'available'),
    indexed_at          = now()
  where listing_id = new.listing_id;
  return new;
end;
$$;

drop trigger if exists rental_state_sync_index on public.rental_vehicle_states;
create trigger rental_state_sync_index
  after insert or update of current_state on public.rental_vehicle_states
  for each row execute function public.rental_state_sync_to_index();

-- ── Trigger: auto-insert a state row when a listing is created ─
create or replace function public.rental_listing_init_state()
returns trigger language plpgsql security definer as $$
begin
  insert into public.rental_vehicle_states (listing_id, current_state)
  values (new.id, 'available')
  on conflict (listing_id) do nothing;
  return new;
end;
$$;

drop trigger if exists rental_listing_init_state on public.rental_vehicle_listings;
create trigger rental_listing_init_state
  after insert on public.rental_vehicle_listings
  for each row execute function public.rental_listing_init_state();

-- ── Concurrency guard: prevent overlapping blocked ranges ───────
-- Runs BEFORE INSERT on rental_vehicle_availability. Raises an
-- exception if another active range already covers any part of
-- the requested window for the same listing.
create or replace function public.rental_availability_no_overlap()
returns trigger language plpgsql as $$
begin
  if exists (
    select 1 from public.rental_vehicle_availability
    where listing_id  = new.listing_id
      and id         <> coalesce(new.id, gen_random_uuid())   -- exclude self on update
      and starts_on  <= new.ends_on
      and ends_on    >= new.starts_on
  ) then
    raise exception
      'Date range overlaps an existing blocked period for this vehicle (% to %).',
      new.starts_on, new.ends_on;
  end if;
  return new;
end;
$$;

drop trigger if exists rental_availability_no_overlap on public.rental_vehicle_availability;
create trigger rental_availability_no_overlap
  before insert on public.rental_vehicle_availability
  for each row execute function public.rental_availability_no_overlap();

-- ── RLS ────────────────────────────────────────────────────────
alter table public.rental_vehicle_states enable row level security;

create policy "rvst: public read"
  on public.rental_vehicle_states for select using (true);

create policy "rvst: owner write"
  on public.rental_vehicle_states for all
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

create policy "rvst: admin all"
  on public.rental_vehicle_states for all
  using (public.is_admin()) with check (public.is_admin());

-- ── Helper RPC: transition state ───────────────────────────────
create or replace function public.rental_set_listing_state(
  p_listing_id  uuid,
  p_new_state   text,
  p_reason      text    default null,
  p_auto_return timestamptz default null
)
returns void language plpgsql security definer as $$
begin
  insert into public.rental_vehicle_states
    (listing_id, current_state, changed_by, change_reason, auto_return_at)
  values
    (p_listing_id, p_new_state, auth.uid(), p_reason, p_auto_return)
  on conflict (listing_id) do update set
    current_state  = excluded.current_state,
    changed_by     = excluded.changed_by,
    change_reason  = excluded.change_reason,
    auto_return_at = excluded.auto_return_at,
    updated_at     = now();
end;
$$;

grant execute on function public.rental_set_listing_state(uuid,text,text,timestamptz)
  to authenticated;

grant select on public.rental_state_transitions to anon, authenticated;
grant select on public.rental_vehicle_states    to anon, authenticated;


-- ═══════════════════════════════════════════════════════════════
-- E5 — ANALYTICS SCHEMA STANDARDIZATION
-- Extends rental_activity_logs with:
--   E5a. rental_analytics_events  — structured event store with
--        validated schema per event type (enforced in trigger)
--   E5b. rental_analytics_daily   — pre-aggregated daily rollups
--        per listing and per company, ready for dashboard queries
-- ═══════════════════════════════════════════════════════════════

-- ── E5a — Structured analytics event store ─────────────────────
-- Each event type has a defined required-fields contract enforced
-- by a BEFORE INSERT trigger. The metadata jsonb column carries
-- event-specific optional payload.

create table if not exists public.rental_analytics_events (
  id              uuid      primary key default gen_random_uuid(),

  -- Required on every event
  event_type      text      not null
                    check (event_type in (
                      'view_listing',
                      'click_chat',
                      'click_whatsapp',
                      'click_call',
                      'favorite',
                      'unfavorite',
                      'share',
                      'report'
                    )),

  -- Context (listing_id required on all events)
  listing_id      uuid      not null
                    references public.rental_vehicle_listings(id) on delete cascade,
  company_id      uuid      not null
                    references public.rental_companies(id) on delete cascade,

  -- User (null = anonymous)
  user_id         uuid      references public.profiles(id) on delete set null,

  -- Session tracing (no raw PII — session_id is a client-generated nonce)
  session_id      text,
  device_hint     text      check (device_hint in ('mobile','desktop','unknown')),

  -- Structured event metadata per type:
  -- view_listing:     { "referrer": "search|featured|direct|share" }
  -- click_chat:       { "lead_id": "<uuid>" }
  -- click_whatsapp:   { "lead_id": "<uuid>" }
  -- click_call:       { "lead_id": "<uuid>" }
  -- favorite:         {}
  -- unfavorite:       {}
  -- share:            { "channel": "whatsapp|copy_link|other" }
  -- report:           { "reason": "<enum>", "report_id": "<uuid>" }
  metadata        jsonb     not null default '{}',

  -- Immutable timestamp — no updated_at on an event log
  created_at      timestamptz not null default now()
);

-- ── Indexes for event store ─────────────────────────────────────

-- Dashboard: events per listing per type per day
create index if not exists rae_listing_type_date_idx
  on public.rental_analytics_events (listing_id, event_type, created_at desc);

-- Dashboard: events per company per day (for business portal)
create index if not exists rae_company_date_idx
  on public.rental_analytics_events (company_id, created_at desc);

-- Admin platform analytics: all events by date
create index if not exists rae_date_idx
  on public.rental_analytics_events (created_at desc);

-- Session analysis
create index if not exists rae_session_idx
  on public.rental_analytics_events (session_id)
  where session_id is not null;

-- ── Trigger: enforce per-event schema contract ──────────────────
create or replace function public.rental_analytics_schema_guard()
returns trigger language plpgsql as $$
begin
  -- click_chat / click_whatsapp / click_call require a lead_id
  if new.event_type in ('click_chat','click_whatsapp','click_call') then
    if (new.metadata ->> 'lead_id') is null then
      raise exception
        'Event type % requires metadata.lead_id.', new.event_type;
    end if;
  end if;

  -- share requires a channel
  if new.event_type = 'share' then
    if (new.metadata ->> 'channel') is null then
      raise exception 'Event type share requires metadata.channel.';
    end if;
  end if;

  -- report requires reason + report_id
  if new.event_type = 'report' then
    if (new.metadata ->> 'reason') is null
    or (new.metadata ->> 'report_id') is null then
      raise exception
        'Event type report requires metadata.reason and metadata.report_id.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists rental_analytics_schema_guard on public.rental_analytics_events;
create trigger rental_analytics_schema_guard
  before insert on public.rental_analytics_events
  for each row execute function public.rental_analytics_schema_guard();

-- ── RLS ────────────────────────────────────────────────────────
alter table public.rental_analytics_events enable row level security;

-- Anyone (anon or auth) can insert — needed for view_listing from guest sessions
create policy "rae: anon insert"
  on public.rental_analytics_events for insert
  with check (true);

-- Business owner reads their own company events only
create policy "rae: owner read"
  on public.rental_analytics_events for select
  using (
    exists (
      select 1 from public.rental_companies rc
      join public.businesses b on b.id = rc.business_id
      where rc.id = company_id and b.owner_user_id = auth.uid()
    )
  );

create policy "rae: admin all"
  on public.rental_analytics_events for all
  using (public.is_admin()) with check (public.is_admin());

-- ── E5b — Pre-aggregated daily rollups ─────────────────────────
-- Populated by a scheduled job (pg_cron or Supabase Edge Function).
-- One row per (listing, company, date, event_type).
-- Eliminates COUNT(*) GROUP BY queries on the raw event table
-- for dashboard loads. The raw table remains the source of truth.

create table if not exists public.rental_analytics_daily (
  id              uuid      primary key default gen_random_uuid(),
  listing_id      uuid      not null
                    references public.rental_vehicle_listings(id) on delete cascade,
  company_id      uuid      not null
                    references public.rental_companies(id) on delete cascade,
  event_date      date      not null,
  event_type      text      not null,
  event_count     integer   not null default 0 check (event_count >= 0),
  unique_sessions integer   not null default 0,
  unique_users    integer   not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  unique (listing_id, event_date, event_type)
);

-- Dashboard query: listing performance over a date range
create index if not exists rad_listing_date_idx
  on public.rental_analytics_daily (listing_id, event_date desc, event_type);

-- Company-level rollup (sum across all listings)
create index if not exists rad_company_date_idx
  on public.rental_analytics_daily (company_id, event_date desc);

-- Date range scan for admin analytics
create index if not exists rad_date_type_idx
  on public.rental_analytics_daily (event_date desc, event_type);

drop trigger if exists rental_analytics_daily_updated_at on public.rental_analytics_daily;
create trigger rental_analytics_daily_updated_at
  before update on public.rental_analytics_daily
  for each row execute function public.set_updated_at();

-- ── Aggregation RPC: upsert today's rollup for a listing ───────
-- Called by the daily cron job. Safe to re-run for the same date.
create or replace function public.rental_aggregate_daily(
  p_date date default current_date
)
returns void language plpgsql security definer as $$
begin
  insert into public.rental_analytics_daily
    (listing_id, company_id, event_date, event_type,
     event_count, unique_sessions, unique_users)
  select
    listing_id,
    company_id,
    p_date                              as event_date,
    event_type,
    count(*)                            as event_count,
    count(distinct session_id)          as unique_sessions,
    count(distinct user_id)             as unique_users
  from public.rental_analytics_events
  where created_at >= p_date
    and created_at <  p_date + interval '1 day'
  group by listing_id, company_id, event_type
  on conflict (listing_id, event_date, event_type) do update set
    event_count     = excluded.event_count,
    unique_sessions = excluded.unique_sessions,
    unique_users    = excluded.unique_users,
    updated_at      = now();
end;
$$;

-- ── RLS ────────────────────────────────────────────────────────
alter table public.rental_analytics_daily enable row level security;

create policy "rad: owner read"
  on public.rental_analytics_daily for select
  using (
    exists (
      select 1 from public.rental_companies rc
      join public.businesses b on b.id = rc.business_id
      where rc.id = company_id and b.owner_user_id = auth.uid()
    )
  );

create policy "rad: admin all"
  on public.rental_analytics_daily for all
  using (public.is_admin()) with check (public.is_admin());

-- ── Grants ─────────────────────────────────────────────────────
grant insert on public.rental_analytics_events to anon, authenticated;
grant select on public.rental_analytics_daily  to authenticated;
grant execute on function public.rental_aggregate_daily(date) to authenticated;

-- Suggested cron schedule (requires pg_cron extension):
-- select cron.schedule(
--   'rental-daily-analytics',
--   '5 0 * * *',                          -- 00:05 UTC every day
--   $$ select public.rental_aggregate_daily(current_date - 1) $$
-- );


-- ═══════════════════════════════════════════════════════════════
-- INTEGRATION: Cross-table grants summary
-- ═══════════════════════════════════════════════════════════════

grant select on public.rental_vehicle_leads           to authenticated;
grant select on public.rental_conversation_context    to authenticated;
grant select on public.rental_vehicle_states          to anon, authenticated;
grant select on public.rental_state_transitions       to anon, authenticated;
grant select on public.rental_analytics_events        to authenticated;

-- ── Realtime subscriptions (enable in Supabase Dashboard):
-- alter publication supabase_realtime add table public.rental_vehicle_leads;
-- alter publication supabase_realtime add table public.rental_conversation_context;
-- alter publication supabase_realtime add table public.rental_vehicle_states;
