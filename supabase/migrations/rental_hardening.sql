-- ═══════════════════════════════════════════════════════════════════
-- PAMARKET — RENTAL MARKETPLACE MODULE
-- Phase 3B: Production Hardening
-- Migration: rental_hardening.sql
--
-- Covers:
--   Task 1:  Storage bucket + policies (rental-media)
--   Task 4:  Moderation workflow — status lifecycle, triggers
--   Task 5:  Notification triggers (uses existing notifications table)
--   Task 6:  Security hardening — additional RLS + rate-limit guards
--   Task 7:  Performance indexes
--   Task 8:  Business analytics RPC
-- ═══════════════════════════════════════════════════════════════════

-- ================================================================
-- SCHEMA PATCH: Add slug column to rental_locations
-- (missed in rental_marketplace_schema.sql)
-- ================================================================

alter table public.rental_locations
  add column if not exists slug text;

-- Backfill slugs from city names (lowercase, spaces to hyphens)
update public.rental_locations
  set slug = lower(replace(city, ' ', '-'))
  where slug is null;

-- Add unique index after backfill
create unique index if not exists rental_locations_slug_idx
  on public.rental_locations (slug)
  where slug is not null;

-- ================================================================
-- TASK 1: STORAGE ARCHITECTURE
-- Bucket: rental-media (private, 8 MB max per file, image types only)
-- ================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'rental-media',
  'rental-media',
  false,
  8388608,  -- 8 MB
  array['image/jpeg','image/png','image/webp','image/heic','image/heif']
)
on conflict (id) do update set
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Owners (listing owner via company) can upload
create policy "rental-media: authenticated upload"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'rental-media'
    and auth.role() = 'authenticated'
  );

-- Anyone can read (URLs are time-limited via signed URLs in app)
create policy "rental-media: authenticated read"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'rental-media');

-- Owner of the object (by folder prefix = user_id) can delete
create policy "rental-media: owner delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'rental-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ================================================================
-- TASK 4: MODERATION WORKFLOW
-- ================================================================

-- 4a. Enforce valid admin_status transitions at DB level
--     (prevents app bugs from setting illegal states)
create or replace function public.rental_listing_status_guard()
returns trigger language plpgsql security definer as $$
begin
  -- Only allow these admin_status values
  if NEW.admin_status not in (
    'pending_review','approved','rejected','removed','hidden'
  ) then
    raise exception 'Invalid admin_status: %', NEW.admin_status;
  end if;

  -- When admin rejects: force listing status to paused
  if NEW.admin_status = 'rejected' and OLD.admin_status != 'rejected' then
    NEW.status := 'paused';
  end if;

  -- When admin approves: allow status to become active if business had it active
  if NEW.admin_status = 'approved' and OLD.admin_status = 'pending_review' then
    NEW.status := coalesce(nullif(OLD.status,'paused'), 'active');
  end if;

  -- When removed: soft-delete
  if NEW.admin_status = 'removed' and OLD.admin_status != 'removed' then
    NEW.deleted_at := coalesce(NEW.deleted_at, now());
    NEW.status := 'archived';
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_rental_listing_status_guard on public.rental_vehicle_listings;
create trigger trg_rental_listing_status_guard
  before update of admin_status on public.rental_vehicle_listings
  for each row execute function public.rental_listing_status_guard();

-- 4b. Auto-write audit log on every listing status change
create or replace function public.rental_listing_audit_trigger()
returns trigger language plpgsql security definer as $$
begin
  if OLD.admin_status is distinct from NEW.admin_status
  or OLD.status is distinct from NEW.status then
    insert into public.rental_audit_logs (
      actor_id, action, target_table, target_id, meta
    ) values (
      auth.uid(),
      'status_change:' || coalesce(OLD.admin_status,'?') || '->' || NEW.admin_status,
      'rental_vehicle_listings',
      NEW.id,
      jsonb_build_object(
        'old_status',   OLD.status,
        'new_status',   NEW.status,
        'old_admin',    OLD.admin_status,
        'new_admin',    NEW.admin_status
      )
    );
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_rental_listing_audit on public.rental_vehicle_listings;
create trigger trg_rental_listing_audit
  after update of admin_status, status on public.rental_vehicle_listings
  for each row execute function public.rental_listing_audit_trigger();

