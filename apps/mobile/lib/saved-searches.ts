import { supabase } from "./supabase";
import type { BrowseFilters } from "./listings";

export type SavedSearch = {
  id: string;
  user_id: string;
  query: string | null;
  category: string | null;
  name: string;
  filters: Record<string, unknown>;
  saved_at: string;
};

export async function fetchSavedSearches(userId: string): Promise<SavedSearch[]> {
  const { data } = await supabase
    .from("saved_searches")
    .select("id,user_id,query,category,name,filters,saved_at")
    .eq("user_id", userId)
    .order("saved_at", { ascending: false });
  return (data as SavedSearch[]) ?? [];
}

// Mirrors www/js/browse.js's save action — persists the current query +
// category + full filter set so it can be re-run identically later.
export async function saveSearch(userId: string, filters: BrowseFilters) {
  const name = filters.query.trim() || (filters.categories[0] ? filters.categories[0] : "All listings");
  await supabase.from("saved_searches").insert({
    user_id: userId,
    query: filters.query.trim() || null,
    category: filters.categories[0] ?? null,
    name,
    filters: filters as unknown as Record<string, unknown>,
  });
}

export async function deleteSavedSearch(id: string) {
  await supabase.from("saved_searches").delete().eq("id", id);
}
