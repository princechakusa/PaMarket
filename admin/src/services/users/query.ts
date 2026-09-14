// C2E-10: User Intelligence reads. Every query here reuses RLS that was
// already verified admin/moderator-safe (C2E-8/C2E-9/C2E-10 audit) — no
// new tables, RPCs, or RLS policies. Never selects mfa_secret,
// two_factor_secret, or any raw KYC document path/column.
import { getSupabaseClient } from '../supabase/client';
import { normalizeError, type NormalizedError } from '../errors/normalize-error';

export type QueryResult<T> = { data: T; error: null } | { data: null; error: NormalizedError };
export type Page<T> = { rows: T[]; total: number; page: number; pageSize: number };

function unavailable<T>(): QueryResult<T> {
  return { data: null, error: { code: 'client_unavailable', message: 'Live Supabase is not configured.', retryable: false } };
}

export const USER_PAGE_SIZE = 20;

export type UserRow = {
  id: string; name: string | null; email: string | null; phone: string | null;
  role: string | null; status: string | null; verified: boolean | null;
  city: string | null; province: string | null; company: string | null;
  company_verified: boolean | null; created_at: string | null;
  last_seen: string | null; last_active_at: string | null; mfa_enabled: boolean | null;
};

export type UserFilters = { search?: string; role?: string; status?: string; province?: string };

/** Server-side paginated, filtered read of profiles. Relies on the existing
 * "profiles: owner or staff read" RLS policy (is_moderator()) — a caller
 * whose role isn't in that set (e.g. support, per the known C2E-8 finding)
 * will legitimately get zero rows, not an error; the page must show that
 * as an empty state, not a bug. */
export async function listUsers(filters: UserFilters, page: number, pageSize = USER_PAGE_SIZE): Promise<QueryResult<Page<UserRow>>> {
  const client = getSupabaseClient();
  if (!client) return unavailable();

  let query = client
    .from('profiles')
    .select('id, name, email, phone, role, status, verified, city, province, company, company_verified, created_at, last_seen, last_active_at, mfa_enabled', { count: 'exact' })
    .order('created_at', { ascending: false });

  if (filters.search) {
    const term = filters.search.trim();
    if (term) query = query.or(`name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%,id.eq.${term}`);
  }
  if (filters.role) query = query.eq('role', filters.role);
  if (filters.status) query = query.eq('status', filters.status);
  if (filters.province) query = query.eq('province', filters.province);

  const from = Math.max(0, page - 1) * pageSize;
  const { data, error, count } = await query.range(from, from + pageSize - 1);
  if (error) return { data: null, error: normalizeError(error) };
  return { data: { rows: data ?? [], total: count ?? 0, page: Math.max(1, page), pageSize }, error: null };
}

export async function getUser(userId: string): Promise<QueryResult<UserRow | null>> {
  const client = getSupabaseClient();
  if (!client) return unavailable();
  const { data, error } = await client
    .from('profiles')
    .select('id, name, email, phone, role, status, verified, city, province, company, company_verified, created_at, last_seen, last_active_at, mfa_enabled')
    .eq('id', userId)
    .maybeSingle();
  if (error) return { data: null, error: normalizeError(error) };
  return { data: data ?? null, error: null };
}

