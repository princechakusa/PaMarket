/*!
 * PaMarket — Zimbabwe's Free Marketplace
 * © 2026 PaMarket. All rights reserved.
 * Unauthorised copying, modification, distribution or use of this
 * software without written permission from the owner is strictly prohibited.
 */
'use strict';
/*
 * SINGLE SOURCE OF TRUTH — Google Play Billing product IDs (client side).
 *
 * Every product ID PaMarket sells (or plans to sell) through Google Play
 * Billing is defined ONCE here. billing.js and any future billing code
 * read these arrays instead of hardcoding product IDs — no other file
 * should ever declare a Play product ID literal.
 *
 * This file has a mirror on the server: supabase/functions/_shared/billing-products.ts
 * Deno Edge Functions can't load a browser <script> file directly, so the
 * same product IDs are declared a second time there. THE TWO FILES MUST BE
 * KEPT IN SYNC BY HAND — there is no build step generating one from the
 * other in this project. If you add/remove/rename a product here, make the
 * identical change in billing-products.ts, and in the matching `product_id`
 * CHECK constraint in the relevant supabase/migrations/*.sql file.
 *
 * ── ACTIVE vs PLANNED (production-safety boundary) ──────────────────────
 * Every family below carries a `status` of 'active' or 'planned'.
 *   'active'  — Edge Function + activation RPC + DB schema all exist and
 *               are deployed. Safe to load into Play Billing and purchase.
 *   'planned' — documented per the unified monetization design, but NO
 *               backend exists yet (no Edge Function route, no RPC, no
 *               migration, no Play Console product, no purchase UI).
 *
 * H.PLAY_PRODUCT_FAMILIES is the master list. Purchase-flow code (billing.js)
 * MUST go through H.getActiveProductFamilies() / H.isActiveProductId() —
 * never iterate H.PLAY_PRODUCT_FAMILIES directly and never reference a
 * family's raw array — so a 'planned' family can never be fetched from
 * Google, shown in a buy sheet, or accepted by _handlePlayPurchase, even by
 * accident, until someone deliberately flips its status to 'active' here
 * (and only after its backend actually exists).
 */
