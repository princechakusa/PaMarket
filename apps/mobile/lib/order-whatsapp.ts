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
import { Share } from "react-native";
import { openWhatsApp, openPhone } from "./open-url";
import { toast } from "../components/ui/Toast";
import { orderWebUrl } from "./site-urls";
import { FULFILLMENT_LABELS, formatMoney, type FulfillmentMethod, type OrderStatus } from "./shop-orders";

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
  total: number;
  currency: string;
  fulfillmentMethod: FulfillmentMethod;
  deliveryAddress?: string | null;
  customerNote?: string | null;
};

// Exactly the fields the spec calls for — no customer name/phone (the
// WhatsApp chat itself already identifies the sender to the shop), no
// passwords/tokens, no raw ids beyond what the link itself needs, and the
// total is always the value the caller already read back from the server
// (create_shop_order's response or the order row itself), never
// recomputed here.
export function buildWhatsAppOrderMessage(input: OrderWhatsAppInput): string {
  const reference = input.orderId.slice(0, 8).toUpperCase();
  const lines: string[] = [];
  lines.push(`PaMarket order request — ${input.shopName}`);
  lines.push(`Order #${reference}`);
  lines.push("");
  lines.push("Items:");
  for (const item of input.itemLines) {
    lines.push(`- ${item.quantity} x ${item.title}`);
  }
  lines.push("");
  lines.push(`Total: ${formatMoney(input.total, input.currency)}`);
  lines.push(`Fulfillment: ${FULFILLMENT_LABELS[input.fulfillmentMethod]}`);
  if (input.fulfillmentMethod === "delivery" && input.deliveryAddress) {
    lines.push(`Delivery address: ${input.deliveryAddress}`);
  }
  if (input.customerNote) {
    lines.push(`Note: ${input.customerNote}`);
  }
  lines.push("");
  lines.push(`Open and confirm this order in PaMarket: ${orderWebUrl(input.orderId)}`);
  lines.push("");
  lines.push("This order is still pending — the official record is inside PaMarket and stays pending until you confirm it there. This message is not a payment and no payment has been made.");
  return lines.join("\n");
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
