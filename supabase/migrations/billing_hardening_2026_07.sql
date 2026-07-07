-- =============================================================
-- PaMarket: Billing hardening (2026-07 audit)
--
-- 1. Drop play_subs_one_active_idx — the partial UNIQUE index on
--    (business_id) for active-ish states rejects the ledger insert for a
--    plan UPGRADE: Google issues a NEW purchase token while the old row is
--    still 'active' (the RTDN that expires it arrives asynchronously), so
--    the verified upgrade purchase could never be recorded. "Current
--    subscription" is resolved as the latest active-state row instead.
--    (add_recruiter_subscriptions.sql already ships without its equivalent.)
--
-- 2. Add a 'refunded' terminal status to every consumable purchase ledger,
--    plus revoke_play_purchase(): called by play-rtdn-webhook when Google
--    reports a voided/refunded one-time purchase, so a refunded buyer does
--    not keep the entitlement. Service-role only.
--
-- 3. expire_lapsed_play_subscriptions(): server-side sweep that downgrades
--    subscriptions whose expiry_time is > 3 days past while still recorded
--    as active — the safety net for a missed RTDN when the owner never
--    reopens their billing screen (the client reconcile poll only runs
--    there). 3-day grace avoids downgrading a paying user whose renewal
--    RTDN is merely delayed. Optionally scheduled via pg_cron if available.
-- =============================================================

-- ── 1. one-active index → non-unique lookup index ─────────────────────
drop index if exists public.play_subs_one_active_idx;
create index if not exists play_subs_active_lookup_idx
  on public.play_subscriptions (business_id, created_at desc)
  where subscription_state in ('active', 'in_grace_period', 'on_hold', 'pending');

-- ── 2a. 'refunded' status on all consumable ledgers ────────────────────
alter table public.play_purchases drop constraint if exists play_purchases_status_check;
alter table public.play_purchases add constraint play_purchases_status_check
  check (status in ('pending', 'verified', 'failed', 'consumed', 'refunded'));

alter table public.featured_slot_packs drop constraint if exists featured_slot_packs_status_check;
alter table public.featured_slot_packs add constraint featured_slot_packs_status_check
  check (status in ('pending', 'verified', 'failed', 'consumed', 'refunded'));

alter table public.job_credit_packs drop constraint if exists job_credit_packs_status_check;
alter table public.job_credit_packs add constraint job_credit_packs_status_check
  check (status in ('pending', 'verified', 'failed', 'consumed', 'refunded'));

alter table public.rental_featured_slot_packs drop constraint if exists rental_featured_slot_packs_status_check;
alter table public.rental_featured_slot_packs add constraint rental_featured_slot_packs_status_check
  check (status in ('pending', 'verified', 'failed', 'consumed', 'refunded'));

