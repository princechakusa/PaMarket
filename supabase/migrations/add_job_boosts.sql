-- =============================================================
-- PaMarket: Google Play Billing — job listing boosts
--
-- Job posts are rows in the same `listings` table regular boosts already
-- target (cat='jobs'), and the boost mechanism (extend listings.featured_until,
-- set listings.boost) is identical — so this reuses play_purchases +
-- activate_play_boost wholesale rather than duplicating a parallel table/RPC.
-- Only two things change: the product_id CHECK constraint gains the two new
-- ids, and activate_play_boost's day-mapping CASE gains two new branches.
-- =============================================================

alter table public.play_purchases drop constraint if exists play_purchases_product_id_check;
alter table public.play_purchases add constraint play_purchases_product_id_check
  check (product_id in ('boost_1day', 'boost_7day', 'boost_30day', 'job_boost_7day', 'job_boost_30day'));

create or replace function public.activate_play_boost(
  p_purchase_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_purchase record;
  v_days     int;
  v_until    timestamptz;
begin
  select * into v_purchase
  from public.play_purchases
  where id = p_purchase_id
  for update; -- lock the row so two concurrent calls can't both pass the status check

  if v_purchase is null then
    return jsonb_build_object('ok', false, 'msg', 'Purchase record not found');
  end if;

  if v_purchase.status = 'consumed' then
    -- Already activated — return success (idempotent) rather than erroring,
    -- so a duplicate Edge Function invocation for the same token is harmless.
    return jsonb_build_object('ok', true, 'already_consumed', true, 'until', v_purchase.expiry_time);
  end if;

  if v_purchase.status != 'verified' then
    return jsonb_build_object('ok', false, 'msg', 'Purchase is not in a verified state: ' || v_purchase.status);
  end if;

  v_days := case v_purchase.product_id
    when 'boost_1day'      then 1
    when 'boost_7day'      then 7
    when 'boost_30day'     then 30
    when 'job_boost_7day'  then 7
    when 'job_boost_30day' then 30
    else null
  end;

  if v_days is null then
    return jsonb_build_object('ok', false, 'msg', 'Unknown product_id: ' || v_purchase.product_id);
  end if;

  -- Extend from current expiry if the listing is already boosted, same
  -- "stacking extends, never resets" behavior as the original wallet RPC.
  select coalesce(
    case when featured_until > now() then featured_until else now() end,
    now()
  ) + (v_days || ' days')::interval
  into v_until
  from public.listings
  where id = v_purchase.listing_id;

  if v_until is null then
    return jsonb_build_object('ok', false, 'msg', 'Listing not found');
  end if;

  update public.listings
  set boost          = 'true'::jsonb,
      featured_until = v_until
  where id = v_purchase.listing_id;

  update public.play_purchases
  set status      = 'consumed',
      expiry_time = v_until
  where id = p_purchase_id;

  return jsonb_build_object('ok', true, 'until', v_until, 'days', v_days);
end;
$$;

revoke execute on function public.activate_play_boost(uuid) from public;
revoke execute on function public.activate_play_boost(uuid) from authenticated;
revoke execute on function public.activate_play_boost(uuid) from anon;

notify pgrst, 'reload schema';
