// Shared StoreKit/Play Billing orchestration. Transactions are only finished
// after the matching Supabase Edge Function verifies them and activates the
// server-side entitlement; this module never grants paid access locally.
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import {
  endConnection,
  ErrorCode,
  finishTransaction,
  fetchProducts,
  getAvailablePurchases,
  initConnection,
  purchaseErrorListener,
  purchaseUpdatedListener,
  requestPurchase,
  restorePurchases as restorePurchasesNative,
  type ExpoPurchaseError,
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
const PENDING_CONTEXT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const PURCHASE_RESULT_TIMEOUT_MS = 120_000;
const NATIVE_STORE_NAME = Platform.OS === "ios" ? "App Store" : "Google Play";

type PendingContext = {
  productId: string;
  listingId?: string;
  businessId?: string;
  savedAt: number;
};

// AFTER_FIRST_UNLOCK because this is read while StoreKit replays unfinished
// transactions, which happens on a background wake with the device still
// locked. A WHEN_UNLOCKED item throws "User interaction is not allowed" there.
const IAP_KEYCHAIN_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
};

async function savePendingContext(ctx: Omit<PendingContext, "savedAt">) {
  // Caller treats a throw here as "purchase couldn't be prepared" and aborts
  // before charging, so this deliberately still propagates — but the Keychain
  // options above stop it firing on a locked device.
  await SecureStore.setItemAsync(
    PENDING_CONTEXT_KEY,
    JSON.stringify({ ...ctx, savedAt: Date.now() }),
    IAP_KEYCHAIN_OPTIONS
  );
}

async function loadPendingContext(
  productId: string
): Promise<PendingContext | null> {
  let raw: string | null;
  try {
    raw = await SecureStore.getItemAsync(
      PENDING_CONTEXT_KEY,
      IAP_KEYCHAIN_OPTIONS
    );
  } catch (e) {
    // A locked Keychain must not abort verification of a completed purchase.
    console.warn("[iap] pending context read failed:", (e as Error)?.message || e);
    return null;
  }
  if (!raw) return null;
  try {
    const ctx = JSON.parse(raw) as PendingContext;
    if (
      Date.now() - ctx.savedAt > PENDING_CONTEXT_TTL_MS ||
      ctx.productId !== productId
    )
      return null;
    return ctx;
  } catch {
    return null;
  }
}

async function clearPendingContext() {
  await SecureStore.deleteItemAsync(
    PENDING_CONTEXT_KEY,
    IAP_KEYCHAIN_OPTIONS
  ).catch(() => {});
}

function verifyEndpointFor(
  platform: "ios" | "android",
  family: ProductFamilyKey
): string {
  const kind =
    family === "shopSubscriptions" || family === "recruiterSubscriptions"
      ? "subscription"
      : "purchase";
  return platform === "ios" ? `verify-apple-${kind}` : `verify-play-${kind}`;
}

async function callVerifyEndpoint(
  fn: string,
  payload: {
    businessId?: string;
    listingId?: string;
    productId: string;
    purchaseToken: string;
    orderId?: string;
  }
): Promise<{ ok: boolean; error?: string; [key: string]: unknown }> {
  const { data: sessionData } = await supabase.auth.getSession();
  let token = sessionData.session?.access_token;
  if (!token) {
    const { data: refreshed } = await supabase.auth.refreshSession();
    token = refreshed.session?.access_token;
  }
  if (!token) return { ok: false, error: "Not signed in" };

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) return { ok: false, error: "Missing Supabase URL" };
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/${fn}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok)
      return {
        ok: false,
        error: body?.error || `Server error (${res.status})`,
      };
    return { ok: true, ...body };
  } catch (error) {
    return {
      ok: false,
      error: (error as Error).message || "Verification network error",
    };
  }
}

export type PurchaseFailureCode =
  | "user-cancelled"
  | "product-unavailable"
  | "store-unavailable"
  | "purchase-failed"
  | "verification-failed"
  | "purchase-timeout";
export type PurchaseResult =
  | { ok: true }
  | { ok: false; code: PurchaseFailureCode; error: string };

const pendingCalls = new Map<
  string,
  {
    resolve: (result: PurchaseResult) => void;
    timeout: ReturnType<typeof setTimeout>;
  }
>();
let connected = false;
let connectionPromise: Promise<boolean> | null = null;
let removeUpdateListener: { remove: () => void } | null = null;
let removeErrorListener: { remove: () => void } | null = null;
const loadedProductIds = new Set<string>();
const processedTransactions = new Set<string>();
const processingTransactions = new Set<string>();

