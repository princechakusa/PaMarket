-- ============================================================================
-- PaMarket — Marketplace notifications, phase 1
-- ----------------------------------------------------------------------------
-- Wires six notification types onto the existing scheduled_notifications
-- queue (202607120001_automation_campaigns_phase1.sql) so they get both the
-- in-app bell entry AND an FCM/web push via send-push, exactly like admin
-- broadcasts do — no new edge function needed, automation-runner already
-- polls the queue.
--
-- Event-driven (fire immediately via trigger):
--   1. Listing approved / rejected / flagged (moderation status change)
--   2. Price drop on a listing a buyer has favourited (user_saves)
--   3. New listing / re-activation matches a buyer's saved search
--
-- Poll-driven (automation-runner calls these once per tick — see the
-- companion edit to supabase/functions/automation-runner/index.ts):
--   4. Listing expiry warning (T-3 days)
--   5. Stale listing prompt (0 views after 7 days)
--   6. View-count milestone (50 / 100 / 500 views — Bump Up upsell)
--
-- Idempotent. Run once in the Supabase SQL Editor.
-- ============================================================================

begin;

-- ── 0. Dedupe/tracking columns ─────────────────────────────────────────────
alter table public.listings
  add column if not exists expiry_warned_at   timestamptz,
  add column if not exists stale_prompted_at  timestamptz,
  add column if not exists milestone_notified integer not null default 0;

-- ============================================================================
-- 1. Listing approved / rejected / flagged → notify seller
-- ============================================================================
create or replace function public.notify_listing_status_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_title text;
  v_body  text;
  v_type  text;
begin
  if NEW.status = 'active' and OLD.status = 'pending' then
    v_type  := 'listing_approved';
    v_title := '✅ Your ad is live!';
    v_body  := '"' || NEW.title || '" is now visible to buyers in ' || NEW.category || '. Good luck with the sale!';
  elsif NEW.status in ('removed','deleted') and OLD.status in ('pending','active','flagged','under_review') then
    v_type  := 'listing_rejected';
    v_title := '⚠️ Ad needs a fix';
    v_body  := '"' || NEW.title || '" wasn''t approved. Edit and resubmit in a few taps.';
  elsif NEW.status in ('flagged','under_review') and OLD.status in ('pending','active') then
    v_type  := 'listing_flagged';
    v_title := '⚠️ Your ad is under review';
    v_body  := '"' || NEW.title || '" is being checked by our team before it can go live again.';
  else
    return NEW;
  end if;

  begin
    insert into public.scheduled_notifications (target, title, body, type, deep_link, scheduled_for)
    values (NEW.seller_id::text, v_title, v_body, v_type, 'Detail?id=' || NEW.id, now());
  exception when others then
    raise warning 'notify_listing_status_change: insert failed for listing %: %', NEW.id, sqlerrm;
  end;

  return NEW;
end;
$$;

drop trigger if exists trg_notify_listing_status_change on public.listings;
create trigger trg_notify_listing_status_change
  after update of status on public.listings
  for each row
  when (OLD.status is distinct from NEW.status)
  execute function public.notify_listing_status_change();

-- ============================================================================
-- 2. Price drop → notify everyone watching the listing (user_saves)
-- ============================================================================
create or replace function public.notify_price_drop()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  rec record;
  v_discount integer;
  v_count integer := 0;
begin
  v_discount := round((OLD.price - NEW.price) / OLD.price * 100);

  for rec in
    select us.user_id
    from public.user_saves us
    where us.listing_id = NEW.id::text
      and us.user_id <> NEW.seller_id
    limit 500
  loop
    begin
      insert into public.scheduled_notifications (target, title, body, type, deep_link, scheduled_for)
      values (
        rec.user_id::text,
        '💸 Price drop on your watchlist!',
        'The seller just dropped "' || NEW.title || '" from ' || NEW.currency || ' ' || OLD.price
          || ' to ' || NEW.currency || ' ' || NEW.price || ' (' || v_discount || '% off). Grab it before someone else does.',
        'price_drop', 'Detail?id=' || NEW.id, now()
      );
      v_count := v_count + 1;
    exception when others then
      raise warning 'notify_price_drop: insert failed for listing % / user %: %', NEW.id, rec.user_id, sqlerrm;
    end;
  end loop;

  return NEW;
end;
$$;

drop trigger if exists trg_notify_price_drop on public.listings;
create trigger trg_notify_price_drop
  after update of price on public.listings
  for each row
  -- require a real drop (>=2%), not rounding noise, and only for live listings
  when (NEW.status = 'active' and OLD.price > 0 and NEW.price < OLD.price * 0.98)
  execute function public.notify_price_drop();

-- ============================================================================
-- 3. New/re-activated listing matches a saved search → notify buyer
-- ============================================================================
create or replace function public.notify_saved_search_match()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  rec record;
begin
  for rec in
    select ss.user_id, ss.name
    from public.saved_searches ss
    where ss.user_id <> NEW.seller_id
      and (ss.category is null or ss.category = '' or ss.category = NEW.category)
      and (ss.query is null or ss.query = ''
           or NEW.title ilike '%' || ss.query || '%'
           or NEW.description ilike '%' || ss.query || '%')
    limit 200
  loop
    begin
      insert into public.scheduled_notifications (target, title, body, type, deep_link, scheduled_for)
      values (
        rec.user_id::text,
        '🔎 New ' || NEW.category || ' match for you!',
        '"' || NEW.title || '" just listed for ' || NEW.currency || ' ' || NEW.price || ' in ' || NEW.city
          || ' — matches your saved search "' || coalesce(nullif(rec.name,''), 'Saved search') || '". Tap to view before it''s gone.',
        'saved_search_match', 'Detail?id=' || NEW.id, now()
      );
    exception when others then
      raise warning 'notify_saved_search_match: insert failed for listing % / user %: %', NEW.id, rec.user_id, sqlerrm;
    end;
  end loop;

  return NEW;
