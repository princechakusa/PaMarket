// Pure shop-cart state logic — no React, no I/O, no Supabase calls. Kept
// separate from cart-context.tsx (persistence/reactivity) and
// shop-orders.ts (RPC + formatting) so each stays small and independently
// testable. Mirrors the server's own rules 1:1 (see
// supabase/migrations/20260910120000_shop_orders_foundation.sql) so the UI
// never lets a customer build a cart the server would reject outright —
// but the server re-validates everything again at order time regardless;
// this module is a UX convenience, never the source of truth.

import type { Listing } from "./listings";

// Mirrors moderation_settings.max_quantity_per_shop_order_item /
// max_shop_order_items_per_order on the live database (Stage 1). If those
// are ever tuned at runtime, this client-side ceiling would need updating
// too — there is no live-config fetch for it yet, so this is a fixed
// mirror, not a source of truth.
export const MAX_QTY_PER_ITEM = 20;
export const MAX_ITEMS_PER_ORDER = 30;

export type CartItem = { listingId: string; quantity: number };

export type CartState = {
  businessId: string | null;
  businessName: string | null;
  items: CartItem[];
};

export function emptyCart(): CartState {
  return { businessId: null, businessName: null, items: [] };
}

export function isCartEmpty(cart: CartState): boolean {
  return cart.items.length === 0;
}

// Total units across all lines — what "item_count" means once the order is
// placed. NOT the same as the max-items-per-order limit below, which caps
// the number of distinct line items, not the summed quantity.
export function cartUnitCount(cart: CartState): number {
  return cart.items.reduce((sum, item) => sum + item.quantity, 0);
}

export function findCartItem(cart: CartState, listingId: string): CartItem | undefined {
  return cart.items.find((item) => item.listingId === listingId);
}

export type AddResult = "added" | "updated" | "conflict" | "item_limit" | "quantity_limit";

// Adding from a second shop never mutates the cart — the caller must ask
// the customer to confirm clearing it first (see replaceCartWithItem).
export function addToCart(
  cart: CartState,
  business: { id: string; name: string },
  listingId: string,
  quantity = 1
): { cart: CartState; result: AddResult } {
  if (cart.businessId && cart.businessId !== business.id) {
    return { cart, result: "conflict" };
  }
  const existing = findCartItem(cart, listingId);
  if (existing) {
    const nextQuantity = existing.quantity + quantity;
    if (nextQuantity > MAX_QTY_PER_ITEM) return { cart, result: "quantity_limit" };
    return {
      cart: {
        businessId: business.id,
        businessName: business.name,
        items: cart.items.map((item) => (item.listingId === listingId ? { ...item, quantity: nextQuantity } : item)),
      },
      result: "updated",
    };
  }
  if (quantity > MAX_QTY_PER_ITEM) return { cart, result: "quantity_limit" };
  if (cart.items.length >= MAX_ITEMS_PER_ORDER) return { cart, result: "item_limit" };
  return {
    cart: {
      businessId: business.id,
      businessName: business.name,
      items: [...cart.items, { listingId, quantity }],
    },
    result: "added",
  };
}

// Used after the customer confirms "Clear cart and add this item" from the
// cross-shop conflict dialog.
export function replaceCartWithItem(business: { id: string; name: string }, listingId: string, quantity = 1): CartState {
  return {
    businessId: business.id,
    businessName: business.name,
    items: [{ listingId, quantity: Math.min(Math.max(1, quantity), MAX_QTY_PER_ITEM) }],
  };
}

export function setItemQuantity(cart: CartState, listingId: string, quantity: number): CartState {
  if (!Number.isFinite(quantity) || quantity <= 0) return removeFromCart(cart, listingId);
  const clamped = Math.min(MAX_QTY_PER_ITEM, Math.floor(quantity));
  return { ...cart, items: cart.items.map((item) => (item.listingId === listingId ? { ...item, quantity: clamped } : item)) };
}

export function removeFromCart(cart: CartState, listingId: string): CartState {
  const items = cart.items.filter((item) => item.listingId !== listingId);
  return items.length ? { ...cart, items } : emptyCart();
}

// The same eligibility rule create_shop_order enforces server-side (active,
// priced, opted in, tied to a shop) — used both to decide whether "Add to
// Cart" shows on a listing, and to detect a cart item that has since gone
// stale (deleted, paused, unlisted from ordering) so the cart screen can
// flag it instead of silently building a request the server will reject.
export function isListingOrderable(
  listing: Pick<Listing, "status" | "price" | "business_id"> & { is_orderable?: boolean | null }
): boolean {
  return listing.status === "active" && !!listing.is_orderable && !!listing.business_id && (listing.price ?? 0) > 0;
}

// Business must additionally be active + verified — mirrors
// create_shop_order's verification_level >= 2 threshold (the same one used
// everywhere else in the app for the "Verified" badge).
export function isShopAcceptingOrders(business: { status: string; verification_level?: number | null }): boolean {
  return business.status === "active" && (business.verification_level ?? 0) >= 2;
}
