// Same exports as "expo-iap", but safe to import in Expo Go, which doesn't
// include the native purchase module (importing expo-iap there crashes the
// app at launch). Store builds get the real functions; Expo Go gets inert
// stand-ins: nothing to buy, listeners that never fire, and purchase calls
// that fail with a clear message instead of crashing.
import { loadExpoIap } from "./native-optional";

export type { ExpoPurchaseError, Product, ProductSubscription, Purchase } from "expo-iap";

const real = loadExpoIap();
const UNAVAILABLE = "In-app purchases aren't available in Expo Go. Use a store or development build.";

function unavailable(): never {
  throw Object.assign(new Error(UNAVAILABLE), { code: "iap-not-available" });
}

// String values mirror expo-iap's ErrorCode so switch statements still work.
const FALLBACK_ERROR_CODE = {
  Unknown: "unknown",
  UserCancelled: "user-cancelled",
  ItemUnavailable: "item-unavailable",
  SkuNotFound: "sku-not-found",
  EmptySkuList: "empty-sku-list",
  BillingUnavailable: "billing-unavailable",
  IapNotAvailable: "iap-not-available",
  InitConnection: "init-connection",
  ConnectionClosed: "connection-closed",
  ServiceDisconnected: "service-disconnected",
} as const;

const noopSubscription = { remove() {} };

export const ErrorCode = (real?.ErrorCode ?? FALLBACK_ERROR_CODE) as typeof import("expo-iap").ErrorCode;
export const initConnection: typeof import("expo-iap").initConnection = real?.initConnection ?? (async () => unavailable());
export const endConnection: typeof import("expo-iap").endConnection = real?.endConnection ?? (async () => true);
export const fetchProducts = (real?.fetchProducts ?? (async () => [])) as typeof import("expo-iap").fetchProducts;
export const getAvailablePurchases: typeof import("expo-iap").getAvailablePurchases = real?.getAvailablePurchases ?? (async () => []);
export const finishTransaction: typeof import("expo-iap").finishTransaction = real?.finishTransaction ?? (async () => unavailable());
export const requestPurchase = (real?.requestPurchase ?? (async () => unavailable())) as typeof import("expo-iap").requestPurchase;
export const restorePurchases: typeof import("expo-iap").restorePurchases = real?.restorePurchases ?? (async () => unavailable());
export const purchaseUpdatedListener = (real?.purchaseUpdatedListener ?? (() => noopSubscription)) as typeof import("expo-iap").purchaseUpdatedListener;
export const purchaseErrorListener = (real?.purchaseErrorListener ?? (() => noopSubscription)) as typeof import("expo-iap").purchaseErrorListener;
export const deepLinkToSubscriptions: typeof import("expo-iap").deepLinkToSubscriptions = real?.deepLinkToSubscriptions ?? (async () => {});
