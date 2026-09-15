// Batch 4: Content Management. content_pages/content_page_versions is a
// real, already-versioned CMS with live website + mobile consumers
// (js/site-content.js, apps/mobile/lib/content.ts, legal-doc/[key].tsx,
// help.tsx) -- edits here are real production edits, not a draft sandbox.
// blog_videos is a separate, genuinely distinct table (no version history).
// Contact & Social links are NOT duplicated here -- they already live in
// app_settings.settings.content (see getContactSocialLinks below), reusing
// the exact read-merge-write pattern platform/query.ts established in
// Batch 3, scoped to that one nested key.
import { getSupabaseClient } from '../supabase/client';
import { normalizeError, type NormalizedError } from '../errors/normalize-error';

export type QueryResult<T> = { data: T; error: null } | { data: null; error: NormalizedError };

function unavailable<T>(): QueryResult<T> {
  return { data: null, error: { code: 'client_unavailable', message: 'Live Supabase is not configured.', retryable: false } };
}

// ── Content pages (legal + faq) ─────────────────────────────────────────

export type ContentPageRow = { id: string; slug: string | null; content_type: string | null; locale: string | null; title: string | null; short_description: string | null; status: string | null; version: number | null; effective_date: string | null };
export async function listContentPages(contentType: 'legal' | 'faq'): Promise<QueryResult<ContentPageRow[]>> {
  const client = getSupabaseClient();
  if (!client) return unavailable();
  const { data, error } = await client
    .from('content_pages')
    .select('id, slug, content_type, locale, title, short_description, status, version, effective_date')
    .eq('content_type', contentType)
    .order('slug', { ascending: true });
  if (error) return { data: null, error: normalizeError(error) };
  return { data: data ?? [], error: null };
}

export type ContentPageDetail = ContentPageRow & { body: unknown; metadata: unknown };
export async function getContentPage(id: string): Promise<QueryResult<ContentPageDetail | null>> {
  const client = getSupabaseClient();
  if (!client) return unavailable();
  const { data, error } = await client
    .from('content_pages')
    .select('id, slug, content_type, locale, title, short_description, status, version, effective_date, body, metadata')
    .eq('id', id)
    .maybeSingle();
  if (error) return { data: null, error: normalizeError(error) };
  return { data: data ?? null, error: null };
}

/** content_pages has a real BEFORE UPDATE trigger
 * (content_pages_before_update()) that already archives the pre-edit row
 * into content_page_versions and bumps `version` itself on every UPDATE --
 * confirmed live via pg_get_functiondef and a reversible end-to-end test
 * against a real draft row. An earlier version of this function also
 * manually inserted a version row and set `version` explicitly, which
 * fought the trigger and produced a duplicate/off-by-one history row on
 * every save (caught before it ever ran against a real edited document --
 * no production duplicates existed). This just sends the plain UPDATE and
 * lets the trigger own versioning entirely. */
export async function updateContentPage(page: ContentPageDetail, updatedBy: string): Promise<QueryResult<true>> {
  const client = getSupabaseClient();
  if (!client) return unavailable();
  const { error } = await client.from('content_pages').update({
    title: page.title, short_description: page.short_description, body: page.body as never,
    status: page.status, effective_date: page.effective_date, updated_by: updatedBy,
  }).eq('id', page.id);
  if (error) return { data: null, error: normalizeError(error) };
  return { data: true, error: null };
}

export type ContentPageVersionRow = { id: string; version: number | null; title: string | null; status: string | null; updated_by: string | null };
export async function listContentPageVersions(contentPageId: string): Promise<QueryResult<ContentPageVersionRow[]>> {
  const client = getSupabaseClient();
  if (!client) return unavailable();
  const { data, error } = await client
    .from('content_page_versions')
    .select('id, version, title, status, updated_by')
    .eq('content_page_id', contentPageId)
    .order('version', { ascending: false });
  if (error) return { data: null, error: normalizeError(error) };
  return { data: data ?? [], error: null };
}

// ── Blog videos ──────────────────────────────────────────────────────────

