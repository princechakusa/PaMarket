// Batch 4: AMOS (marketing automation). This is a real, live system driven
// by 11 Edge Functions (amos-content-generator, amos-publish-dispatcher,
// amos-seo-runner, etc.) -- not a legacy screen with no backend. Everything
// here is admin-gated by the existing has_admin_privilege('admin') RLS
// already on every amos_* table; nothing new is created server-side.
// amos_get_vault_secret / amos_set_integration_credential and any provider
// API keys are deliberately never called or read from this file.
import { getSupabaseClient } from '../supabase/client';
import { normalizeError, type NormalizedError } from '../errors/normalize-error';

export type QueryResult<T> = { data: T; error: null } | { data: null; error: NormalizedError };

function unavailable<T>(): QueryResult<T> {
  return { data: null, error: { code: 'client_unavailable', message: 'Live Supabase is not configured.', retryable: false } };
}

export type AmosCounts = { drafts: number; pendingReview: number; approved: number; rejected: number; scheduledUpcoming: number; integrations: number; integrationsFailing: number };
export async function getAmosCounts(): Promise<QueryResult<AmosCounts>> {
  const client = getSupabaseClient();
  if (!client) return unavailable();
  const results = await Promise.all([
    client.from('amos_content_drafts').select('*', { count: 'exact', head: true }),
    client.from('amos_content_drafts').select('*', { count: 'exact', head: true }).eq('status', 'draft'),
    client.from('amos_content_drafts').select('*', { count: 'exact', head: true }).eq('status', 'approved'),
    client.from('amos_content_drafts').select('*', { count: 'exact', head: true }).eq('status', 'rejected'),
    client.from('amos_schedule').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    client.from('amos_integrations').select('*', { count: 'exact', head: true }),
    client.from('amos_integrations').select('*', { count: 'exact', head: true }).eq('auto_disabled', true),
  ] as const);
  const failed = results.find((r) => r.error);
  if (failed?.error) return { data: null, error: normalizeError(failed.error) };
  const [drafts, pendingReview, approved, rejected, scheduledUpcoming, integrations, integrationsFailing] = results;
  return {
    data: {
      drafts: drafts.count ?? 0, pendingReview: pendingReview.count ?? 0, approved: approved.count ?? 0,
      rejected: rejected.count ?? 0, scheduledUpcoming: scheduledUpcoming.count ?? 0,
      integrations: integrations.count ?? 0, integrationsFailing: integrationsFailing.count ?? 0,
    },
    error: null,
  };
}

export type DraftRow = { id: string; channel: string | null; draft_type: string | null; body: string | null; status: string | null; created_at: string | null; relevance_score: number | null; brand_alignment_score: number | null; seo_value_score: number | null };
export async function listPendingDrafts(): Promise<QueryResult<DraftRow[]>> {
  const client = getSupabaseClient();
  if (!client) return unavailable();
  const { data, error } = await client
    .from('amos_content_drafts')
    .select('id, channel, draft_type, body, status, created_at, relevance_score, brand_alignment_score, seo_value_score')
    .eq('status', 'draft')
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) return { data: null, error: normalizeError(error) };
  return { data: data ?? [], error: null };
}

/** This is the real, existing AMOS approval workflow (reviewed_by/
 * reviewed_at columns already exist for this exact purpose) -- not a new
 * moderation system, and unrelated to Trust & Safety listing moderation. */
export async function decideDraft(id: string, status: 'approved' | 'rejected', reviewerId: string): Promise<QueryResult<true>> {
  const client = getSupabaseClient();
  if (!client) return unavailable();
  const { error } = await client.from('amos_content_drafts').update({ status, reviewed_by: reviewerId, reviewed_at: new Date().toISOString() }).eq('id', id);
  if (error) return { data: null, error: normalizeError(error) };
  return { data: true, error: null };
}

export type MarketIntelRow = { id: string; country_code: string | null; signal_type: string | null; topic: string | null; score: number | null; rationale: string | null; collected_at: string | null };
export async function listMarketIntelligence(): Promise<QueryResult<MarketIntelRow[]>> {
  const client = getSupabaseClient();
  if (!client) return unavailable();
  const { data, error } = await client.from('amos_market_intelligence').select('id, country_code, signal_type, topic, score, rationale, collected_at').order('collected_at', { ascending: false }).limit(30);
  if (error) return { data: null, error: normalizeError(error) };
  return { data: data ?? [], error: null };
}

export type SeoRecommendationRow = { id: string; page_type: string | null; page_ref: string | null; recommendation_type: string | null; current_value: string | null; suggested_value: string | null; status: string | null };
export async function listSeoRecommendations(): Promise<QueryResult<SeoRecommendationRow[]>> {
  const client = getSupabaseClient();
  if (!client) return unavailable();
  const { data, error } = await client.from('amos_seo_recommendations').select('id, page_type, page_ref, recommendation_type, current_value, suggested_value, status').order('created_at', { ascending: false }).limit(30);
  if (error) return { data: null, error: normalizeError(error) };
  return { data: data ?? [], error: null };
}

export type IntegrationRow = { id: string; provider: string | null; status: string | null; last_success_at: string | null; last_error: string | null; consecutive_failures: number | null; auto_disabled: boolean | null };
export async function listIntegrations(): Promise<QueryResult<IntegrationRow[]>> {
  const client = getSupabaseClient();
  if (!client) return unavailable();
  const { data, error } = await client.from('amos_integrations').select('id, provider, status, last_success_at, last_error, consecutive_failures, auto_disabled');
  if (error) return { data: null, error: normalizeError(error) };
  return { data: data ?? [], error: null };
}
