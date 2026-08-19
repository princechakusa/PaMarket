import { CATEGORIES } from "./constants";

export type Listing = {
  id: string;
  seller_id: string;
  seller_name?: string | null;
  seller_phone?: string | null;
  title: string;
  description?: string | null;
  price: number | null;
  currency?: string | null;
  category: string | null;
  province?: string | null;
  city?: string | null;
  suburb?: string | null;
  photos?: string[] | null;
  status: string;
  boost?: boolean | null;
  featured_until?: string | null;
  expires_at?: string | null;
  views?: number | null;
  business_id?: string | null;
  created_at: string;
  updated_at?: string | null;
  attributes?: Record<string, unknown> | null;
  condition?: string | null;
};

// Keep public feed queries aligned with the database RLS rule. The database
// remains authoritative (its clock decides access); this client-side clause is
// defense in depth for signed-in owners/admins and for cached feed snapshots.
export function publicListingExpiryFilter(now = new Date()): string {
  return `expires_at.gt.${now.toISOString()}`;
}

export function isPublicListingEligible(
  listing: Pick<Listing, "status" | "expires_at">,
  now = Date.now()
): boolean {
  if (listing.status !== "active") return false;
  // Missing expiry metadata (including old cache entries) fails closed.
  if (!listing.expires_at) return false;
  const expiresAt = new Date(listing.expires_at).getTime();
  return Number.isFinite(expiresAt) && expiresAt > now;
}

export type SortMode = "newest" | "oldest" | "price_asc" | "price_desc" | "views";

export type ListingFilters = {
  query?: string;
  cityFilter?: string;
  priceMin?: number;
  priceMax?: number;
  sortMode?: SortMode;
};

function categoryName(id: string | null | undefined) {
  return CATEGORIES.find((c) => c.id === id)?.name ?? "";
}

function escapeRegExp(token: string) {
  return token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Mirrors www/js/app.js H.filterListings: city filter, price range, then a
// token-AND relevance search across title/description/location/category,
// falling back to the selected sort mode when there's no active query.
export function filterListings(list: Listing[], filters: ListingFilters): Listing[] {
  const query = (filters.query ?? "").toLowerCase().trim();
  const priceMin = filters.priceMin ?? 0;
  const priceMax = filters.priceMax ?? Infinity;
  const sortMode = filters.sortMode ?? "newest";
  const cityFilter = filters.cityFilter ?? "All Zimbabwe";
  const tokens = query ? query.split(/\s+/).filter(Boolean) : [];

  const scored: { listing: Listing; score: number }[] = [];

  for (const listing of list) {
    if (cityFilter && cityFilter !== "All Zimbabwe") {
      const haystack = `${listing.city ?? ""} ${listing.province ?? ""}`.toLowerCase();
      if (!haystack.includes(cityFilter.toLowerCase())) continue;
    }
    const price = listing.price ?? 0;
    if (price < priceMin || price > priceMax) continue;

    let score = 0;
    if (tokens.length) {
      const title = (listing.title || "").toLowerCase();
      const haystack = [
        title,
        listing.description || "",
        listing.city || "",
        listing.suburb || "",
        listing.province || "",
        categoryName(listing.category),
      ]
        .join(" ")
        .toLowerCase();

      let allTokensMatch = true;
      for (const token of tokens) {
        if (!haystack.includes(token)) {
          allTokensMatch = false;
          break;
        }
        score += title.includes(token) ? 10 : 3;
        if (new RegExp(`\\b${escapeRegExp(token)}\\b`).test(title)) score += 5;
      }
      if (!allTokensMatch) continue;
      if (title.includes(query)) score += 25;
    }

    scored.push({ listing, score });
  }

  scored.sort((a, b) => {
    if (tokens.length && b.score !== a.score) return b.score - a.score;
    const x = a.listing;
    const y = b.listing;
    if (sortMode === "oldest") return +new Date(x.created_at) - +new Date(y.created_at);
    if (sortMode === "price_asc") return (x.price ?? 0) - (y.price ?? 0);
    if (sortMode === "price_desc") return (y.price ?? 0) - (x.price ?? 0);
    if (sortMode === "views") return (y.views ?? 0) - (x.views ?? 0);
    return +new Date(y.created_at) - +new Date(x.created_at);
  });

  return scored.map((s) => s.listing);
}

export function isFeatured(listing: { featured_until?: string | null }): boolean {
  return !!listing.featured_until && new Date(listing.featured_until).getTime() > Date.now();
}

export function isNew(listing: Listing): boolean {
  const createdTime = listing.created_at ? new Date(listing.created_at).getTime() : 0;
  return createdTime > 0 && Date.now() - createdTime < 3 * 24 * 60 * 60 * 1000;
}

export function formatPrice(listing: Pick<Listing, "price" | "currency">): string {
  if (listing.price == null) return "Free";
  return `${listing.currency ?? "$"}${Number(listing.price).toLocaleString()}`;
}

export function listingLocation(listing: Pick<Listing, "suburb" | "city" | "province">): string {
  return listing.suburb || listing.city || listing.province || "Zimbabwe";
}

export type Condition = "all" | "new" | "like-new" | "used" | "refurbished";

export type BrowseFilters = {
  query: string;
  categories: string[];
  priceMin: number;
  priceMax: number;
  condition: Condition;
  currency: "all" | "USD" | "ZiG";
  location: string;
  verifiedOnly: boolean;
  sortBy: SortMode | "recent";
  verifiedSellerIds?: Set<string>;
  rentalType?: "all" | "For Sale" | "For Rent";
};

// Mirrors www/js/browse.js applyBrowseFilters: category/price/condition/
// currency/location/verified checks first, then the shared relevance search,
// then an explicit sort-by override on top.
export function applyBrowseFilters(list: Listing[], filters: BrowseFilters): Listing[] {
  const pool = list.filter((listing) => {
    if (filters.categories.length && !filters.categories.includes(listing.category ?? "")) return false;
    const price = listing.price ?? 0;
    if (price < filters.priceMin || price > filters.priceMax) return false;
    if (filters.condition !== "all") {
      // Current listings store condition in the dedicated column. Keep the
      // attributes fallback for legacy rows created before that column existed.
      const condition = listing.condition ?? (listing.attributes?.condition as string) ?? "";
      if (condition !== filters.condition) return false;
    }
    if (filters.currency !== "all" && (listing.currency ?? "USD") !== filters.currency) return false;
    if (filters.location && filters.location !== "all") {
      const haystack = `${listing.city ?? ""} ${listing.province ?? ""}`.toLowerCase();
      if (!haystack.includes(filters.location.toLowerCase())) return false;
    }
    if (filters.verifiedOnly && filters.verifiedSellerIds && !filters.verifiedSellerIds.has(listing.seller_id)) {
      return false;
    }
    if (filters.rentalType && filters.rentalType !== "all") {
      const rt = (listing.attributes?.rentalType as string) || "For Sale";
      if (rt !== filters.rentalType) return false;
    }
    return true;
  });

  const matched = filterListings(pool, { query: filters.query, sortMode: "newest" });

  if (filters.sortBy === "price_asc") matched.sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
  else if (filters.sortBy === "price_desc") matched.sort((a, b) => (b.price ?? 0) - (a.price ?? 0));
  else if (filters.sortBy === "oldest") matched.sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
  else if (filters.sortBy === "views") matched.sort((a, b) => (b.views ?? 0) - (a.views ?? 0));

  return matched;
}
