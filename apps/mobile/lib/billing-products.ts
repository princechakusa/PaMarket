// SINGLE SOURCE OF TRUTH — in-app purchase product IDs (client side).
//
// Mirrors supabase/functions/_shared/billing-products.ts exactly. That file
// is the server's copy (Deno can't import from apps/mobile, and this file
// can't import from supabase/functions), so the two must be kept in sync BY
// HAND — if you add/remove/rename a product here, make the identical change
// there, and in the matching `product_id` CHECK constraint in the relevant
// supabase/migrations/*.sql file.
//
// Same product IDs sell on both stores — Google Play Console and App Store
// Connect must each have a product configured with these exact identifiers
// (Apple: as In-App Purchases / Subscriptions under this app's record).
//
// ── ACTIVE vs PLANNED (production-safety boundary) ──────────────────────
// Mirrors the server file's status gate: 'active' families have a real
// Edge Function + activation RPC + Play/App Store product already set up.
// 'planned' families are documented for the unified monetization design but
// have no backend yet — lib/iap.ts refuses to even attempt fetching or
// purchasing a 'planned' product, so a stray reference to one fails loudly
// in development rather than silently no-op-ing in production.

export type ProductFamilyStatus = "active" | "planned";

interface ProductFamily<T> {
  status: ProductFamilyStatus;
  kind: "consumable" | "subscription";
  products: Record<string, T>;
}

const BOOSTS: ProductFamily<{ days: number; estimatedPriceUsd: number }> = {
  status: "active",
  kind: "consumable",
  products: {
    boost_1day: { days: 1, estimatedPriceUsd: 2 },
    boost_7day: { days: 7, estimatedPriceUsd: 10 },
    boost_30day: { days: 30, estimatedPriceUsd: 30 },
  },
};

// Product ID has no _monthly/_yearly suffix — see
// supabase/migrations/fix_shop_subscription_product_ids.sql. Yearly billing
// has no real store product yet; do not add one until it actually exists on
// both Play Console and App Store Connect.
const SHOP_SUBSCRIPTIONS: ProductFamily<{ planId: string; cycle: string }> = {
  status: "active",
  kind: "subscription",
  products: {
    shop_starter: { planId: "starter", cycle: "monthly" },
    shop_pro: { planId: "pro", cycle: "monthly" },
    shop_premium: { planId: "premium", cycle: "monthly" },
  },
};

const SLOT_PACKS: ProductFamily<{ extraSlots: number; estimatedPriceUsd: number }> = {
  status: "active",
  kind: "consumable",
  products: {
    featured_slot_pack_1: { extraSlots: 1, estimatedPriceUsd: 2 },
    featured_slot_pack_3: { extraSlots: 3, estimatedPriceUsd: 5 },
  },
};

// Single tier only — recruiter_pro / yearly variants are documented
// elsewhere but do not exist as real store products yet.
const RECRUITER_SUBSCRIPTIONS: ProductFamily<{ planId: string; cycle: string }> = {
  status: "active",
  kind: "subscription",
  products: {
    recruiter_monthly: { planId: "recruiter", cycle: "monthly" },
  },
};

const JOB_CREDITS: ProductFamily<{ credits: number }> = {
  status: "active",
  kind: "consumable",
  products: {
    job_credit_pack_1: { credits: 1 },
    job_credit_pack_5: { credits: 5 },
  },
};

const JOB_BOOSTS: ProductFamily<{ days: number }> = {
  status: "active",
  kind: "consumable",
  products: {
    job_boost_7day: { days: 7 },
    job_boost_30day: { days: 30 },
  },
};

const RENTAL_FEATURED_SLOTS: ProductFamily<{ days: number }> = {
  status: "active",
  kind: "consumable",
  products: {
    rental_featured_slot_7day: { days: 7 },
    rental_featured_slot_30day: { days: 30 },
  },
};

const PRODUCT_FAMILIES = {
  boosts: BOOSTS,
  shopSubscriptions: SHOP_SUBSCRIPTIONS,
  slotPacks: SLOT_PACKS,
  recruiterSubscriptions: RECRUITER_SUBSCRIPTIONS,
  jobBoosts: JOB_BOOSTS,
  jobCredits: JOB_CREDITS,
  rentalFeaturedSlots: RENTAL_FEATURED_SLOTS,
} as const;

export type ProductFamilyKey = keyof typeof PRODUCT_FAMILIES;

export function isActiveProductId(productId: string): boolean {
  return (Object.keys(PRODUCT_FAMILIES) as ProductFamilyKey[]).some(
    (key) => PRODUCT_FAMILIES[key].status === "active" && productId in PRODUCT_FAMILIES[key].products
  );
}

export function familyOf(productId: string): ProductFamilyKey | null {
  const keys = Object.keys(PRODUCT_FAMILIES) as ProductFamilyKey[];
  for (const key of keys) {
    if (productId in PRODUCT_FAMILIES[key].products) return key;
  }
  return null;
}

export function isSubscriptionProduct(productId: string): boolean {
  const key = familyOf(productId);
  return key ? PRODUCT_FAMILIES[key].kind === "subscription" : false;
}

// All active product ids, split by StoreKit product type — needed for
// expo-iap's fetchProducts({ skus, type }), which queries in-app and
// subscription SKUs separately.
export function activeConsumableSkus(): string[] {
  return (Object.keys(PRODUCT_FAMILIES) as ProductFamilyKey[])
    .filter((key) => PRODUCT_FAMILIES[key].status === "active" && PRODUCT_FAMILIES[key].kind === "consumable")
    .flatMap((key) => Object.keys(PRODUCT_FAMILIES[key].products));
}

export function activeSubscriptionSkus(): string[] {
  return (Object.keys(PRODUCT_FAMILIES) as ProductFamilyKey[])
    .filter((key) => PRODUCT_FAMILIES[key].status === "active" && PRODUCT_FAMILIES[key].kind === "subscription")
    .flatMap((key) => Object.keys(PRODUCT_FAMILIES[key].products));
}

export const BOOST_PRODUCTS = BOOSTS.products;
export const SHOP_SUBSCRIPTION_PRODUCTS = SHOP_SUBSCRIPTIONS.products;
export const SLOT_PACK_PRODUCTS = SLOT_PACKS.products;
export const RECRUITER_SUBSCRIPTION_PRODUCTS = RECRUITER_SUBSCRIPTIONS.products;
export const JOB_CREDIT_PRODUCTS = JOB_CREDITS.products;
export const JOB_BOOST_PRODUCTS = JOB_BOOSTS.products;
export const RENTAL_FEATURED_SLOT_PRODUCTS = RENTAL_FEATURED_SLOTS.products;
