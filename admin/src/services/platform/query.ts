// Batch 3: Platform + Operations — Errors & Health, Settings, Maintenance,
// Notifications. Sentry access goes through the existing, already-secure
// admin-sentry-issues Edge Function (server-side token, role-checked,
// writes security evidence) — never a direct Sentry API call from the
// browser. app_settings' `content` key (app store links, social links,
// support email — a Batch 4/Content concern) is deliberately never read
// or written here.
import { getSupabaseClient } from '../supabase/client';
import { normalizeError, type NormalizedError } from '../errors/normalize-error';
import { invokeAdminFunction } from '../edge/invoke';

export type QueryResult<T> = { data: T; error: null } | { data: null; error: NormalizedError };
export type Page<T> = { rows: T[]; total: number; page: number; pageSize: number };

function unavailable<T>(): QueryResult<T> {
  return { data: null, error: { code: 'client_unavailable', message: 'Live Supabase is not configured.', retryable: false } };
}

export const PLATFORM_PAGE_SIZE = 20;

// ── App Error Events ────────────────────────────────────────────────────

export type ErrorEventRow = {
  id: string; error_type: string | null; message: string | null; screen: string | null; platform: string | null;
  severity: string | null; occurrence_count: number | null; affected_users_count: number | null;
  status: string | null; last_seen_at: string | null;
};
export async function listErrorEvents(status: string | undefined, page: number, pageSize = PLATFORM_PAGE_SIZE): Promise<QueryResult<Page<ErrorEventRow>>> {
  const client = getSupabaseClient();
  if (!client) return unavailable();
  let query = client
    .from('app_error_events')
    .select('id, error_type, message, screen, platform, severity, occurrence_count, affected_users_count, status, last_seen_at', { count: 'exact' })
    .order('last_seen_at', { ascending: false });
  if (status) query = query.eq('status', status);
  const from = Math.max(0, page - 1) * pageSize;
  const { data, error, count } = await query.range(from, from + pageSize - 1);
  if (error) return { data: null, error: normalizeError(error) };
  return { data: { rows: data ?? [], total: count ?? 0, page: Math.max(1, page), pageSize }, error: null };
}

export type ErrorEventDetail = ErrorEventRow & { stack: string | null; app_version: string | null; environment: string | null; first_seen_at: string | null; admin_notes: string | null; sentry_event_id: string | null };
export async function getErrorEvent(id: string): Promise<QueryResult<ErrorEventDetail | null>> {
  const client = getSupabaseClient();
  if (!client) return unavailable();
  const { data, error } = await client
    .from('app_error_events')
    .select('id, error_type, message, screen, platform, severity, occurrence_count, affected_users_count, status, last_seen_at, stack, app_version, environment, first_seen_at, admin_notes, sentry_event_id')
    .eq('id', id)
    .maybeSingle();
  if (error) return { data: null, error: normalizeError(error) };
  return { data: data ?? null, error: null };
}

export async function updateErrorEventStatus(id: string, status: string, note?: string): Promise<QueryResult<{ id: string }>> {
  const client = getSupabaseClient();
  if (!client) return unavailable();
  const update: { status: string; admin_notes?: string; resolved_at?: string } = { status };
  if (note) update.admin_notes = note;
  if (status === 'resolved') update.resolved_at = new Date().toISOString();
  const { data, error } = await client.from('app_error_events').update(update).eq('id', id).select('id').maybeSingle();
  if (error) return { data: null, error: normalizeError(error) };
  if (!data) return { data: null, error: { code: 'forbidden', message: 'Not authorized to update this error, or it no longer exists.', retryable: false } };
  return { data, error: null };
}

// ── Sentry (via the existing secure Edge Function) ──────────────────────

export type SentryIssue = { id: string | null; shortId: string | null; title: string | null; culprit: string | null; level: string | null; count: string | null; userCount: string | null; lastSeen: string | null; permalink: string | null };
export async function listSentryIssues(accessToken: string): Promise<QueryResult<SentryIssue[]>> {
  const result = await invokeAdminFunction<{ issues: SentryIssue[] } | { error: string }>('admin-sentry-issues?statsPeriod=14d', accessToken, { method: 'GET' });
  if (result.error) return { data: null, error: result.error };
  if ('error' in result.data) return { data: null, error: { code: result.data.error, message: `Sentry: ${result.data.error}`, retryable: false } };
  return { data: result.data.issues, error: null };
}

