// Batch 1: Verifications — one merged workspace for individual KYC
// (`verifications`) and business KYC (`business_verifications`). Reuses
// the existing "verif admin select/update" and "biz_verif: admin all"
// RLS policies (both is_admin()) directly — no new RPC.
//
// id_doc_path/selfie_path/reg_doc_path are Cloudflare R2 object keys, NOT
// Supabase Storage paths -- the mobile app's verification upload
// (apps/mobile/lib/verification.ts) has always gone through the
// get-r2-upload-url Edge Function to R2, never through Supabase Storage.
// That function already has a dedicated, already-secure admin bypass for
// exactly this read ("Admin can access any verification path" -- see its
// isGet && isVerification branch), including evidence logging via
// record_security_event, so getSignedDocumentUrl() calls it directly
// instead of inventing a second signing path. An earlier attempt at this
// fix pointed at a private "verification-docs" Supabase Storage bucket,
// which turned out to be an unrelated/unused legacy bucket -- real
// documents were never written there, so no signed URL from it could ever
// resolve to a real file.
import { getSupabaseClient } from '../supabase/client';
import { normalizeError, type NormalizedError } from '../errors/normalize-error';
import { invokeAdminFunction } from '../edge/invoke';

export type QueryResult<T> = { data: T; error: null } | { data: null; error: NormalizedError };
export type Page<T> = { rows: T[]; total: number; page: number; pageSize: number };

function unavailable<T>(): QueryResult<T> {
  return { data: null, error: { code: 'client_unavailable', message: 'Live Supabase is not configured.', retryable: false } };
}

export const VERIFICATIONS_PAGE_SIZE = 20;

export type VerificationRow = {
  id: string; user_id: string | null; status: string | null; admin_note: string | null;
  submitted_at: string | null; reviewed_at: string | null; reviewed_by: string | null;
  id_doc_path: string | null; selfie_path: string | null;
};

/** Requests a short-lived (5 minute) signed R2 GET URL for a verification
 * document key via the existing get-r2-upload-url Edge Function's admin
 * read path. Never returns/stores the URL beyond component state. */
export async function getSignedDocumentUrl(key: string, accessToken: string): Promise<QueryResult<string>> {
  const result = await invokeAdminFunction<{ signedUrl?: string; error?: string }>('get-r2-upload-url', accessToken, {
    body: { key, verb: 'GET', expiresIn: 300 },
  });
  if (result.error) return { data: null, error: result.error };
  if (!result.data.signedUrl) return { data: null, error: { code: result.data.error ?? 'not_found', message: result.data.error ?? 'This document could not be located in storage.', retryable: false } };
  return { data: result.data.signedUrl, error: null };
}

export async function listVerifications(status: string | undefined, page: number, pageSize = VERIFICATIONS_PAGE_SIZE): Promise<QueryResult<Page<VerificationRow>>> {
  const client = getSupabaseClient();
  if (!client) return unavailable();
  let query = client
    .from('verifications')
    .select('id, user_id, status, admin_note, submitted_at, reviewed_at, reviewed_by, id_doc_path, selfie_path', { count: 'exact' })
    .order('submitted_at', { ascending: false });
  if (status) query = query.eq('status', status);
  const from = Math.max(0, page - 1) * pageSize;
  const { data, error, count } = await query.range(from, from + pageSize - 1);
  if (error) return { data: null, error: normalizeError(error) };
  return { data: { rows: data ?? [], total: count ?? 0, page: Math.max(1, page), pageSize }, error: null };
}

export async function updateVerificationStatus(id: string, status: string, note?: string): Promise<QueryResult<{ id: string }>> {
  const client = getSupabaseClient();
  if (!client) return unavailable();
  const update: { status: string; reviewed_at: string; admin_note?: string } = { status, reviewed_at: new Date().toISOString() };
  if (note) update.admin_note = note;
  const { data, error } = await client.from('verifications').update(update).eq('id', id).select('id').maybeSingle();
  if (error) return { data: null, error: normalizeError(error) };
  if (!data) return { data: null, error: { code: 'forbidden', message: 'Not authorized to update this verification, or it no longer exists.', retryable: false } };
  return { data, error: null };
}

export type BusinessVerificationRow = {
  id: string; business_id: string | null; status: string | null; admin_note: string | null;
  submitted_at: string | null; reviewed_at: string | null; level_requested: number | null;
  id_doc_path: string | null; reg_doc_path: string | null;
};

export async function listBusinessVerifications(status: string | undefined, page: number, pageSize = VERIFICATIONS_PAGE_SIZE): Promise<QueryResult<Page<BusinessVerificationRow>>> {
  const client = getSupabaseClient();
  if (!client) return unavailable();
  let query = client
    .from('business_verifications')
    .select('id, business_id, status, admin_note, submitted_at, reviewed_at, level_requested, id_doc_path, reg_doc_path', { count: 'exact' })
    .order('submitted_at', { ascending: false });
  if (status) query = query.eq('status', status);
  const from = Math.max(0, page - 1) * pageSize;
  const { data, error, count } = await query.range(from, from + pageSize - 1);
  if (error) return { data: null, error: normalizeError(error) };
  return { data: { rows: data ?? [], total: count ?? 0, page: Math.max(1, page), pageSize }, error: null };
}

export async function updateBusinessVerificationStatus(id: string, status: string, note?: string): Promise<QueryResult<{ id: string }>> {
  const client = getSupabaseClient();
  if (!client) return unavailable();
  const update: { status: string; reviewed_at: string; admin_note?: string } = { status, reviewed_at: new Date().toISOString() };
  if (note) update.admin_note = note;
  const { data, error } = await client.from('business_verifications').update(update).eq('id', id).select('id').maybeSingle();
  if (error) return { data: null, error: normalizeError(error) };
  if (!data) return { data: null, error: { code: 'forbidden', message: 'Not authorized to update this verification, or it no longer exists.', retryable: false } };
  return { data, error: null };
}
