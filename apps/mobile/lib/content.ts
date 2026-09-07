// Admin-managed public content (legal docs, FAQ) — stage 1 of the
// hardcoded-content migration. Fetches a published row from Supabase's
// content_pages table, with the existing offline-cache pattern
// (lib/offlineCache.ts) as a second line of defence and the app's own
// static constants (lib/legal.ts) as the last-resort fallback, so a
// content-server outage or first-ever-launch-while-offline never blanks a
// legal or FAQ screen.
//
// Deliberately narrow: this only fetches `body` (sections/items), `title`
// and `updated`-equivalent metadata for the small set of slugs actually
// migrated into content_pages so far. Any slug not yet migrated (most of
// the 18 docs in lib/legal.ts) simply isn't looked up here — callers keep
// reading the static constant directly, unchanged.
import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import { loadCache, saveCache } from "./offlineCache";
import type { LegalDoc } from "./legal";

const CACHE_PREFIX = "content-page-";

type ContentPageRow = {
  slug: string;
  title: string;
  body: { sections?: LegalDoc["sections"]; items?: unknown };
  effective_date: string | null;
  updated_at: string;
};

function updatedLabel(row: Pick<ContentPageRow, "effective_date" | "updated_at">): string {
  const d = row.effective_date ? new Date(row.effective_date) : new Date(row.updated_at);
  if (Number.isNaN(d.getTime())) return "";
  return `Last updated: ${d.toLocaleString("en-US", { month: "long", year: "numeric" })}`;
}

// Returns a LegalDoc-shaped object for a migrated legal slug, or null if
// the slug isn't published (or reachable) anywhere — callers fall back to
// their static lib/legal.ts constant in that case.
export async function fetchLegalDoc(slug: string): Promise<LegalDoc | null> {
  const cacheKey = `${CACHE_PREFIX}${slug}`;
  try {
    const { data, error } = await supabase
      .from("content_pages")
      .select("slug,title,body,effective_date,updated_at")
      .eq("slug", slug)
      .eq("status", "published")
      .maybeSingle<ContentPageRow>();
    if (error || !data || !data.body?.sections) {
      const cached = await loadCache<LegalDoc>(cacheKey);
      return cached ?? null;
    }
    const doc: LegalDoc = { title: data.title, updated: updatedLabel(data), sections: data.body.sections };
    saveCache(cacheKey, doc).catch(() => {});
    return doc;
  } catch {
    return loadCache<LegalDoc>(cacheKey);
  }
}

// Shared silent-upgrade hook for screens that hold a TERMS/PRIVACY (or
// other migrated LegalDoc) object in local state to feed a LegalDocSheet —
// sign-in, sign-up. Returns the static doc immediately (no loading state,
// nothing blocks the screen), then swaps in the published version in the
// background if content_pages has it. `staticDoc` itself never changes
// identity across renders (TERMS/PRIVACY are module-level constants), so
// this is safe to call with it directly as a dependency.
export function useLegalDocUpgrade(slug: string, staticDoc: LegalDoc): LegalDoc {
  const [doc, setDoc] = useState<LegalDoc>(staticDoc);
  useEffect(() => {
    let cancelled = false;
    fetchLegalDoc(slug)
      .then((fetched) => {
        if (!cancelled && fetched) setDoc(fetched);
      })
      .catch(() => {
        // Fetch/cache both failed — the static doc already showing stays.
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);
  return doc;
}

export type PublicSettings = {
  supportEmail?: string | null;
  whatsappNumber?: string | null;
  socialLinks?: { tiktok?: string | null; facebook?: string | null; instagram?: string | null };
  appStoreUrl?: string | null;
  playStoreUrl?: string | null;
  websiteUrl?: string | null;
};

// Same app_settings.content record the website footer reads (Stage 1) —
// support email, WhatsApp, social links, store/website links. Never
// throws; resolves null on any failure so callers keep their bundled
// static values.
export async function fetchPublicSettings(): Promise<PublicSettings | null> {
  const cacheKey = `${CACHE_PREFIX}public-settings`;
  try {
    const { data, error } = await supabase
      .from("app_settings")
      .select("settings")
      .eq("id", 1)
      .maybeSingle<{ settings: { content?: PublicSettings } }>();
    const content = !error && data?.settings?.content ? data.settings.content : null;
    if (!content) return loadCache<PublicSettings>(cacheKey);
    saveCache(cacheKey, content).catch(() => {});
    return content;
  } catch {
    return loadCache<PublicSettings>(cacheKey);
  }
}

export type FaqEntry = { group: string; q: string; a: string };

// Same pattern for the FAQ page (content_type='faq', slug='faq').
export async function fetchFaqEntries(): Promise<FaqEntry[] | null> {
  const cacheKey = `${CACHE_PREFIX}faq`;
  try {
    const { data, error } = await supabase
      .from("content_pages")
      .select("body")
      .eq("slug", "faq")
      .eq("status", "published")
      .maybeSingle<{ body: { items?: FaqEntry[] } }>();
    const items = !error && data?.body?.items ? data.body.items : null;
    if (!items) return loadCache<FaqEntry[]>(cacheKey);
    saveCache(cacheKey, items).catch(() => {});
    return items;
  } catch {
    return loadCache<FaqEntry[]>(cacheKey);
  }
}