(function (H) {

  var PLAY_PRODUCT_FAMILIES = {

    // ═══════════════════════════════════════════════════════════
    // ACTIVE — backend fully built (verify-play-purchase / verify-play-subscription)
    // ═══════════════════════════════════════════════════════════

    boosts: {
      status: 'active',
      // Listing boosts (consumable). estimatedPriceUsd is a DISPLAY ESTIMATE
      // only (e.g. admin revenue dashboard) — actual price is whatever is
      // configured in Google Play Console, which this file cannot read.
      // supabase/migrations/add_play_purchases.sql — product_id CHECK constraint
      products: [
        { productId: 'boost_1day',  days: 1,  label: '1 day',   tag: '',           estimatedPriceUsd: 2 },
        { productId: 'boost_7day',  days: 7,  label: '7 days',  tag: 'Popular',    estimatedPriceUsd: 10 },
        { productId: 'boost_30day', days: 30, label: '30 days', tag: 'Best value', estimatedPriceUsd: 30 },
      ],
    },

    shopSubscriptions: {
      status: 'active',
      // Business shop subscriptions. Google Play Billing subscriptions have
      // a top-level Product ID (what getAvailableProducts()/subscribe() use)
      // and separate Base Plan IDs underneath it (e.g. 'premium-monthly') —
      // these are NOT the same string. Each product below has exactly ONE
      // base plan in Play Console today (monthly only), so the native plugin
      // auto-selects it without needing an explicit offerToken (see
      // PurchasePlugin.java's parseBillingFlowParams — it defaults to
      // subscriptionOfferDetails[0] when no offerToken is given). Yearly
      // billing does not exist as a real Play Console base plan yet, so it
      // is NOT listed here — adding it means creating the yearly base plan
      // in Play Console first, then adding an explicit offerToken-aware
      // entry, not just appending a new string to this array.
      // supabase/migrations/add_play_subscriptions.sql — product_id CHECK constraint.
      // planId mirrors H.BIZ_PLANS' ids in business-onboarding.js.
      products: [
        { productId: 'shop_starter', planId: 'starter', cycle: 'monthly' },
        { productId: 'shop_pro',     planId: 'pro',     cycle: 'monthly' },
        { productId: 'shop_premium', planId: 'premium', cycle: 'monthly' },
      ],
    },

    slotPacks: {
      status: 'active',
      // Extra featured-slot packs (consumable, shops). estimatedPriceUsd is
      // a DISPLAY ESTIMATE only — see note on `boosts` above.
      // supabase/migrations/add_featured_slot_packs.sql — product_id CHECK constraint.
      products: [
        { productId: 'featured_slot_pack_1', extraSlots: 1, label: '+1 slot',                    estimatedPriceUsd: 2 },
        { productId: 'featured_slot_pack_3', extraSlots: 3, label: '+3 slots', tag: 'Best value', estimatedPriceUsd: 5 },
      ],
    },

    // Recruiter subscriptions — single tier only. recruiter_yearly,
    // recruiter_pro_monthly, and recruiter_pro_yearly are documented but do
    // NOT exist as real Play Console products; only recruiter_monthly is
    // final per the monetization-phase task. Do not add a second tier here
    // until a real recruiter_pro product actually exists in Play Console.
    // supabase/migrations/add_recruiter_subscriptions.sql — product_id CHECK constraint.
    recruiterSubscriptions: {
      status: 'active',
      products: [
        { productId: 'recruiter_monthly', planId: 'recruiter', cycle: 'monthly' },
      ],
    },

    // Pay-per-post alternative to a recruiter subscription; one credit spent
    // per job posted beyond the recruiter plan's free post limit.
    // supabase/migrations/add_job_credits.sql — product_id CHECK constraint.
    jobCredits: {
      status: 'active',
      products: [
        { productId: 'job_credit_pack_1', credits: 1, label: '1 job post',  estimatedPriceUsd: 3 },
        { productId: 'job_credit_pack_5', credits: 5, label: '5 job posts', tag: 'Best value', estimatedPriceUsd: 12 },
      ],
    },

    // Same mechanics/backend as `boosts` (reuses play_purchases +
    // activate_play_boost — a job post is a listings row like any other),
    // kept as its own family so the UI can offer a distinct "boost this
    // job" picker. supabase/migrations/add_job_boosts.sql — product_id CHECK constraint.
    jobBoosts: {
      status: 'active',
      products: [
        { productId: 'job_boost_7day',  days: 7,  label: '7 days',  tag: '',           estimatedPriceUsd: 8 },
        { productId: 'job_boost_30day', days: 30, label: '30 days', tag: 'Best value', estimatedPriceUsd: 20 },
      ],
    },

    // Duration-based featured placement for a rental listing — targets
    // rental_featured_listings (previously admin-only/unpaid; this adds a
    // purchased path that inserts a system row alongside it, same table).
    // supabase/migrations/add_rental_featured_slot_packs.sql — product_id CHECK constraint.
    rentalFeaturedSlots: {
      status: 'active',
      products: [
        { productId: 'rental_featured_slot_7day',  days: 7,  label: '7 days',  tag: '',           estimatedPriceUsd: 6 },
        { productId: 'rental_featured_slot_30day', days: 30, label: '30 days', tag: 'Best value', estimatedPriceUsd: 18 },
      ],
    },

  };

  H.PLAY_PRODUCT_FAMILIES = PLAY_PRODUCT_FAMILIES;

  // ── Safe accessors — the ONLY sanctioned way for purchase-flow code to
  // read product data. These are the production-safety boundary: a
  // 'planned' family's products can never come back from these functions,
  // so they can never be fetched from Google, shown in a buy sheet, or
  // accepted by a purchase handler, regardless of what billing.js does.
  H.getActiveProducts = function (familyKey) {
    var family = PLAY_PRODUCT_FAMILIES[familyKey];
    if (!family || family.status !== 'active') return [];
    return family.products;
  };

  // All active products across every family, flattened — used to build the
  // getAvailableProducts() SKU lists without hand-listing family keys.
  H.getAllActiveProducts = function () {
    var out = [];
    Object.keys(PLAY_PRODUCT_FAMILIES).forEach(function (key) {
      if (PLAY_PRODUCT_FAMILIES[key].status === 'active') {
        out = out.concat(PLAY_PRODUCT_FAMILIES[key].products);
      }
    });
    return out;
  };

  H.isActiveProductId = function (productId) {
    return H.getAllActiveProducts().some(function (p) { return p.productId === productId; });
  };

  // Back-compat aliases matching the shape billing.js already consumes
  // (array of product objects for one family) — always sourced through the
  // 'active'-only accessor above, never straight from PLAY_PRODUCT_FAMILIES.
  H.BOOST_PRODUCTS        = H.getActiveProducts('boosts');
  H.SUBSCRIPTION_PRODUCTS = H.getActiveProducts('shopSubscriptions');
  H.SLOT_PACK_PRODUCTS    = H.getActiveProducts('slotPacks');
  H.RECRUITER_SUBSCRIPTION_PRODUCTS = H.getActiveProducts('recruiterSubscriptions');
  H.JOB_CREDIT_PRODUCTS = H.getActiveProducts('jobCredits');
  H.JOB_BOOST_PRODUCTS = H.getActiveProducts('jobBoosts');
  H.RENTAL_FEATURED_SLOT_PRODUCTS = H.getActiveProducts('rentalFeaturedSlots');

})(window.H = window.H || {});
