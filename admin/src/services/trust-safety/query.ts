// Batch 1: Trust & Safety — one merged workspace for Reports and
// Moderation Appeals (the legacy "Moderation"/"Moderation Inbox" split was
// never a real data distinction — both concepts already read/write the
// same `reports`/`moderation_appeals` tables). Reuses existing RLS
// directly: "reports: reporter or moderator read/update" and "appeals team
// read/update" (both is_moderator(), narrowed in C2E-8) — no new RPC.
import { getSupabaseClient } from '../supabase/client';
import { normalizeError, type NormalizedError } from '../errors/normalize-error';

export type QueryResult<T> = { data: T; error: null } | { data: null; error: NormalizedError };
export type Page<T> = { rows: T[]; total: number; page: number; pageSize: number };

function unavailable<T>(): QueryResult<T> {
  return { data: null, error: { code: 'client_unavailable', message: 'Live Supabase is not configured.', retryable: false } };
}

export const TRUST_PAGE_SIZE = 20;
export const REPORT_TARGET_TYPES = ['listing', 'user', 'business', 'message', 'support', 'bug', 'appeal'] as const;

export type ReportRow = {
  id: string; status: string | null; target_type: string | null; target_id: string | null;
  reason: string | null; severity: string | null; created_at: number | null; reporter_id: string | null;
};

export type ReportFilters = { status?: string; targetType?: string };

export async function listReports(filters: ReportFilters, page: number, pageSize = TRUST_PAGE_SIZE): Promise<QueryResult<Page<ReportRow>>> {
  const client = getSupabaseClient();
  if (!client) return unavailable();
  let query = client
    .from('reports')
    .select('id, status, target_type, target_id, reason, severity, created_at, reporter_id', { count: 'exact' })
    .order('created_at', { ascending: false });
  if (filters.status) query = query.eq('status', filters.status);
  if (filters.targetType) query = query.eq('target_type', filters.targetType);
  const from = Math.max(0, page - 1) * pageSize;
  const { data, error, count } = await query.range(from, from + pageSize - 1);
  if (error) return { data: null, error: normalizeError(error) };
  return { data: { rows: data ?? [], total: count ?? 0, page: Math.max(1, page), pageSize }, error: null };
}

export async function updateReportStatus(id: string, status: string): Promise<QueryResult<{ id: string }>> {
  const client = getSupabaseClient();
  if (!client) return unavailable();
  const { data, error } = await client.from('reports').update({ status }).eq('id', id).select('id').maybeSingle();
  if (error) return { data: null, error: normalizeError(error) };
  if (!data) return { data: null, error: { code: 'forbidden', message: 'Not authorized to update this report, or it no longer exists.', retryable: false } };
  return { data, error: null };
}

export type AppealRow = {
  id: string; status: string | null; entity: string | null; entity_id: string | null;
  requester_id: string | null; reason: string | null; created_at: string | null;
  decided_by: string | null; decided_at: string | null;
};

export async function listAppeals(status: string | undefined, page: number, pageSize = TRUST_PAGE_SIZE): Promise<QueryResult<Page<AppealRow>>> {
  const client = getSupabaseClient();
  if (!client) return unavailable();
  let query = client
    .from('moderation_appeals')
    .select('id, status, entity, entity_id, requester_id, reason, created_at, decided_by, decided_at', { count: 'exact' })
    .order('created_at', { ascending: false });
  if (status) query = query.eq('status', status);
  const from = Math.max(0, page - 1) * pageSize;
  const { data, error, count } = await query.range(from, from + pageSize - 1);
  if (error) return { data: null, error: normalizeError(error) };
  return { data: { rows: data ?? [], total: count ?? 0, page: Math.max(1, page), pageSize }, error: null };
}

export async function updateAppealStatus(id: string, status: string): Promise<QueryResult<{ id: string }>> {
  const client = getSupabaseClient();
  if (!client) return unavailable();
  const { data, error } = await client
    .from('moderation_appeals')
    .update({ status, decided_at: new Date().toISOString() })
    .eq('id', id)
    .select('id')
    .maybeSingle();
  if (error) return { data: null, error: normalizeError(error) };
  if (!data) return { data: null, error: { code: 'forbidden', message: 'Not authorized to update this appeal, or it no longer exists.', retryable: false } };
  return { data, error: null };
}
