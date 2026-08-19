import { supabase } from "./supabase";
import { publicListingExpiryFilter } from "./listings";

// Real backend-backed saved listings (table: user_saves — see
// supabase/schema/user_saves.sql). Replaces the earlier client-only stub so
// Save works end-to-end and Favourites shows real data across devices.

export async function fetchSavedListingIds(userId: string): Promise<Set<string>> {
  const { data } = await supabase.from("user_saves").select("listing_id").eq("user_id", userId).limit(2000);
  return new Set((data ?? []).map((r: { listing_id: string }) => r.listing_id));
}

// Counts only saves whose listing still actually exists. user_saves.listing_id
// has no foreign key to listings (plain text column, no constraint), so a row
// isn't cleaned up when its listing is later hard-deleted — a raw count of
// fetchSavedListingIds() can be higher than what Favourites actually shows
// (that screen fetches the listing rows themselves and silently drops any
// id that no longer resolves to one). Anywhere a "you have N saved" count is
// displayed should use this instead, so it always matches what opening
// Favourites shows.
export async function fetchValidSavedCount(userId: string): Promise<number> {
  const ids = await fetchSavedListingIds(userId);
  if (!ids.size) return 0;
  const { count } = await supabase
    .from("listings")
    .select("id", { count: "exact", head: true })
    .eq("status", "active")
    .or(publicListingExpiryFilter())
    .in("id", Array.from(ids));
  return count ?? 0;
}

export async function isListingSaved(userId: string, listingId: string): Promise<boolean> {
  const { data } = await supabase
    .from("user_saves")
    .select("id")
    .eq("user_id", userId)
    .eq("listing_id", listingId)
    .maybeSingle();
  return !!data;
}

export async function saveListing(userId: string, listingId: string) {
  await supabase.from("user_saves").upsert(
    { user_id: userId, listing_id: listingId },
    { onConflict: "user_id,listing_id" }
  );
}

export async function unsaveListing(userId: string, listingId: string) {
  await supabase.from("user_saves").delete().eq("user_id", userId).eq("listing_id", listingId);
}

export async function toggleSave(userId: string, listingId: string, currentlySaved: boolean) {
  if (currentlySaved) await unsaveListing(userId, listingId);
  else await saveListing(userId, listingId);
}
