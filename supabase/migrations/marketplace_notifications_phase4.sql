-- ============================================================================
-- PaMarket — Marketplace notifications, phase 4
-- ----------------------------------------------------------------------------
-- Proactive, Dubizzle-style re-engagement pushes that reach a user's phone
-- even when they haven't opened the app recently, based on past browsing
-- interest rather than an explicit saved search or watchlist entry:
--
--   1. Shop new arrivals    — you viewed a business/shop; it has since posted
--                             new active listings you haven't seen.
--   2. Category digest      — you browsed a category repeatedly but never set
--                             up a saved search for it ("New Jobs near you").
--   3. Verification nudge   — unverified account, gentle one-off reminder.
--
-- All three reuse the existing scheduled_notifications -> automation-runner ->
-- send-push pipeline. No new edge function. Poll-driven, called once per
-- automation-runner tick (see companion edit to
-- supabase/functions/automation-runner/index.ts).
--
-- A shared daily engagement cap keeps this from feeling like spam: at most 2
-- proactive (non-transactional, non-safety) notifications per user per 24h
-- across shop_new_arrivals / category_digest / view_milestone /
-- personalized_recommendation combined.
--
-- Assumes marketplace_notifications_phase1/2/3.sql, schema/profiles.sql,
-- schema/businesses.sql, schema/conversations.sql, schema/applications.sql,
-- schema/saved_searches.sql are already applied. Idempotent. Run once in the
-- Supabase SQL Editor.
-- ============================================================================

begin;

-- ============================================================================
-- 0. Shared daily engagement cap — proactive re-engagement pushes only.
--    Transactional/safety notifications (chat scam warning, listing status,
--    job application, price drop, saved search match) are NEVER capped by
--    this — only the "we noticed you might be interested" category.
-- ============================================================================
create or replace function public.under_daily_engagement_cap(p_user_id uuid, p_cap integer default 2)
returns boolean language sql stable security definer set search_path = public as $$
  select count(*) < p_cap
  from public.scheduled_notifications
  where target = p_user_id::text
    and type in ('shop_new_arrivals', 'category_digest', 'view_milestone', 'personalized_recommendation')
    and created_at >= now() - interval '24 hours';
$$;

revoke all on function public.under_daily_engagement_cap(uuid, integer) from public, anon, authenticated;
grant execute on function public.under_daily_engagement_cap(uuid, integer) to service_role;

