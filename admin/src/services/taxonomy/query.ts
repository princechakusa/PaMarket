// Batch 4: Marketplace Taxonomy. One shared architecture over the real
// `categories` table that mobile/website already consume (apps/mobile/lib/
// taxonomy.ts) -- listing.category values match categories.legacy_key.
// Rentals has its own separate, pre-existing rental_categories table
// (different vertical, different lifecycle) and is intentionally not
// merged into this one. Deactivation is preferred over deletion wherever
// listings reference a category; there is no DELETE path here at all.
import { getSupabaseClient } from '../supabase/client';
import { normalizeError, type NormalizedError } from '../errors/normalize-error';

export type QueryResult<T> = { data: T; error: null } | { data: null; error: NormalizedError };

function unavailable<T>(): QueryResult<T> {
  return { data: null, error: { code: 'client_unavailable', message: 'Live Supabase is not configured.', retryable: false } };
}

export type CategoryRow = { id: string; legacy_key: string | null; slug: string | null; name: string | null; description: string | null; icon: string | null; is_active: boolean | null; sort_order: number | null };
export async function listCategories(): Promise<QueryResult<CategoryRow[]>> {
  const client = getSupabaseClient();
  if (!client) return unavailable();
  const { data, error } = await client.from('categories').select('id, legacy_key, slug, name, description, icon, is_active, sort_order').order('sort_order', { ascending: true });
  if (error) return { data: null, error: normalizeError(error) };
  return { data: data ?? [], error: null };
}

export async function getCategoryListingCount(category: CategoryRow): Promise<QueryResult<number>> {
  const client = getSupabaseClient();
  if (!client) return unavailable();
  const key = category.legacy_key ?? category.slug ?? '';
  const { count, error } = await client.from('listings').select('*', { count: 'exact', head: true }).eq('category', key);
  if (error) return { data: null, error: normalizeError(error) };
  return { data: count ?? 0, error: null };
}

export async function updateCategory(id: string, patch: { name?: string; description?: string; icon?: string; sort_order?: number }, updatedBy: string): Promise<QueryResult<true>> {
  const client = getSupabaseClient();
  if (!client) return unavailable();
  const { error } = await client.from('categories').update({ ...patch, updated_by: updatedBy, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) return { data: null, error: normalizeError(error) };
  return { data: true, error: null };
}

/** Archive/deactivate only -- there is no delete path, by design, since
 * listings reference categories by key. */
// ── Safe meeting spots (safe_meeting_spots) ─────────────────────────────
// Busy public places shown to buyers on listings in the same city.
export type SafeSpotRow = { id: string; city: string; name: string; area: string | null; note: string | null; is_active: boolean; sort_order: number };
export type SafeSpotDraft = { id?: string; city: string; name: string; area: string; note: string; is_active: boolean; sort_order: number };

export async function listSafeSpots(): Promise<QueryResult<SafeSpotRow[]>> {
  const client = getSupabaseClient();
  if (!client) return unavailable();
  const { data, error } = await client.from('safe_meeting_spots').select('id, city, name, area, note, is_active, sort_order').order('city').order('sort_order');
  if (error) return { data: null, error: normalizeError(error) };
  return { data: (data ?? []) as SafeSpotRow[], error: null };
}

export async function saveSafeSpot(spot: SafeSpotDraft): Promise<QueryResult<true>> {
  const client = getSupabaseClient();
  if (!client) return unavailable();
  const payload = { city: spot.city.trim(), name: spot.name.trim(), area: spot.area.trim() || null, note: spot.note.trim() || null, is_active: spot.is_active, sort_order: spot.sort_order, updated_at: new Date().toISOString() };
  const { error } = spot.id
    ? await client.from('safe_meeting_spots').update(payload).eq('id', spot.id)
    : await client.from('safe_meeting_spots').insert(payload);
  if (error) return { data: null, error: normalizeError(error) };
  return { data: true, error: null };
}

export async function deleteSafeSpot(id: string): Promise<QueryResult<true>> {
  const client = getSupabaseClient();
  if (!client) return unavailable();
  const { error } = await client.from('safe_meeting_spots').delete().eq('id', id);
  if (error) return { data: null, error: normalizeError(error) };
  return { data: true, error: null };
}

export async function setCategoryActive(id: string, isActive: boolean, updatedBy: string): Promise<QueryResult<true>> {
  const client = getSupabaseClient();
  if (!client) return unavailable();
  const { error } = await client.from('categories').update({ is_active: isActive, updated_by: updatedBy, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) return { data: null, error: normalizeError(error) };
  return { data: true, error: null };
}