export type VerificationRow = { id: string; status: string | null; admin_note: string | null; submitted_at: string | null; reviewed_at: string | null; reviewed_by: string | null };
export async function getUserVerification(userId: string): Promise<QueryResult<VerificationRow | null>> {
  const client = getSupabaseClient();
  if (!client) return unavailable();
  const { data, error } = await client
    .from('verifications')
    .select('id, status, admin_note, submitted_at, reviewed_at, reviewed_by')
    .eq('user_id', userId)
    .order('submitted_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return { data: null, error: normalizeError(error) };
  return { data: data ?? null, error: null };
}

export type BusinessRow = { id: string; name: string | null; status: string | null; province: string | null; created_at: string | null };
export async function getUserBusinesses(userId: string): Promise<QueryResult<BusinessRow[]>> {
  const client = getSupabaseClient();
  if (!client) return unavailable();
  const { data, error } = await client
    .from('businesses')
    .select('id, name, status, province, created_at')
    .eq('owner_user_id', userId)
    .order('created_at', { ascending: false });
  if (error) return { data: null, error: normalizeError(error) };
  return { data: data ?? [], error: null };
}

export type BusinessVerificationRow = { id: string; business_id: string | null; status: string | null; admin_note: string | null; submitted_at: string | null; reviewed_at: string | null };
export async function getBusinessVerifications(businessIds: string[]): Promise<QueryResult<BusinessVerificationRow[]>> {
  const client = getSupabaseClient();
  if (!client) return unavailable();
  if (businessIds.length === 0) return { data: [], error: null };
  const { data, error } = await client
    .from('business_verifications')
    .select('id, business_id, status, admin_note, submitted_at, reviewed_at')
    .in('business_id', businessIds);
  if (error) return { data: null, error: normalizeError(error) };
  return { data: data ?? [], error: null };
}

export type CommercialCounts = { listings: number; applications: number; activeSubscriptions: number; rentalListings: number };
export async function getUserCommercialCounts(userId: string, businessIds: string[]): Promise<QueryResult<CommercialCounts>> {
  const client = getSupabaseClient();
  if (!client) return unavailable();

  const [listings, applications, subscriptions] = await Promise.all([
    client.from('listings').select('*', { count: 'exact', head: true }).eq('seller_id', userId),
    client.from('applications').select('*', { count: 'exact', head: true }).eq('applicant_id', userId),
    businessIds.length > 0
      ? client.from('business_subscriptions').select('*', { count: 'exact', head: true }).in('business_id', businessIds).eq('status', 'active')
      : Promise.resolve({ count: 0, error: null } as { count: number; error: null }),
  ]);
  if (listings.error) return { data: null, error: normalizeError(listings.error) };
  if (applications.error) return { data: null, error: normalizeError(applications.error) };
  if (subscriptions.error) return { data: null, error: normalizeError(subscriptions.error) };

  let rentalListings = 0;
  if (businessIds.length > 0) {
    const companies = await client.from('rental_companies').select('id').in('business_id', businessIds);
    if (companies.error) return { data: null, error: normalizeError(companies.error) };
    const companyIds = (companies.data ?? []).map((row) => row.id);
    if (companyIds.length > 0) {
      const rentals = await client.from('rental_vehicle_listings').select('*', { count: 'exact', head: true }).in('company_id', companyIds);
      if (rentals.error) return { data: null, error: normalizeError(rentals.error) };
      rentalListings = rentals.count ?? 0;
    }
  }

  return {
    data: { listings: listings.count ?? 0, applications: applications.count ?? 0, activeSubscriptions: subscriptions.count ?? 0, rentalListings },
    error: null,
  };
}

export type ReportRow = { id: string; status: string | null; reason: string | null; severity: string | null; created_at: number | null };
export async function getUserReports(userId: string): Promise<QueryResult<ReportRow[]>> {
  const client = getSupabaseClient();
  if (!client) return unavailable();
  const { data, error } = await client
    .from('reports')
    .select('id, status, reason, severity, created_at')
    .eq('target_type', 'user')
    .eq('target_id', userId)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) return { data: null, error: normalizeError(error) };
  return { data: data ?? [], error: null };
}

export type AppealRow = { id: string; status: string | null; entity: string | null; reason: string | null; created_at: string | null };
export async function getUserAppeals(userId: string): Promise<QueryResult<AppealRow[]>> {
  const client = getSupabaseClient();
  if (!client) return unavailable();
  const { data, error } = await client
    .from('moderation_appeals')
    .select('id, status, entity, reason, created_at')
    .eq('requester_id', userId)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) return { data: null, error: normalizeError(error) };
  return { data: data ?? [], error: null };
}

export type AuditActionRow = { id: string; action: string; actor_role: string | null; reason: string | null; created_at: string };
export async function getUserAuditActions(userId: string): Promise<QueryResult<AuditActionRow[]>> {
  const client = getSupabaseClient();
  if (!client) return unavailable();
  const { data, error } = await client
    .from('admin_audit_logs')
    .select('id, action, actor_role, reason, created_at')
    .eq('entity', 'profiles')
    .eq('entity_id', userId)
    .order('created_at', { ascending: false })
    .limit(10);
  if (error) return { data: null, error: normalizeError(error) };
  return { data: data ?? [], error: null };
}
