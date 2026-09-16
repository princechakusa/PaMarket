// Batch 4: Audit Center. Aggregates three genuinely separate operational
// audit tables in one UI without merging them at the database level, and
// never touches security_events (evidence-grade, its own protected surface
// via list_security_events -- see security-events/query.ts).
import { getSupabaseClient } from '../supabase/client';
import { normalizeError, type NormalizedError } from '../errors/normalize-error';
import { escapePostgrestValue } from '../search/escape-postgrest-value';

export type QueryResult<T> = { data: T; error: null } | { data: null; error: NormalizedError };
export type Page<T> = { rows: T[]; total: number; page: number; pageSize: number };

function unavailable<T>(): QueryResult<T> {
  return { data: null, error: { code: 'client_unavailable', message: 'Live Supabase is not configured.', retryable: false } };
}

export const AUDIT_PAGE_SIZE = 25;

export type AdminAuditRow = { id: string; action: string; entity: string; entity_id: string | null; actor_role: string | null; actor_email: string | null; reason: string | null; created_at: string };
export async function listAdminAuditLogs(page: number, search?: string): Promise<QueryResult<Page<AdminAuditRow>>> {
  const client = getSupabaseClient();
  if (!client) return unavailable();
  let query = client.from('admin_audit_logs').select('id, action, entity, entity_id, actor_role, actor_email, reason, created_at', { count: 'exact' }).order('created_at', { ascending: false });
  if (search) {
    const like = escapePostgrestValue(`%${search}%`);
    query = query.or(`action.ilike.${like},entity.ilike.${like},entity_id.ilike.${like}`);
  }
  const from = Math.max(0, page - 1) * AUDIT_PAGE_SIZE;
  const { data, error, count } = await query.range(from, from + AUDIT_PAGE_SIZE - 1);
  if (error) return { data: null, error: normalizeError(error) };
  return { data: { rows: data ?? [], total: count ?? 0, page: Math.max(1, page), pageSize: AUDIT_PAGE_SIZE }, error: null };
}

export type RentalAuditRow = { id: string; actor_id: string | null; actor_role: string | null; action: string | null; target_table: string | null; target_id: string | null; created_at: string | null };
export async function listRentalAuditLogs(page: number): Promise<QueryResult<Page<RentalAuditRow>>> {
  const client = getSupabaseClient();
  if (!client) return unavailable();
  const from = Math.max(0, page - 1) * AUDIT_PAGE_SIZE;
  const { data, error, count } = await client
    .from('rental_audit_logs')
    .select('id, actor_id, actor_role, action, target_table, target_id, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, from + AUDIT_PAGE_SIZE - 1);
  if (error) return { data: null, error: normalizeError(error) };
  return { data: { rows: data ?? [], total: count ?? 0, page: Math.max(1, page), pageSize: AUDIT_PAGE_SIZE }, error: null };
}

export type RoleAuditRow = { id: number; actor_id: string | null; target_id: string | null; old_role: string | null; new_role: string | null; changed_at: string | null };
export async function listRoleAuditLog(page: number): Promise<QueryResult<Page<RoleAuditRow>>> {
  const client = getSupabaseClient();
  if (!client) return unavailable();
  const from = Math.max(0, page - 1) * AUDIT_PAGE_SIZE;
  const { data, error, count } = await client
    .from('role_audit_log')
    .select('id, actor_id, target_id, old_role, new_role, changed_at', { count: 'exact' })
    .order('changed_at', { ascending: false })
    .range(from, from + AUDIT_PAGE_SIZE - 1);
  if (error) return { data: null, error: normalizeError(error) };
  return { data: { rows: data ?? [], total: count ?? 0, page: Math.max(1, page), pageSize: AUDIT_PAGE_SIZE }, error: null };
}
