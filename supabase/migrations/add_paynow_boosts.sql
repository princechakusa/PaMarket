-- =============================================================
-- PaMarket: Paynow-funded listing boosts (website checkout)
--
-- The Android app sells boosts through Google Play Billing
-- (play_purchases + activate_play_boost). The public WEBSITE cannot use
-- Play Billing, so this adds a parallel, equally locked-down path funded
-- through Paynow (EcoCash / OneMoney / cards — paynow.co.zw).
--
-- Architecture mirrors play_purchases exactly:
--   * paynow_payments is the server-side ledger. Clients can read their
--     own rows (receipt transparency) but there is NO INSERT/UPDATE
--     policy for authenticated at all — every write happens through the
--     paynow-create-payment / paynow-check-payment Edge Functions using
--     the service-role key.
--   * activate_paynow_boost is service-role only. A signed-in user
--     calling it directly gets a permission error. The ONLY path to a
--     boosted listing is: Paynow confirms payment server-side (hash-
--     verified poll of the transaction's poll URL) → Edge Function marks
--     the ledger row 'paid' → this RPC stacks featured_until.
--
-- PRICING: amounts live in supabase/functions/_shared/paynow-products.ts
-- and MUST match the app's Google Play prices declared in
-- www/js/billing-products.js (boost_1day $2, boost_7day $10,
-- boost_30day $30, job_boost_7day $8, job_boost_30day $20). Keep the
-- three files in sync by hand — same rule as billing-products.ts.
-- =============================================================

create table if not exists public.paynow_payments (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  listing_id      uuid not null references public.listings(id) on delete cascade,

  product_id      text not null check (product_id in
                    ('boost_1day', 'boost_7day', 'boost_30day',
                     'job_boost_7day', 'job_boost_30day')),
  amount_usd      numeric(8,2) not null check (amount_usd > 0),

  -- Our merchant reference sent to Paynow (unique per attempt) and the
  -- transaction's poll URL returned by InitiateTransaction. The poll URL
  -- is the ONLY thing the check function trusts — never the browser
  -- redirect, never Paynow's status POST body on its own.
  reference       text not null,
  poll_url        text,
  paynow_reference text,

  status          text not null default 'created'
                    check (status in ('created', 'paid', 'failed', 'cancelled', 'consumed')),
  verification_error text,

  paid_at         timestamptz,
  expiry_time     timestamptz,   -- when the boost this payment granted ends
  created_at      timestamptz not null default now(),

  constraint uq_paynow_reference unique (reference)
);

create index if not exists paynow_payments_user_idx on public.paynow_payments (user_id, created_at desc);
create index if not exists paynow_payments_listing_idx on public.paynow_payments (listing_id);
create index if not exists paynow_payments_status_idx on public.paynow_payments (status);

alter table public.paynow_payments enable row level security;

-- Own-read only; zero client write policies (same trust model as
-- play_purchases — the Edge Functions' service-role key bypasses RLS).
drop policy if exists "paynow_payments: own read" on public.paynow_payments;
create policy "paynow_payments: own read"
  on public.paynow_payments for select
  using (auth.uid() = user_id);

drop policy if exists "paynow_payments: admin all" on public.paynow_payments;
create policy "paynow_payments: admin all"
  on public.paynow_payments for all
  using (public.is_admin())
  with check (public.is_admin());

-- =============================================================
-- activate_paynow_boost — the Paynow twin of activate_play_boost.
-- Same stacking rule ("extends, never resets"), same idempotency
-- (a 'consumed' row returns success without re-applying), service-role
-- only.
-- =============================================================
create or replace function public.activate_paynow_boost(
  p_payment_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment record;
  v_days    int;
  v_until   timestamptz;
begin
  select * into v_payment
  from public.paynow_payments
  where id = p_payment_id
  for update; -- lock so two concurrent check calls can't both activate

  if v_payment is null then
    return jsonb_build_object('ok', false, 'msg', 'Payment record not found');
  end if;

  if v_payment.status = 'consumed' then
    return jsonb_build_object('ok', true, 'already_consumed', true, 'until', v_payment.expiry_time);
  end if;

  if v_payment.status != 'paid' then
    return jsonb_build_object('ok', false, 'msg', 'Payment is not in a paid state: ' || v_payment.status);
  end if;

  v_days := case v_payment.product_id
    when 'boost_1day'      then 1
    when 'boost_7day'      then 7
    when 'boost_30day'     then 30
    when 'job_boost_7day'  then 7
    when 'job_boost_30day' then 30
    else null
  end;

  if v_days is null then
    return jsonb_build_object('ok', false, 'msg', 'Unknown product_id: ' || v_payment.product_id);
  end if;

  select coalesce(
    case when featured_until > now() then featured_until else now() end,
    now()
  ) + (v_days || ' days')::interval
  into v_until
  from public.listings
  where id = v_payment.listing_id;

  if v_until is null then
    return jsonb_build_object('ok', false, 'msg', 'Listing not found');
  end if;

  update public.listings
  set boost          = 'true'::jsonb,
      featured_until = v_until
  where id = v_payment.listing_id;

  update public.paynow_payments
  set status      = 'consumed',
      expiry_time = v_until
  where id = p_payment_id;

  return jsonb_build_object('ok', true, 'until', v_until, 'days', v_days);
end;
$$;

revoke execute on function public.activate_paynow_boost(uuid) from public;
revoke execute on function public.activate_paynow_boost(uuid) from authenticated;
revoke execute on function public.activate_paynow_boost(uuid) from anon;

notify pgrst, 'reload schema';