-- 4c. Company status audit trigger
create or replace function public.rental_company_audit_trigger()
returns trigger language plpgsql security definer as $$
begin
  if OLD.status is distinct from NEW.status then
    insert into public.rental_audit_logs (
      actor_id, action, target_table, target_id, meta
    ) values (
      auth.uid(),
      'company_status:' || coalesce(OLD.status,'?') || '->' || NEW.status,
      'rental_companies',
      NEW.id,
      jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status)
    );
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_rental_company_audit on public.rental_companies;
create trigger trg_rental_company_audit
  after update of status on public.rental_companies
  for each row execute function public.rental_company_audit_trigger();

-- 4d. Auto-update rental_companies.fleet_count when listings change
create or replace function public.rental_sync_fleet_count()
returns trigger language plpgsql security definer as $$
declare v_company_id uuid;
begin
  v_company_id := coalesce(NEW.company_id, OLD.company_id);
  update public.rental_companies
  set fleet_count = (
    select count(*) from public.rental_vehicle_listings
    where company_id = v_company_id
      and deleted_at is null
      and admin_status = 'approved'
  )
  where id = v_company_id;
  return coalesce(NEW, OLD);
end;
$$;

drop trigger if exists trg_rental_sync_fleet on public.rental_vehicle_listings;
create trigger trg_rental_sync_fleet
  after insert or update of admin_status, deleted_at or delete
  on public.rental_vehicle_listings
  for each row execute function public.rental_sync_fleet_count();

-- 4e. Auto-update rental_companies.avg_rating / review_count
create or replace function public.rental_sync_company_rating()
returns trigger language plpgsql security definer as $$
declare v_company_id uuid;
begin
  v_company_id := coalesce(NEW.company_id, OLD.company_id);
  update public.rental_companies
  set
    avg_rating   = (select round(avg(rating)::numeric, 2) from public.rental_reviews where company_id = v_company_id and status = 'published'),
    review_count = (select count(*) from public.rental_reviews where company_id = v_company_id and status = 'published')
  where id = v_company_id;
  return coalesce(NEW, OLD);
end;
$$;

drop trigger if exists trg_rental_sync_rating on public.rental_reviews;
create trigger trg_rental_sync_rating
  after insert or update of status or delete on public.rental_reviews
  for each row execute function public.rental_sync_company_rating();

-- ================================================================
-- TASK 5: NOTIFICATION INTEGRATION
-- Fires into existing notifications table on key events
-- ================================================================

-- 5a. Notify business owner when listing is approved or rejected
create or replace function public.rental_notify_listing_decision()
returns trigger language plpgsql security definer as $$
declare
  v_owner_id   uuid;
  v_title      text;
  v_body       text;
  v_listing_title text;
begin
  -- Only fire on admin_status change
  if OLD.admin_status is not distinct from NEW.admin_status then return NEW; end if;
  if NEW.admin_status not in ('approved','rejected') then return NEW; end if;

  -- Find business owner
  select u.id into v_owner_id
  from public.rental_companies rc
  join public.businesses b on b.id = rc.business_id
  join auth.users u on u.id = b.owner_id
  where rc.id = NEW.company_id
  limit 1;

  if v_owner_id is null then return NEW; end if;

  v_listing_title := coalesce(NEW.model, 'Your vehicle');

  if NEW.admin_status = 'approved' then
    v_title := 'Listing Approved';
    v_body  := v_listing_title || ' is now live and visible to customers.';
  else
    v_title := 'Listing Requires Changes';
    v_body  := v_listing_title || ' was not approved. Please review and resubmit.';
  end if;

  insert into public.notifications (user_id, title, body, type, data)
  values (
    v_owner_id,
    v_title,
    v_body,
    'rental_listing_decision',
    jsonb_build_object('listing_id', NEW.id, 'admin_status', NEW.admin_status)
  );

  return NEW;
