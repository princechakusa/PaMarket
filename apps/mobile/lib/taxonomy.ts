// Canonical marketplace taxonomy (categories/provinces/cities) — Stage 4 of
// the centralization work. Same pattern as lib/content.ts: fetch published
// content_pages, fetch this instead → fetch active categories/provinces/
// cities from Supabase, fall back to lib/offlineCache.ts's last-good
// snapshot, and ultimately to the bundled lib/constants.ts values (which
// stay in the app regardless — nothing here can leave a screen blank).
//
// Deliberately narrow this stage: only wired into one low-risk, display-
// only consumer (the home tab's category grid) as a proof of the safe
// pattern. The other ~13 screens that import CATEGORIES/PROVINCES directly
// (posting/editing forms across listings, jobs, business) are NOT touched —
// rewiring a posting form's category picker carries real risk of blocking
// listing/job creation if done in a rush, which Stage 4 explicitly
// prohibits. See the Stage 4 report for the full list, deferred to a
// future stage.
import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import { loadCache, saveCache } from "./offlineCache";
import { CATEGORIES, PROVINCES, CITIES_BY_PROVINCE, type Category } from "./constants";

const CACHE_PREFIX = "taxonomy-";

// Stable sentinel for "remote" job location — kept distinct from any real
// province name so it can never collide with a canonical province fetched
// from Supabase (Zimbabwe has no province literally named "Remote", but
// this makes that guarantee explicit rather than incidental). Existing job
// rows already store the literal string "Remote" in their province column
// (matching post-job.html's current behaviour) — this constant's VALUE is
// deliberately kept identical to that existing stored value so old job
// records keep matching; only the reference is now named, not scattered
// string literals.
export const REMOTE_PROVINCE_VALUE = "Remote";

type CategoryRow = { legacy_key: string; name: string; color: string | null; sort_order: number };
type ProvinceRow = { name: string; sort_order: number };
type CityRow = { name: string; sort_order: number; provinces: { name: string } | { name: string }[] | null };

// Resolves to the same Category[] shape as lib/constants.ts's CATEGORIES,
// or null if nothing published/reachable — callers keep their static
// import in that case.
export async function fetchCategories(): Promise<Category[] | null> {
  const cacheKey = `${CACHE_PREFIX}categories`;
  try {
    const { data, error } = await supabase
      .from("categories")
      .select("legacy_key,name,color,sort_order")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .returns<CategoryRow[]>();
    if (error || !data || !data.length) {
      return loadCache<Category[]>(cacheKey);
    }
    const mapped: Category[] = data.map((r) => ({ id: r.legacy_key, name: r.name }));
    saveCache(cacheKey, mapped).catch(() => {});
    return mapped;
  } catch {
    return loadCache<Category[]>(cacheKey);
  }
}

export async function fetchCategoryColors(): Promise<Record<string, string> | null> {
  const cacheKey = `${CACHE_PREFIX}category-colors`;
  try {
    const { data, error } = await supabase
      .from("categories")
      .select("legacy_key,color")
      .eq("is_active", true)
      .returns<{ legacy_key: string; color: string | null }[]>();
    if (error || !data || !data.length) return loadCache<Record<string, string>>(cacheKey);
    const mapped: Record<string, string> = {};
    data.forEach((r) => { if (r.color) mapped[r.legacy_key] = r.color; });
    saveCache(cacheKey, mapped).catch(() => {});
    return mapped;
  } catch {
    return loadCache<Record<string, string>>(cacheKey);
  }
}

export async function fetchProvinces(): Promise<string[] | null> {
  const cacheKey = `${CACHE_PREFIX}provinces`;
  try {
    const { data, error } = await supabase
      .from("provinces")
      .select("name,sort_order")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .returns<ProvinceRow[]>();
    if (error || !data || !data.length) return loadCache<string[]>(cacheKey);
    const mapped = data.map((r) => r.name);
    saveCache(cacheKey, mapped).catch(() => {});
    return mapped;
  } catch {
    return loadCache<string[]>(cacheKey);
  }
}

