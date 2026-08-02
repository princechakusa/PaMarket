// Shared in-app purchase orchestration — Android (Google Play) and iOS (App
// Store) through the one `expo-iap` API, mirroring the behavioral pattern of
// the legacy Capacitor app's www/js/billing.js: init once at app boot,
// purchases resolve asynchronously through a listener (never through
// requestPurchase()'s own return value), a durable "pending context" survives
// the app being killed mid-purchase, and every purchase is verified server-
// side before any entitlement is granted — this module never grants
// anything itself, it only calls the right Edge Function and reports what
// came back.
//
// Backend contract (see supabase/functions/verify-play-purchase,
// verify-play-subscription, verify-apple-purchase, verify-apple-subscription):
// the four Edge Functions all accept POST { businessId?, listingId?,
// productId, purchaseToken, orderId? } with the caller's bearer token, and
// return { ok: true, ... } on success or { error } / { notImplemented } on
// failure. Which function to call is decided here by platform + product
// family (lib/billing-products.ts), never hardcoded per screen.
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import {
  endConnection,
  finishTransaction,
  fetchProducts,
  getAvailablePurchases,
  initConnection,
  purchaseErrorListener,
  purchaseUpdatedListener,
  requestPurchase,
  restorePurchases as restorePurchasesNative,
  type Product,
  type ProductSubscription,
  type Purchase,
} from "expo-iap";
import { supabase } from "./supabase";
import {
  activeConsumableSkus,
  activeSubscriptionSkus,
  familyOf,
  isActiveProductId,
  isSubscriptionProduct,
  type ProductFamilyKey,
} from "./billing-products";

const PENDING_CONTEXT_KEY = "pamarket.iap-pending-context";
const PENDING_CONTEXT_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days — mirrors billing.js

type PendingContext = {
  productId: string;
  listingId?: string;
  businessId?: string;
  savedAt: number;
};

async function savePendingContext(ctx: Omit<PendingContext, "savedAt">) {
  await SecureStore.setItemAsync(PENDING_CONTEXT_KEY, JSON.stringify({ ...ctx, savedAt: Date.now() }));
}

async function loadPendingContext(productId: string): Promise<PendingContext | null> {
  const raw = await SecureStore.getItemAsync(PENDING_CONTEXT_KEY);
  if (!raw) return null;
  try {
    const ctx = JSON.parse(raw) as PendingContext;
    if (Date.now() - ctx.savedAt > PENDING_CONTEXT_TTL_MS) return null;
    if (ctx.productId !== productId) return null;
    return ctx;
  } catch {
    return null;
  }
}

async function clearPendingContext() {
  await SecureStore.deleteItemAsync(PENDING_CONTEXT_KEY).catch(() => {});
}

// Edge Function per (platform, family-kind) combination.
function verifyEndpointFor(platform: "ios" | "android", family: ProductFamilyKey): string {
  const kind = family === "shopSubscriptions" || family === "recruiterSubscriptions" ? "subscription" : "purchase";
  return platform === "ios" ? `verify-apple-${kind}` : `verify-play-${kind}`;
}

