-- ============================================================
-- fix_rental_notify_triggers.sql
--
-- BUG: rental_hardening.sql created notify trigger functions that
-- insert into notifications (user_id, title, body, type, data) — but
-- the live notifications table has:
--   • meta jsonb            (there is no "data" column)
--   • id text primary key   (NO default — must be supplied)
-- So the moment an admin approved a company/listing, the AFTER UPDATE
-- trigger failed with:
--   column "data" of relation "notifications" does not exist
-- rolling back the entire approval. This is why rental_companies still
-- has no active row even though admin.html reported success (before
-- commit d471d1d) or now shows this exact error.
--
-- FIX: recreate all three notify functions using the real columns
-- (id generated, meta instead of data). Each insert is also wrapped in
-- an exception handler so a notification problem can never again
-- block an approval — approvals must succeed even if notifying fails.
--
-- Run once in Supabase SQL Editor, then approve the company/listing
-- again in admin.html.
-- ============================================================

-- 5a. Listing approved / rejected → notify owner
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
    insert into public.notifications (id, user_id, title, body, type, meta)
    values (
      gen_random_uuid()::text,
      v_owner_id,
      v_title,
      v_body,
      'rental_listing_decision',
      jsonb_build_object('listing_id', NEW.id, 'admin_status', NEW.admin_status)
    );
  exception when others then
    raise warning 'rental_notify_listing_decision: notification insert failed: %', sqlerrm;
  end;

  return NEW;
end;
$$;

-- 5b. Company activated / suspended / rejected → notify owner
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
    insert into public.notifications (id, user_id, title, body, type, meta)
    values (
      gen_random_uuid()::text,
      v_owner_id, v_title, v_body,
      'rental_company_decision',
      jsonb_build_object('company_id', NEW.id, 'status', NEW.status)
    );
  exception when others then
    raise warning 'rental_notify_company_decision: notification insert failed: %', sqlerrm;
  end;

  return NEW;
end;
$$;

-- 5c. New published review → notify owner
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
        insert into public.notifications (id, user_id, title, body, type, meta)
        values (
          gen_random_uuid()::text,
          v_owner_id,
          'New Review',
          'A customer left a ' || NEW.rating || '-star review on your rental company.',
          'rental_new_review',
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

-- Triggers themselves are unchanged; replacing the functions is enough.
-- ============================================================
