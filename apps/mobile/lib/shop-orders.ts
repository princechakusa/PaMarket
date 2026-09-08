// Shop order RPC calls, status/fulfillment display metadata, and money
// formatting for the customer-facing order flow. Kept separate from
// cart.ts (pure cart state) and cart-context.tsx (persistence) so each
// file stays focused. The server (create_shop_order /
// update_shop_order_status in supabase/migrations/
// 20260910120000_shop_orders_foundation.sql) is the sole authority on
// price, ownership, and eligibility — nothing here is ever trusted back.
import * as Crypto from "expo-crypto";
import { supabase } from "./supabase";
import { friendlyError } from "./safety";

export type FulfillmentMethod = "collection" | "delivery";

export const FULFILLMENT_LABELS: Record<FulfillmentMethod, string> = {
  collection: "Pickup",
  delivery: "Delivery",
};

export type OrderStatus = "pending" | "confirmed" | "declined" | "preparing" | "ready" | "completed" | "cancelled";

export const ORDER_STATUS_META: Record<OrderStatus, { label: string; color: string; bg: string; border: string; message: string }> = {
  pending: {
    label: "Pending",
    color: "#D97706",
    bg: "#FFFBEB",
    border: "#FDE68A",
    message: "Waiting for the shop to confirm this request.",
  },
  confirmed: {
    label: "Confirmed",
    color: "#2563EB",
    bg: "#EFF6FF",
    border: "#BFDBFE",
    message: "The shop has confirmed this order.",
  },
  declined: {
    label: "Declined",
    color: "#DC2626",
    bg: "#FEF2F2",
    border: "#FECACA",
    message: "The shop was unable to fulfil this order.",
  },
  preparing: {
    label: "Preparing",
    color: "#7C3AED",
    bg: "#F5F3FF",
    border: "#DDD6FE",
    message: "The shop is preparing your order.",
  },
  ready: {
    label: "Ready",
    color: "#16A34A",
    bg: "#F0FDF4",
    border: "#BBF7D0",
    message: "Your order is ready.",
  },
  completed: {
    label: "Completed",
    color: "#475569",
    bg: "#F1F5F9",
    border: "#E2E8F0",
    message: "This order has been completed.",
  },
  cancelled: {
    label: "Cancelled",
    color: "#64748B",
    bg: "#F8FAFC",
    border: "#E2E8F0",
    message: "This order was cancelled.",
  },
};

export function orderStatusMeta(status: string) {
  return ORDER_STATUS_META[(status as OrderStatus) in ORDER_STATUS_META ? (status as OrderStatus) : "pending"];
}

// Same convention formatPrice() in lib/listings.ts uses (currency string
// prepended directly, e.g. "USD120") — kept consistent rather than
// introducing a second money format in the same app.
export function formatMoney(amount: number, currency: string | null | undefined): string {
  return `${currency ?? "USD"}${Number(amount).toLocaleString()}`;
}

// One key per checkout attempt, reused across retries of that SAME attempt
// (network failure, user taps submit again) so create_shop_order's
// idempotency check returns the original order instead of creating a
// second one. A fresh key is only generated when the customer starts a NEW
// checkout (see app/shop-checkout.tsx).
export function generateIdempotencyKey(): string {
  return Crypto.randomUUID();
}

export type CreateShopOrderInput = {
  businessId: string;
  items: { listingId: string; quantity: number }[];
  fulfillmentMethod: FulfillmentMethod;
  customerName: string;
  customerPhone: string;
  idempotencyKey: string;
  deliveryAddress?: string;
  customerNote?: string;
};

export type CreateShopOrderResult =
  | { ok: true; orderId: string; status: OrderStatus; total: number; currency: string; itemCount: number; replayed: boolean }
  | { ok: false; code: string | null; message: string };