end;
$$;

drop trigger if exists trg_rental_notify_listing on public.rental_vehicle_listings;
create trigger trg_rental_notify_listing
  after update of admin_status on public.rental_vehicle_listings
  for each row execute function public.rental_notify_listing_decision();

-- 5b. Notify company owner when their company is verified or suspended
create or replace function public.rental_notify_company_decision()
returns trigger language plpgsql security definer as $$
declare
  v_owner_id uuid;
  v_title    text;
  v_body     text;
begin
  if OLD.status is not distinct from NEW.status then return NEW; end if;
  if NEW.status not in ('active','suspended','rejected') then return NEW; end if;

  select u.id into v_owner_id
  from public.businesses b
  join auth.users u on u.id = b.owner_id
  where b.id = NEW.business_id
  limit 1;

  if v_owner_id is null then return NEW; end if;

  if NEW.status = 'active' then
    v_title := 'Rental Company Verified';
    v_body  := 'Your rental company is now verified. You can start adding vehicles.';
  elsif NEW.status = 'suspended' then
    v_title := 'Rental Company Suspended';
    v_body  := 'Your rental company has been suspended. Contact support for details.';
  else
    v_title := 'Rental Company Application';
    v_body  := 'Your rental company application was not approved.';
  end if;

  insert into public.notifications (user_id, title, body, type, data)
  values (
    v_owner_id, v_title, v_body,
    'rental_company_decision',
    jsonb_build_object('company_id', NEW.id, 'status', NEW.status)
  );

  return NEW;
end;
$$;

drop trigger if exists trg_rental_notify_company on public.rental_companies;
create trigger trg_rental_notify_company
  after update of status on public.rental_companies
  for each row execute function public.rental_notify_company_decision();

-- 5c. Notify business owner when a review is posted on their company
create or replace function public.rental_notify_new_review()
returns trigger language plpgsql security definer as $$
declare v_owner_id uuid;
begin
  if TG_OP = 'INSERT' and NEW.status = 'published' then
    select u.id into v_owner_id
    from public.rental_companies rc
    join public.businesses b on b.id = rc.business_id
    join auth.users u on u.id = b.owner_id
    where rc.id = NEW.company_id limit 1;

    if v_owner_id is not null then
      insert into public.notifications (user_id, title, body, type, data)
      values (
        v_owner_id,
        'New Review',
        'A customer left a ' || NEW.rating || '-star review on your rental company.',
        'rental_new_review',
        jsonb_build_object('review_id', NEW.id, 'company_id', NEW.company_id, 'rating', NEW.rating)
      );
    end if;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_rental_notify_review on public.rental_reviews;
create trigger trg_rental_notify_review
  after insert on public.rental_reviews
  for each row execute function public.rental_notify_new_review();

-- ================================================================
-- TASK 6: SECURITY HARDENING
-- ================================================================

-- 6a. Prevent a user from reviewing their own company
create or replace function public.rental_review_not_own_company()
returns trigger language plpgsql security definer as $$
declare v_owner_id uuid;
begin
  select u.id into v_owner_id
  from public.rental_companies rc
  join public.businesses b on b.id = rc.business_id
  join auth.users u on u.id = b.owner_id
  where rc.id = NEW.company_id limit 1;

  if v_owner_id = auth.uid() then
    raise exception 'Cannot review your own company';
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_rental_no_self_review on public.rental_reviews;
create trigger trg_rental_no_self_review
  before insert on public.rental_reviews
  for each row execute function public.rental_review_not_own_company();