function safeIapError(error: unknown) {
  const e = error as Partial<ExpoPurchaseError>;
  return {
    code: e?.code || ErrorCode.Unknown,
    message: e?.message || String(error),
    productId: e?.productId || undefined,
    responseCode: e?.responseCode || undefined,
  };
}

function purchaseFailure(
  error: unknown
): Exclude<PurchaseResult, { ok: true }> {
  const code = (error as Partial<ExpoPurchaseError>)?.code;
  switch (code) {
    case ErrorCode.UserCancelled:
      return {
        ok: false,
        code: "user-cancelled",
        error: "Purchase cancelled.",
      };
    case ErrorCode.ItemUnavailable:
    case ErrorCode.SkuNotFound:
    case ErrorCode.EmptySkuList:
      return {
        ok: false,
        code: "product-unavailable",
        error: `This product is unavailable in the ${NATIVE_STORE_NAME}.`,
      };
    case ErrorCode.BillingUnavailable:
    case ErrorCode.IapNotAvailable:
    case ErrorCode.InitConnection:
    case ErrorCode.ConnectionClosed:
    case ErrorCode.ServiceDisconnected:
      return {
        ok: false,
        code: "store-unavailable",
        error: `The ${NATIVE_STORE_NAME} is unavailable. Please try again later.`,
      };
    default:
      return {
        ok: false,
        code: "purchase-failed",
        error: "The purchase couldn't be completed. Please try again.",
      };
  }
}

function resolvePending(productId: string, result: PurchaseResult) {
  const waiter = pendingCalls.get(productId);
  if (!waiter) return;
  clearTimeout(waiter.timeout);
  pendingCalls.delete(productId);
  waiter.resolve(result);
}

async function handlePurchase(purchase: Purchase) {
  const productId = purchase.productId;
  const family = familyOf(productId);
  const purchaseToken = purchase.purchaseToken;
  const transactionKey = `${purchase.store}:${
    purchase.transactionId || purchase.id
  }`;
  // A replayed transaction must never leave the caller hanging. This branch
  // used to `return` outright, so if StoreKit re-delivered a transaction that
  // was already handled, purchaseProduct() waited the full 120s and then
  // reported "The store didn't return a result" even though the purchase had
  // actually succeeded.
  //
  // Already finished: report success to the waiting caller without
  // re-verifying or re-granting anything — anti-replay is preserved because
  // no server call and no finishTransaction happens here.
  if (processedTransactions.has(transactionKey)) {
    resolvePending(productId, { ok: true });
    return;
  }
  // Still in flight from an earlier delivery of the same transaction: the
  // in-progress run owns resolution, so drop this duplicate rather than
  // double-processing it. resolvePending is a no-op if nothing is waiting.
  if (processingTransactions.has(transactionKey)) return;
  processingTransactions.add(transactionKey);

  if (!family || !purchaseToken) {
    console.warn("iap: purchase update missing a recognized product/token", {
      productId,
      hasToken: Boolean(purchaseToken),
    });
    resolvePending(productId, {
      ok: false,
      code: "verification-failed",
      error:
        "The store returned an incomplete transaction. Please use Restore Purchases.",
    });
    processingTransactions.delete(transactionKey);
    return;
  }

  let ctx: PendingContext | null;
  try {
    ctx = await loadPendingContext(productId);
  } catch (error) {
    console.warn("iap: could not read purchase context", safeIapError(error));
    resolvePending(productId, {
      ok: false,
      code: "verification-failed",
      error:
        "The purchase couldn't be prepared for verification. Please contact support.",
    });
    processingTransactions.delete(transactionKey);
    return;
  }
  const platform = Platform.OS === "ios" ? "ios" : "android";
  const fn = verifyEndpointFor(platform, family);
  const tokenForServer =
    platform === "ios" &&
    isSubscriptionProduct(productId) &&
    "originalTransactionIdentifierIOS" in purchase &&
    purchase.originalTransactionIdentifierIOS
      ? purchase.originalTransactionIdentifierIOS
      : purchaseToken;
  const result = await callVerifyEndpoint(fn, {
    productId,
    purchaseToken: tokenForServer,
    listingId: ctx?.listingId,
    businessId: ctx?.businessId,
    orderId:
      "transactionId" in purchase
        ? purchase.transactionId || undefined
        : undefined,
  });

  const entitlementGranted =
    result.ok &&
    (!isSubscriptionProduct(productId) || result.granted !== false);
  if (entitlementGranted) {
    let finished = false;
    try {
      await finishTransaction({
        purchase,
        isConsumable:
          family !== "shopSubscriptions" && family !== "recruiterSubscriptions",
      });
      await clearPendingContext();
      finished = true;
    } catch (error) {
      // Keep context so StoreKit can replay this verified but unfinished transaction.
      console.warn(
        "iap: finishTransaction failed after server verification",
        safeIapError(error)
      );
    }
    if (finished) processedTransactions.add(transactionKey);
    processingTransactions.delete(transactionKey);
    resolvePending(productId, { ok: true });
    return;
  }

  console.warn("iap: server verification failed", {
    endpoint: fn,
    productId,
    error: result.error,
  });
  resolvePending(productId, {
    ok: false,
    code: "verification-failed",
    error: `${NATIVE_STORE_NAME} confirmed the purchase, but PaMarket couldn't verify it. Please contact support before trying again.`,
  });
  processingTransactions.delete(transactionKey);
}

