// C2E-9: Dashboard reads. Every query here reuses infrastructure that
// already existed and was already correctly authorized before this stage
// (the six admin_* analytics RPCs added grants in C2E-5; the table RLS
// policies used for the count queries below were verified live during the
// C2E-9 audit) — nothing new is created server-side by this file.
import { getSupabaseClient } from '../supabase/client';
import { normalizeError, type NormalizedError } from '../errors/normalize-error';

export type QueryResult<T> = { data: T; error: null } | { data: null; error: NormalizedError };

function unavailable<T>(): QueryResult<T> {
  return { data: null, error: { code: 'client_unavailable', message: 'Live Supabase is not configured.', retryable: false } };
}

export type GrowthPoint = { d: string; users: number; listings: number };
export async function getDailyGrowth(days = 14): Promise<QueryResult<GrowthPoint[]>> {
  const client = getSupabaseClient();
  if (!client) return unavailable();
  const { data, error } = await client.rpc('admin_daily_growth', { days });
  if (error) return { data: null, error: normalizeError(error) };
  return { data: data ?? [], error: null };
}

// Batch 4: Shared Analytics reuses this RPC directly -- no separate
// analytics engine/service was created.
export type CohortRow = { cohort: string; signups: number; verified: number };
export async function getCohorts(weeks = 8): Promise<QueryResult<CohortRow[]>> {
  const client = getSupabaseClient();
  if (!client) return unavailable();
  const { data, error } = await client.rpc('admin_cohorts', { weeks });
  if (error) return { data: null, error: normalizeError(error) };
  return { data: data ?? [], error: null };
}

export type CategoryRow = { category: string; n: number };
export async function getCategoryBreakdown(): Promise<QueryResult<CategoryRow[]>> {
  const client = getSupabaseClient();
  if (!client) return unavailable();
  const { data, error } = await client.rpc('admin_category_breakdown');
  if (error) return { data: null, error: normalizeError(error) };
  return { data: data ?? [], error: null };
}

export type ProvinceRow = { province: string; n: number };
export async function getProvinceBreakdown(): Promise<QueryResult<ProvinceRow[]>> {
  const client = getSupabaseClient();
  if (!client) return unavailable();
  const { data, error } = await client.rpc('admin_province_breakdown');
  if (error) return { data: null, error: normalizeError(error) };
  return { data: data ?? [], error: null };
}

export type RevenueSummary = { subs_paid: number; subs_failed: number; subs_pending: number; other_paid: number; ads_revenue: number; txn_count: number };
export async function getRevenueSummary(days = 30): Promise<QueryResult<RevenueSummary>> {
  const client = getSupabaseClient();
  if (!client) return unavailable();
  const { data, error } = await client.rpc('admin_revenue_summary', { days });
  if (error) return { data: null, error: normalizeError(error) };
  if (!data) return { data: null, error: { code: 'empty_response', message: 'No revenue summary returned.', retryable: false } };
  return { data, error: null };
}

export type TopPayerRow = { business_id: string; total: number; payments: number };
export async function getTopPayers(days = 30, lim = 5): Promise<QueryResult<TopPayerRow[]>> {
  const client = getSupabaseClient();
  if (!client) return unavailable();
  const { data, error } = await client.rpc('admin_top_payers', { days, lim });
  if (error) return { data: null, error: normalizeError(error) };
  return { data: data ?? [], error: null };
}

export type AuditLogRow = { id: string; action: string; entity: string; entity_id: string | null; actor_role: string | null; reason: string | null; created_at: string };
export async function getRecentAuditLog(limit = 8): Promise<QueryResult<AuditLogRow[]>> {
  const client = getSupabaseClient();
  if (!client) return unavailable();
  const { data, error } = await client
    .from('admin_audit_logs')
    .select('id, action, entity, entity_id, actor_role, reason, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) return { data: null, error: normalizeError(error) };
  return { data: data ?? [], error: null };
}

export type QueueCounts = {
  businesses: number;
  pendingVerifications: number;
  pendingBusinessVerifications: number;
  pendingListings: number;
  openReports: number;
  openAppeals: number;
  pendingApplications: number;
  totalRentals: number;
  pendingRentals: number;
  activeSubscriptions: number;
  openErrors: number;
  criticalErrors: number;
  openTickets: number;
};

/** Real status values confirmed live against the schema/check-constraints during the C2E-9 audit — not guessed. */
export async function getQueueCounts(): Promise<QueryResult<QueueCounts>> {
  const client = getSupabaseClient();
  if (!client) return unavailable();

  const results = await Promise.all([
    client.from('businesses').select('*', { count: 'exact', head: true }),
    client.from('verifications').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    client.from('business_verifications').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    client.from('listings').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    client.from('reports').select('*', { count: 'exact', head: true }).eq('status', 'open'),
    client.from('moderation_appeals').select('*', { count: 'exact', head: true }).eq('status', 'open'),
    client.from('applications').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    client.from('rental_vehicle_listings').select('*', { count: 'exact', head: true }),
    client.from('rental_vehicle_listings').select('*', { count: 'exact', head: true }).eq('admin_status', 'pending_review'),
    client.from('business_subscriptions').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    client.from('app_error_events').select('*', { count: 'exact', head: true }).eq('status', 'open'),
    client.from('app_error_events').select('*', { count: 'exact', head: true }).eq('status', 'open').in('severity', ['fatal', 'error']),
    client.from('support_tickets').select('*', { count: 'exact', head: true }).in('status', ['open', 'pending']),
  ] as const);

  const failed = results.find((r) => r.error);
  if (failed?.error) return { data: null, error: normalizeError(failed.error) };

  const [
    businesses, pendingVerifications, pendingBusinessVerifications, pendingListings,
    openReports, openAppeals, pendingApplications, totalRentals, pendingRentals,
    activeSubscriptions, openErrors, criticalErrors, openTickets,
  ] = results;

  return {
    data: {
      businesses: businesses.count ?? 0,
      pendingVerifications: pendingVerifications.count ?? 0,
      pendingBusinessVerifications: pendingBusinessVerifications.count ?? 0,
      pendingListings: pendingListings.count ?? 0,
      openReports: openReports.count ?? 0,
      openAppeals: openAppeals.count ?? 0,
      pendingApplications: pendingApplications.count ?? 0,
      totalRentals: totalRentals.count ?? 0,
      pendingRentals: pendingRentals.count ?? 0,
      activeSubscriptions: activeSubscriptions.count ?? 0,
      openErrors: openErrors.count ?? 0,
      criticalErrors: criticalErrors.count ?? 0,
      openTickets: openTickets.count ?? 0,
    },
    error: null,
  };
}
