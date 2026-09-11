// Typed, server-side-paginated reads of public.security_events /
// security_event_legal_holds. RLS (admin-team + aal2) is the real
// authorization boundary; this module just shapes the query and the
// response — it never assumes access, and every call still goes through
// the one shared, authenticated Supabase client.
import { getSupabaseClient } from '../supabase/client';
import { normalizeError, type NormalizedError } from '../errors/normalize-error';
import type { Database } from '../supabase/database.types';

export type SecurityEvent = Database['public']['Tables']['security_events']['Row'];
export type LegalHold = Database['public']['Tables']['security_event_legal_holds']['Row'];

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

export const PAGE_SIZE = 25;

function unavailable<T>(): QueryResult<T> {
  return { data: null, error: { code: 'client_unavailable', message: 'Live Supabase is not configured.', retryable: false } };
}

export async function listSecurityEvents(filters: SecurityEventFilters, page: number): Promise<QueryResult<Page<SecurityEvent>>> {
  const client = getSupabaseClient();
  if (!client) return unavailable();

  let query = client
    .from('security_events')
    .select('*', { count: 'exact' })
    .order('occurred_at', { ascending: false });

  if (filters.from) query = query.gte('occurred_at', filters.from);
  if (filters.to) query = query.lte('occurred_at', filters.to);
  if (filters.severity) query = query.eq('severity', filters.severity);
  if (filters.eventType) query = query.eq('event_type', filters.eventType);
  if (filters.source) query = query.eq('source', filters.source);
  if (filters.outcome) query = query.eq('outcome', filters.outcome);
  if (filters.actorUserId) query = query.eq('actor_user_id', filters.actorUserId);
  if (filters.correlationId) query = query.eq('correlation_id', filters.correlationId);

  const safePage = Math.max(1, page);
  const start = (safePage - 1) * PAGE_SIZE;
  query = query.range(start, start + PAGE_SIZE - 1);

  const { data, error, count } = await query;
  if (error) return { data: null, error: normalizeError(error) };
  return { data: { rows: data ?? [], total: count ?? 0, page: safePage, pageSize: PAGE_SIZE }, error: null };
}

/** Active + released holds for a single event, for the detail drawer. */
export async function listHoldsForEvent(eventId: string, correlationId: string | null): Promise<QueryResult<LegalHold[]>> {
  const client = getSupabaseClient();
  if (!client) return unavailable();
  let query = client.from('security_event_legal_holds').select('*').order('placed_at', { ascending: false });
  query = correlationId ? query.or(`event_id.eq.${eventId},correlation_id.eq.${correlationId}`) : query.eq('event_id', eventId);
  const { data, error } = await query;
  if (error) return { data: null, error: normalizeError(error) };
  return { data: data ?? [], error: null };
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
