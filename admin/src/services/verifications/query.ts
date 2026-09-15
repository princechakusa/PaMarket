// Batch 1: Verifications — one merged workspace for individual KYC
// (`verifications`) and business KYC (`business_verifications`). Reuses
// the existing "verif admin select/update" and "biz_verif: admin all"
// RLS policies (both is_admin()) directly — no new RPC.
//
// id_doc_path/selfie_path/reg_doc_path (storage object paths, not raw
// files) ARE selected below so the review UI can request a short-lived
// signed URL for each document on demand via getSignedDocumentUrl() --
// nothing beyond the path string is ever fetched by this file itself.
// The private verification-docs bucket's "verifdocs admin select" storage
// policy previously checked profiles.role = 'admin' literally, which
// silently blocked every super_admin session (the only staff role that
// exists in production) from generating a signed URL at all -- fixed in
// supabase/migrations/20260915090000_fix_verifdocs_admin_select_super_admin.sql
// to use is_admin() instead.
import { getSupabaseClient } from '../supabase/client';
import { normalizeError, type NormalizedError } from '../errors/normalize-error';

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

/** Generates a short-lived (2 minute) signed URL for a private document
 * path in the verification-docs bucket. Never returns/stores the URL
 * beyond component state; the caller re-requests on each detail view. */
export async function getSignedDocumentUrl(path: string): Promise<QueryResult<string>> {
  const client = getSupabaseClient();
  if (!client) return unavailable();
  const { data, error } = await client.storage.from('verification-docs').createSignedUrl(path, 120);
  if (error) return { data: null, error: normalizeError(error) };
  return { data: data.signedUrl, error: null };
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
