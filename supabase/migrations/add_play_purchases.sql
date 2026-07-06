-- =============================================================
-- PaMarket: Google Play Billing — consumable listing boost purchases
--
-- Replaces the wallet_usd-funded apply_listing_boost RPC with a real
-- Google Play Billing consumable purchase flow. This table is the
-- server-side ledger of every purchase token the client reports, and
-- is the single source of truth for whether a purchase has already
-- been consumed (idempotency / anti-replay).
--
-- The client NEVER grants its own entitlement. It reports a purchase
-- token to the verify-play-purchase Edge Function, which calls the
-- Google Play Developer API (server-to-server, using a service-account
-- JWT) to confirm the purchase is real and unconsumed, THEN activates
-- the boost. No code path activates a boost from client-supplied data
-- alone.
-- =============================================================

create table if not exists public.play_purchases (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  listing_id      uuid not null references public.listings(id) on delete cascade,

  -- Google Play identifiers
  product_id      text not null check (product_id in ('boost_1day', 'boost_7day', 'boost_30day')),
  purchase_token  text not null,
  order_id        text,

  -- Verification lifecycle
  status          text not null default 'pending'
                    check (status in ('pending', 'verified', 'failed', 'consumed')),
  verification_error text,

  -- Timestamps (purchase_time comes from Google; expiry_time is when the
  -- boost this purchase grants stops being effective)
  purchase_time   timestamptz,
  expiry_time     timestamptz,

  created_at      timestamptz not null default now(),
  verified_at     timestamptz,

  -- A given purchase token can only ever be processed once — this is the
  -- database-level anti-replay guarantee (belt-and-braces alongside the
  -- Edge Function's own pre-check).
  constraint uq_play_purchase_token unique (purchase_token)
);

create index if not exists play_purchases_user_idx on public.play_purchases (user_id, created_at desc);
create index if not exists play_purchases_listing_idx on public.play_purchases (listing_id);
create index if not exists play_purchases_status_idx on public.play_purchases (status);

alter table public.play_purchases enable row level security;

-- Users can see their own purchase history (billing/receipt transparency)
-- but can NEVER insert or update a row themselves — every write happens
-- through the verify-play-purchase Edge Function using the service-role
-- key, which bypasses RLS. This is what makes client-side trust impossible:
-- there is no INSERT/UPDATE policy for `authenticated` at all.
drop policy if exists "play_purchases: own read" on public.play_purchases;
create policy "play_purchases: own read"
  on public.play_purchases for select
  using (auth.uid() = user_id);

drop policy if exists "play_purchases: admin all" on public.play_purchases;
create policy "play_purchases: admin all"
  on public.play_purchases for all
  using (public.is_admin())
  with check (public.is_admin());
