// Institutions Phase 3. Mirrors lib/businesses.ts's shape exactly (a plain
// type + a tiny display helper, no separate fetch/service layer -- mobile
// has no such layer for businesses either; screens query Supabase
// directly). province_id/city_id are real FKs into the existing
// provinces/cities tables (Phase 1) -- resolved to names via an embedded
// join in the screens that need them, never duplicated here.
export type InstitutionType = "university" | "high_school" | "organization";

export type Institution = {
  id: string;
  type: InstitutionType;
  official_name: string;
  short_name?: string | null;
  search_aliases?: string[] | null;
  province_id: string;
  city_id: string;
  suburb?: string | null;
  logo_url?: string | null;
  description?: string | null;
  is_active: boolean;
  sort_order?: number | null;
};

export const INSTITUTION_TYPE_LABEL: Record<InstitutionType, string> = {
  university: "University",
  high_school: "High School",
  organization: "Organization",
};

export function institutionInitials(name: string): string {
  return (name || "I").trim().charAt(0).toUpperCase();
}

// "public"/"institution_only" is stored inside the existing listings.attributes
// jsonb column (see INSTITUTION_VISIBILITY_ATTR_KEY below) -- the smallest
// existing mechanism (already used for subcat/condition), never a new
// column. Absent/undefined (a normal, non-institution listing) behaves
// identically to "public": every existing query that doesn't know about
// this key keeps working unchanged.
export type InstitutionVisibility = "public" | "institution_only";

// Single source of truth for the jsonb attribute key itself -- previously
// hand-typed as the raw string "institution_visibility" in every screen
// that reads or writes it (post.tsx, the Home/Search feed filters, the
// Institutions directory feed filter, and the listing detail institution
// card). A typo in any one of those call sites would silently break the
// "Institution Only" privacy filter, so this key belongs in exactly one
// place.
export const INSTITUTION_VISIBILITY_ATTR_KEY = "institution_visibility";

export const INSTITUTION_VISIBILITY_LABEL: Record<InstitutionVisibility, string> = {
  public: "PaMarket + Institution",
  institution_only: "Institution Only",
};