-- ── 2b. revoke_play_purchase ───────────────────────────────────────────
-- Reverses the entitlement a consumed purchase granted, identified by its
-- Google purchase token (which is all a voidedPurchaseNotification carries).
-- Idempotent: a second call for the same token is a no-op.
--   boost           → subtract the purchased days from listings.featured_until
--                     (boosts stack additively, so subtraction is the exact
--                     inverse); clear the boost flag if no time remains.
--   slot pack       → status 'refunded' (fetchExtraFeaturedSlots only counts
--                     'consumed', so the extra slots vanish on next read).
--   job credit pack → status 'refunded' (get_job_credit_balance only counts
--                     'consumed'; balance may go negative if already spent,
--                     which correctly blocks further credit posts).
--   rental featured → status 'refunded' + shrink/deactivate the purchased
--                     (approved_by is null) featured row for that listing.
create or replace function public.revoke_play_purchase(p_purchase_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row record;
  v_days int;
  v_new_until timestamptz;
begin
  -- Listing / job boosts
  select * into v_row from public.play_purchases where purchase_token = p_purchase_token for update;
  if found then
    if v_row.status != 'consumed' then
      update public.play_purchases set status = 'refunded' where id = v_row.id and status != 'refunded';
      return jsonb_build_object('ok', true, 'kind', 'boost', 'reverted', false);
    end if;
    v_days := case v_row.product_id
      when 'boost_1day' then 1 when 'boost_7day' then 7 when 'boost_30day' then 30
      when 'job_boost_7day' then 7 when 'job_boost_30day' then 30 else 0 end;
    update public.listings
    set featured_until = featured_until - (v_days || ' days')::interval
    where id = v_row.listing_id and featured_until is not null
    returning featured_until into v_new_until;
    if v_new_until is not null and v_new_until <= now() then
      update public.listings set boost = null where id = v_row.listing_id;
    end if;
    update public.play_purchases set status = 'refunded', expiry_time = v_new_until where id = v_row.id;
    return jsonb_build_object('ok', true, 'kind', 'boost', 'reverted', true);
  end if;

  -- Business featured slot packs
  select * into v_row from public.featured_slot_packs where purchase_token = p_purchase_token for update;
  if found then
    update public.featured_slot_packs set status = 'refunded' where id = v_row.id;
    return jsonb_build_object('ok', true, 'kind', 'slot_pack', 'reverted', v_row.status = 'consumed');
  end if;

  -- Job credit packs
  select * into v_row from public.job_credit_packs where purchase_token = p_purchase_token for update;
  if found then
    update public.job_credit_packs set status = 'refunded' where id = v_row.id;
    return jsonb_build_object('ok', true, 'kind', 'job_credits', 'reverted', v_row.status = 'consumed');
  end if;

  -- Rental featured placements
  select * into v_row from public.rental_featured_slot_packs where purchase_token = p_purchase_token for update;
  if found then
    if v_row.status = 'consumed' then
      update public.rental_featured_listings
      set ends_at = ends_at - (v_row.duration_days || ' days')::interval
      where listing_id = v_row.listing_id and approved_by is null and is_active = true;
      update public.rental_featured_listings
      set is_active = false
      where listing_id = v_row.listing_id and approved_by is null and is_active = true and ends_at <= now();
    end if;
    update public.rental_featured_slot_packs set status = 'refunded' where id = v_row.id;
    return jsonb_build_object('ok', true, 'kind', 'rental_featured', 'reverted', v_row.status = 'consumed');
  end if;

  return jsonb_build_object('ok', true, 'kind', 'unknown_token', 'reverted', false);
end;
$$;

revoke execute on function public.revoke_play_purchase(text) from public;
revoke execute on function public.revoke_play_purchase(text) from authenticated;
revoke execute on function public.revoke_play_purchase(text) from anon;

-- ── 3. lapsed-subscription sweep ───────────────────────────────────────
create or replace function public.expire_lapsed_play_subscriptions()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_biz int := 0;
  v_rec int := 0;
  r record;
begin
  -- Shop subscriptions
  for r in
    select id, business_id from public.play_subscriptions
    where subscription_state in ('active', 'in_grace_period')
      and expiry_time is not null and expiry_time < now() - interval '3 days'
    for update skip locked
  loop
    update public.play_subscriptions set subscription_state = 'expired' where id = r.id;
    -- Only downgrade if no OTHER still-current play subscription exists
    -- for this business (e.g. an upgrade replaced this token).
    if not exists (
      select 1 from public.play_subscriptions
      where business_id = r.business_id and id != r.id
        and subscription_state in ('active', 'in_grace_period')
        and (expiry_time is null or expiry_time > now())
    ) then
      update public.business_subscriptions set status = 'expired'
      where business_id = r.business_id and status = 'active';
      update public.businesses set plan_id = 'free' where id = r.business_id;
    end if;
    v_biz := v_biz + 1;
  end loop;

  -- Recruiter subscriptions
  for r in
    select id, recruiter_id from public.play_recruiter_subscriptions
    where subscription_state in ('active', 'in_grace_period')
      and expiry_time is not null and expiry_time < now() - interval '3 days'
    for update skip locked
  loop
    update public.play_recruiter_subscriptions set subscription_state = 'expired' where id = r.id;
    if not exists (
      select 1 from public.play_recruiter_subscriptions
      where recruiter_id = r.recruiter_id and id != r.id
        and subscription_state in ('active', 'in_grace_period')
        and (expiry_time is null or expiry_time > now())
    ) then
      update public.recruiter_subscriptions set status = 'expired'
      where recruiter_id = r.recruiter_id and status = 'active';
      update public.recruiter_profiles set plan_id = 'free' where id = r.recruiter_id;
    end if;
    v_rec := v_rec + 1;
  end loop;

  return jsonb_build_object('ok', true, 'business_expired', v_biz, 'recruiter_expired', v_rec);
end;
$$;

revoke execute on function public.expire_lapsed_play_subscriptions() from public;
revoke execute on function public.expire_lapsed_play_subscriptions() from authenticated;
revoke execute on function public.expire_lapsed_play_subscriptions() from anon;

-- Schedule daily via pg_cron when available (Supabase: Database → Extensions
-- → enable pg_cron first if this block reports it is missing).
do $cron$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'expire-lapsed-play-subscriptions',
      '15 3 * * *',
      'select public.expire_lapsed_play_subscriptions()'
    );
    raise notice 'pg_cron: scheduled expire-lapsed-play-subscriptions daily at 03:15 UTC';
  else
    raise notice 'pg_cron not installed — run select public.expire_lapsed_play_subscriptions() periodically yourself, or enable pg_cron and re-run this file.';
  end if;
exception when others then
  raise notice 'pg_cron scheduling skipped: %', sqlerrm;
end
$cron$;

notify pgrst, 'reload schema';
