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
      // Business shop subscriptions.
      // supabase/migrations/add_play_subscriptions.sql — product_id CHECK constraint.
      // planId/cycle mirror H.BIZ_PLANS' ids in business-onboarding.js.
      products: [
        { productId: 'shop_starter_monthly', planId: 'starter', cycle: 'monthly' },
        { productId: 'shop_starter_yearly',  planId: 'starter', cycle: 'yearly' },
        { productId: 'shop_pro_monthly',     planId: 'pro',     cycle: 'monthly' },
        { productId: 'shop_pro_yearly',      planId: 'pro',     cycle: 'yearly' },
        { productId: 'shop_premium_monthly', planId: 'premium', cycle: 'monthly' },
        { productId: 'shop_premium_yearly',  planId: 'premium', cycle: 'yearly' },
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

    // ═══════════════════════════════════════════════════════════
    // PLANNED — documented only. NO Edge Function, RPC, migration, Play
    // Console product, or purchase UI exists for these yet. Do not flip to
    // 'active' until all four of those are actually built and deployed.
    // ═══════════════════════════════════════════════════════════

    recruiterSubscriptions: {
      status: 'planned',
      // planId mirrors a future H.JOB_PLAN_ENTITLEMENTS
      // ('recruiter' | 'recruiter_pro'), same shape as shopSubscriptions.
      products: [
        { productId: 'recruiter_monthly',      planId: 'recruiter',      cycle: 'monthly' },
        { productId: 'recruiter_yearly',       planId: 'recruiter',      cycle: 'yearly' },
        { productId: 'recruiter_pro_monthly',  planId: 'recruiter_pro',  cycle: 'monthly' },
        { productId: 'recruiter_pro_yearly',   planId: 'recruiter_pro',  cycle: 'yearly' },
      ],
    },

    jobBoosts: {
      status: 'planned',
      // Same mechanics as `boosts`, targeting listings.featured_until where category='jobs'.
      products: [
        { productId: 'job_boost_7day',  days: 7,  label: '7 days',  tag: '' },
        { productId: 'job_boost_30day', days: 30, label: '30 days', tag: 'Best value' },
      ],
    },

    jobCredits: {
      status: 'planned',
      // Pay-per-post alternative to a recruiter subscription; one credit
      // spent per job posted.
      products: [
        { productId: 'job_credit_pack_1', credits: 1, label: '1 job post' },
        { productId: 'job_credit_pack_5', credits: 5, label: '5 job posts', tag: 'Best value' },
      ],
    },

    rentalFeaturedSlots: {
      status: 'planned',
      // Same shape as `slotPacks`, targeting rental_featured_listings
      // (currently an admin-only, unpaid mechanism — see the unified
      // monetization design doc).
      products: [
        { productId: 'rental_featured_slot_1', extraSlots: 1, label: '+1 slot' },
        { productId: 'rental_featured_slot_3', extraSlots: 3, label: '+3 slots', tag: 'Best value' },
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

})(window.H = window.H || {});
