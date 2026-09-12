// Typed reads of security events. C2D-FIX: the browser never queries
// public.security_events or public.security_event_legal_holds directly —
// there is no grant left on either table to make that call succeed. Every
// read goes through list_security_events()/get_security_event(), which
// enforce has_admin_privilege('admin') + has_mfa_aal2() internally and
// redact ip_address/ip_source (to NULL / 'restricted') unless the
// verified caller is_super_admin(). The frontend's `canSeeIp`-style flags
// are a UX label only — see components/security-events — never an
// authorization decision; the RPC decides what value (if any) is even in
// the response.
import { getSupabaseClient } from '../supabase/client';
import { normalizeError, type NormalizedError } from '../errors/normalize-error';
import type { Json } from '../supabase/database.types';

export type SecurityEventRow = {
  id: string;
  event_type: string;
  severity: string;
  source: string;
  occurred_at: string;
  actor_user_id: string | null;
  actor_role: string | null;
  actor_authenticated: boolean;
  assurance_level: string;
  target_type: string | null;
  target_id: string | null;
  action: string;
  outcome: string;
  reason_code: string | null;
  correlation_id: string | null;
  request_path: string | null;
  request_method: string | null;
  /** Present only when the verified caller is super_admin; otherwise null. */
  ip_address: string | null;
  /** 'restricted' when ip_address was redacted for this caller's role. */
  ip_source: string;
  user_agent: string | null;
  retention_until: string;
};

export type SecurityEventDetail = Omit<SecurityEventRow, 'total_count'> & {
  received_at: string;
  metadata: Json;
  created_at: string;
  hold_status: 'active' | 'none' | string;
  hold_id: string | null;
};

// Back-compat alias — a concurrent, unrelated in-progress change in this
// working tree (OpsDashboardPage.tsx) already imports the pre-C2D-FIX
// `SecurityEvent` name from this module. Keeping it avoids breaking that
// file's typecheck without touching it.
export type SecurityEvent = SecurityEventRow;

export type SecurityEventFilters = {
  from?: string;
  to?: string;
  severity?: string;
  eventType?: string;
  source?: string;
  outcome?: string;
  actorUserId?: string;
  correlationId?: string;
};

export type Page<T> = { rows: T[]; total: number; page: number; pageSize: number };
export type QueryResult<T> = { data: T; error: null } | { data: null; error: NormalizedError };

/** Matches the RPC's own hard cap — requesting more never returns more than this. */
export const PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;

function unavailable<T>(): QueryResult<T> {
  return { data: null, error: { code: 'client_unavailable', message: 'Live Supabase is not configured.', retryable: false } };
}

/**
 * The only place the UI decides how to *label* an IP value — never
 * whether to show it. `ip_source === 'restricted'` is a server-set
 * sentinel meaning "this caller's role does not receive this field",
 * distinct from a genuinely uncaptured IP (ip_source e.g. 'unavailable').
 */
export function ipDisplay(ipAddress: string | null, ipSource: string): string {
  if (ipSource === 'restricted') return 'Restricted for this role';
  if (!ipAddress) return 'Not available';
  return ipAddress;
}

export async function listSecurityEvents(filters: SecurityEventFilters, page: number): Promise<QueryResult<Page<SecurityEventRow>>> {
  const client = getSupabaseClient();
  if (!client) return unavailable();

  const { data, error } = await client.rpc('list_security_events', {
    p_page: Math.max(1, page),
    p_page_size: PAGE_SIZE,
    p_from: filters.from ?? null,
    p_to: filters.to ?? null,
    p_severity: filters.severity ?? null,
    p_event_type: filters.eventType ?? null,
    p_source: filters.source ?? null,
    p_outcome: filters.outcome ?? null,
    p_actor_user_id: filters.actorUserId ?? null,
    p_correlation_id: filters.correlationId ?? null,
  });

  if (error) return { data: null, error: normalizeError(error) };
  const rows = data ?? [];
  const total = rows[0]?.total_count ?? 0;
  return {
    data: {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars -- total_count is deliberately dropped per row (already read into `total` above)
      rows: rows.map(({ total_count, ...row }) => row),
      total,
      page: Math.max(1, page),
      pageSize: PAGE_SIZE,
    },
    error: null,
  };
}

export async function getSecurityEvent(eventId: string): Promise<QueryResult<SecurityEventDetail | null>> {
  const client = getSupabaseClient();
  if (!client) return unavailable();
  const { data, error } = await client.rpc('get_security_event', { p_event_id: eventId });
  if (error) return { data: null, error: normalizeError(error) };
  return { data: data?.[0] ?? null, error: null };
}

export async function placeLegalHold(args: { eventId?: string; correlationId?: string; reason: string }): Promise<QueryResult<{ id: string }>> {
  const client = getSupabaseClient();
  if (!client) return unavailable();
  const { data, error } = await client.rpc('place_legal_hold', {
    p_event_id: args.eventId ?? null,
    p_correlation_id: args.correlationId ?? null,
    p_reason: args.reason,
  });
  if (error) return { data: null, error: normalizeError(error) };
  const row = data?.[0];
  if (!row) return { data: null, error: { code: 'empty_response', message: 'No hold was returned.', retryable: false } };
  return { data: row, error: null };
}

export async function releaseLegalHold(holdId: string): Promise<QueryResult<{ id: string }>> {
  const client = getSupabaseClient();
  if (!client) return unavailable();
  const { data, error } = await client.rpc('release_legal_hold', { p_hold_id: holdId });
  if (error) return { data: null, error: normalizeError(error) };
  const row = data?.[0];
  if (!row) return { data: null, error: { code: 'empty_response', message: 'No hold was returned.', retryable: false } };
  return { data: row, error: null };
}
