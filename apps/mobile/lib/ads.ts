import { supabase } from "./supabase";

export type PaidAd = {
  id: string;
  type: string;
  businessName: string;
  headline: string;
  tagline: string;
  imageUrl: string | null;
  bgColor: string;
  linkUrl: string | null;
  targetCat: string | null;
  listingId: string | null;
  startsAt: number;
  endsAt: number;
  active: boolean;
  priority: number;
  impressions: number;
  clicks: number;
};

export async function fetchActiveAds(): Promise<PaidAd[]> {
  const { data, error } = await supabase.from("paid_ads").select("*").eq("active", true).limit(20);
  if (error || !data) return [];
  const now = Date.now();
  const mapped: PaidAd[] = data.map((r: any) => ({
    id: r.id,
    type: r.type || "banner",
    businessName: r.business_name || r.title || "Sponsored",
    headline: r.headline || r.title || "",
    tagline: r.tagline || "",
    imageUrl: r.image_url || null,
    bgColor: r.bg_color || "#1A3A8F",
    linkUrl: r.link_url || null,
    targetCat: r.target_cat || null,
    listingId: r.listing_id || null,
    startsAt: r.starts_at ? new Date(r.starts_at).getTime() : 0,
    endsAt: r.ends_at ? new Date(r.ends_at).getTime() : 9999999999999,
    active: r.active,
    priority: r.priority || 0,
    impressions: r.impressions || 0,
    clicks: r.clicks || 0,
  }));
  mapped.sort((a, b) => b.priority - a.priority);
  return mapped.filter((a) => a.active && a.startsAt <= now && a.endsAt > now);
}

export function adsForCategory(ads: PaidAd[], cat?: string | null): PaidAd[] {
  if (!cat) return ads;
  return ads.filter((a) => !a.targetCat || a.targetCat === cat);
}

export async function trackAdImpression(id: string) {
  const { data } = await supabase.from("paid_ads").select("impressions").eq("id", id).maybeSingle();
  if (!data) return;
  await supabase
    .from("paid_ads")
    .update({ impressions: (data.impressions || 0) + 1 })
    .eq("id", id);
}

// Mirrors www/js/app.js H._setupRealtimeAds: keeps the ads feed live so new
// promos/announcements from admin appear without a manual refresh.
export function subscribeToAds(onChange: (ads: PaidAd[]) => void) {
  // Unique topic per call — a fixed topic can collide with a same-named
  // channel from a previous mount still mid-teardown, throwing "cannot add
  // postgres_changes callbacks after subscribe()" on remount.
  const channel = supabase
    .channel(`paid-ads-live-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "paid_ads" }, () => {
      fetchActiveAds().then(onChange);
    })
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "paid_ads" }, () => {
      fetchActiveAds().then(onChange);
    })
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}

export async function trackAdClick(id: string) {
  const { data } = await supabase.from("paid_ads").select("clicks").eq("id", id).maybeSingle();
  if (!data) return;
  await supabase
    .from("paid_ads")
    .update({ clicks: (data.clicks || 0) + 1 })
    .eq("id", id);
}