export async function initIAP(): Promise<boolean> {
  if (connected) return true;
  if (connectionPromise) return connectionPromise;
  connectionPromise = (async () => {
    try {
      await initConnection();
      connected = true;
    } catch (error) {
      console.warn("iap: initConnection failed", safeIapError(error));
      return false;
    }
    removeUpdateListener = purchaseUpdatedListener((purchase) => {
      handlePurchase(purchase).catch((error) => {
        console.warn("iap: handlePurchase threw", safeIapError(error));
        // Without this the caller waits the full 120s timeout whenever
        // handlePurchase throws before reaching one of its own
        // resolvePending() calls. Release the in-flight marker too, so a
        // StoreKit replay of the same transaction can be retried rather than
        // being swallowed by the duplicate guard forever.
        const key = `${purchase.store}:${
          purchase.transactionId || purchase.id
        }`;
        processingTransactions.delete(key);
        resolvePending(purchase.productId, {
          ok: false,
          code: "verification-failed",
          error: `${NATIVE_STORE_NAME} confirmed the purchase, but PaMarket couldn't verify it. Please contact support before trying again.`,
        });
      });
    });
    removeErrorListener = purchaseErrorListener((error) => {
      console.warn("iap: purchase error", safeIapError(error));
      const id =
        error.productId ||
        (pendingCalls.size === 1
          ? pendingCalls.keys().next().value
          : undefined);
      if (id) {
        resolvePending(id, purchaseFailure(error));
        clearPendingContext().catch(() => {});
      }
    });
    return true;
  })().finally(() => {
    connectionPromise = null;
  });
  return connectionPromise;
}

export async function teardownIAP() {
  removeUpdateListener?.remove();
  removeErrorListener?.remove();
  removeUpdateListener = null;
  removeErrorListener = null;
  if (connected) await endConnection().catch(() => {});
  connected = false;
  loadedProductIds.clear();
  processedTransactions.clear();
  processingTransactions.clear();
}

export type SubscriptionProductsResult = {
  prices: Record<string, string>;
  availableProductIds: string[];
  missingProductIds: string[];
  error?: string;
};

export async function fetchSubscriptionProducts(
  productIds: string[]
): Promise<SubscriptionProductsResult> {
  if (!(await initIAP())) {
    return {
      prices: {},
      availableProductIds: [],
      missingProductIds: productIds,
      error: `The ${NATIVE_STORE_NAME} is unavailable. Check your connection and try again.`,
    };
  }
  try {
    const products = ((await fetchProducts({
      skus: productIds,
      type: "subs",
    })) || []) as ProductSubscription[];
    const availableProductIds = products.map((product) => product.id);
    availableProductIds.forEach((id) => loadedProductIds.add(id));
    const missingProductIds = productIds.filter(
      (id) => !availableProductIds.includes(id)
    );

    if (Platform.OS === "ios") {
      const groupIds = new Set(
        products
          .map((product) =>
            product.platform === "ios" ? product.subscriptionGroupIdIOS : null
          )
          .filter((id): id is string => Boolean(id))
      );
      if (groupIds.size > 1) {
        console.warn("iap: subscriptions are in multiple App Store groups", {
          productIds: availableProductIds,
          groupCount: groupIds.size,
        });
        return {
          prices: {},
          availableProductIds: [],
          missingProductIds: productIds,
          error:
            "Subscriptions are temporarily unavailable because the App Store configuration is inconsistent.",
        };
      }
    }
    return {
      prices: Object.fromEntries(
        products.map((product) => [product.id, product.displayPrice])
      ),
      availableProductIds,
      missingProductIds,
      error: missingProductIds.length
        ? `Some subscription plans aren't available from the ${NATIVE_STORE_NAME}.`
        : undefined,
    };
  } catch (error) {
    console.warn("iap: fetchSubscriptionProducts failed", safeIapError(error));
    return {
      prices: {},
      availableProductIds: [],
      missingProductIds: productIds,
      error: `Could not load ${NATIVE_STORE_NAME} pricing. Check your connection and try again.`,
    };
  }
}

