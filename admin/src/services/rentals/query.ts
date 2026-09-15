// Batch 2: Rentals — one consolidated workspace (Companies, Listings,
// Reports, Featured, Analytics, Audit Logs, Lookups) over the real,
// pre-existing rental_* tables, all already admin-gated (is_admin()).
// Reviews are handled by services/reviews/query.ts (listRentalReviews/
// updateRentalReviewStatus) — not duplicated here.
import { getSupabaseClient } from '../supabase/client';
import { normalizeError, type NormalizedError } from '../errors/normalize-error';

export type QueryResult<T> = { data: T; error: null } | { data: null; error: NormalizedError };
export type Page<T> = { rows: T[]; total: number; page: number; pageSize: number };

function unavailable<T>(): QueryResult<T> {
  return { data: null, error: { code: 'client_unavailable', message: 'Live Supabase is not configured.', retryable: false } };
}

export const RENTALS_PAGE_SIZE = 20;

// ── Companies ───────────────────────────────────────────────────────────

export type RentalCompanyRow = {
  id: string; business_id: string | null; trading_name: string | null; status: string | null;
  fleet_count: number | null; avg_rating: number | null; review_count: number | null; created_at: string | null;
};

export async function listRentalCompanies(status: string | undefined, page: number, pageSize = RENTALS_PAGE_SIZE): Promise<QueryResult<Page<RentalCompanyRow>>> {
  const client = getSupabaseClient();
  if (!client) return unavailable();
  let query = client
    .from('rental_companies')
    .select('id, business_id, trading_name, status, fleet_count, avg_rating, review_count, created_at', { count: 'exact' })
    .order('created_at', { ascending: false });
  if (status) query = query.eq('status', status);
  const from = Math.max(0, page - 1) * pageSize;
  const { data, error, count } = await query.range(from, from + pageSize - 1);
  if (error) return { data: null, error: normalizeError(error) };
  return { data: { rows: data ?? [], total: count ?? 0, page: Math.max(1, page), pageSize }, error: null };
}

export async function decideRentalCompany(id: string, status: 'active' | 'rejected', actorId: string, note?: string): Promise<QueryResult<{ id: string }>> {
  const client = getSupabaseClient();
  if (!client) return unavailable();
  const { data, error } = await client
    .from('rental_companies')
    .update({ status, approved_by: actorId, approved_at: new Date().toISOString(), admin_note: note ?? null })
    .eq('id', id)
    .select('id')
    .maybeSingle();
  if (error) return { data: null, error: normalizeError(error) };
  if (!data) return { data: null, error: { code: 'forbidden', message: 'Not authorized to update this company, or it no longer exists.', retryable: false } };
  return { data, error: null };
}

// ── Listings (Approvals + All Listings share this) ────────────────────

export type RentalListingRow = {
  id: string; company_id: string | null; model: string | null; year: number | null;
  daily_rate: number | null; status: string | null; admin_status: string | null;
  view_count: number | null; created_at: string | null;
};

export async function listRentalListings(filters: { adminStatus?: string; status?: string }, page: number, pageSize = RENTALS_PAGE_SIZE): Promise<QueryResult<Page<RentalListingRow>>> {
  const client = getSupabaseClient();
  if (!client) return unavailable();
  let query = client
    .from('rental_vehicle_listings')
    .select('id, company_id, model, year, daily_rate, status, admin_status, view_count, created_at', { count: 'exact' })
    .order('created_at', { ascending: false });
  if (filters.adminStatus) query = query.eq('admin_status', filters.adminStatus);
  if (filters.status) query = query.eq('status', filters.status);
  const from = Math.max(0, page - 1) * pageSize;
  const { data, error, count } = await query.range(from, from + pageSize - 1);
  if (error) return { data: null, error: normalizeError(error) };
  return { data: { rows: data ?? [], total: count ?? 0, page: Math.max(1, page), pageSize }, error: null };
}

export async function decideRentalListing(id: string, adminStatus: 'approved' | 'rejected', note?: string): Promise<QueryResult<{ id: string }>> {
  const client = getSupabaseClient();
  if (!client) return unavailable();
  const { data, error } = await client
    .from('rental_vehicle_listings')
    .update({ admin_status: adminStatus, admin_note: note ?? null })
    .eq('id', id)
    .select('id')
    .maybeSingle();
  if (error) return { data: null, error: normalizeError(error) };
  if (!data) return { data: null, error: { code: 'forbidden', message: 'Not authorized to update this listing, or it no longer exists.', retryable: false } };
  return { data, error: null };
}

