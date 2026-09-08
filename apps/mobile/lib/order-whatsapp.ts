// WhatsApp handoff for a shop order — a customer sharing their own order to
// the shop, and an owner reaching a customer back. Kept separate from
// lib/shop-orders.ts (RPCs/formatting) since this is UI-adjacent
// share/contact logic, not order data access.
//
// This never sends anything automatically: every call here opens the
// device's own WhatsApp/share/dialer UI with a pre-filled, user-editable
// draft — the user still has to review and tap Send themselves. Nothing
// here writes to the database, calls an order RPC, or can create/duplicate
// an order or a notification; it only composes text and opens a URL via
// the existing lib/open-url.ts utility (the same one every other
// contact-seller/contact-shop action in the app already uses).
import { Platform, Share } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import { openWhatsApp, openPhone } from "./open-url";
import { toast } from "../components/ui/Toast";
import { orderWebUrl } from "./site-urls";
import { logClientError } from "./error-log";
import { FULFILLMENT_LABELS, type FulfillmentMethod } from "./shop-orders";

// Businesses keep phone and whatsapp as distinct optional fields (see
// app/business/[id].tsx: call uses business.phone, WhatsApp uses
// business.whatsapp, and the WhatsApp button only renders when whatsapp is
// set). A shop's order-request WhatsApp action falls back to phone only
// because, unlike the storefront where a separate Call button already
// covers `phone`, there is no sibling action here to fall back to — a
// shop that lists a phone number but no distinct WhatsApp number very
// often still reaches customers on that same number over WhatsApp.
export function resolveShopWhatsAppNumber(business: { phone?: string | null; whatsapp?: string | null } | null): string | null {
  const raw = business?.whatsapp || business?.phone || "";
  const digits = raw.replace(/[^0-9]/g, "");
  return digits.length >= 9 ? digits : null;
}

export type OrderWhatsAppInput = {
  orderId: string;
  shopName: string;
  itemLines: { title: string; quantity: number }[];
  fulfillmentMethod: FulfillmentMethod;
  deliveryAddress?: string | null;
  customerNote?: string | null;
};

// Deliberately excludes price, subtotal, and total — this is an order
// request awaiting shop confirmation, not a receipt or invoice, and must
// never read like an in-app purchase. No customer name/phone either (the
// WhatsApp chat itself already identifies the sender to the shop), and no
// passwords/tokens/service-role data. The link only ever carries the order
// id (never an auth token) — orderWebUrl's own destination is responsible
// for authenticating the visitor before showing anything.
export function buildWhatsAppOrderMessage(input: OrderWhatsAppInput): string {
  const reference = input.orderId.slice(0, 8).toUpperCase();
  const lines: string[] = [];
  lines.push(`PaMarket — Order Request`);
  lines.push(`Shop: ${input.shopName}`);
  lines.push(`Reference: #${reference}`);
  lines.push("");
  lines.push("Items requested:");
  for (const item of input.itemLines) {
    lines.push(`- ${item.quantity} x ${item.title}`);
  }
  lines.push("");
  lines.push(`Fulfillment: ${FULFILLMENT_LABELS[input.fulfillmentMethod]}`);
  if (input.fulfillmentMethod === "delivery" && input.deliveryAddress) {
    lines.push(`Delivery address: ${input.deliveryAddress}`);
  }
  if (input.customerNote) {
    lines.push(`Note: ${input.customerNote}`);
  }
  lines.push("");
  lines.push(`View and confirm this order request: ${orderWebUrl(input.orderId)}`);
  lines.push("");
  lines.push("This is an order request awaiting shop confirmation in PaMarket — not a payment, and no payment has been made.");
  return lines.join("\n");
}

export type OrderImageShareResult = "shared" | "text_only" | "unsupported_platform" | "download_failed";

// Best-effort single-photo attachment. React Native's built-in Share API
// can attach a local file via `url` on iOS, but has no cross-platform way
// to attach a file on Android without an additional native module
// (expo-sharing is not currently installed in this app) — so on Android
// this always falls back to the text-only message, honestly, rather than
// presenting a button that silently does nothing. The photo is downloaded
// to a throwaway cache file (never written to permanent storage) purely so
// the OS share sheet has something local to attach; nothing here uploads,
// modifies, or persists the image anywhere.
export async function shareOrderWithImage(
  phoneDigits: string | null,
  message: string,
  imageUrl: string | null
): Promise<OrderImageShareResult> {
  if (Platform.OS !== "ios" || !imageUrl) {
    await shareOrderToWhatsApp(phoneDigits, message);
    return Platform.OS !== "ios" ? "unsupported_platform" : "text_only";
  }
  try {
    const localUri = `${FileSystem.cacheDirectory}pamarket-order-photo-${Date.now()}.jpg`;
    const download = await FileSystem.downloadAsync(imageUrl, localUri);
    if (download.status !== 200) throw new Error(`download status ${download.status}`);
    // Share.share's `url` field is what lets iOS attach a local file — the
    // customer still sees the OS share sheet (with a preview of the photo)
    // and picks WhatsApp themselves; nothing is sent automatically.
    await Share.share({ message, url: localUri });
    FileSystem.deleteAsync(localUri, { idempotent: true }).catch(() => {});
    return "shared";
  } catch (e) {
    logClientError({ error: e, screen: "shop-order/[id]", component: "shareOrderWithImage", severity: "warning" });
    await shareOrderToWhatsApp(phoneDigits, message);
    return "download_failed";
  }
}

// Tries WhatsApp first (the safe existing utility, which already shows a
// friendly toast on failure); if that genuinely couldn't open, falls back
// to the native share sheet so the customer can still send the same draft
// through SMS, email, or anything else installed. Either way the customer
// reviews and sends it themselves — nothing here is automatic.
export async function shareOrderToWhatsApp(phoneDigits: string | null, message: string): Promise<void> {
  if (phoneDigits) {
    const opened = await openWhatsApp(phoneDigits, message);
    if (opened) return;
  } else {
    toast("This shop hasn't added a WhatsApp number yet.", 4000, true);
  }
  try {
    await Share.share({ message });
  } catch {
    // Share.share rejects only if the user cancels or the OS sheet itself
    // fails to open — either way there is nothing further to recover from
    // here, and openWhatsApp/Share already surfaced what happened.
  }
}

// Owner reaching the customer back — reuses the same call/WhatsApp icons
// already used for contacting a seller (app/listing/[id].tsx) and a shop
// (app/business/[id].tsx). No message is pre-filled or sent automatically;
// openWhatsApp with no text just opens the chat itself.
export async function contactCustomerByWhatsApp(phoneDigits: string | null): Promise<void> {
  if (!phoneDigits) {
    toast("No valid phone number for this customer.", 4000, true);
    return;
  }
  await openWhatsApp(phoneDigits);
}

export async function contactCustomerByPhone(phoneDigits: string | null): Promise<void> {
  if (!phoneDigits) {
    toast("No valid phone number for this customer.", 4000, true);
    return;
  }
  await openPhone(phoneDigits);
}

export function normalizedPhoneDigits(raw: string | null | undefined): string | null {
  const digits = (raw || "").replace(/[^0-9]/g, "");
  return digits.length >= 9 ? digits : null;
}