export type BlogVideoRow = { id: string; title: string | null; description: string | null; provider: string | null; embed_id: string | null; is_published: boolean | null; sort_order: number | null };
export async function listBlogVideos(): Promise<QueryResult<BlogVideoRow[]>> {
  const client = getSupabaseClient();
  if (!client) return unavailable();
  const { data, error } = await client.from('blog_videos').select('id, title, description, provider, embed_id, is_published, sort_order').order('sort_order', { ascending: true });
  if (error) return { data: null, error: normalizeError(error) };
  return { data: data ?? [], error: null };
}

export async function setBlogVideoPublished(id: string, isPublished: boolean): Promise<QueryResult<true>> {
  const client = getSupabaseClient();
  if (!client) return unavailable();
  const { error } = await client.from('blog_videos').update({ is_published: isPublished }).eq('id', id);
  if (error) return { data: null, error: normalizeError(error) };
  return { data: true, error: null };
}

export async function createBlogVideo(title: string, provider: string, embedId: string, videoUrl: string, description: string): Promise<QueryResult<true>> {
  const client = getSupabaseClient();
  if (!client) return unavailable();
  const { error } = await client.from('blog_videos').insert({ title, provider, embed_id: embedId, video_url: videoUrl, description, is_published: false });
  if (error) return { data: null, error: normalizeError(error) };
  return { data: true, error: null };
}

export async function updateBlogVideo(id: string, patch: { title?: string; description?: string; provider?: string; embed_id?: string; sort_order?: number }): Promise<QueryResult<true>> {
  const client = getSupabaseClient();
  if (!client) return unavailable();
  const { error } = await client.from('blog_videos').update(patch).eq('id', id);
  if (error) return { data: null, error: normalizeError(error) };
  return { data: true, error: null };
}

// ── Contact & Social (a nested key inside the existing app_settings row) ──

export type ContactSocialLinks = { supportEmail: string; whatsappNumber: string; websiteUrl: string; appStoreUrl: string; playStoreUrl: string; socialLinks: Record<string, string> };
const emptyLinks: ContactSocialLinks = { supportEmail: '', whatsappNumber: '', websiteUrl: '', appStoreUrl: '', playStoreUrl: '', socialLinks: {} };

export async function getContactSocialLinks(): Promise<QueryResult<ContactSocialLinks>> {
  const client = getSupabaseClient();
  if (!client) return unavailable();
  const { data, error } = await client.from('app_settings').select('settings').eq('id', 1).maybeSingle();
  if (error) return { data: null, error: normalizeError(error) };
  const content = ((data?.settings as Record<string, unknown> | null)?.content ?? {}) as Record<string, unknown>;
  return {
    data: {
      supportEmail: typeof content.supportEmail === 'string' ? content.supportEmail : '',
      whatsappNumber: typeof content.whatsappNumber === 'string' ? content.whatsappNumber : '',
      websiteUrl: typeof content.websiteUrl === 'string' ? content.websiteUrl : '',
      appStoreUrl: typeof content.appStoreUrl === 'string' ? content.appStoreUrl : '',
      playStoreUrl: typeof content.playStoreUrl === 'string' ? content.playStoreUrl : '',
      socialLinks: (content.socialLinks && typeof content.socialLinks === 'object' ? content.socialLinks : {}) as Record<string, string>,
    },
    error: null,
  };
}

/** Merge-only write: reads the full settings row first so the Batch 3
 * operational keys (signupPaused, fxRate, etc.) are preserved untouched. */
export async function updateContactSocialLinks(patch: Partial<ContactSocialLinks>): Promise<QueryResult<true>> {
  const client = getSupabaseClient();
  if (!client) return unavailable();
  const { data: current, error: readError } = await client.from('app_settings').select('settings').eq('id', 1).maybeSingle();
  if (readError) return { data: null, error: normalizeError(readError) };
  const currentSettings = (current?.settings as Record<string, unknown> ?? {});
  const currentContent = (currentSettings.content as Record<string, unknown> ?? emptyLinks);
  const merged = { ...currentSettings, content: { ...currentContent, ...patch } };
  const { error } = await client.from('app_settings').update({ settings: merged }).eq('id', 1);
  if (error) return { data: null, error: normalizeError(error) };
  return { data: true, error: null };
}
