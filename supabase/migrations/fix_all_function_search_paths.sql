-- ============================================================================
-- PaMarket — Pin search_path on all remaining app functions
-- ----------------------------------------------------------------------------
-- Supabase's database linter (0011_function_search_path_mutable) flagged
-- every function below as having a role-mutable search_path — a hardening
-- gap: without a pinned search_path, a SECURITY DEFINER function can be
-- tricked into resolving an unqualified table/function name against a
-- schema the caller controls (schema-injection). All bodies are UNCHANGED
-- from their live definitions (pulled via pg_get_functiondef) — only
-- `SET search_path = public` is added to each signature.
--
-- Deliberately NOT included: pg_trgm extension functions (gin_*, gtrgm_*,
-- similarity*, word_similarity*, set_limit, show_limit, show_trgm) — these
-- belong to the pg_trgm extension itself and must never be redefined by
-- hand; the correct fix for those is moving the extension to its own
-- schema, a separate, bigger change.
--
-- check_listing_content is fixed separately in
-- fix_check_listing_content_search_path.sql.
--
-- Idempotent — every statement is CREATE OR REPLACE against the exact
-- current body. Run once in the Supabase SQL Editor.
-- ============================================================================

-- ── expire_old_listings ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.expire_old_listings()
 RETURNS void
 LANGUAGE plpgsql
 SET search_path = public
AS $function$
begin
  update public.listings
  set status = 'deleted'
  where status = 'active' and expires_at < now();
end;
$function$;

-- ── prune_error_logs ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.prune_error_logs()
 RETURNS void
 LANGUAGE plpgsql
 SET search_path = public
AS $function$
begin
  delete from error_logs where created_at < now() - interval '30 days';
end;
$function$;

-- ── refresh_company_fleet_count ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.refresh_company_fleet_count()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
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
$function$;

-- ── refresh_company_rating ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.refresh_company_rating()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
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
$function$;

-- ── refresh_listing_save_count ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.refresh_listing_save_count()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
declare v_listing_id uuid := coalesce(new.listing_id, old.listing_id);
begin
  update public.rental_vehicle_listings
  set save_count = (select count(*) from public.rental_favorites where listing_id = v_listing_id)
  where id = v_listing_id;
  return coalesce(new, old);
end;
$function$;