export async function fetchSubscriptionDisplayPrices(
  productIds: string[]
): Promise<Record<string, string>> {
  return (await fetchSubscriptionProducts(productIds)).prices;
}

export async function fetchConsumableProducts(
  productIds: string[]
): Promise<SubscriptionProductsResult> {
  if (!(await initIAP())) {
    return {
      prices: {},
      availableProductIds: [],
      missingProductIds: productIds,
      error: `The ${NATIVE_STORE_NAME} is unavailable. Check your connection and try again.`,
    };
  }
  try {
    const products = ((await fetchProducts({
      skus: productIds,
      type: "in-app",
    })) || []) as Product[];
    const availableProductIds = products.map((product) => product.id);
    availableProductIds.forEach((id) => loadedProductIds.add(id));
    const missingProductIds = productIds.filter(
      (id) => !availableProductIds.includes(id)
    );
    return {
      prices: Object.fromEntries(
        products.map((product) => [product.id, product.displayPrice])
      ),
      availableProductIds,
      missingProductIds,
      error: missingProductIds.length
        ? `Some products aren't available from the ${NATIVE_STORE_NAME}.`
        : undefined,
    };
  } catch (error) {
    console.warn("iap: fetchConsumableProducts failed", safeIapError(error));
    return {
      prices: {},
      availableProductIds: [],
      missingProductIds: productIds,
      error: `Could not load ${NATIVE_STORE_NAME} pricing. Check your connection and try again.`,
    };
  }
}

async function ensureProductsLoaded(productId: string): Promise<boolean> {
  if (loadedProductIds.has(productId)) return true;
  const wantsSubscription = isSubscriptionProduct(productId);
  try {
    const products = await fetchProducts({
      skus: wantsSubscription
        ? activeSubscriptionSkus()
        : activeConsumableSkus(),
      type: wantsSubscription ? "subs" : "in-app",
    });
    (products || []).forEach((product) => loadedProductIds.add(product.id));
  } catch (error) {
    console.warn(
      `iap: fetchProducts(${wantsSubscription ? "subs" : "in-app"}) failed`,
      safeIapError(error)
    );
  }
  return loadedProductIds.has(productId);
}

export type PurchaseContext = { listingId?: string; businessId?: string };

