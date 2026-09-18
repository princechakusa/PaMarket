// Fixed, curated Institution listing filters (Phase 0 taxonomy-mapping
// decision -- deliberately NOT derived dynamically from distinct
// categories present, per that decision). Applied on top of
// listings.institution_id = <institution>, never replacing it. Reuses the
// existing category taxonomy verbatim -- no new categories were created.
// "Free" is price = 0 on the existing price column, not a category.
export type InstitutionListingFilter =
  | "all" | "accommodation" | "study-materials" | "electronics" | "furniture"
  | "fashion" | "services" | "jobs" | "vehicles" | "free";

export const INSTITUTION_LISTING_FILTERS: { key: InstitutionListingFilter; label: string; emoji: string }[] = [
  { key: "all", label: "All", emoji: "🏫" },
  { key: "accommodation", label: "Accommodation", emoji: "🏠" },
  { key: "study-materials", label: "Study Materials", emoji: "📚" },
  { key: "electronics", label: "Electronics", emoji: "💻" },
  { key: "furniture", label: "Furniture", emoji: "🪑" },
  { key: "fashion", label: "Fashion", emoji: "👕" },
  { key: "services", label: "Services", emoji: "🛠️" },
  { key: "jobs", label: "Jobs", emoji: "💼" },
  { key: "vehicles", label: "Vehicles", emoji: "🚗" },
  { key: "free", label: "Free", emoji: "🆓" },
];

/** Applies one fixed filter's clause to an in-flight Supabase query builder
 * for `listings`. "accommodation" maps to two categories (property + rooms,
 * per the Phase 0 mapping report) so it needs `.in(...)`, not `.eq(...)`.
 * "study-materials" is the other/study-materials subcategory added in
 * Phase 1 -- reused verbatim, not redefined here. "free" filters price
 * regardless of category and combines with nothing else (mutually
 * exclusive with the category chips in this fixed UI, matching the Phase 0
 * decision that Free is independent of category). */
export function applyInstitutionListingFilter<Q extends { eq: (c: string, v: unknown) => Q; in: (c: string, v: unknown[]) => Q }>(
  query: Q,
  filter: InstitutionListingFilter
): Q {
  switch (filter) {
    case "all": return query;
    case "accommodation": return query.in("category", ["property", "rooms"]);
    case "study-materials": return query.eq("category", "other").eq("attributes->>subcat", "study-materials") as unknown as Q;
    case "electronics": return query.eq("category", "electronics");
    case "furniture": return query.eq("category", "furniture");
    case "fashion": return query.eq("category", "fashion");
    case "services": return query.eq("category", "services");
    case "jobs": return query.eq("category", "jobs");
    case "vehicles": return query.eq("category", "vehicles");
    case "free": return query.eq("price", 0);
    default: return query;
  }
}
