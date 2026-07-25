import { supabase } from "./supabase";

export type NotifMeta = {
  deepLink?: string | null;
  imageUrl?: string | null;
  conversationId?: string | null;
  listingId?: string | null;
  businessId?: string | null;
  profileId?: string | null;
  sellerId?: string | null;
  jobId?: string | null;
  applicationId?: string | null;
  [key: string]: unknown;
} | null;

export type NotificationRow = {
  id: string;
  title: string;
  body: string;
  type: string;
  read: boolean;
  created_at: string;
  meta: NotifMeta;
};

// Mirrors www/js/notifications.js's excludes: rental notifications live only
// in the Rental Business Platform's own list, never the personal feed.
export async function fetchNotifications(userId: string): Promise<NotificationRow[]> {
  const { data } = await supabase
    .from("notifications")
    .select("id,user_id,title,body,type,read,created_at,meta")
    .eq("user_id", userId)
    .or("category.is.null,category.neq.rental")
    .order("created_at", { ascending: false })
    .limit(50);
  return (data as NotificationRow[]) ?? [];
}

export function subscribeToNotifications(userId: string, onChange: () => void) {
  const channel = supabase
    .channel(`notifications:${userId}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
      (payload: any) => {
        if (payload.new?.category === "rental") return;
        onChange();
      }
    )
    .on(
      "postgres_changes",
      { event: "DELETE", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
      onChange
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}

export async function markNotifRead(id: string) {
  await supabase.from("notifications").update({ read: true }).eq("id", id);
}

export async function markAllNotifsRead(userId: string) {
  await supabase
    .from("notifications")
    .update({ read: true })
    .eq("user_id", userId)
    .eq("read", false)
    .or("category.is.null,category.neq.rental");
}

export async function deleteNotif(id: string) {
  await supabase.from("notifications").delete().eq("id", id);
}

export async function clearAllNotifs(userId: string) {
  await supabase.from("notifications").delete().eq("user_id", userId).or("category.is.null,category.neq.rental");
}

const TYPE_DOT_COLOR: Record<string, string> = {
  message: "#16A34A",
  sale: "#1D4ED8",
  boost: "#CA8A04",
  lead: "#1A3A8F",
  job_alert: "#475569",
  verify: "#1A3A8F",
  ban: "#DC2626",
  report: "#C2410C",
  review: "#7C3AED",
  security: "#DC2626",
  info: "#1A3A8F",
  listing_approved: "#1D4ED8",
  listing_rejected: "#DC2626",
  listing_flagged: "#DC2626",
  price_drop: "#CA8A04",
  saved_search_match: "#1A3A8F",
  listing_expiry: "#DC2626",
  stale_listing: "#CA8A04",
  view_milestone: "#CA8A04",
  job_application: "#475569",
  job_shortlisted: "#16A34A",
  job_declined: "#475569",
  personalized_recommendation: "#1A3A8F",
  chat_scam_warning: "#DC2626",
  shop_new_arrivals: "#1A3A8F",
  category_digest: "#CA8A04",
  verification_nudge: "#1A3A8F",
};

export function notifDotColor(type: string): string {
  return TYPE_DOT_COLOR[type] || "#1A3A8F";
}

// ── Deep-link routing ───────────────────────────────────────────────────────
// Single source of truth used by BOTH the in-app notifications list and the
// native FCM tap handler (lib/push.ts). Every notification type the app
// produces maps to a real expo-router route — never a broken/"page not found"
// path. Anything unresolvable falls back to a safe route.

export type ExpoRoute = { pathname: string; params?: Record<string, string> };

const SAFE_FALLBACK: ExpoRoute = { pathname: "/(tabs)" };

// Parse "chat:<id>" / "listing:<id>" / "profile:<id>" / "business:<id>"
// style deepLink strings, plus already-valid "/route" paths.
function parseDeepLinkString(raw?: string | null): ExpoRoute | null {
  if (!raw) return null;
  const s = raw.trim();
  if (!s || /^https?:\/\//i.test(s)) return null; // external URLs are not in-app routes
  if (s.startsWith("/")) return { pathname: s }; // already a router path
  const m = s.match(/^([a-z_]+)\s*:\s*(.+)$/i);
  if (!m) return null;
  const kind = m[1].toLowerCase();
  const id = m[2].trim();
  switch (kind) {
    case "chat":
    case "conversation":
    case "message":
      return { pathname: "/chat/[id]", params: { id } };
    case "listing":
    case "product":
    case "sale":
      return { pathname: "/listing/[id]", params: { id } };
    case "profile":
    case "user":
    case "seller":
      return { pathname: "/profile/[id]", params: { id } };
    case "business":
    case "shop":
    case "store":
      return { pathname: "/business/[id]", params: { id } };
    case "job":
      return { pathname: "/jobs/[id]", params: { id } };
    case "review":
      return { pathname: "/reviews/[id]", params: { id } };
    default:
      return null;
  }
}

// Types where the notification concerns the user's OWN listing status.
const OWN_LISTING_TYPES = new Set([
  "listing_approved",
  "listing_rejected",
  "listing_flagged",
  "listing_expiry",
  "stale_listing",
  "view_milestone",
]);

// Types that reference some listing the user may want to view.
const LISTING_TYPES = new Set([
  "sale",
  "price_drop",
  "personalized_recommendation",
  ...OWN_LISTING_TYPES,
]);

/**
 * Resolve a notification (row from the table OR an FCM data payload) into a
 * concrete in-app route. Accepts a loose shape so the push handler can pass the
 * raw `{ type, deepLink, conversationId, ... }` data object directly.
 */
export function resolveNotifRoute(n: {
  type?: string | null;
  meta?: NotifMeta;
  // FCM data payloads carry these flat, not under meta:
  deepLink?: string | null;
  conversationId?: string | null;
  listingId?: string | null;
  [key: string]: unknown;
}): ExpoRoute {
  const type = (n.type || "").toLowerCase();
  const meta: Record<string, any> = { ...(n.meta || {}) };
  // Merge any flat fields from an FCM data payload into meta.
  for (const k of ["deepLink", "conversationId", "listingId", "businessId", "profileId", "sellerId", "jobId", "applicationId"]) {
    if (n[k] != null && meta[k] == null) meta[k] = n[k];
  }

  const conversationId: string | undefined = meta.conversationId || undefined;
  const listingId: string | undefined = meta.listingId || undefined;
  const businessId: string | undefined = meta.businessId || undefined;
  const profileId: string | undefined = meta.profileId || meta.sellerId || undefined;

  // 1. Chat / message
  if (type === "message" || type === "chat_scam_warning") {
    if (conversationId) return { pathname: "/chat/[id]", params: { id: conversationId } };
    const parsed = parseDeepLinkString(meta.deepLink);
    if (parsed) return parsed;
    return { pathname: "/(tabs)/messages" };
  }

  // 2. Listing-oriented types
  if (LISTING_TYPES.has(type)) {
    const parsed = parseDeepLinkString(meta.deepLink);
    if (parsed) return parsed;
    if (listingId) return { pathname: "/listing/[id]", params: { id: listingId } };
    if (OWN_LISTING_TYPES.has(type)) return { pathname: "/my-listings" };
    return { pathname: "/(tabs)/search" };
  }

  // 3. Jobs — applications/recruiter side
  if (type === "lead" || type === "job_application" || type === "job_shortlisted" || type === "job_declined") {
    const parsed = parseDeepLinkString(meta.deepLink);
    if (parsed) return parsed;
    if (meta.jobId) return { pathname: "/jobs/[id]", params: { id: String(meta.jobId) } };
    return { pathname: "/jobs/applications" };
  }
  if (type === "job_alert") {
    const parsed = parseDeepLinkString(meta.deepLink);
    if (parsed) return parsed;
    if (meta.jobId) return { pathname: "/jobs/[id]", params: { id: String(meta.jobId) } };
    return { pathname: "/jobs/index" };
  }

  // 4. Verification
  if (type === "verify" || type === "verification_nudge") {
    return { pathname: "/verify" };
  }

  // 5. Review — listing if resolvable, else seller profile
  if (type === "review") {
    const parsed = parseDeepLinkString(meta.deepLink);
    if (parsed) return parsed;
    if (listingId) return { pathname: "/listing/[id]", params: { id: listingId } };
    if (profileId) return { pathname: "/profile/[id]", params: { id: profileId } };
    return SAFE_FALLBACK;
  }

  // 6. Discovery digests
  if (type === "saved_search_match" || type === "category_digest" || type === "shop_new_arrivals") {
    const parsed = parseDeepLinkString(meta.deepLink);
    if (parsed) return parsed;
    if (businessId) return { pathname: "/business/[id]", params: { id: businessId } };
    if (type === "saved_search_match") return { pathname: "/saved-searches" };
    return { pathname: "/(tabs)/search" };
  }

  // 7. Security
  if (type === "security") {
    return { pathname: "/active-sessions" };
  }

  // 8. Moderation
  if (type === "ban" || type === "report") {
    const parsed = parseDeepLinkString(meta.deepLink);
    if (parsed) return parsed;
    return { pathname: "/settings" };
  }

  // 9. Boost / info / anything else — honor deepLink, else safe fallback.
  const parsed = parseDeepLinkString(meta.deepLink);
  if (parsed) return parsed;
  if (conversationId) return { pathname: "/chat/[id]", params: { id: conversationId } };
  if (listingId) return { pathname: "/listing/[id]", params: { id: listingId } };
  return SAFE_FALLBACK;
}

export function dayLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const same = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (same(d, now)) return "Today";
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (same(d, yesterday)) return "Yesterday";
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: d.getFullYear() === now.getFullYear() ? undefined : "numeric" });
}
