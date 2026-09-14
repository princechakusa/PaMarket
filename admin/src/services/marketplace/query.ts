// Batch 1: Marketplace (Listings + category workspaces: Jobs, Services,
// Property, Vehicle Sales). All five reuse this single query module and
// the `listings` table filtered by `category` — not five separate
// architectures. Reuses existing RLS: "listings: admin update" (is_admin())
// for mutation, "listings: public read active" (active rows are public;
// admin/super_admin see every status; moderator is NOT included in the
// non-active branch — see the C2E-19-adjacent finding in the Batch 1
// report, not fixed here).
import { getSupabaseClient } from '../supabase/client';
import { normalizeError, type NormalizedError } from '../errors/normalize-error';

export type QueryResult<T> = { data: T; error: null } | { data: null; error: NormalizedError };
export type Page<T> = { rows: T[]; total: number; page: number; pageSize: number };

function unavailable<T>(): QueryResult<T> {
  return { data: null, error: { code: 'client_unavailable', message: 'Live Supabase is not configured.', retryable: false } };
}

export const LISTINGS_PAGE_SIZE = 20;
export const LISTING_CATEGORIES = ['electronics', 'other', 'fashion', 'services', 'furniture', 'vehicles', 'pets', 'kids', 'property', 'jobs', 'agriculture'] as const;
export const LISTING_STATUSES = ['pending', 'active', 'paused', 'under_review', 'flagged', 'sold', 'removed', 'deleted'] as const;

export type ListingRow = {
  id: string; title: string | null; category: string | null; status: string | null;
  province: string | null; city: string | null; price: number | null; currency: string | null;
  seller_id: string | null; seller_name: string | null; created_at: string | null; updated_at: string | null;
};

export type ListingFilters = { category?: string; status?: string; province?: string; search?: string };

export async function listListings(filters: ListingFilters, page: number, pageSize = LISTINGS_PAGE_SIZE): Promise<QueryResult<Page<ListingRow>>> {
  const client = getSupabaseClient();
  if (!client) return unavailable();

  let query = client
    .from('listings')
    .select('id, title, category, status, province, city, price, currency, seller_id, seller_name, created_at, updated_at', { count: 'exact' })
    .order('created_at', { ascending: false });

  if (filters.category) query = query.eq('category', filters.category);
  if (filters.status) query = query.eq('status', filters.status);
  if (filters.province) query = query.eq('province', filters.province);
  if (filters.search) {
    const term = filters.search.trim();
    if (term) query = query.or(`title.ilike.%${term}%,seller_name.ilike.%${term}%,id.eq.${term}`);
  }

  const from = Math.max(0, page - 1) * pageSize;
  const { data, error, count } = await query.range(from, from + pageSize - 1);
  if (error) return { data: null, error: normalizeError(error) };
  return { data: { rows: data ?? [], total: count ?? 0, page: Math.max(1, page), pageSize }, error: null };
}

export type ListingDetail = ListingRow & {
  description: string | null; suburb: string | null; photos: string[] | null; seller_phone: string | null;
  condition: string | null; business_id: string | null; views: number | null; expires_at: string | null;
};

export async function getListing(id: string): Promise<QueryResult<ListingDetail | null>> {
  const client = getSupabaseClient();
  if (!client) return unavailable();
  const { data, error } = await client
    .from('listings')
    .select('id, title, description, category, status, province, city, suburb, price, currency, photos, seller_id, seller_name, seller_phone, condition, business_id, views, created_at, updated_at, expires_at')
    .eq('id', id)
    .maybeSingle();
  if (error) return { data: null, error: normalizeError(error) };
  return { data: data ?? null, error: null };
}

export type ListingReportRow = { id: string; status: string | null; reason: string | null; severity: string | null; created_at: number | null };
export async function getListingReports(listingId: string): Promise<QueryResult<ListingReportRow[]>> {
  const client = getSupabaseClient();
  if (!client) return unavailable();
  const { data, error } = await client
    .from('reports')
    .select('id, status, reason, severity, created_at')
    .eq('target_type', 'listing')
    .eq('target_id', listingId)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) return { data: null, error: normalizeError(error) };
  return { data: data ?? [], error: null };
}

/** Uses the existing "listings: admin update" RLS policy (is_admin()) directly
 * — no new RPC. Fails closed (a 403 from Postgres) for any caller that
 * policy doesn't cover, including moderator (see module header note). */
export async function updateListingStatus(id: string, status: string): Promise<QueryResult<{ id: string }>> {
  const client = getSupabaseClient();
  if (!client) return unavailable();
  const { data, error } = await client.from('listings').update({ status }).eq('id', id).select('id').maybeSingle();
  if (error) return { data: null, error: normalizeError(error) };
  if (!data) return { data: null, error: { code: 'forbidden', message: 'Not authorized to update this listing, or it no longer exists.', retryable: false } };
  return { data, error: null };
}

export type ApplicationRow = {
  id: string; applicant_name: string | null; applicant_phone: string | null; applicant_email: string | null;
  message: string | null; status: string | null; applied_at: string | null;
};

/** applications RLS ("applications: read") already includes is_moderator()
 * — admin/super_admin/moderator can all read every application for any job. */
export async function listApplicationsForJob(jobId: string): Promise<QueryResult<ApplicationRow[]>> {
  const client = getSupabaseClient();
  if (!client) return unavailable();
  const { data, error } = await client
    .from('applications')
    .select('id, applicant_name, applicant_phone, applicant_email, message, status, applied_at')
    .eq('job_id', jobId)
    .order('applied_at', { ascending: false });
  if (error) return { data: null, error: normalizeError(error) };
  return { data: data ?? [], error: null };
}
