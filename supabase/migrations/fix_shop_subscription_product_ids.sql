-- =============================================================
-- PaMarket: fix shop subscription product_id mismatch
--
-- Root cause of "Could not load plan pricing" on the business subscription
-- screen: play_subscriptions.product_id (and the client/server catalogues)
-- expected 'shop_starter_monthly' etc., but the actual Google Play Console
-- products created were 'shop_starter' / 'shop_pro' / 'shop_premium' (the
-- monthly/yearly distinction lives in the BASE PLAN under each product, not
-- in the product id itself — Play Billing subscriptions have Product ID +
-- Base Plan ID as two separate identifiers). getAvailableProducts() was
-- asking Google for productIds that don't exist, so it always returned
-- empty and no purchase flow could ever start.
--
-- This migration only relaxes the CHECK constraint to match the real
-- product ids — www/js/billing-products.js and
-- supabase/functions/_shared/billing-products.ts were updated in the same
-- change to match. No data migration needed: no real rows exist yet using
-- the old (never-purchasable) ids.
-- =============================================================

alter table public.play_subscriptions drop constraint if exists play_subscriptions_product_id_check;
alter table public.play_subscriptions add constraint play_subscriptions_product_id_check
  check (product_id in ('shop_starter', 'shop_pro', 'shop_premium'));

notify pgrst, 'reload schema';
