-- =============================================================
-- PaMarket: Google Play Billing — business subscription purchases
--
-- Replaces the WhatsApp + admin-approval upgrade flow with real Google
-- Play subscription products. Mirrors the play_purchases pattern used
-- for listing boosts (see add_play_purchases.sql), but tracks recurring
-- subscription state (renewals/cancellations/grace periods) instead of
-- a one-shot consumable.
--
-- Lifecycle is kept current two ways:
--   1. Synchronous verification at purchase/upgrade time (the
--      verify-play-subscription Edge Function).
--   2. Real-Time Developer Notifications (RTDN) via Pub/Sub, delivered
--      to the play-rtdn-webhook Edge Function, which is the source of
--      truth for renewals/cancellations/billing-retry that happen on
--      Google's schedule while the app isn't open.
--   3. A lightweight reconciliation poll (Android Publisher API) each
--      time the owner opens their Subscription/Billing screen, as a
--      fallback safety check if an RTDN event was ever missed.
-- =============================================================

create table if not exists public.play_subscriptions (
  id                  uuid primary key default gen_random_uuid(),
  business_id         uuid not null references public.businesses(id) on delete cascade,
  user_id             uuid not null references auth.users(id) on delete cascade,

  -- Google Play identifiers
  product_id          text not null
                        check (product_id in (
                          'shop_starter_monthly','shop_starter_yearly',
                          'shop_pro_monthly','shop_pro_yearly',
                          'shop_premium_monthly','shop_premium_yearly'
                        )),
  purchase_token      text not null,
  order_id            text,

  -- Derived plan (kept denormalized so business_subscriptions/entitlement
  -- code doesn't need to know the Play product-id naming scheme)
  plan_id             text not null check (plan_id in ('starter','pro','premium')),
  billing_cycle       text not null check (billing_cycle in ('monthly','yearly')),

  -- Verification lifecycle for THIS purchase token (distinct from the
  -- subscription's own billing status below — a token can be verified
  -- once and then the subscription renews many times under the same token
  -- until the user resubscribes, per Play Billing's subscription model)
  status              text not null default 'pending'
                        check (status in ('pending', 'verified', 'failed')),
  verification_error  text,

  -- Google's subscription lifecycle state — this is what actually gates
  -- entitlement, updated by RTDN events and the reconciliation poll.
  -- SUBSCRIPTION_STATE_* per the Android Publisher API v3 subscriptionsv2 resource.
  subscription_state  text not null default 'pending'
                        check (subscription_state in (
                          'pending', 'active', 'in_grace_period',
                          'on_hold', 'canceled', 'expired', 'paused'
                        )),
  auto_renewing       boolean not null default true,

  purchase_time       timestamptz,
  expiry_time         timestamptz,

  created_at          timestamptz not null default now(),
  verified_at         timestamptz,
  updated_at          timestamptz not null default now(),

  constraint uq_play_subscription_token unique (purchase_token)
);

create index if not exists play_subs_business_idx on public.play_subscriptions (business_id, created_at desc);
create index if not exists play_subs_user_idx on public.play_subscriptions (user_id);
create index if not exists play_subs_state_idx on public.play_subscriptions (subscription_state);

-- One row is "the current subscription" per business at a time — a business
-- resubscribing gets a new purchase_token (new row); the old one is marked
-- expired/canceled by the RTDN handler rather than deleted, preserving history.
create unique index if not exists play_subs_one_active_idx
  on public.play_subscriptions (business_id)
  where subscription_state in ('active', 'in_grace_period', 'on_hold', 'pending');

drop trigger if exists play_subscriptions_set_updated_at on public.play_subscriptions;
create trigger play_subscriptions_set_updated_at
  before update on public.play_subscriptions
  for each row execute function public.set_updated_at();

alter table public.play_subscriptions enable row level security;

-- Read-only for the business owner (billing/receipt transparency) — same
-- reasoning as play_purchases: no client INSERT/UPDATE policy exists at
-- all, so every write happens through the service-role key inside the
-- verify-play-subscription / play-rtdn-webhook Edge Functions.
drop policy if exists "play_subscriptions: owner read" on public.play_subscriptions;
create policy "play_subscriptions: owner read"
  on public.play_subscriptions for select
  using (
    exists (
      select 1 from public.businesses b
      where b.id = business_id and b.owner_user_id = auth.uid()
    )
  );

drop policy if exists "play_subscriptions: admin all" on public.play_subscriptions;
create policy "play_subscriptions: admin all"
  on public.play_subscriptions for all
  using (public.is_admin())
  with check (public.is_admin());