// ── Reports ─────────────────────────────────────────────────────────────
// Distinct real table (rental_reports), not the shared marketplace
// `reports` table — `reports.target_type` has no 'rental' value, so this
// is a separate table by design, not a duplicate created for convenience.
// Reuses the same list/detail/resolve shape as trust-safety's reports for
// architectural consistency.

export type RentalReportRow = { id: string; listing_id: string | null; reporter_id: string | null; reason: string | null; severity: string | null; status: string | null; created_at: string | null };
export async function listRentalReports(status: string | undefined, page: number, pageSize = RENTALS_PAGE_SIZE): Promise<QueryResult<Page<RentalReportRow>>> {
  const client = getSupabaseClient();
  if (!client) return unavailable();
  let query = client
    .from('rental_reports')
    .select('id, listing_id, reporter_id, reason, severity, status, created_at', { count: 'exact' })
    .order('created_at', { ascending: false });
  if (status) query = query.eq('status', status);
  const from = Math.max(0, page - 1) * pageSize;
  const { data, error, count } = await query.range(from, from + pageSize - 1);
  if (error) return { data: null, error: normalizeError(error) };
  return { data: { rows: data ?? [], total: count ?? 0, page: Math.max(1, page), pageSize }, error: null };
}

export async function resolveRentalReport(id: string, status: string, actorId: string, note?: string): Promise<QueryResult<{ id: string }>> {
  const client = getSupabaseClient();
  if (!client) return unavailable();
  const { data, error } = await client
    .from('rental_reports')
    .update({ status, resolved_by: actorId, resolved_at: new Date().toISOString(), admin_note: note ?? null })
    .eq('id', id)
    .select('id')
    .maybeSingle();
  if (error) return { data: null, error: normalizeError(error) };
  if (!data) return { data: null, error: { code: 'forbidden', message: 'Not authorized to update this report, or it no longer exists.', retryable: false } };
  return { data, error: null };
}

// ── Featured ────────────────────────────────────────────────────────────

export type FeaturedListingRow = { id: string; listing_id: string | null; company_id: string | null; starts_at: string | null; ends_at: string | null; priority: number | null; is_active: boolean | null };
export async function listFeaturedListings(page: number, pageSize = RENTALS_PAGE_SIZE): Promise<QueryResult<Page<FeaturedListingRow>>> {
  const client = getSupabaseClient();
  if (!client) return unavailable();
  const from = Math.max(0, page - 1) * pageSize;
  const { data, error, count } = await client
    .from('rental_featured_listings')
    .select('id, listing_id, company_id, starts_at, ends_at, priority, is_active', { count: 'exact' })
    .order('starts_at', { ascending: false })
    .range(from, from + pageSize - 1);
  if (error) return { data: null, error: normalizeError(error) };
  return { data: { rows: data ?? [], total: count ?? 0, page: Math.max(1, page), pageSize }, error: null };
}

export async function setFeaturedActive(id: string, isActive: boolean): Promise<QueryResult<{ id: string }>> {
  const client = getSupabaseClient();
  if (!client) return unavailable();
  const { data, error } = await client.from('rental_featured_listings').update({ is_active: isActive }).eq('id', id).select('id').maybeSingle();
  if (error) return { data: null, error: normalizeError(error) };
  if (!data) return { data: null, error: { code: 'forbidden', message: 'Not authorized to update this record, or it no longer exists.', retryable: false } };
  return { data, error: null };
}

// ── Analytics ───────────────────────────────────────────────────────────
// Real stored counters only (fleet_count/avg_rating/review_count/
// total_views/view_count/inquiry_count/save_count) — no fabricated
// revenue/occupancy/conversion/utilization figures, none of which are
// stored anywhere in this schema.

