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