// ── Settings (app_settings, excluding the `content` key) ────────────────

export type OperationalSettings = {
  signupPaused: boolean; freeOnly: boolean; fxRate: number | null; fxRateUpdatedAt: string | null;
  supportWhatsapp: string; showSponsoredAds: boolean; allowImageUploads: boolean; autoApproveVerified: boolean;
  enablePremiumListings: boolean; requireListingApproval: boolean; requirePhoneVerification: boolean;
};
export async function getOperationalSettings(): Promise<QueryResult<OperationalSettings>> {
  const client = getSupabaseClient();
  if (!client) return unavailable();
  const { data, error } = await client.from('app_settings').select('settings').eq('id', 1).maybeSingle();
  if (error) return { data: null, error: normalizeError(error) };
  const raw = (data?.settings ?? {}) as Record<string, unknown>;
  return {
    data: {
      signupPaused: Boolean(raw.signupPaused), freeOnly: Boolean(raw.freeOnly),
      fxRate: typeof raw.fxRate === 'number' ? raw.fxRate : null, fxRateUpdatedAt: typeof raw.fxRateUpdatedAt === 'string' ? raw.fxRateUpdatedAt : null,
      supportWhatsapp: typeof raw.supportWhatsapp === 'string' ? raw.supportWhatsapp : '',
      showSponsoredAds: Boolean(raw.showSponsoredAds), allowImageUploads: Boolean(raw.allowImageUploads),
      autoApproveVerified: Boolean(raw.autoApproveVerified), enablePremiumListings: Boolean(raw.enablePremiumListings),
      requireListingApproval: Boolean(raw.requireListingApproval), requirePhoneVerification: Boolean(raw.requirePhoneVerification),
    },
    error: null,
  };
}

/** Merges only the operational keys into the existing settings JSON —
 * `content` and any other key this batch doesn't own are read first and
 * preserved untouched, never overwritten wholesale. */
export async function updateOperationalSettings(patch: Partial<OperationalSettings>): Promise<QueryResult<true>> {
  const client = getSupabaseClient();
  if (!client) return unavailable();
  const { data: current, error: readError } = await client.from('app_settings').select('settings').eq('id', 1).maybeSingle();
  if (readError) return { data: null, error: normalizeError(readError) };
  const merged = { ...(current?.settings as Record<string, unknown> ?? {}), ...patch };
  const { error } = await client.from('app_settings').update({ settings: merged }).eq('id', 1);
  if (error) return { data: null, error: normalizeError(error) };
  return { data: true, error: null };
}

// ── Notifications (send + recent) ───────────────────────────────────────

export type NotificationRow = { id: string; user_id: string | null; title: string | null; body: string | null; type: string | null; read: boolean | null; created_at: number | null };
export async function listRecentNotifications(page: number, pageSize = PLATFORM_PAGE_SIZE): Promise<QueryResult<Page<NotificationRow>>> {
  const client = getSupabaseClient();
  if (!client) return unavailable();
  const from = Math.max(0, page - 1) * pageSize;
  const { data, error, count } = await client
    .from('notifications')
    .select('id, user_id, title, body, type, read, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, from + pageSize - 1);
  if (error) return { data: null, error: normalizeError(error) };
  return { data: { rows: data ?? [], total: count ?? 0, page: Math.max(1, page), pageSize }, error: null };
}

/** Existing "notifications: self or admin insert" RLS (is_admin()) — direct
 * INSERT, no send RPC exists or is needed. Push delivery (push_sent/
 * push_status) is handled server-side after insert, not by this call. */
export async function sendNotification(userId: string, title: string, body: string, type = 'admin'): Promise<QueryResult<{ id: string }>> {
  const client = getSupabaseClient();
  if (!client) return unavailable();
  const id = crypto.randomUUID();
  const { data, error } = await client.from('notifications').insert({ id, user_id: userId, title, body, type, created_at: Date.now() }).select('id').single();
  if (error) return { data: null, error: normalizeError(error) };
  return { data, error: null };
}
