// Batch 3: Support Center. Reuses "tickets team"/"ticket_msgs team"
// (is_support_team(), C2E-8) directly. Contact Requests is a genuinely
// separate, recruiter-specific workflow (requester/candidate contact
// approval, not general user support) -- included here as its own tab
// rather than merged into ticket data, but its real RLS is is_admin()
// only (not is_support_team()), a pre-existing mismatch against the
// 'support.manage' permission its route uses -- documented, not fixed
// here (out of this batch's explicit scope).
import { getSupabaseClient } from '../supabase/client';
import { normalizeError, type NormalizedError } from '../errors/normalize-error';

export type QueryResult<T> = { data: T; error: null } | { data: null; error: NormalizedError };
export type Page<T> = { rows: T[]; total: number; page: number; pageSize: number };

function unavailable<T>(): QueryResult<T> {
  return { data: null, error: { code: 'client_unavailable', message: 'Live Supabase is not configured.', retryable: false } };
}

export const SUPPORT_PAGE_SIZE = 20;

export type TicketRow = { id: string; subject: string | null; status: string | null; priority: string | null; category: string | null; created_at: string | null };
export async function listTickets(status: string | undefined, page: number, pageSize = SUPPORT_PAGE_SIZE): Promise<QueryResult<Page<TicketRow>>> {
  const client = getSupabaseClient();
  if (!client) return unavailable();
  let query = client
    .from('support_tickets')
    .select('id, subject, status, priority, category, created_at', { count: 'exact' })
    .order('created_at', { ascending: false });
  if (status) query = query.eq('status', status);
  const from = Math.max(0, page - 1) * pageSize;
  const { data, error, count } = await query.range(from, from + pageSize - 1);
  if (error) return { data: null, error: normalizeError(error) };
  return { data: { rows: data ?? [], total: count ?? 0, page: Math.max(1, page), pageSize }, error: null };
}

export type TicketDetail = TicketRow & { source: string | null; first_response_at: string | null; resolved_at: string | null };
export async function getTicket(id: string): Promise<QueryResult<TicketDetail | null>> {
  const client = getSupabaseClient();
  if (!client) return unavailable();
  const { data, error } = await client
    .from('support_tickets')
    .select('id, subject, status, priority, category, created_at, source, first_response_at, resolved_at')
    .eq('id', id)
    .maybeSingle();
  if (error) return { data: null, error: normalizeError(error) };
  return { data: data ?? null, error: null };
}

export async function updateTicketStatus(id: string, status: string): Promise<QueryResult<{ id: string }>> {
  const client = getSupabaseClient();
  if (!client) return unavailable();
  const update: { status: string; resolved_at?: string } = { status };
  if (status === 'resolved' || status === 'closed') update.resolved_at = new Date().toISOString();
  const { data, error } = await client.from('support_tickets').update(update).eq('id', id).select('id').maybeSingle();
  if (error) return { data: null, error: normalizeError(error) };
  if (!data) return { data: null, error: { code: 'forbidden', message: 'Not authorized to update this ticket, or it no longer exists.', retryable: false } };
  return { data, error: null };
}

export type TicketMessageRow = { id: string; author_kind: string | null; body: string | null; internal: boolean | null; created_at: string | null };
export async function listTicketMessages(ticketId: string): Promise<QueryResult<TicketMessageRow[]>> {
  const client = getSupabaseClient();
  if (!client) return unavailable();
  const { data, error } = await client
    .from('support_ticket_messages')
    .select('id, author_kind, body, internal, created_at')
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: true });
  if (error) return { data: null, error: normalizeError(error) };
  return { data: data ?? [], error: null };
}

export async function sendTicketMessage(ticketId: string, authorId: string, body: string, internal: boolean): Promise<QueryResult<{ id: string }>> {
  const client = getSupabaseClient();
  if (!client) return unavailable();
  const { data, error } = await client
    .from('support_ticket_messages')
    .insert({ ticket_id: ticketId, author_id: authorId, author_kind: 'staff', body, internal })
    .select('id')
    .single();
  if (error) return { data: null, error: normalizeError(error) };
  return { data, error: null };
}

// ── Contact Requests (recruiter-candidate contact approval) ────────────

export type ContactRequestRow = { id: string; requester_name: string | null; candidate_name: string | null; company: string | null; role: string | null; status: string | null; created_at: string | null };
export async function listContactRequests(status: string | undefined, page: number, pageSize = SUPPORT_PAGE_SIZE): Promise<QueryResult<Page<ContactRequestRow>>> {
  const client = getSupabaseClient();
  if (!client) return unavailable();
  let query = client
    .from('contact_requests')
    .select('id, requester_name, candidate_name, company, role, status, created_at', { count: 'exact' })
    .order('created_at', { ascending: false });
  if (status) query = query.eq('status', status);
  const from = Math.max(0, page - 1) * pageSize;
  const { data, error, count } = await query.range(from, from + pageSize - 1);
  if (error) return { data: null, error: normalizeError(error) };
  return { data: { rows: data ?? [], total: count ?? 0, page: Math.max(1, page), pageSize }, error: null };
}

export async function decideContactRequest(id: string, status: string, actorId: string): Promise<QueryResult<{ id: string }>> {
  const client = getSupabaseClient();
  if (!client) return unavailable();
  const { data, error } = await client
    .from('contact_requests')
    .update({ status, decided_at: new Date().toISOString(), decided_by: actorId })
    .eq('id', id)
    .select('id')
    .maybeSingle();
  if (error) return { data: null, error: normalizeError(error) };
  if (!data) return { data: null, error: { code: 'forbidden', message: 'Not authorized to update this request, or it no longer exists.', retryable: false } };
  return { data, error: null };
}
