-- =============================================================
-- PAmarket: apply_listing_boost RPC
-- Atomically deducts wallet_usd and applies boost + featured_until
-- on a listing the caller owns. Idempotent — safe to run multiple times.
-- =============================================================

-- Ensure featured_until column exists (added by businesses migration)
alter table public.listings
  add column if not exists featured_until timestamptz;

-- ─────────────────────────────────────────────────────────────
-- apply_listing_boost(listing_id, days)
--   • Validates caller owns the listing
--   • Validates days is one of the allowed durations
--   • Atomically deducts wallet and sets boost
--   • Returns jsonb: {ok, charged, balance, until} or {ok:false, msg}
-- ─────────────────────────────────────────────────────────────
create or replace function public.apply_listing_boost(
  p_listing_id text,
  p_days       int
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_price  numeric;
  v_wallet numeric;
  v_until  timestamptz;
begin
  -- Validate duration
  if p_days not in (1, 7, 30) then
    return jsonb_build_object('ok', false, 'msg', 'Invalid duration');
  end if;

  -- $2/day
  v_price := p_days * 2.0;

  -- Verify listing belongs to caller
  if not exists (
    select 1 from public.listings
    where id::text = p_listing_id
      and seller_id = auth.uid()
  ) then
    return jsonb_build_object('ok', false, 'msg', 'Listing not found or not yours');
  end if;

  -- Read wallet balance
  select coalesce(wallet_usd, 0) into v_wallet
  from public.profiles
  where id = auth.uid();

  if v_wallet < v_price then
    return jsonb_build_object(
      'ok',       false,
      'msg',      'Insufficient balance',
      'balance',  v_wallet,
      'required', v_price
    );
  end if;

  -- Deduct wallet (second check guards against concurrent requests)
  update public.profiles
  set wallet_usd = wallet_usd - v_price
  where id = auth.uid()
    and coalesce(wallet_usd, 0) >= v_price;

  if not found then
    return jsonb_build_object('ok', false, 'msg', 'Insufficient balance');
  end if;

  -- Extend or set the boost; if already boosted, extend from current expiry
  select coalesce(
    case when featured_until > now() then featured_until else now() end,
    now()
  ) + (p_days || ' days')::interval
  into v_until
  from public.listings
  where id::text = p_listing_id;

  update public.listings
  set boost          = 'true'::jsonb,
      featured_until = v_until
  where id::text = p_listing_id;

  return jsonb_build_object(
    'ok',      true,
    'charged', v_price,
    'balance', v_wallet - v_price,
    'until',   v_until
  );
end;
$$;

revoke execute on function public.apply_listing_boost(text, int) from public;
grant  execute on function public.apply_listing_boost(text, int) to authenticated;

notify pgrst, 'reload schema';