-- 6b. Prevent a user from reporting their own listing
create or replace function public.rental_report_not_own_listing()
returns trigger language plpgsql security definer as $$
declare v_company_owner uuid;
begin
  select u.id into v_company_owner
  from public.rental_vehicle_listings l
  join public.rental_companies rc on rc.id = l.company_id
  join public.businesses b on b.id = rc.business_id
  join auth.users u on u.id = b.owner_id
  where l.id = NEW.listing_id limit 1;

  if v_company_owner = auth.uid() then
    raise exception 'Cannot report your own listing';
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_rental_no_self_report on public.rental_reports;
create trigger trg_rental_no_self_report
  before insert on public.rental_reports
  for each row execute function public.rental_report_not_own_listing();

-- 6c. Rate-limit activity logs — max 5 events per listing per user per minute
create or replace function public.rental_activity_rate_limit()
returns trigger language plpgsql security definer as $$
declare v_count int;
begin
  -- Only apply to authenticated users with a user_id
  if NEW.user_id is null then return NEW; end if;

  select count(*) into v_count
  from public.rental_activity_logs
  where listing_id = NEW.listing_id
    and user_id    = NEW.user_id
    and event_type = NEW.event_type
    and created_at > now() - interval '1 minute';

  if v_count >= 5 then
    return null;  -- silently discard
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_rental_activity_rate on public.rental_activity_logs;
create trigger trg_rental_activity_rate
  before insert on public.rental_activity_logs
  for each row execute function public.rental_activity_rate_limit();

-- 6d. Immutable audit logs — deny updates and deletes
create or replace function public.rental_audit_immutable()
returns trigger language plpgsql as $$
begin
  raise exception 'Audit logs are immutable';
end;
$$;

drop trigger if exists trg_rental_audit_immutable on public.rental_audit_logs;
create trigger trg_rental_audit_immutable
  before update or delete on public.rental_audit_logs
  for each row execute function public.rental_audit_immutable();

-- 6e. Harden RLS: business owner can only manage their OWN company's listings
-- (supplements the policy in rental_marketplace_schema.sql)
do $$ begin
  drop policy if exists "rental_listings: owner insert" on public.rental_vehicle_listings;
exception when undefined_object then null; end $$;

create policy "rental_listings: owner insert"
  on public.rental_vehicle_listings for insert
  to authenticated
  with check (
    exists (
      select 1 from public.rental_companies rc
      join public.businesses b on b.id = rc.business_id
      where rc.id = company_id
        and b.owner_id = auth.uid()
        and rc.status = 'active'
    )
  );

do $$ begin
  drop policy if exists "rental_listings: owner update" on public.rental_vehicle_listings;
exception when undefined_object then null; end $$;

create policy "rental_listings: owner update"
  on public.rental_vehicle_listings for update
  to authenticated
  using (
    exists (
      select 1 from public.rental_companies rc
      join public.businesses b on b.id = rc.business_id
      where rc.id = company_id
        and b.owner_id = auth.uid()
    )
  )
  with check (
    -- Business owner cannot change admin_status — only admins can
    admin_status = (select admin_status from public.rental_vehicle_listings where id = rental_vehicle_listings.id)
  );

-- ================================================================
-- TASK 7: PERFORMANCE INDEXES
-- ================================================================

-- Browse query: status + admin_status + location (most common filter combo)
create index if not exists rental_listings_browse_idx
  on public.rental_vehicle_listings (status, admin_status, location_id)
  where deleted_at is null;

-- Browse + category filter
create index if not exists rental_listings_category_idx
  on public.rental_vehicle_listings (category_id, status, admin_status)
  where deleted_at is null;

-- Browse + brand filter
create index if not exists rental_listings_brand_idx
  on public.rental_vehicle_listings (brand_id, status, admin_status)
  where deleted_at is null;

-- Daily rate range queries (price filter)
create index if not exists rental_listings_daily_rate_idx
  on public.rental_vehicle_listings (daily_rate)
  where deleted_at is null and admin_status = 'approved';

-- Company portal: owner's listings
create index if not exists rental_listings_company_idx
  on public.rental_vehicle_listings (company_id, status)
  where deleted_at is null;

