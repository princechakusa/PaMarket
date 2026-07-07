// SINGLE SOURCE OF TRUTH — Google Play Billing product IDs (server side).
//
// Every product ID PaMarket sells (or plans to sell) through Google Play
// Billing is defined ONCE here for Edge Functions. verify-play-purchase and
// verify-play-subscription import from this file instead of hardcoding
// product IDs — no Edge Function should ever declare a Play product ID
// literal itself.
//
// This file has a mirror on the client: www/js/billing-products.js
// A Deno Edge Function can't load a browser <script> file directly, so the
// same product IDs are declared a second time there. THE TWO FILES MUST BE
// KEPT IN SYNC BY HAND — there is no build step generating one from the
// other in this project. If you add/remove/rename a product here, make the
// identical change in billing-products.js, and in the matching `product_id`
// CHECK constraint in the relevant supabase/migrations/*.sql file.
//
// ── ACTIVE vs PLANNED (production-safety boundary) ──────────────────────
// Every family below carries a `status` of 'active' or 'planned'.
//   'active'  — Edge Function + activation RPC + DB schema all exist and
//               are deployed. Safe to verify/activate.
//   'planned' — documented per the unified monetization design, but NO
//               backend exists yet (no Edge Function route, no RPC, no
//               migration, no Play Console product, no purchase UI).
//
// Edge Functions MUST go through isActiveProductId() / getActiveProduct() —
// never reference PLAY_PRODUCT_FAMILIES directly — so a 'planned' family's
// product id is structurally rejected even if a client somehow sent one.

export type ProductFamilyStatus = 'active' | 'planned';

interface ProductFamily<T> {
  status: ProductFamilyStatus;
  products: Record<string, T>;
}

// ═══════════════════════════════════════════════════════════
// ACTIVE — backend fully built (verify-play-purchase / verify-play-subscription)
// ═══════════════════════════════════════════════════════════

// Listing boosts (consumable). estimatedPriceUsd is a DISPLAY ESTIMATE only
// (e.g. admin revenue dashboard) — actual price is whatever is configured
// in Google Play Console, which this file cannot read.
// supabase/migrations/add_play_purchases.sql — product_id CHECK constraint
const BOOSTS: ProductFamily<{ days: number; estimatedPriceUsd: number }> = {
  status: 'active',
  products: {
    boost_1day:  { days: 1,  estimatedPriceUsd: 2 },
    boost_7day:  { days: 7,  estimatedPriceUsd: 10 },
    boost_30day: { days: 30, estimatedPriceUsd: 30 },
  },
};

// Business shop subscriptions.
// supabase/migrations/add_play_subscriptions.sql — product_id CHECK constraint.
// planId/cycle mirror H.BIZ_PLANS' ids in www/js/business-onboarding.js.
const SHOP_SUBSCRIPTIONS: ProductFamily<{ planId: string; cycle: string }> = {
  status: 'active',
  products: {
    shop_starter_monthly: { planId: 'starter', cycle: 'monthly' },
    shop_starter_yearly:  { planId: 'starter', cycle: 'yearly' },
    shop_pro_monthly:     { planId: 'pro',     cycle: 'monthly' },
    shop_pro_yearly:      { planId: 'pro',     cycle: 'yearly' },
    shop_premium_monthly: { planId: 'premium', cycle: 'monthly' },
    shop_premium_yearly:  { planId: 'premium', cycle: 'yearly' },
  },
};

// Extra featured-slot packs (consumable, shops). estimatedPriceUsd is a
// DISPLAY ESTIMATE only — see note on BOOSTS above.
// supabase/migrations/add_featured_slot_packs.sql — product_id CHECK constraint.
const SLOT_PACKS: ProductFamily<{ extraSlots: number; estimatedPriceUsd: number }> = {
  status: 'active',
  products: {
    featured_slot_pack_1: { extraSlots: 1, estimatedPriceUsd: 2 },
    featured_slot_pack_3: { extraSlots: 3, estimatedPriceUsd: 5 },
  },
};

// Recruiter subscriptions.
// supabase/migrations/add_recruiter_subscriptions.sql — product_id CHECK constraint.
const RECRUITER_SUBSCRIPTIONS: ProductFamily<{ planId: string; cycle: string }> = {
  status: 'active',
  products: {
    recruiter_monthly:     { planId: 'recruiter',     cycle: 'monthly' },
    recruiter_yearly:      { planId: 'recruiter',     cycle: 'yearly' },
    recruiter_pro_monthly: { planId: 'recruiter_pro', cycle: 'monthly' },
    recruiter_pro_yearly:  { planId: 'recruiter_pro', cycle: 'yearly' },
  },
};

