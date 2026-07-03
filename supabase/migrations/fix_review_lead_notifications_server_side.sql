-- ============================================================
-- PaMarket — server-side notifications for reviews and business leads
--
-- Follow-up to fix_message_notifications_server_side.sql. The client called
-- H.pushNotif(<other user>, ...) for "New review" (profile.js, business-profile.js)
-- and "New lead"/"New contact" (business-leads.js), but the notifications INSERT
-- policy is self-only (auth.uid() = user_id), so RLS rejected every one — the
-- reviewed seller / business owner never received them. This adds security-
-- definer triggers so these user-facing events are delivered server-side, the
-- same pattern already used for messages and rental events.
--
-- Note: live notifications.user_id is text (not uuid as in schema), so recipients
-- are cast to text. rental_reviews and rental_vehicle_leads already have their
-- own notify triggers (fix_rental_notifications_scope_and_gaps.sql) and are NOT
-- touched here.
--
-- Idempotent. Run once in the Supabase SQL Editor.
-- ============================================================

-- ── 1. General seller reviews (public.reviews) ────────────────────────
-- reviews(seller_id uuid, reviewer_id uuid, reviewer_name text, rating smallint)
create or replace function public.notify_review_recipient()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Never notify a self-review (shouldn't exist per CHECK, but be safe).
  if NEW.seller_id is not distinct from NEW.reviewer_id then
    return NEW;
  end if;

  insert into public.notifications (id, user_id, title, body, type, read, created_at, meta)
  values (
    gen_random_uuid()::text,
    NEW.seller_id::text,
    'New Review',
    coalesce(nullif(NEW.reviewer_name, ''), 'Someone')
      || ' left you a ' || NEW.rating::text || '-star review',
    'review',
    false,
    (extract(epoch from now()) * 1000)::bigint,
    jsonb_build_object('deepLink', 'Reviews')
  );
  return NEW;
end;
$$;

drop trigger if exists trg_notify_review_recipient on public.reviews;
create trigger trg_notify_review_recipient
  after insert on public.reviews
  for each row execute function public.notify_review_recipient();

-- ── 2. Business leads (public.business_leads) ─────────────────────────
-- business_leads(business_id uuid, user_id uuid, user_name text, type text, ...)
-- Guarded: only creates the trigger if the table exists in this database, since
-- business_leads is created by the app runtime, not a checked-in schema file.
do $$
begin
  if to_regclass('public.business_leads') is not null then

    create or replace function public.notify_lead_recipient()
    returns trigger
    language plpgsql
    security definer
    set search_path = public
    as $fn$
    declare
      v_owner uuid;
      v_kind  text;
      v_body  text;
    begin
      select b.owner_user_id into v_owner
      from public.businesses b
      where b.id = NEW.business_id;

      if v_owner is null then
        return NEW;
      end if;

      v_kind := coalesce(NEW.type, 'chat');
      if v_kind in ('whatsapp','call') then
        v_body := coalesce(nullif(NEW.user_name, ''), 'Someone')
                  || ' contacted your shop via '
                  || case v_kind when 'whatsapp' then 'WhatsApp' else 'Call' end;
      else
        v_body := coalesce(nullif(NEW.user_name, ''), 'Someone')
                  || ' is interested in your listing';
      end if;

      insert into public.notifications (id, user_id, title, body, type, read, created_at, meta)
      values (
        gen_random_uuid()::text,
        v_owner::text,
        'New Lead',
        v_body,
        'lead',
        false,
        (extract(epoch from now()) * 1000)::bigint,
        '{}'::jsonb
      );
      return NEW;
    end;
    $fn$;

    drop trigger if exists trg_notify_lead_recipient on public.business_leads;
    create trigger trg_notify_lead_recipient
      after insert on public.business_leads
      for each row execute function public.notify_lead_recipient();

  end if;
end $$;