// Resolves to the same Record<string,string[]> shape as constants.ts's
// CITIES_BY_PROVINCE, or null if unreachable.
export async function fetchCitiesByProvince(): Promise<Record<string, string[]> | null> {
  const cacheKey = `${CACHE_PREFIX}cities-by-province`;
  try {
    const { data, error } = await supabase
      .from("cities")
      .select("name,sort_order,provinces(name)")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .returns<CityRow[]>();
    if (error || !data || !data.length) return loadCache<Record<string, string[]>>(cacheKey);
    const mapped: Record<string, string[]> = {};
    data.forEach((r) => {
      const prov = Array.isArray(r.provinces) ? r.provinces[0] : r.provinces;
      const provName = prov?.name;
      if (!provName) return;
      if (!mapped[provName]) mapped[provName] = [];
      mapped[provName].push(r.name);
    });
    saveCache(cacheKey, mapped).catch(() => {});
    return mapped;
  } catch {
    return loadCache<Record<string, string[]>>(cacheKey);
  }
}

// Ensures `value` is present in `list` even if the fetched/active taxonomy
// no longer includes it (e.g. an old listing's category/province/city was
// since deactivated, or is a legacy value that was never in the canonical
// table at all). Without this, editing an old record could show an empty
// picker or fail validation for a value the record itself already has —
// exactly what Stage 5 prohibits ("preserve existing selected values when
// editing an old listing"). Never mutates the input list.
export function withSelectedValue<T extends { id: string } | string>(
  list: T[],
  value: string | null | undefined,
  makeEntry: (value: string) => T
): T[] {
  if (!value) return list;
  const has = list.some((item) => (typeof item === "string" ? item === value : item.id === value));
  return has ? list : [...list, makeEntry(value)];
}

// Shared silent-upgrade hook: shows the bundled constants.ts values
// immediately (no loading state), then swaps in the active taxonomy from
// Supabase in the background if reachable. `selectedCategoryId`/
// `selectedProvince`/`selectedCity` (all optional — pass the current form
// value when editing an existing record) are guaranteed to remain present
// in the returned lists even if Supabase's active set no longer includes
// them, so an old listing's picker/validation never breaks.
export function useTaxonomy(selected?: {
  categoryId?: string | null;
  province?: string | null;
  city?: string | null;
}): {
  categories: Category[];
  provinces: string[];
  citiesByProvince: Record<string, string[]>;
} {
  const [categories, setCategories] = useState<Category[]>(CATEGORIES);
  const [provinces, setProvinces] = useState<string[]>(PROVINCES);
  const [citiesByProvince, setCitiesByProvince] = useState<Record<string, string[]>>(CITIES_BY_PROVINCE);

  useEffect(() => {
    let cancelled = false;
    fetchCategories().then((fetched) => {
      if (!cancelled && fetched && fetched.length) setCategories(fetched);
    }).catch(() => {});
    fetchProvinces().then((fetched) => {
      if (!cancelled && fetched && fetched.length) setProvinces(fetched);
    }).catch(() => {});
    fetchCitiesByProvince().then((fetched) => {
      if (!cancelled && fetched && Object.keys(fetched).length) setCitiesByProvince(fetched);
    }).catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const safeCategories = withSelectedValue(categories, selected?.categoryId, (id) => ({ id, name: id }));
  const safeProvinces = withSelectedValue(provinces, selected?.province, (p) => p);
  const safeCitiesByProvince = { ...citiesByProvince };
  if (selected?.province && selected?.city) {
    const existing = safeCitiesByProvince[selected.province] ?? [];
    if (!existing.includes(selected.city)) {
      safeCitiesByProvince[selected.province] = [...existing, selected.city];
    }
  }

  return { categories: safeCategories, provinces: safeProvinces, citiesByProvince: safeCitiesByProvince };
}