// Thin wrapper around the create_shop_order RPC. Never sends a
// client-computed price or total — only listing ids, quantities, and the
// customer-entered contact/fulfillment details the server needs to store.
export async function createShopOrder(input: CreateShopOrderInput): Promise<CreateShopOrderResult> {
  try {
    const { data, error } = await supabase.rpc("create_shop_order", {
      p_business_id: input.businessId,
      p_items: input.items.map((item) => ({ listing_id: item.listingId, quantity: item.quantity })),
      p_fulfillment_method: input.fulfillmentMethod,
      p_customer_name: input.customerName,
      p_customer_phone: input.customerPhone,
      p_idempotency_key: input.idempotencyKey,
      p_delivery_address: input.deliveryAddress || null,
      p_customer_note: input.customerNote || null,
    });

    if (error) {
      // A transport/RPC-level failure (network, auth token issue) — never
      // the shape the function itself returns on a handled rejection.
      return { ok: false, code: null, message: friendlyError(error).message };
    }

    const result = data as
      | { ok: true; order_id: string; status: OrderStatus; total: number; currency: string; item_count: number; code?: string }
      | { ok: false; code?: string; msg?: string }
      | null;

    if (!result || !result.ok) {
      const code = (result as { code?: string } | null)?.code ?? null;
      const message = (result as { msg?: string } | null)?.msg || "Could not place this order. Please try again.";
      return { ok: false, code, message };
    }

    return {
      ok: true,
      orderId: result.order_id,
      status: result.status,
      total: Number(result.total),
      currency: result.currency,
      itemCount: result.item_count,
      replayed: result.code === "idempotent_replay",
    };
  } catch (e) {
    // Network failure never reaches Supabase's error shape above (thrown
    // instead of returned) — this is the "no connection at all" case.
    return { ok: false, code: null, message: friendlyError(e).message || "Network error. Please check your connection and try again." };
  }
}

export type ShopOrderItemRow = {
  id: string;
  listing_id: string | null;
  title_snapshot: string;
  image_snapshot: string | null;
  unit_price_snapshot: number;
  currency_snapshot: string;
  quantity: number;
  subtotal_snapshot: number;
};

export type ShopOrderStatusHistoryRow = {
  id: string;
  status: OrderStatus;
  note: string | null;
  changed_by: string;
  created_at: string;
};

export type ShopOrderRow = {
  id: string;
  business_id: string;
  customer_id: string;
  status: OrderStatus;
  fulfillment_method: FulfillmentMethod;
  delivery_address: string | null;
  customer_name: string;
  customer_phone: string;
  customer_note: string | null;
  item_count: number;
  total: number;
  currency: string;
  created_at: string;
  updated_at: string;
};

// Reads go through ordinary RLS-scoped `select` calls (not an RPC) — the
// same "shop_orders: customer or owner or admin read" policy that lets a
// customer see only their own orders governs this automatically. There is
// deliberately no client-side write path to any of these three tables.
export async function fetchShopOrderDetail(orderId: string): Promise<{
  order: ShopOrderRow | null;
  business: { id: string; name: string; logo: string | null } | null;
  items: ShopOrderItemRow[];
  history: ShopOrderStatusHistoryRow[];
  error: string | null;
}> {
  const [orderRes, itemsRes, historyRes] = await Promise.all([
    supabase.from("shop_orders").select("*").eq("id", orderId).maybeSingle(),
    supabase
      .from("shop_order_items")
      .select("id,listing_id,title_snapshot,image_snapshot,unit_price_snapshot,currency_snapshot,quantity,subtotal_snapshot")
      .eq("order_id", orderId)
      .order("created_at", { ascending: true }),
    supabase
      .from("shop_order_status_history")
      .select("id,status,note,changed_by,created_at")
      .eq("order_id", orderId)
      .order("created_at", { ascending: true }),
  ]);

  if (orderRes.error) {
    return { order: null, business: null, items: [], history: [], error: friendlyError(orderRes.error).message };
  }
  const order = (orderRes.data as ShopOrderRow | null) ?? null;
  if (!order) {
    return { order: null, business: null, history: [], items: [], error: "not-found" };
  }

  const businessRes = await supabase.from("businesses").select("id,name,logo").eq("id", order.business_id).maybeSingle();

  return {
    order,
    business: (businessRes.data as { id: string; name: string; logo: string | null } | null) ?? null,
    items: (itemsRes.data as ShopOrderItemRow[]) ?? [],
    history: (historyRes.data as ShopOrderStatusHistoryRow[]) ?? [],
    error: null,
  };
}