export async function purchaseProduct(
  productId: string,
  ctx: PurchaseContext = {}
): Promise<PurchaseResult> {
  if (!isActiveProductId(productId))
    return {
      ok: false,
      code: "product-unavailable",
      error: "This product isn't available for purchase yet.",
    };
  if (pendingCalls.size > 0)
    return {
      ok: false,
      code: "purchase-failed",
      error: "Another purchase is already in progress.",
    };
  if (!(await initIAP()))
    return {
      ok: false,
      code: "store-unavailable",
      error: `The ${NATIVE_STORE_NAME} is unavailable. Please try again later.`,
    };
  if (!(await ensureProductsLoaded(productId))) {
    console.warn(
      "iap: refusing purchase because the store did not return the requested product",
      { productId }
    );
    return {
      ok: false,
      code: "product-unavailable",
      error: `This product isn't available in the ${NATIVE_STORE_NAME} for your account or region.`,
    };
  }

  // A stale/expired session at the exact moment of purchase would otherwise
  // silently send an undefined appAccountToken into StoreKit — masking "you
  // were signed out" as a generic native purchase failure. Fail loudly here,
  // before StoreKit is ever invoked, while still reading the session the
  // normal way at request time below (this check does not change how
  // appAccountToken itself is sourced, only guards against it being absent).
  const { data: sessionCheck } = await supabase.auth.getSession();
  if (!sessionCheck.session?.user.id) {
    return {
      ok: false,
      code: "purchase-failed",
      error: "Please sign in again before purchasing.",
    };
  }

  try {
    await savePendingContext({
      productId,
      listingId: ctx.listingId,
      businessId: ctx.businessId,
    });
  } catch (error) {
    console.warn(
      "iap: could not persist purchase context",
      safeIapError(error)
    );
    return {
      ok: false,
      code: "purchase-failed",
      error: "The purchase couldn't be prepared. Please try again.",
    };
  }
  const resultPromise = new Promise<PurchaseResult>((resolve) => {
    const timeout = setTimeout(() => {
      resolvePending(productId, {
        ok: false,
        code: "purchase-timeout",
        error:
          "The store didn't return a result. Check your purchase history before trying again.",
      });
    }, PURCHASE_RESULT_TIMEOUT_MS);
    pendingCalls.set(productId, { resolve, timeout });
  });

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const appAccountToken = sessionData.session?.user.id;
    if (isSubscriptionProduct(productId)) {
      await requestPurchase({
        type: "subs",
        request: {
          apple: { sku: productId, appAccountToken },
          google: { skus: [productId] },
        },
      });
    } else {
      await requestPurchase({
        type: "in-app",
        request: {
          apple: { sku: productId, appAccountToken },
          google: { skus: [productId] },
        },
      });
    }
  } catch (error) {
    console.warn("iap: requestPurchase failed", safeIapError(error));
    const result = purchaseFailure(error);
    resolvePending(productId, result);
    await clearPendingContext();
    return result;
  }
  return resultPromise;
}

export type RestoreResult = {
  ok: boolean;
  restoredCount: number;
  failedCount: number;
  errors: string[];
};

export async function restoreAllPurchases(
  options: { businessId?: string; family?: ProductFamilyKey } = {}
): Promise<RestoreResult> {
  if (!(await initIAP()))
    return {
      ok: false,
      restoredCount: 0,
      failedCount: 0,
      errors: [
        `The ${NATIVE_STORE_NAME} is unavailable. Please try again later.`,
      ],
    };
  try {
    await restorePurchasesNative();
  } catch (error) {
    console.warn("iap: native restore sync failed", safeIapError(error));
  }

  let purchases: Purchase[];
  try {
    purchases = ((await getAvailablePurchases({
      onlyIncludeActiveItemsIOS: true,
    })) || []) as Purchase[];
  } catch (error) {
    console.warn("iap: getAvailablePurchases failed", safeIapError(error));
    return {
      ok: false,
      restoredCount: 0,
      failedCount: 0,
      errors: [`Could not reach the ${NATIVE_STORE_NAME}.`],
    };
  }
  const subscriptionPurchases = purchases.filter(
    (purchase) =>
      isSubscriptionProduct(purchase.productId) &&
      (!options.family || familyOf(purchase.productId) === options.family)
  );
  if (subscriptionPurchases.length === 0)
    return { ok: true, restoredCount: 0, failedCount: 0, errors: [] };

  const platform = Platform.OS === "ios" ? "ios" : "android";
  let restoredCount = 0;
  const errors: string[] = [];
  for (const purchase of subscriptionPurchases) {
    const family = familyOf(purchase.productId);
    if (!family || !purchase.purchaseToken) continue;
    const tokenForServer =
      platform === "ios" &&
      "originalTransactionIdentifierIOS" in purchase &&
      purchase.originalTransactionIdentifierIOS
        ? purchase.originalTransactionIdentifierIOS
        : purchase.purchaseToken;
    const result = await callVerifyEndpoint(
      verifyEndpointFor(platform, family),
      {
        productId: purchase.productId,
        purchaseToken: tokenForServer,
        businessId:
          family === "shopSubscriptions" ? options.businessId : undefined,
      }
    );
    if (result.ok && result.granted !== false) {
      restoredCount += 1;
      try {
        await finishTransaction({ purchase, isConsumable: false });
      } catch (error) {
        console.warn(
          "iap: restore finishTransaction failed",
          safeIapError(error)
        );
      }
    } else if (result.ok) {
      errors.push(`${purchase.productId} is not currently active.`);
    } else {
      console.warn("iap: restore verification failed", {
        productId: purchase.productId,
        error: result.error,
      });
      errors.push(`Could not verify ${purchase.productId}.`);
    }
  }
  return {
    ok: errors.length === 0,
    restoredCount,
    failedCount: errors.length,
    errors,
  };
}

export type { Product, ProductSubscription };
