-- ============================================================
-- fix_rental_notifications_scope_and_gaps.sql
--
-- Production audit findings (2026-07-03):
--
-- 1) SCOPE FIELD — the frontend previously isolated rental notifications
--    from personal ones using `type ILIKE 'rental_%'` string matching.
--    The audit correctly flagged this as fragile (a typo'd type breaks
--    isolation silently, and it's not indexable). notifications.category
--    already exists and is already used for personal notifications
--    (e.g. 'account'). This migration sets category = 'rental' on every
--    row the three existing rental triggers insert, and on the two new
--    ones added below, so the app can query on an explicit, indexed
--    column instead of pattern-matching type.
--
-- 2) MISSING NOTIFICATIONS — of the 9 events the audit requires, only 3
--    were wired (Listing Approved/Rejected, Company Activated/Suspended/
--    Rejected, Review Received). This migration adds the two that have
--    complete backing workflows already built:
--      • New Inquiry        — rental_vehicle_leads insert already happens
--                              (rentals.js R._logLead); just needed a
--                              notify trigger, same as the review trigger.
--      • Report Submitted   — rental_reports insert already happens
--                              (rentals.js R.reportVehicle); needed a
--                              notify-admins trigger. Notifies every user
--                              with profiles.role = 'admin'.
--      • Report Resolved    — admin.html raSetReportStatus() already
--                              updates rental_reports.status; needed a
--                              notify-reporter trigger.
--
--    NOT added (documented gap, not silently skipped):
--      • New Message         — would require a trigger on the shared
--                               `messages` table scoped to rental_
--                               conversation_context threads. Deliberately
--                               out of scope here: it touches the shared
--                               personal-messaging table used by every
--                               non-rental conversation in the app, which
--                               is a larger, riskier change than this
--                               audit's "fix what's broken" mandate covers.
--      • Promotion Approved  — rental_promotions has no approval-status
--                               column and no admin.html moderation UI
--                               exists for it (only is_active). This is a
--                               genuinely unbuilt feature, not a bug.
--
-- Run once in Supabase SQL Editor.
-- ============================================================

-- ── 1. Tag existing rental notify functions with category = 'rental' ────

create or replace function public.rental_notify_listing_decision()
returns trigger language plpgsql security definer as $$
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
$$;

create or replace function public.rental_notify_company_decision()
returns trigger language plpgsql security definer as $$
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
$$;

create or replace function public.rental_notify_new_review()
returns trigger language plpgsql security definer as $$
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
$$;

-- ── 2. NEW: notify owner on a new inquiry (lead) ─────────────────────────

create or replace function public.rental_notify_new_lead()
returns trigger language plpgsql security definer as $$
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
$$;

drop trigger if exists trg_rental_notify_new_lead on public.rental_vehicle_leads;
create trigger trg_rental_notify_new_lead
  after insert on public.rental_vehicle_leads
  for each row execute function public.rental_notify_new_lead();

-- ── 3. NEW: notify admins on a new report; notify reporter on resolution ─

create or replace function public.rental_notify_report_submitted()
returns trigger language plpgsql security definer as $$
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
$$;

drop trigger if exists trg_rental_notify_report_submitted on public.rental_reports;
create trigger trg_rental_notify_report_submitted
  after insert on public.rental_reports
  for each row execute function public.rental_notify_report_submitted();

create or replace function public.rental_notify_report_resolved()
returns trigger language plpgsql security definer as $$
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
$$;

drop trigger if exists trg_rental_notify_report_resolved on public.rental_reports;
create trigger trg_rental_notify_report_resolved
  after update on public.rental_reports
  for each row execute function public.rental_notify_report_resolved();

-- ── 4. Backfill category on any already-inserted rental notifications ───
update public.notifications
set category = 'rental'
where category is distinct from 'rental'
  and type in ('rental_listing_decision','rental_company_decision','rental_new_review');

-- ============================================================