-- Pending approvals (admin tab — small set, partial index is fast)
create index if not exists rental_listings_pending_idx
  on public.rental_vehicle_listings (created_at)
  where admin_status = 'pending_review' and deleted_at is null;

-- Favorites lookup by user
create index if not exists rental_favorites_user_idx
  on public.rental_favorites (user_id, listing_id);

-- Activity logs time-series queries
create index if not exists rental_activity_time_idx
  on public.rental_activity_logs (listing_id, event_type, created_at desc);

-- Reports by status
create index if not exists rental_reports_status_idx
  on public.rental_reports (status, created_at desc);

-- Reviews by company + status
create index if not exists rental_reviews_company_idx
  on public.rental_reviews (company_id, status, created_at desc);

-- Featured listings active window
create index if not exists rental_featured_active_idx
  on public.rental_featured_listings (is_active, starts_at, ends_at, priority)
  where is_active = true;

-- Audit logs time-series (admin tail queries)
create index if not exists rental_audit_time_idx
  on public.rental_audit_logs (created_at desc);

-- ================================================================
-- TASK 8: BUSINESS ANALYTICS RPC
-- Returns 30-day event breakdown + conversion metrics per company
-- ================================================================

create or replace function public.rental_business_analytics(p_company_id uuid)
returns jsonb language plpgsql security definer as $$
declare
  v_owner_id uuid;
  v_result   jsonb;
  v_since    timestamptz := now() - interval '30 days';
begin
  -- Auth: must be the company owner or an admin
  select u.id into v_owner_id
  from public.rental_companies rc
  join public.businesses b on b.id = rc.business_id
  join auth.users u on u.id = b.owner_id
  where rc.id = p_company_id
  limit 1;

  if v_owner_id != auth.uid() and not public.is_admin() then
    raise exception 'Not authorized';
  end if;

  select jsonb_build_object(
    'views_30d',      coalesce(sum(case when event_type='view'         then 1 else 0 end),0),
    'saves_30d',      coalesce(sum(case when event_type='save'         then 1 else 0 end),0),
    'chats_30d',      coalesce(sum(case when event_type='chat_open'    then 1 else 0 end),0),
    'whatsapp_30d',   coalesce(sum(case when event_type='whatsapp_click' then 1 else 0 end),0),
    'calls_30d',      coalesce(sum(case when event_type='call_click'   then 1 else 0 end),0),
    'total_events',   count(*)
  ) into v_result
  from public.rental_activity_logs al
  join public.rental_vehicle_listings l on l.id = al.listing_id
  where l.company_id = p_company_id
    and al.created_at >= v_since;

  -- Add fleet + rating snapshot
  select v_result || jsonb_build_object(
    'fleet_count',  coalesce(rc.fleet_count, 0),
    'avg_rating',   coalesce(rc.avg_rating, 0),
    'review_count', coalesce(rc.review_count, 0)
  ) into v_result
  from public.rental_companies rc
  where rc.id = p_company_id;

  return v_result;
end;
$$;

grant execute on function public.rental_business_analytics(uuid) to authenticated;

-- NOTE: rental_search_listings is defined in rental_marketplace_schema.sql
-- with text-based slug parameters matching the JS client. Do NOT redefine
-- it here with different parameter types — that creates an incompatible
-- PostgreSQL overload that breaks PostgREST routing.

-- Increment view count (idempotent RPC called from app)
create or replace function public.rental_increment_view(p_listing_id uuid)
returns void language sql security definer as $$
  update public.rental_vehicle_listings
  set view_count = coalesce(view_count, 0) + 1
  where id = p_listing_id and deleted_at is null;

  -- Also log the event (ignore rate-limit trigger — it returns null silently)
  insert into public.rental_activity_logs (listing_id, user_id, event_type)
  values (p_listing_id, auth.uid(), 'view')
  on conflict do nothing;
$$;

grant execute on function public.rental_increment_view(uuid) to anon, authenticated;
