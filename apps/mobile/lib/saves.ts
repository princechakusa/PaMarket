import { supabase } from "./supabase";

// Real backend-backed saved listings (table: user_saves — see
// supabase/schema/user_saves.sql). Replaces the earlier client-only stub so
// Save works end-to-end and Favourites shows real data across devices.

export async function fetchSavedListingIds(userId: string): Promise<Set<string>> {
  const { data } = await supabase.from("user_saves").select("listing_id").eq("user_id", userId);
  return new Set((data ?? []).map((r: { listing_id: string }) => r.listing_id));
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