// Job posting credit packs (consumable) — one credit spent per job posted
// beyond the recruiter plan's free post limit.
// supabase/migrations/add_job_credits.sql — product_id CHECK constraint.
const JOB_CREDITS: ProductFamily<{ credits: number }> = {
  status: 'active',
  products: {
    job_credit_pack_1: { credits: 1 },
    job_credit_pack_5: { credits: 5 },
  },
};

// Job listing boosts — reuses play_purchases + activate_play_boost (a job
// post is a listings row like any other), kept as its own family so the
// verify-play-purchase 501-guard and client UI can distinguish it.
// supabase/migrations/add_job_boosts.sql — product_id CHECK constraint.
const JOB_BOOSTS: ProductFamily<{ days: number }> = {
  status: 'active',
  products: {
    job_boost_7day:  { days: 7 },
    job_boost_30day: { days: 30 },
  },
};

// Duration-based rental listing featured placement.
// supabase/migrations/add_rental_featured_slot_packs.sql — product_id CHECK constraint.
const RENTAL_FEATURED_SLOTS: ProductFamily<{ days: number }> = {
  status: 'active',
  products: {
    rental_featured_slot_7day:  { days: 7 },
    rental_featured_slot_30day: { days: 30 },
  },
};

const PLAY_PRODUCT_FAMILIES = {
  boosts: BOOSTS,
  shopSubscriptions: SHOP_SUBSCRIPTIONS,
  slotPacks: SLOT_PACKS,
  recruiterSubscriptions: RECRUITER_SUBSCRIPTIONS,
  jobBoosts: JOB_BOOSTS,
  jobCredits: JOB_CREDITS,
  rentalFeaturedSlots: RENTAL_FEATURED_SLOTS,
};

// ── Safe accessors — the ONLY sanctioned way for Edge Function code to
// read product data. A 'planned' family's products never come back from
// these, so a request naming one is rejected as "unknown" regardless of
// what any individual function does with the result.
function isActiveFamily(key: keyof typeof PLAY_PRODUCT_FAMILIES): boolean {
  return PLAY_PRODUCT_FAMILIES[key].status === 'active';
}

export function isActiveProductId(productId: string): boolean {
  return (Object.keys(PLAY_PRODUCT_FAMILIES) as Array<keyof typeof PLAY_PRODUCT_FAMILIES>)
    .some((key) => isActiveFamily(key) && productId in PLAY_PRODUCT_FAMILIES[key].products);
}

// Distinguishes "this id belongs to a real, documented family that just
// isn't built yet" (planned) from "this id isn't in the catalogue at all"
// (unknown — likely a typo or a client sending garbage). Lets callers give
// a clear "not implemented yet" response for the former instead of lumping
// it in with genuinely invalid input.
export type ProductLookupStatus = 'active' | 'planned' | 'unknown';

export function getProductStatus(productId: string): ProductLookupStatus {
  const keys = Object.keys(PLAY_PRODUCT_FAMILIES) as Array<keyof typeof PLAY_PRODUCT_FAMILIES>;
  for (const key of keys) {
    if (productId in PLAY_PRODUCT_FAMILIES[key].products) {
      return PLAY_PRODUCT_FAMILIES[key].status;
    }
  }
  return 'unknown';
}

// Back-compat exports matching what verify-play-purchase / verify-play-subscription
// already import — sourced only from the 'active' families above.
export const BOOST_PRODUCTS = BOOSTS.status === 'active' ? BOOSTS.products : {};
export const SLOT_PACK_PRODUCTS = SLOT_PACKS.status === 'active' ? SLOT_PACKS.products : {};
export const SUBSCRIPTION_PRODUCTS = SHOP_SUBSCRIPTIONS.status === 'active' ? SHOP_SUBSCRIPTIONS.products : {};
export const RECRUITER_SUBSCRIPTION_PRODUCTS = RECRUITER_SUBSCRIPTIONS.status === 'active' ? RECRUITER_SUBSCRIPTIONS.products : {};
export const JOB_CREDIT_PRODUCTS = JOB_CREDITS.status === 'active' ? JOB_CREDITS.products : {};
export const JOB_BOOST_PRODUCTS = JOB_BOOSTS.status === 'active' ? JOB_BOOSTS.products : {};
export const RENTAL_FEATURED_SLOT_PRODUCTS = RENTAL_FEATURED_SLOTS.status === 'active' ? RENTAL_FEATURED_SLOTS.products : {};