-- ============================================================================
-- 1. viewed_businesses — per-user shop/storefront view history
-- ============================================================================
create table if not exists public.viewed_businesses (
  user_id     uuid not null references auth.users(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  view_count  integer not null default 1,
  viewed_at   timestamptz not null default now(),
  notified_at timestamptz,
  primary key (user_id, business_id)
);

create index if not exists viewed_businesses_user_recent_idx on public.viewed_businesses (user_id, viewed_at desc);
create index if not exists viewed_businesses_business_idx on public.viewed_businesses (business_id);

alter table public.viewed_businesses enable row level security;

drop policy if exists "viewed businesses: own read" on public.viewed_businesses;
create policy "viewed businesses: own read"
  on public.viewed_businesses for select
  using (auth.uid() = user_id);

-- No insert/update policy — written only by the security-definer RPC below.

-- ============================================================================
-- 2. increment_business_view — client calls this once per shop page open,
--    same shape as the existing increment_listing_view RPC.
-- ============================================================================
create or replace function public.increment_business_view(p_business_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null then
    insert into public.viewed_businesses (user_id, business_id, view_count, viewed_at)
    values (auth.uid(), p_business_id, 1, now())
    on conflict (user_id, business_id)
    do update set view_count = public.viewed_businesses.view_count + 1, viewed_at = now();
  end if;

  return json_build_object('ok', true);
exception when others then
  return json_build_object('ok', false);
end;
$$;

grant execute on function public.increment_business_view(uuid) to anon, authenticated;

-- ============================================================================
-- 3. run_shop_new_arrivals — poll job: notify users who viewed a shop that
--    has since posted new active listings they haven't seen.
-- ============================================================================
create or replace function public.run_shop_new_arrivals()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  rec record;
  v_new_count integer;
  v_count integer := 0;
begin
  for rec in
    select vb.user_id, vb.business_id, vb.viewed_at, b.name as business_name
    from public.viewed_businesses vb
    join public.businesses b on b.id = vb.business_id
    where b.status = 'active'
      and (vb.notified_at is null or vb.notified_at < now() - interval '3 days')
      and public.under_daily_engagement_cap(vb.user_id)
    limit 300
  loop
    select count(*) into v_new_count
    from public.listings l
    where l.business_id = rec.business_id
      and l.status = 'active'
      and l.seller_id <> rec.user_id
      and l.created_at > rec.viewed_at;

    if v_new_count is null or v_new_count < 1 then
      continue;
    end if;

    begin
      insert into public.scheduled_notifications (target, title, body, type, deep_link, scheduled_for)
      values (
        rec.user_id::text,
        '🛍️ New arrivals at ' || rec.business_name,
        v_new_count || ' new listing' || (case when v_new_count = 1 then '' else 's' end)
          || ' just went live at ' || rec.business_name || '. Take a look.',
        'shop_new_arrivals', 'BusinessShop?id=' || rec.business_id, now()
      );
      update public.viewed_businesses
        set notified_at = now()
        where user_id = rec.user_id and business_id = rec.business_id;
      v_count := v_count + 1;
    exception when others then
      raise warning 'run_shop_new_arrivals: failed for user % / business %: %', rec.user_id, rec.business_id, sqlerrm;
    end;
  end loop;
  return jsonb_build_object('notified', v_count);
end;
$$;

revoke all on function public.run_shop_new_arrivals() from public, anon, authenticated;
grant execute on function public.run_shop_new_arrivals() to service_role;

-- ============================================================================
-- 4. run_category_digest — poll job: notify users who repeatedly browsed a
--    category but never set up a saved search for it ("New Jobs near you").
-- ============================================================================
create table if not exists public._category_digest_cooldown (
  user_id     uuid not null,
  category    text not null,
  notified_at timestamptz not null default now(),
  primary key (user_id, category)
);

alter table public._category_digest_cooldown enable row level security;
-- No policies — service_role (security definer functions) only; RLS with zero
-- policies denies all direct client access by default.

create or replace function public.run_category_digest()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  rec record;
  v_new_count integer;
  v_city text;
  v_count integer := 0;
begin

  for rec in
    select vl.user_id, vl.category, max(vl.viewed_at) as last_viewed, count(*) as view_count
    from public.viewed_listings vl
    where vl.viewed_at >= now() - interval '14 days'
    group by vl.user_id, vl.category
    having count(*) >= 2
    limit 500
  loop
    if not public.under_daily_engagement_cap(rec.user_id) then
      continue;
    end if;

    if exists (
      select 1 from public.saved_searches ss
      where ss.user_id = rec.user_id
        and ss.category = rec.category
    ) then
      continue;
    end if;

    if exists (
      select 1 from public._category_digest_cooldown c
      where c.user_id = rec.user_id and c.category = rec.category
        and c.notified_at >= now() - interval '3 days'
    ) then
      continue;
    end if;

    select count(*) into v_new_count
    from public.listings l
    where l.category = rec.category
      and l.status = 'active'
      and l.seller_id <> rec.user_id
      and l.created_at >= now() - interval '14 days'
      and not exists (
        select 1 from public.viewed_listings vl2
        where vl2.user_id = rec.user_id and vl2.listing_id = l.id
      );

    if v_new_count is null or v_new_count < 1 then
      continue;
    end if;

    select l.city into v_city
    from public.listings l
    where l.category = rec.category and l.status = 'active'
    order by l.created_at desc limit 1;

    begin
      insert into public.scheduled_notifications (target, title, body, type, deep_link, scheduled_for)
      values (
        rec.user_id::text,
        '🔥 New ' || rec.category || ' listings near you',
        v_new_count || ' new ' || rec.category || ' ad' || (case when v_new_count = 1 then '' else 's' end)
          || coalesce(' in ' || v_city, '') || ' since you last checked.',
        'category_digest', 'BusinessSearch?cat=' || rec.category, now()
      );
      insert into public._category_digest_cooldown (user_id, category, notified_at)
      values (rec.user_id, rec.category, now())
      on conflict (user_id, category) do update set notified_at = now();
      v_count := v_count + 1;
    exception when others then
      raise warning 'run_category_digest: failed for user % / category %: %', rec.user_id, rec.category, sqlerrm;
    end;
  end loop;
  return jsonb_build_object('notified', v_count);
end;
$$;

revoke all on function public.run_category_digest() from public, anon, authenticated;
grant execute on function public.run_category_digest() to service_role;

-- ============================================================================
-- 5. run_verification_nudge — gentle one-off "verify in 60 seconds" reminder.
-- ============================================================================
alter table public.profiles
  add column if not exists last_verification_nudge_at timestamptz;

create or replace function public.run_verification_nudge()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  rec record;
  v_count integer := 0;
begin
  for rec in
    select id
    from public.profiles
    where coalesce(verified, false) = false
      and coalesce(verification_pending, false) = false
      and created_at <= now() - interval '3 days'
      and (last_verification_nudge_at is null or last_verification_nudge_at < now() - interval '7 days')
    limit 300
  loop
    begin
      insert into public.scheduled_notifications (target, title, body, type, deep_link, scheduled_for)
      values (
        rec.id::text,
        '🪪 Verify your account in 60 seconds',
        'Get the trust badge and start selling faster — buyers trust verified sellers more.',
        'verification_nudge', 'Account', now()
      );
      update public.profiles set last_verification_nudge_at = now() where id = rec.id;
      v_count := v_count + 1;
    exception when others then
      raise warning 'run_verification_nudge: failed for user %: %', rec.id, sqlerrm;
    end;
  end loop;
  return jsonb_build_object('notified', v_count);
end;
$$;

revoke all on function public.run_verification_nudge() from public, anon, authenticated;
grant execute on function public.run_verification_nudge() to service_role;

commit;

-- ============================================================================
-- Verification (run manually, not part of the migration):
--
--   select run_shop_new_arrivals();
--   select run_category_digest();
--   select run_verification_nudge();
--
--   -- confirm the daily cap actually blocks a 3rd proactive push:
--   select public.under_daily_engagement_cap('<some user id>'::uuid);
-- ============================================================================
