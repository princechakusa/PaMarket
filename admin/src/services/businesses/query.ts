// Batch 3: Businesses. Reuses "businesses: admin all" (is_admin()) directly.
// Verification and reviews are NOT duplicated here — the detail view links
// to the existing Verifications (Batch 1) and Reviews (Batch 2) workspaces
// for that business, rather than re-implementing either.
import { getSupabaseClient } from '../supabase/client';
import { normalizeError, type NormalizedError } from '../errors/normalize-error';

export type QueryResult<T> = { data: T; error: null } | { data: null; error: NormalizedError };
export type Page<T> = { rows: T[]; total: number; page: number; pageSize: number };

function unavailable<T>(): QueryResult<T> {
  return { data: null, error: { code: 'client_unavailable', message: 'Live Supabase is not configured.', retryable: false } };
}

export const BUSINESSES_PAGE_SIZE = 20;

export type BusinessRow = { id: string; name: string | null; status: string | null; category: string | null; city: string | null; province: string | null; plan_id: string | null; created_at: string | null };

export async function listBusinesses(filters: { status?: string; search?: string }, page: number, pageSize = BUSINESSES_PAGE_SIZE): Promise<QueryResult<Page<BusinessRow>>> {
  const client = getSupabaseClient();
  if (!client) return unavailable();
  let query = client
    .from('businesses')
    .select('id, name, status, category, city, province, plan_id, created_at', { count: 'exact' })
    .order('created_at', { ascending: false });
  if (filters.status) query = query.eq('status', filters.status);
  if (filters.search) {
    const term = filters.search.trim();
    if (term) query = query.or(`name.ilike.%${term}%,id.eq.${term}`);
  }
  const from = Math.max(0, page - 1) * pageSize;
  const { data, error, count } = await query.range(from, from + pageSize - 1);
  if (error) return { data: null, error: normalizeError(error) };
  return { data: { rows: data ?? [], total: count ?? 0, page: Math.max(1, page), pageSize }, error: null };
}

export type BusinessDetail = BusinessRow & { owner_user_id: string | null; biz_type: string | null; phone: string | null; email: string | null; verification_level: number | null; verification_pending: boolean | null; suburb: string | null; latitude: number | null; longitude: number | null };
export async function getBusiness(id: string): Promise<QueryResult<BusinessDetail | null>> {
  const client = getSupabaseClient();
  if (!client) return unavailable();
  const { data, error } = await client
    .from('businesses')
    .select('id, name, status, category, city, province, suburb, plan_id, created_at, owner_user_id, biz_type, phone, email, verification_level, verification_pending, latitude, longitude')
    .eq('id', id)
    .maybeSingle();
  if (error) return { data: null, error: normalizeError(error) };
  return { data: data ?? null, error: null };
}

export async function getBusinessListingsCount(businessId: string): Promise<QueryResult<number>> {
  const client = getSupabaseClient();
  if (!client) return unavailable();
  const { count, error } = await client.from('listings').select('*', { count: 'exact', head: true }).eq('business_id', businessId);
  if (error) return { data: null, error: normalizeError(error) };
  return { data: count ?? 0, error: null };
}

/** business_staff: admin read (C2E-14). Read-only here -- no write access
 * beyond what C2E-14 established is intentionally added. */
export type BusinessStaffRow = { id: string; user_id: string | null; role: string | null; status: string | null };
export async function getBusinessStaff(businessId: string): Promise<QueryResult<BusinessStaffRow[]>> {
  const client = getSupabaseClient();
  if (!client) return unavailable();
  const { data, error } = await client.from('business_staff').select('id, user_id, role, status').eq('business_id', businessId);
  if (error) return { data: null, error: normalizeError(error) };
  return { data: data ?? [], error: null };
}

/** business_payments (C2E-15: is_admin(), super_admin included). Aggregate
 * only -- no raw payment rows rendered here, matching least-privilege. */
export async function getBusinessPaymentsTotal(businessId: string): Promise<QueryResult<{ count: number; totalPaid: number }>> {
  const client = getSupabaseClient();
  if (!client) return unavailable();
  const { data, error } = await client.from('business_payments').select('amount, status').eq('business_id', businessId);
  if (error) return { data: null, error: normalizeError(error) };
  const rows = (data ?? []) as { amount: number | null; status: string | null }[];
  return { data: { count: rows.length, totalPaid: rows.filter((r) => r.status === 'paid').reduce((sum, r) => sum + (r.amount ?? 0), 0) }, error: null };
}