export type RentalAnalyticsSummary = {
  totalCompanies: number; activeCompanies: number; totalListings: number; approvedListings: number;
  pendingListings: number; totalViews: number; totalInquiries: number;
};
export async function getRentalAnalyticsSummary(): Promise<QueryResult<RentalAnalyticsSummary>> {
  const client = getSupabaseClient();
  if (!client) return unavailable();
  const results = await Promise.all([
    client.from('rental_companies').select('*', { count: 'exact', head: true }),
    client.from('rental_companies').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    client.from('rental_vehicle_listings').select('*', { count: 'exact', head: true }),
    client.from('rental_vehicle_listings').select('*', { count: 'exact', head: true }).eq('admin_status', 'approved'),
    client.from('rental_vehicle_listings').select('*', { count: 'exact', head: true }).eq('admin_status', 'pending_review'),
    client.from('rental_vehicle_listings').select('view_count, inquiry_count'),
  ] as const);
  const failed = results.find((r) => r.error);
  if (failed?.error) return { data: null, error: normalizeError(failed.error) };
  const [totalCompanies, activeCompanies, totalListings, approvedListings, pendingListings, viewRows] = results;
  const rows = (viewRows.data ?? []) as { view_count: number | null; inquiry_count: number | null }[];
  return {
    data: {
      totalCompanies: totalCompanies.count ?? 0,
      activeCompanies: activeCompanies.count ?? 0,
      totalListings: totalListings.count ?? 0,
      approvedListings: approvedListings.count ?? 0,
      pendingListings: pendingListings.count ?? 0,
      totalViews: rows.reduce((sum, r) => sum + (r.view_count ?? 0), 0),
      totalInquiries: rows.reduce((sum, r) => sum + (r.inquiry_count ?? 0), 0),
    },
    error: null,
  };
}

// ── Audit Logs ──────────────────────────────────────────────────────────
// Real, pre-existing, separate rental_audit_logs table — operational
// audit, not evidence-grade (same distinction as admin_audit_logs vs
// security_events; not merged into either).

// rental_audit_logs reads now go through services/audit/query.ts's
// listRentalAuditLogs() (the Audit Center's version) -- this file used to
// have its own near-identical copy of the same query (found during the
// final production audit).

// ── Lookups ─────────────────────────────────────────────────────────────

export type LookupRow = { id: string; label: string | null; is_active: boolean | null };

export async function listRentalBrands(): Promise<QueryResult<LookupRow[]>> {
  const client = getSupabaseClient();
  if (!client) return unavailable();
  const { data, error } = await client.from('rental_brands').select('id, label, is_active').order('sort_order', { ascending: true });
  if (error) return { data: null, error: normalizeError(error) };
  return { data: data ?? [], error: null };
}

export async function listRentalCategories(): Promise<QueryResult<LookupRow[]>> {
  const client = getSupabaseClient();
  if (!client) return unavailable();
  const { data, error } = await client.from('rental_categories').select('id, label, is_active').order('sort_order', { ascending: true });
  if (error) return { data: null, error: normalizeError(error) };
  return { data: data ?? [], error: null };
}

export type RentalLocationRow = { id: string; city: string | null; province: string | null; is_active: boolean | null };
export async function listRentalLocations(): Promise<QueryResult<RentalLocationRow[]>> {
  const client = getSupabaseClient();
  if (!client) return unavailable();
  const { data, error } = await client.from('rental_locations').select('id, city, province, is_active').order('sort_order', { ascending: true });
  if (error) return { data: null, error: normalizeError(error) };
  return { data: data ?? [], error: null };
}

export async function setBrandActive(id: string, isActive: boolean): Promise<QueryResult<{ id: string }>> {
  const client = getSupabaseClient();
  if (!client) return unavailable();
  const { error } = await client.from('rental_brands').update({ is_active: isActive }).eq('id', id);
  if (error) return { data: null, error: normalizeError(error) };
  return { data: { id }, error: null };
}

export async function setCategoryActive(id: string, isActive: boolean): Promise<QueryResult<{ id: string }>> {
  const client = getSupabaseClient();
  if (!client) return unavailable();
  const { error } = await client.from('rental_categories').update({ is_active: isActive }).eq('id', id);
  if (error) return { data: null, error: normalizeError(error) };
  return { data: { id }, error: null };
}

export async function setLocationActive(id: string, isActive: boolean): Promise<QueryResult<{ id: string }>> {
  const client = getSupabaseClient();
  if (!client) return unavailable();
  const { error } = await client.from('rental_locations').update({ is_active: isActive }).eq('id', id);
  if (error) return { data: null, error: normalizeError(error) };
  return { data: { id }, error: null };
}
