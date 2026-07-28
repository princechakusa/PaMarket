-- Adds Apple/App Store Server API support to the existing purchase-ledger
-- tables, reusing them (and their activation RPCs) for BOTH platforms rather
-- than duplicating six tables + six RPCs. The activation RPCs
-- (activate_play_boost, activate_play_subscription, activate_recruiter_
-- subscription, activate_featured_slot_pack, activate_job_credit_pack,
-- activate_rental_featured_slot_pack) only ever read the ledger row by id
-- and write the entitlement — none of them call out to Google, so they are
-- already platform-agnostic and need no changes.
--
-- `purchase_token` already exists as a generic unique text column on every
-- one of these tables — for an Apple purchase, the mobile client stores
-- StoreKit's transaction JWS representation there (one-time products) or
-- the subscription's `originalTransactionId` (subscriptions, since that's
-- the STABLE identifier across renewals, unlike `transactionId` which
-- changes on every renewal). No column rename needed; `platform` alone
-- disambiguates which verification path (Google Play vs Apple Server API)
-- a given row was verified through.
--
-- Idempotent. Run once in the Supabase SQL Editor, after all the existing
-- add_play_*/add_*_packs/add_job_credits/add_recruiter_subscriptions/
-- add_rental_featured_slot_packs migrations.

do $$
declare
  t text;
begin
  foreach t in array array[
    'play_purchases',
    'play_subscriptions',
    'play_recruiter_subscriptions',
    'featured_slot_packs',
    'job_credit_packs',
    'rental_featured_slot_packs'
  ]
  loop
    execute format(
      'alter table public.%I add column if not exists platform text not null default ''android''',
      t
    );
    execute format(
      'alter table public.%I drop constraint if exists %I_platform_check',
      t, t
    );
    execute format(
      'alter table public.%I add constraint %I_platform_check check (platform in (''android'',''ios''))',
      t, t
    );
  end loop;
end $$;

-- Apple's App Store Server Notifications V2 payload doesn't send a
-- purchase_token-shaped receipt for lifecycle events (renewal, cancel,
-- refund) the way Google's RTDN does — it identifies a subscription by
-- `originalTransactionId`. That's exactly what verify-apple-subscription
-- stores in purchase_token for subscription rows, so the webhook can look
-- up the same row the same way play-rtdn-webhook does — no schema
-- difference needed there either.

notify pgrst, 'reload schema';

-- Verification (run manually):
--   select column_name, data_type, is_nullable, column_default
--   from information_schema.columns
--   where table_schema = 'public' and column_name = 'platform'
--     and table_name in ('play_purchases','play_subscriptions','play_recruiter_subscriptions',
--                         'featured_slot_packs','job_credit_packs','rental_featured_slot_packs')
--   order by table_name;
--   -- expect 6 rows, all platform=text, not null, default 'android'
