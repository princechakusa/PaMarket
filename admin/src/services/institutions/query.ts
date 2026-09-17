// Institutions Phase 2: Admin service over the real public.institutions
// table (Phase 1, already deployed). Follows the exact services/*/query.ts
// convention used by taxonomy/content/businesses -- QueryResult<T>,
// unavailable() guard, .range() pagination, normalizeError(). Deactivation
// only -- there is no DELETE path here at all, matching Taxonomy's design
// (listings.institution_id references institutions by id; deactivating
// hides an institution from public reads without breaking that reference).
// province_id/city_id reuse the existing provinces/cities tables (first
// Admin-side read of them -- they were never consumed by Admin before).
import { getSupabaseClient } from '../supabase/client';
import { normalizeError, type NormalizedError } from '../errors/normalize-error';

export type QueryResult<T> = { data: T; error: null } | { data: null; error: NormalizedError };
export type Page<T> = { rows: T[]; total: number; page: number; pageSize: number };

function unavailable<T>(): QueryResult<T> {
  return { data: null, error: { code: 'client_unavailable', message: 'Live Supabase is not configured.', retryable: false } };
}

export const INSTITUTIONS_PAGE_SIZE = 20;

export type InstitutionType = 'university' | 'high_school' | 'organization';

export type InstitutionRow = {
  id: string; type: string | null; official_name: string | null; short_name: string | null;
  search_aliases: string[] | null; province_id: string | null; city_id: string | null; suburb: string | null;
  logo_url: string | null; cover_image: string | null; founded_year: number | null;
  description: string | null; is_active: boolean | null; sort_order: number | null;
};

export type ProvinceRow = { id: string; code: string | null; name: string | null };
export type CityRow = { id: string; name: string | null; province_id: string | null };

export async function listProvinces(): Promise<QueryResult<ProvinceRow[]>> {
  const client = getSupabaseClient();
  if (!client) return unavailable();
  const { data, error } = await client.from('provinces').select('id, code, name').eq('is_active', true).order('sort_order', { ascending: true });
  if (error) return { data: null, error: normalizeError(error) };
  return { data: data ?? [], error: null };
}

export async function listCitiesForProvince(provinceId: string): Promise<QueryResult<CityRow[]>> {
  const client = getSupabaseClient();
  if (!client) return unavailable();
  const { data, error } = await client.from('cities').select('id, name, province_id').eq('province_id', provinceId).eq('is_active', true).order('sort_order', { ascending: true });
  if (error) return { data: null, error: normalizeError(error) };
  return { data: data ?? [], error: null };
}

export type InstitutionFilters = { search?: string; type?: InstitutionType; provinceId?: string; cityId?: string; active?: boolean };

export async function listInstitutions(filters: InstitutionFilters, page: number, pageSize = INSTITUTIONS_PAGE_SIZE): Promise<QueryResult<Page<InstitutionRow>>> {
  const client = getSupabaseClient();
  if (!client) return unavailable();
  let query = client
    .from('institutions')
    .select('id, type, official_name, short_name, search_aliases, province_id, city_id, suburb, logo_url, cover_image, founded_year, description, is_active, sort_order', { count: 'exact' })
    .order('sort_order', { ascending: true });
  if (filters.search) query = query.ilike('official_name', `%${filters.search.trim()}%`);
  if (filters.type) query = query.eq('type', filters.type);
  if (filters.provinceId) query = query.eq('province_id', filters.provinceId);
  if (filters.cityId) query = query.eq('city_id', filters.cityId);
  if (filters.active !== undefined) query = query.eq('is_active', filters.active);
  const from = Math.max(0, page - 1) * pageSize;
  const { data, error, count } = await query.range(from, from + pageSize - 1);
  if (error) return { data: null, error: normalizeError(error) };
  return { data: { rows: data ?? [], total: count ?? 0, page: Math.max(1, page), pageSize }, error: null };
}

export async function getInstitutionListingCount(institutionId: string): Promise<QueryResult<number>> {
  const client = getSupabaseClient();
  if (!client) return unavailable();
  const { count, error } = await client.from('listings').select('*', { count: 'exact', head: true }).eq('institution_id', institutionId);
  if (error) return { data: null, error: normalizeError(error) };
  return { data: count ?? 0, error: null };
}

export type InstitutionInput = {
  type: InstitutionType; official_name: string; short_name?: string | null; search_aliases?: string[];
  province_id: string; city_id: string; suburb?: string | null; logo_url?: string | null;
  cover_image?: string | null; founded_year?: number | null; description?: string | null;
  is_active?: boolean; sort_order?: number;
};

export async function createInstitution(input: InstitutionInput, createdBy: string): Promise<QueryResult<{ id: string }>> {
  const client = getSupabaseClient();
  if (!client) return unavailable();
  const { data, error } = await client.from('institutions').insert({ ...input, created_by: createdBy }).select('id').single();
  if (error) return { data: null, error: normalizeError(error) };
  return { data, error: null };
}

export async function updateInstitution(id: string, patch: Partial<InstitutionInput>, updatedBy: string): Promise<QueryResult<true>> {
  const client = getSupabaseClient();
  if (!client) return unavailable();
  const { error } = await client.from('institutions').update({ ...patch, updated_by: updatedBy, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) return { data: null, error: normalizeError(error) };
  return { data: true, error: null };
}

/** Deactivate/reactivate only -- there is no delete path here at all,
 * matching Taxonomy's design and the Phase 1 database design (institutions
 * are referenced by listings.institution_id; hiding is safe, deleting a
 * still-referenced row is not something this UI should ever trigger). */
export async function setInstitutionActive(id: string, isActive: boolean, updatedBy: string): Promise<QueryResult<true>> {
  const client = getSupabaseClient();
  if (!client) return unavailable();
  const { error } = await client.from('institutions').update({ is_active: isActive, updated_by: updatedBy, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) return { data: null, error: normalizeError(error) };
  return { data: true, error: null };
}