-- ── renew_listing ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.renew_listing(listing_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
begin
  update public.listings
  set expires_at = now() + interval '30 days'
  where id = listing_id and seller_id = auth.uid();
end;
$function$;

-- ── rental_activity_rate_limit ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.rental_activity_rate_limit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
declare v_count int;
begin
  if NEW.user_id is null then return NEW; end if;

  select count(*) into v_count
  from public.rental_activity_logs
  where listing_id = NEW.listing_id
    and user_id    = NEW.user_id
    and event_type = NEW.event_type
    and created_at > now() - interval '1 minute';

  if v_count >= 5 then
    return null;
  end if;

  return NEW;
end;
$function$;

-- ── rental_aggregate_daily ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.rental_aggregate_daily(p_date date DEFAULT CURRENT_DATE)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
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
$function$;

-- ── rental_analytics_schema_guard ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.rental_analytics_schema_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = public
AS $function$
begin
  if new.event_type in ('click_chat','click_whatsapp','click_call') then
    if (new.metadata ->> 'lead_id') is null then
      raise exception
        'Event type % requires metadata.lead_id.', new.event_type;
    end if;
  end if;

  if new.event_type = 'share' then
    if (new.metadata ->> 'channel') is null then
      raise exception 'Event type share requires metadata.channel.';
    end if;
  end if;

  if new.event_type = 'report' then
    if (new.metadata ->> 'reason') is null
    or (new.metadata ->> 'report_id') is null then
      raise exception
        'Event type report requires metadata.reason and metadata.report_id.';
    end if;
  end if;

  return new;
end;
$function$;

-- ── rental_audit_immutable ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.rental_audit_immutable()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = public
AS $function$
begin
  raise exception 'Audit logs are immutable';
end;
$function$;

-- ── rental_availability_no_overlap ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.rental_availability_no_overlap()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = public
AS $function$
begin
  if exists (
    select 1 from public.rental_vehicle_availability
    where listing_id  = new.listing_id
      and id         <> coalesce(new.id, gen_random_uuid())
      and starts_on  <= new.ends_on
      and ends_on    >= new.starts_on
  ) then
    raise exception
      'Date range overlaps an existing blocked period for this vehicle (% to %).',
      new.starts_on, new.ends_on;
  end if;
  return new;
end;
$function$;

-- ── rental_business_analytics ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.rental_business_analytics(p_company_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
declare
  v_owner_id uuid;
  v_result   jsonb;
  v_since    timestamptz := now() - interval '30 days';
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = 'AUTEN';
  end if;

  select b.owner_user_id into v_owner_id
  from public.rental_companies rc
  join public.businesses b on b.id = rc.business_id
  where rc.id = p_company_id
  limit 1;

  if v_owner_id is null or (v_owner_id != auth.uid() and not public.is_admin()) then
    raise exception 'Not authorized' using errcode = 'AUTHR';
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

  select v_result || jsonb_build_object(
    'fleet_count',  coalesce(rc.fleet_count, 0),
    'avg_rating',   coalesce(rc.avg_rating, 0),
    'review_count', coalesce(rc.review_count, 0)
  ) into v_result
  from public.rental_companies rc
  where rc.id = p_company_id;

  return v_result;
end;
$function$;

-- ── rental_company_audit_trigger ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.rental_company_audit_trigger()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
begin
  if OLD.status is distinct from NEW.status then
    insert into public.rental_audit_logs (
      actor_id, action, target_table, target_id, before_state, after_state
    ) values (
      auth.uid(),
      'company_status:' || coalesce(OLD.status,'?') || '->' || NEW.status,
      'rental_companies',
      NEW.id,
      jsonb_build_object('status', OLD.status),
      jsonb_build_object('status', NEW.status)
    );
  end if;
  return NEW;
end;
$function$;

-- ── rental_increment_view ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.rental_increment_view(p_listing_id uuid)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path = public
AS $function$
  update public.rental_vehicle_listings
  set view_count = coalesce(view_count, 0) + 1
  where id = p_listing_id and deleted_at is null;

  insert into public.rental_activity_logs (listing_id, user_id, event_type)
  values (p_listing_id, auth.uid(), 'view')
  on conflict do nothing;
$function$;

-- ── rental_leads_inquiry_count ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.rental_leads_inquiry_count()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
begin
  if new.lead_source in ('chat','whatsapp_click','call_click') then
    update public.rental_vehicle_listings
    set inquiry_count = inquiry_count + 1
    where id = new.listing_id;
  end if;
  return new;
end;
$function$;

-- ── rental_listing_audit_trigger ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.rental_listing_audit_trigger()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
begin
  if OLD.admin_status is distinct from NEW.admin_status
  or OLD.status is distinct from NEW.status then
    insert into public.rental_audit_logs (
      actor_id, action, target_table, target_id, before_state, after_state
    ) values (
      auth.uid(),
      'status_change:' || coalesce(OLD.admin_status,'?') || '->' || NEW.admin_status,
      'rental_vehicle_listings',
      NEW.id,
      jsonb_build_object('status', OLD.status, 'admin_status', OLD.admin_status),
      jsonb_build_object('status', NEW.status, 'admin_status', NEW.admin_status)
    );
  end if;
  return NEW;
end;
$function$;

-- ── rental_listing_init_state ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.rental_listing_init_state()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
begin
  insert into public.rental_vehicle_states (listing_id, current_state)
  values (new.id, 'available')
  on conflict (listing_id) do nothing;
  return new;
end;
$function$;

-- ── rental_listing_status_guard ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.rental_listing_status_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
begin
  if NEW.admin_status not in (
    'pending_review','approved','rejected','removed','hidden'
  ) then
    raise exception 'Invalid admin_status: %', NEW.admin_status;
  end if;

  if NEW.admin_status = 'rejected' and OLD.admin_status != 'rejected' then
    NEW.status := 'paused';
  end if;

  if NEW.admin_status = 'approved' and OLD.admin_status = 'pending_review' then
    NEW.status := coalesce(nullif(OLD.status,'paused'), 'active');
  end if;

  if NEW.admin_status = 'removed' and OLD.admin_status != 'removed' then
    NEW.deleted_at := coalesce(NEW.deleted_at, now());
    NEW.status := 'archived';
  end if;

  return NEW;
end;
$function$;

-- ── rental_notify_company_decision ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.rental_notify_company_decision()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
declare
  v_owner_id uuid;
  v_title    text;
  v_body     text;
begin
  if OLD.status is not distinct from NEW.status then return NEW; end if;
  if NEW.status not in ('active','suspended','rejected') then return NEW; end if;

  select b.owner_user_id into v_owner_id
  from public.businesses b
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

  begin
    insert into public.notifications (id, user_id, title, body, type, category, meta)
    values (
      gen_random_uuid()::text,
      v_owner_id, v_title, v_body,
      'rental_company_decision',
      'rental',
      jsonb_build_object('company_id', NEW.id, 'status', NEW.status)
    );
  exception when others then
    raise warning 'rental_notify_company_decision: notification insert failed: %', sqlerrm;
  end;

  return NEW;
end;
$function$;

-- ── rental_notify_listing_decision ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.rental_notify_listing_decision()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
declare
  v_owner_id   uuid;
  v_title      text;
  v_body       text;
  v_listing_title text;
begin
  if OLD.admin_status is not distinct from NEW.admin_status then return NEW; end if;
  if NEW.admin_status not in ('approved','rejected') then return NEW; end if;

  select b.owner_user_id into v_owner_id
  from public.rental_companies rc
  join public.businesses b on b.id = rc.business_id
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

  begin
    insert into public.notifications (id, user_id, title, body, type, category, meta)
    values (
      gen_random_uuid()::text,
      v_owner_id,
      v_title,
      v_body,
      'rental_listing_decision',
      'rental',
      jsonb_build_object('listing_id', NEW.id, 'admin_status', NEW.admin_status)
    );
  exception when others then
    raise warning 'rental_notify_listing_decision: notification insert failed: %', sqlerrm;
  end;

  return NEW;
end;
$function$;

-- ── rental_notify_new_lead ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.rental_notify_new_lead()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
declare
  v_owner_id uuid;
  v_customer_name text;
begin
  select b.owner_user_id into v_owner_id
  from public.rental_companies rc
  join public.businesses b on b.id = rc.business_id
  where rc.id = NEW.company_id limit 1;

  if v_owner_id is null or v_owner_id = NEW.user_id then return NEW; end if;

  select coalesce(p.name, 'A customer') into v_customer_name
  from public.profiles p where p.id = NEW.user_id;

  begin
    insert into public.notifications (id, user_id, title, body, type, category, meta)
    values (
      gen_random_uuid()::text,
      v_owner_id,
      'New Inquiry',
      v_customer_name || ' contacted you via ' || coalesce(NEW.lead_source, 'the app') || '.',
      'rental_new_lead',
      'rental',
      jsonb_build_object('lead_id', NEW.id, 'listing_id', NEW.listing_id, 'company_id', NEW.company_id)
    );
  exception when others then
    raise warning 'rental_notify_new_lead: notification insert failed: %', sqlerrm;
  end;

  return NEW;
end;
$function$;

-- ── rental_notify_new_review ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.rental_notify_new_review()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
declare v_owner_id uuid;
begin
  if TG_OP = 'INSERT' and NEW.status = 'published' then
    select b.owner_user_id into v_owner_id
    from public.rental_companies rc
    join public.businesses b on b.id = rc.business_id
    where rc.id = NEW.company_id limit 1;

    if v_owner_id is not null then
      begin
        insert into public.notifications (id, user_id, title, body, type, category, meta)
        values (
          gen_random_uuid()::text,
          v_owner_id,
          'New Review',
          'A customer left a ' || NEW.rating || '-star review on your rental company.',
          'rental_new_review',
          'rental',
          jsonb_build_object('review_id', NEW.id, 'company_id', NEW.company_id, 'rating', NEW.rating)
        );
      exception when others then
        raise warning 'rental_notify_new_review: notification insert failed: %', sqlerrm;
      end;
    end if;
  end if;
  return NEW;
end;
$function$;

-- ── rental_notify_report_resolved ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.rental_notify_report_resolved()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
begin
  if OLD.status is not distinct from NEW.status then return NEW; end if;
  if NEW.status not in ('resolved', 'dismissed') then return NEW; end if;

  begin
    insert into public.notifications (id, user_id, title, body, type, category, meta)
    values (
      gen_random_uuid()::text,
      NEW.reporter_id,
      'Report Update',
      'Your report on a rental listing has been ' || NEW.status || '.',
      'rental_report_resolved',
      'rental',
      jsonb_build_object('report_id', NEW.id, 'listing_id', NEW.listing_id, 'status', NEW.status)
    );
  exception when others then
    raise warning 'rental_notify_report_resolved: notification insert failed: %', sqlerrm;
  end;

  return NEW;
end;
$function$;

-- ── rental_notify_report_submitted ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.rental_notify_report_submitted()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
declare v_admin record;
begin
  for v_admin in select id from public.profiles where role = 'admin' loop
    begin
      insert into public.notifications (id, user_id, title, body, type, category, meta)
      values (
        gen_random_uuid()::text,
        v_admin.id,
        'Vehicle Reported',
        'A rental listing was reported: ' || coalesce(NEW.reason, 'no reason given') || '.',
        'rental_report_submitted',
        'rental',
        jsonb_build_object('report_id', NEW.id, 'listing_id', NEW.listing_id)
      );
    exception when others then
      raise warning 'rental_notify_report_submitted: notification insert failed for admin %: %', v_admin.id, sqlerrm;
    end;
  end loop;
  return NEW;
end;
$function$;

-- ── rental_rebuild_search_index_row ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.rental_rebuild_search_index_row(p_listing_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
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
$function$;

-- ── rental_report_not_own_listing ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.rental_report_not_own_listing()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
declare v_company_owner uuid;
begin
  select u.id into v_company_owner
  from public.rental_vehicle_listings l
  join public.rental_companies rc on rc.id = l.company_id
  join public.businesses b on b.id = rc.business_id
  where l.id = NEW.listing_id limit 1;

  if v_company_owner = auth.uid() then
    raise exception 'Cannot report your own listing';
  end if;
  return NEW;
end;
$function$;

-- ── rental_review_not_own_company ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.rental_review_not_own_company()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
declare v_owner_id uuid;
begin
  select b.owner_user_id into v_owner_id
  from public.rental_companies rc
  join public.businesses b on b.id = rc.business_id
  where rc.id = NEW.company_id limit 1;

  if v_owner_id = auth.uid() then
    raise exception 'Cannot review your own company';
  end if;
  return NEW;
end;
$function$;

-- ── rental_reviews_no_self_review ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.rental_reviews_no_self_review()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = public
AS $function$
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
$function$;

-- ── rental_search_listings ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.rental_search_listings(p_category_slug text DEFAULT NULL::text, p_city text DEFAULT NULL::text, p_brand_slug text DEFAULT NULL::text, p_price_min numeric DEFAULT NULL::numeric, p_price_max numeric DEFAULT NULL::numeric, p_transmission text DEFAULT NULL::text, p_fuel_type text DEFAULT NULL::text, p_drive_type text DEFAULT NULL::text, p_available_only boolean DEFAULT false, p_featured_first boolean DEFAULT true, p_limit integer DEFAULT 20, p_offset integer DEFAULT 0)
 RETURNS TABLE(id uuid, model text, year smallint, daily_rate numeric, is_available boolean, view_count bigint, category_slug text, brand_slug text, city text, company_name text, cover_url text, is_featured boolean)
 LANGUAGE sql
 STABLE
 SET search_path = public
AS $function$
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
$function$;

-- ── rental_state_machine_guard ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.rental_state_machine_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = public
AS $function$
begin
  if TG_OP = 'INSERT' then
    new.previous_state    := null;
    new.state_entered_at  := now();
    return new;
  end if;

  if new.current_state = old.current_state then
    return new;
  end if;

  if not exists (
    select 1 from public.rental_state_transitions
    where from_state = old.current_state
      and to_state   = new.current_state
  ) then
    raise exception
      'Invalid state transition: % → %. Check rental_state_transitions.',
      old.current_state, new.current_state;
  end if;

  new.previous_state   := old.current_state;
  new.state_entered_at := now();
  return new;
end;
$function$;

-- ── rental_state_sync_to_index ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.rental_state_sync_to_index()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
begin
  update public.rental_listing_search_index
  set
    availability_status = new.current_state,
    is_available        = (new.current_state = 'available'),
    indexed_at          = now()
  where listing_id = new.listing_id;
  return new;
end;
$function$;

-- ── rental_sync_company_rating ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.rental_sync_company_rating()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
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
$function$;

-- ── rental_sync_fleet_count ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.rental_sync_fleet_count()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
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
$function$;

-- ── rlsi_from_company ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.rlsi_from_company()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = public
AS $function$
begin
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
$function$;

-- ── rlsi_from_featured ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.rlsi_from_featured()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = public
AS $function$
begin
  perform public.rental_rebuild_search_index_row(
    coalesce(new.listing_id, old.listing_id)
  );
  return coalesce(new, old);
end;
$function$;

-- ── rlsi_from_listing ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.rlsi_from_listing()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = public
AS $function$
begin
  perform public.rental_rebuild_search_index_row(
    coalesce(new.id, old.id)
  );
  return coalesce(new, old);
end;
$function$;

-- ── rlsi_from_media ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.rlsi_from_media()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = public
AS $function$
begin
  if (coalesce(new.is_cover, false) or coalesce(old.is_cover, false)) then
    perform public.rental_rebuild_search_index_row(
      coalesce(new.listing_id, old.listing_id)
    );
  end if;
  return coalesce(new, old);
end;
$function$;

-- ── rlsi_from_specs ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.rlsi_from_specs()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = public
AS $function$
begin
  perform public.rental_rebuild_search_index_row(
    coalesce(new.listing_id, old.listing_id)
  );
  return coalesce(new, old);
end;
$function$;

-- ── set_updated_at ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = public
AS $function$ begin new.updated_at = now(); return new; end; $function$;

-- ── sort_uuid_array ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.sort_uuid_array(arr uuid[])
 RETURNS uuid[]
 LANGUAGE sql
 IMMUTABLE STRICT
 SET search_path = public
AS $function$
  SELECT ARRAY(SELECT unnest(arr) ORDER BY 1)
$function$;

-- ── touch_adr_updated_at ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.touch_adr_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = public
AS $function$
begin
  new.updated_at := now();
  return new;
end;
$function$;

notify pgrst, 'reload schema';
