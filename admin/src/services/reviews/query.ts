// Batch 2: Reviews — one workspace over three real, structurally distinct
// tables (never merged — "reviews"/"business_reviews" have no status
// column at all, only "rental_reviews" supports moderation). Reused by
// both the Reviews page and Rentals' Reviews tab, so rental review
// moderation isn't duplicated.
import { getSupabaseClient } from '../supabase/client';
import { normalizeError, type NormalizedError } from '../errors/normalize-error';

export type QueryResult<T> = { data: T; error: null } | { data: null; error: NormalizedError };
export type Page<T> = { rows: T[]; total: number; page: number; pageSize: number };

function unavailable<T>(): QueryResult<T> {
  return { data: null, error: { code: 'client_unavailable', message: 'Live Supabase is not configured.', retryable: false } };
}

export const REVIEWS_PAGE_SIZE = 20;

export type MarketplaceReviewRow = { id: string; seller_id: string | null; reviewer_id: string | null; reviewer_name: string | null; rating: number | null; body: string | null; created_at: string | null };
export async function listMarketplaceReviews(page: number, pageSize = REVIEWS_PAGE_SIZE): Promise<QueryResult<Page<MarketplaceReviewRow>>> {
  const client = getSupabaseClient();
  if (!client) return unavailable();
  const from = Math.max(0, page - 1) * pageSize;
  const { data, error, count } = await client
    .from('reviews')
    .select('id, seller_id, reviewer_id, reviewer_name, rating, body, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, from + pageSize - 1);
  if (error) return { data: null, error: normalizeError(error) };
  return { data: { rows: data ?? [], total: count ?? 0, page: Math.max(1, page), pageSize }, error: null };
}

/** No status column exists on `reviews` — the only supported admin action is
 * removal, via the existing "reviews: admin delete" (is_admin()) policy. */
export async function deleteMarketplaceReview(id: string): Promise<QueryResult<{ id: string }>> {
  const client = getSupabaseClient();
  if (!client) return unavailable();
  const { error } = await client.from('reviews').delete().eq('id', id);
  if (error) return { data: null, error: normalizeError(error) };
  return { data: { id }, error: null };
}

export type BusinessReviewRow = { id: string; business_id: string | null; reviewer_id: string | null; reviewer_name: string | null; rating: number | null; comment: string | null; created_at: string | null };
export async function listBusinessReviews(page: number, pageSize = REVIEWS_PAGE_SIZE): Promise<QueryResult<Page<BusinessReviewRow>>> {
  const client = getSupabaseClient();
  if (!client) return unavailable();
  const from = Math.max(0, page - 1) * pageSize;
  const { data, error, count } = await client
    .from('business_reviews')
    .select('id, business_id, reviewer_id, reviewer_name, rating, comment, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, from + pageSize - 1);
  if (error) return { data: null, error: normalizeError(error) };
  return { data: { rows: data ?? [], total: count ?? 0, page: Math.max(1, page), pageSize }, error: null };
}
// business_reviews has no admin delete/update RLS policy at all (confirmed
// live during Batch 2 inspection) — view-only here, matching the real
// backend rather than fabricating a moderation control.

export type RentalReviewRow = { id: string; company_id: string | null; reviewer_id: string | null; reviewer_name: string | null; rating: number | null; title: string | null; body: string | null; status: string | null; admin_note: string | null; created_at: string | null };
export async function listRentalReviews(status: string | undefined, page: number, pageSize = REVIEWS_PAGE_SIZE): Promise<QueryResult<Page<RentalReviewRow>>> {
  const client = getSupabaseClient();
  if (!client) return unavailable();
  let query = client
    .from('rental_reviews')
    .select('id, company_id, reviewer_id, reviewer_name, rating, title, body, status, admin_note, created_at', { count: 'exact' })
    .order('created_at', { ascending: false });
  if (status) query = query.eq('status', status);
  const from = Math.max(0, page - 1) * pageSize;
  const { data, error, count } = await query.range(from, from + pageSize - 1);
  if (error) return { data: null, error: normalizeError(error) };
  return { data: { rows: data ?? [], total: count ?? 0, page: Math.max(1, page), pageSize }, error: null };
}

export async function updateRentalReviewStatus(id: string, status: string, note?: string): Promise<QueryResult<{ id: string }>> {
  const client = getSupabaseClient();
  if (!client) return unavailable();
  const update: { status: string; admin_note?: string } = { status };
  if (note) update.admin_note = note;
  const { data, error } = await client.from('rental_reviews').update(update).eq('id', id).select('id').maybeSingle();
  if (error) return { data: null, error: normalizeError(error) };
  if (!data) return { data: null, error: { code: 'forbidden', message: 'Not authorized to update this review, or it no longer exists.', retryable: false } };
  return { data, error: null };
}