// Shared by both the customer and owner order-detail screens so a date
// reads identically wherever it appears.
export function formatOrderDateTime(iso: string): string {
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "";
}

// The exact transition table from Stage 1's update_shop_order_status RPC
// (see supabase/migrations/20260910120000_shop_orders_foundation.sql) —
// mirrored here only to drive which action buttons the owner sees. The RPC
// re-validates the transition itself regardless of what this offers.
export const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, { to: OrderStatus; label: string; danger?: boolean }[]> = {
  pending: [
    { to: "confirmed", label: "Confirm Order" },
    { to: "declined", label: "Decline Order", danger: true },
    { to: "cancelled", label: "Cancel Order", danger: true },
  ],
  confirmed: [
    { to: "preparing", label: "Start Preparing" },
    { to: "cancelled", label: "Cancel Order", danger: true },
  ],
  preparing: [
    { to: "ready", label: "Mark Ready" },
    { to: "cancelled", label: "Cancel Order", danger: true },
  ],
  ready: [{ to: "completed", label: "Mark Completed" }],
  declined: [],
  completed: [],
  cancelled: [],
};

export type UpdateShopOrderStatusResult = { ok: true; orderId: string; status: OrderStatus } | { ok: false; code: string | null; message: string };

// Thin wrapper around update_shop_order_status — the only allowed write
// path for order status. No direct client update to shop_orders exists
// anywhere in this app.
export async function updateShopOrderStatus(orderId: string, newStatus: OrderStatus, note?: string): Promise<UpdateShopOrderStatusResult> {
  try {
    const { data, error } = await supabase.rpc("update_shop_order_status", {
      p_order_id: orderId,
      p_new_status: newStatus,
      p_note: note || null,
    });

    if (error) {
      return { ok: false, code: null, message: friendlyError(error).message };
    }

    const result = data as { ok: true; order_id: string; status: OrderStatus } | { ok: false; code?: string; msg?: string } | null;
    if (!result || !result.ok) {
      const code = (result as { code?: string } | null)?.code ?? null;
      const message = (result as { msg?: string } | null)?.msg || "Could not update this order. Please try again.";
      return { ok: false, code, message };
    }
    return { ok: true, orderId: result.order_id, status: result.status };
  } catch (e) {
    return { ok: false, code: null, message: friendlyError(e).message || "Network error. Please check your connection and try again." };
  }
}

export type OwnerOrderListRow = {
  id: string;
  customer_name: string;
  item_count: number;
  total: number;
  currency: string;
  fulfillment_method: FulfillmentMethod;
  status: OrderStatus;
  created_at: string;
};

// List query for the owner inbox — the "shop_orders: customer or owner or
// admin read" RLS policy is what actually restricts this to the caller's
// own business; business_id is passed only to scope the query, never
// trusted as an authorization decision on its own (the calling screen
// verifies ownership itself before ever reaching this call — see
// app/business-orders/[id].tsx).
export async function fetchShopOrdersForBusiness(businessId: string): Promise<{ orders: OwnerOrderListRow[]; error: string | null }> {
  const { data, error } = await supabase
    .from("shop_orders")
    .select("id,customer_name,item_count,total,currency,fulfillment_method,status,created_at")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) return { orders: [], error: friendlyError(error).message };
  return { orders: (data as OwnerOrderListRow[]) ?? [], error: null };
}
