-- =============================================================
-- PaMarket: activate_play_boost RPC
--
-- Grants a listing boost from a VERIFIED Google Play purchase. This is
-- the server-side replacement for the wallet-debit branch of the old
-- apply_listing_boost RPC — no wallet_usd is touched here at all.
--
-- SECURITY: this function is intentionally NOT granted to `authenticated`.
-- It is only callable via the service-role key, which only the
-- verify-play-purchase Edge Function holds. A signed-in user calling
-- this RPC directly (bypassing purchase verification) gets a permission
-- error — there is no client-trusted path to a boosted listing.
--
-- Idempotent: if play_purchases.status is already 'consumed' for this
-- token, the boost is not re-applied (guards against the Edge Function
-- being invoked twice for the same token, e.g. a client retry).
-- =============================================================

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
    when 'boost_1day'  then 1
    when 'boost_7day'  then 7
    when 'boost_30day' then 30
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

-- Deliberately NOT granted to `authenticated` — service-role only (the
-- Edge Function's client uses the service-role key, which bypasses grants
-- entirely, but revoking from authenticated/anon makes the intent explicit
-- and blocks any direct RPC call from the app).
revoke execute on function public.activate_play_boost(uuid) from public;
revoke execute on function public.activate_play_boost(uuid) from authenticated;
revoke execute on function public.activate_play_boost(uuid) from anon;

notify pgrst, 'reload schema';