async function callVerifyEndpoint(
  fn: string,
  payload: { businessId?: string; listingId?: string; productId: string; purchaseToken: string; orderId?: string }
): Promise<{ ok: boolean; error?: string; notImplemented?: boolean; [key: string]: unknown }> {
  const { data: sessionData } = await supabase.auth.getSession();
  let token = sessionData.session?.access_token;
  if (!token) {
    const { data: refreshed } = await supabase.auth.refreshSession();
    token = refreshed.session?.access_token;
  }
  if (!token) return { ok: false, error: "Not signed in" };

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
  const res = await fetch(`${supabaseUrl}/functions/v1/${fn}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: body?.error || `Server error (${res.status})`, notImplemented: res.status === 501 };
  return { ok: true, ...body };
}

// A screen calling purchaseProduct() awaits a real resolved/rejected result,
// even though expo-iap itself only ever delivers the outcome through the
// module-level purchaseUpdatedListener/purchaseErrorListener below — this
// map bridges the two, keyed by productId (one in-flight purchase per
// product at a time is the only case that matters in practice).
const pendingCalls = new Map<string, { resolve: (v: { ok: boolean; error?: string }) => void }>();

let connected = false;
let removeUpdateListener: { remove: () => void } | null = null;
let removeErrorListener: { remove: () => void } | null = null;
let fetchedConsumables = false;
let fetchedSubscriptions = false;

async function handlePurchase(purchase: Purchase) {
  const productId = purchase.productId;
  const family = familyOf(productId);
  const purchaseToken = purchase.purchaseToken;
  if (!family || !purchaseToken) {
    console.warn("iap: purchase update for unrecognized product or missing token", productId);
    return;
  }

  const ctx = await loadPendingContext(productId);
  const platform = Platform.OS === "ios" ? "ios" : "android";
  const fn = verifyEndpointFor(platform, family);

  // For iOS subscriptions, originalTransactionIdentifierIOS is the STABLE id
  // across renewals — that's what the backend needs to look this
  // subscription up again later (renewal/cancel notifications reference it,
  // not the per-renewal transactionId). For everything else the unified
  // purchaseToken (Android token / iOS per-transaction JWS) is the right key.
  const isIosSubscription = platform === "ios" && isSubscriptionProduct(productId);
  const tokenForServer =
    isIosSubscription && "originalTransactionIdentifierIOS" in purchase && purchase.originalTransactionIdentifierIOS
      ? purchase.originalTransactionIdentifierIOS
      : purchaseToken;

  const result = await callVerifyEndpoint(fn, {
    productId,
    purchaseToken: tokenForServer,
    listingId: ctx?.listingId,
    businessId: ctx?.businessId,
    orderId: "transactionId" in purchase ? (purchase.transactionId as string | undefined) : undefined,
  });

  if (result.ok) {
    // Only finish (and for consumables, consume) the transaction once the
    // server confirms it granted the entitlement — an unfinished iOS
    // transaction simply replays on next launch, which is the safe default
    // if verification failed transiently.
    await finishTransaction({ purchase, isConsumable: family !== "shopSubscriptions" && family !== "recruiterSubscriptions" }).catch(
      (e) => console.warn("iap: finishTransaction failed", e)
    );
    await clearPendingContext();
  }

  const waiter = pendingCalls.get(productId);
  if (waiter) {
    waiter.resolve(result.ok ? { ok: true } : { ok: false, error: result.error });
    pendingCalls.delete(productId);
  }
}

// Call once, near the app root (app/_layout.tsx), after a session exists.
// Safe to call multiple times — no-ops if already connected.
export async function initIAP() {
  if (connected) return;
  try {
    await initConnection();
    connected = true;
  } catch (e) {
    console.warn("iap: initConnection failed", e);
    return;
  }

  removeUpdateListener = purchaseUpdatedListener((purchase) => {
    handlePurchase(purchase).catch((e) => console.warn("iap: handlePurchase threw", e));
  });
  removeErrorListener = purchaseErrorListener((error) => {
    console.warn("iap: purchase error", error);
    // error.productId isn't always populated by every store, so this can't
    // always resolve a specific pendingCalls entry — screens also have their
    // own timeout/cancel handling for that case.
    const id = (error as { productId?: string }).productId;
    if (id) {
      const waiter = pendingCalls.get(id);
      if (waiter) {
        waiter.resolve({ ok: false, error: error.message });
        pendingCalls.delete(id);
      }
    }
  });
}

export async function teardownIAP() {
  removeUpdateListener?.remove();
  removeErrorListener?.remove();
  removeUpdateListener = null;
  removeErrorListener = null;
  if (connected) {
    await endConnection().catch(() => {});
    connected = false;
  }
}

async function ensureProductsLoaded(productId: string) {
  const wantsSubscription = isSubscriptionProduct(productId);
  if (wantsSubscription && !fetchedSubscriptions) {
    await fetchProducts({ skus: activeSubscriptionSkus(), type: "subs" }).catch((e) => console.warn("iap: fetchProducts(subs) failed", e));
    fetchedSubscriptions = true;
  } else if (!wantsSubscription && !fetchedConsumables) {
    await fetchProducts({ skus: activeConsumableSkus(), type: "in-app" }).catch((e) => console.warn("iap: fetchProducts(in-app) failed", e));
    fetchedConsumables = true;
  }
}

export type PurchaseContext = { listingId?: string; businessId?: string };

// The single entry point every "Upgrade"/"Buy" button should call. Resolves
// once the server has verified the purchase AND activated the entitlement
// (or rejects with a reason) — never grants anything on the client side.
export async function purchaseProduct(productId: string, ctx: PurchaseContext = {}): Promise<{ ok: boolean; error?: string }> {
  if (!isActiveProductId(productId)) {
    return { ok: false, error: "This product isn't available for purchase yet." };
  }
  if (!connected) {
    return { ok: false, error: "Store connection isn't ready yet. Please try again in a moment." };
  }

  await savePendingContext({ productId, listingId: ctx.listingId, businessId: ctx.businessId });
  await ensureProductsLoaded(productId);

  const resultPromise = new Promise<{ ok: boolean; error?: string }>((resolve) => {
    pendingCalls.set(productId, { resolve });
  });

  try {
    if (isSubscriptionProduct(productId)) {
      await requestPurchase({
        type: "subs",
        request: {
          apple: { sku: productId },
          google: { skus: [productId] },
        },
      });
    } else {
      await requestPurchase({
        type: "in-app",
        request: {
          apple: { sku: productId },
          google: { skus: [productId] },
        },
      });
    }
  } catch (e) {
    pendingCalls.delete(productId);
    await clearPendingContext();
    return { ok: false, error: (e as Error).message || "Purchase could not be started." };
  }

  return resultPromise;
}

export type RestoreResult = {
  ok: boolean;
  restoredCount: number;
  failedCount: number;
  errors: string[];
};

// Required by Apple Guideline 3.1.1 for any app selling subscriptions: lets
// a user recover entitlements after a reinstall / new device / re-login
// without paying again. Only subscription products are restorable here —
// this app's consumables (boosts, job credits, slot packs) are genuinely
// consumed on purchase, so the platform has nothing left to restore for
// them; StoreKit/Play would simply return nothing for those SKUs.
//
// The client never grants anything itself: every purchase returned by the
// platform is re-submitted to the same server-side verify endpoint used for
// a fresh purchase (Apple's real receipt/JWS validation, Apple's servers as
// the source of truth for subscription status), and only finished once the
// server confirms the entitlement is active.
export async function restoreAllPurchases(): Promise<RestoreResult> {
  if (!connected) {
    return { ok: false, restoredCount: 0, failedCount: 0, errors: ["Store connection isn't ready yet. Please try again in a moment."] };
  }

  try {
    await restorePurchasesNative();
  } catch (e) {
    console.warn("iap: restorePurchases (native sync) failed, continuing with getAvailablePurchases anyway", e);
  }

  let purchases: Purchase[] = [];
  try {
    purchases = (await getAvailablePurchases()) as Purchase[];
  } catch (e) {
    return { ok: false, restoredCount: 0, failedCount: 0, errors: [(e as Error).message || "Could not reach the store."] };
  }

  const subscriptionPurchases = purchases.filter((p) => isSubscriptionProduct(p.productId));
  if (subscriptionPurchases.length === 0) {
    return { ok: true, restoredCount: 0, failedCount: 0, errors: [] };
  }

  const platform = Platform.OS === "ios" ? "ios" : "android";
  let restoredCount = 0;
  const errors: string[] = [];

  for (const purchase of subscriptionPurchases) {
    const productId = purchase.productId;
    const family = familyOf(productId);
    const purchaseToken = purchase.purchaseToken;
    if (!family || !purchaseToken) continue;

    const isIosSubscription = platform === "ios";
    const tokenForServer =
      isIosSubscription && "originalTransactionIdentifierIOS" in purchase && purchase.originalTransactionIdentifierIOS
        ? purchase.originalTransactionIdentifierIOS
        : purchaseToken;

    const fn = verifyEndpointFor(platform, family);
    const result = await callVerifyEndpoint(fn, { productId, purchaseToken: tokenForServer });

    if (result.ok) {
      restoredCount += 1;
      await finishTransaction({ purchase, isConsumable: false }).catch((e) => console.warn("iap: restore finishTransaction failed", e));
    } else {
      errors.push(result.error || `Could not restore ${productId}`);
    }
  }

  return { ok: true, restoredCount, failedCount: errors.length, errors };
}

export type { Product, ProductSubscription };
