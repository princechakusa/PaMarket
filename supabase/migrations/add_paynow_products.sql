-- =============================================================
-- PaMarket: extend Paynow website payments beyond listing boosts
--
-- add_paynow_boosts.sql created paynow_payments as a boost-only ledger.
-- The website now also sells, via Paynow:
--   * shop featured-slot packs  (featured_slot_pack_1 $2, _3 $5)
--   * job posting credit packs  (job_credit_pack_1 $3, _5 $12)
--
-- Rather than invent parallel entitlement tables, the Paynow Edge Function
-- grants these into the SAME tables the Android app already uses
-- (public.featured_slot_packs, public.job_credit_packs) with a synthetic
-- purchase_token of 'paynow:<reference>'. That keeps a business's featured-
-- slot balance and a recruiter's job-credit balance identical whether the
-- purchase happened in the app (Google Play) or on the web (Paynow) — the
-- app's existing get_job_credit_balance() / featured-slot summing counts
-- both automatically.
--
-- paynow_payments stays the money ledger; this migration just widens it so
-- one row can represent any of the three product families.
-- =============================================================

-- 1. Widen the product_id whitelist to the new families.
alter table public.paynow_payments
  drop constraint if exists paynow_payments_product_id_check;
alter table public.paynow_payments
  add constraint paynow_payments_product_id_check
  check (product_id in (
    'boost_1day', 'boost_7day', 'boost_30day',
    'job_boost_7day', 'job_boost_30day',
    'featured_slot_pack_1', 'featured_slot_pack_3',
    'job_credit_pack_1', 'job_credit_pack_5'
  ));

-- 2. A boost targets a listing; a slot pack targets a business; a job-credit
--    pack targets only the buyer. Make listing_id optional and add the other
--    two optional targets.
alter table public.paynow_payments alter column listing_id drop not null;
alter table public.paynow_payments
  add column if not exists business_id uuid references public.businesses(id) on delete cascade;
-- target_id points at the row created in featured_slot_packs / job_credit_packs
-- once payment is confirmed, so a retried activation is idempotent.
alter table public.paynow_payments
  add column if not exists target_id uuid;

create index if not exists paynow_payments_business_idx on public.paynow_payments (business_id);

notify pgrst, 'reload schema';