end;
$$;

drop trigger if exists trg_notify_saved_search_insert on public.listings;
create trigger trg_notify_saved_search_insert
  after insert on public.listings
  for each row
  when (NEW.status = 'active')
  execute function public.notify_saved_search_match();

drop trigger if exists trg_notify_saved_search_activate on public.listings;
create trigger trg_notify_saved_search_activate
  after update of status on public.listings
  for each row
  when (NEW.status = 'active' and OLD.status is distinct from 'active')
  execute function public.notify_saved_search_match();

-- ============================================================================
-- 4. Listing expiry warning (T-3 days) — called by automation-runner
-- ============================================================================
create or replace function public.run_listing_expiry_warnings()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  rec record;
  v_count integer := 0;
begin
  for rec in
    select id, seller_id, title, category, expires_at
    from public.listings
    where status = 'active'
      and expires_at is not null
      and expires_at <= now() + interval '3 days'
      and expires_at > now()
      and expiry_warned_at is null
    limit 500
  loop
    begin
      insert into public.scheduled_notifications (target, title, body, type, deep_link, scheduled_for)
      values (
        rec.seller_id::text,
        '⏳ Your ad expires soon',
        '"' || rec.title || '" goes offline on ' || to_char(rec.expires_at, 'Mon DD')
          || '. Renew now to stay visible to buyers in ' || rec.category || '.',
        'listing_expiry', 'Detail?id=' || rec.id, now()
      );
      update public.listings set expiry_warned_at = now() where id = rec.id;
      v_count := v_count + 1;
    exception when others then
      raise warning 'run_listing_expiry_warnings: failed for listing %: %', rec.id, sqlerrm;
    end;
  end loop;
  return jsonb_build_object('warned', v_count);
end;
$$;

revoke all on function public.run_listing_expiry_warnings() from public, anon, authenticated;
grant execute on function public.run_listing_expiry_warnings() to service_role;

-- ============================================================================
-- 5. Stale listing prompt (0 views after 7 days) — called by automation-runner
-- ============================================================================
create or replace function public.run_stale_listing_prompts()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  rec record;
  v_count integer := 0;
begin
  for rec in
    select id, seller_id, title, category
    from public.listings
    where status = 'active'
      and views = 0
      and created_at <= now() - interval '7 days'
      and stale_prompted_at is null
    limit 500
  loop
    begin
      insert into public.scheduled_notifications (target, title, body, type, deep_link, scheduled_for)
      values (
        rec.seller_id::text,
        '👀 Zero views on your ad?',
        'Your ' || rec.category || ' ad "' || rec.title
          || '" hasn''t been seen yet. Try better photos, a sharper price, or Bump Up to get in front of buyers.',
        'stale_listing', 'Detail?id=' || rec.id, now()
      );
      update public.listings set stale_prompted_at = now() where id = rec.id;
      v_count := v_count + 1;
    exception when others then
      raise warning 'run_stale_listing_prompts: failed for listing %: %', rec.id, sqlerrm;
    end;
  end loop;
  return jsonb_build_object('prompted', v_count);
end;
$$;

revoke all on function public.run_stale_listing_prompts() from public, anon, authenticated;
grant execute on function public.run_stale_listing_prompts() to service_role;

-- ============================================================================
-- 6. View-count milestone (50 / 100 / 500) — called by automation-runner
-- ============================================================================
create or replace function public.run_view_milestones()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  rec record;
  v_threshold integer;
  v_count integer := 0;
begin
  for rec in
    select id, seller_id, title, category, views, milestone_notified
    from public.listings
    where status = 'active'
      and boost is null           -- already-boosted listings don't need the upsell
      and views >= 50
      and views > milestone_notified
    limit 500
  loop
    v_threshold := case
      when rec.views >= 500 then 500
      when rec.views >= 100 then 100
      else 50
    end;
    if v_threshold <= rec.milestone_notified then
      continue;
    end if;
    begin
      insert into public.scheduled_notifications (target, title, body, type, deep_link, scheduled_for)
      values (
        rec.seller_id::text,
        '🔥 Your ad is getting noticed!',
        '"' || rec.title || '" has ' || rec.views || ' views. Bump it to the top or make it Featured to turn views into offers.',
        'view_milestone', 'Detail?id=' || rec.id, now()
      );
      update public.listings set milestone_notified = v_threshold where id = rec.id;
      v_count := v_count + 1;
    exception when others then
      raise warning 'run_view_milestones: failed for listing %: %', rec.id, sqlerrm;
    end;
  end loop;
  return jsonb_build_object('notified', v_count);
end;
$$;

revoke all on function public.run_view_milestones() from public, anon, authenticated;
grant execute on function public.run_view_milestones() to service_role;

commit;

-- ============================================================================
-- Verification (run manually, not part of the migration):
--
--   -- approve a pending listing → expect a 'listing_approved' row queued
--   update listings set status = 'active' where id = '<some pending id>' and status = 'pending';
--   select * from scheduled_notifications where type = 'listing_approved' order by created_at desc limit 1;
--
--   -- drop a watched listing's price by >2% → expect one row per watcher
--   update listings set price = price * 0.9 where id = '<some active id>';
--   select * from scheduled_notifications where type = 'price_drop' order by created_at desc limit 5;
--
--   select run_listing_expiry_warnings();
--   select run_stale_listing_prompts();
--   select run_view_milestones();
-- ============================================================================
