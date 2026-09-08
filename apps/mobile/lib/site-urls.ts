// Builds public pamarketzw.com URLs for content the app shares outward
// (listing share sheet today; business/rental share can reuse this the
// same way once those exist). Mirrors js/utils/urls.js's slugify/
// listingPath/listingUrl EXACTLY — the website statically pre-renders a
// real page at this path (tools/prerender.js writes l/<slug>-<id>.html,
// served extensionless), so a mismatched slug algorithm here would share a
// URL that 404s. If that website logic ever changes, this must change with
// it.
export const SITE_ORIGIN = "https://pamarketzw.com";

export function slugify(text: string | null | undefined): string {
  return (
    String(text || "listing")
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "") // strip accents
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60)
      .replace(/-+$/g, "") || "listing"
  );
}

export function listingPath(listing: { id: string; title?: string | null }): string {
  return `l/${slugify(listing.title)}-${listing.id}`;
}

export function listingUrl(listing: { id: string; title?: string | null }): string {
  return `${SITE_ORIGIN}/${listingPath(listing)}`;
}

// Private, authenticated order page (order.html, served extensionless like
// every other top-level page on this site — see tools/build-includes.js's
// header/footer convention). Unlike listing pages, this is never
// pre-rendered and never indexed (order.html sets noindex,nofollow): the
// page itself requires sign-in, then relies on the exact same
// shop_orders/shop_order_items/shop_order_status_history RLS policies the
// mobile app uses, so a signed-out visitor or the wrong signed-in user
// never sees another customer's or shop's order data. The order id in the
// query string is never treated as authorization by that page — only as
// which row to ask RLS for.
export function orderWebUrl(orderId: string): string {
  return `${SITE_ORIGIN}/order?id=${encodeURIComponent(orderId)}`;
}
