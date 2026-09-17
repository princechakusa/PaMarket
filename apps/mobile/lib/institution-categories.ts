import type { InstitutionType } from "./institutions";
import type { Category } from "./constants";

// Institution Post Setup screen. Fixed, curated category shortlists per
// institution type -- same "fixed, not dynamically derived" decision
// already used by lib/institution-listing-filters.ts for the feed filter
// chips. Each entry's `id` is a real, existing public.categories /
// listings.category id (see lib/constants.ts's CATEGORIES) -- no new
// category was created. Where the underlying taxonomy only has one matching
// subcategory today (e.g. "study-materials" under "other"), the tile still
// points at the real top-level category and the user refines it with the
// existing subcategory picker already shown in the post form's step 1
// (components/post/AttrFields.tsx) -- this screen only pre-selects the
// top-level category, matching the brief's "no new listing fields yet".
export type InstitutionCategoryTile = {
  // Real listings.category id this tile pre-selects -- typed from the real
  // Category source of truth (lib/constants.ts) rather than a bare string,
  // so this ties to the same type CATEGORIES itself uses instead of a
  // second, disconnected category union.
  categoryId: Category["id"];
  // Approved short, campus-facing label shown on the tile (distinct from
  // the underlying category's generic marketplace name).
  label: string;
  // Reuses the app's existing bundled category art (assets/cats/*.webp,
  // the same images already used by components/post/CategoryPicker.tsx)
  // rather than introducing new photographic assets.
  icon: ReturnType<typeof require>;
};

const catOther = require("../assets/cats/cat_other.webp");
const catElectronics = require("../assets/cats/cat_electronics.webp");
const catRooms = require("../assets/cats/cat_rooms.webp");
const catFurniture = require("../assets/cats/cat_furniture.webp");
const catServices = require("../assets/cats/cat_services.webp");
const catFashion = require("../assets/cats/cat_fashion.webp");

const UNIVERSITY_CATEGORIES: InstitutionCategoryTile[] = [
  { categoryId: "other", label: "Textbooks", icon: catOther },
  { categoryId: "electronics", label: "Electronics", icon: catElectronics },
  { categoryId: "rooms", label: "Accommodation", icon: catRooms },
  { categoryId: "furniture", label: "Room & Furniture", icon: catFurniture },
  { categoryId: "other", label: "Stationery & Lab", icon: catOther },
  { categoryId: "services", label: "Student Services", icon: catServices },
];

// Matches the approved High School Institution Post Setup design exactly:
// Uniforms, Sports, Textbooks, Calculators & Equipment, Boarding. Sports,
// Textbooks, and Calculators & Equipment all pre-select "other" (school
// supplies/equipment isn't split into dedicated top-level categories in the
// existing taxonomy) -- same "distinct tiles, shared underlying category"
// pattern already used by the University set's Textbooks/Stationery & Lab
// pair, refined later via the existing subcategory picker where available.
const HIGH_SCHOOL_CATEGORIES: InstitutionCategoryTile[] = [
  { categoryId: "fashion", label: "Uniforms", icon: catFashion },
  { categoryId: "other", label: "Sports", icon: catOther },
  { categoryId: "other", label: "Textbooks", icon: catOther },
  { categoryId: "other", label: "Calculators & Equipment", icon: catOther },
  { categoryId: "other", label: "Boarding", icon: catOther },
];

// "organization" institutions fall back to the university set (the closer
// analog of the two) since no dedicated shortlist has been approved for
// that type yet.
export const INSTITUTION_CATEGORIES: Record<InstitutionType, InstitutionCategoryTile[]> = {
  university: UNIVERSITY_CATEGORIES,
  high_school: HIGH_SCHOOL_CATEGORIES,
  organization: UNIVERSITY_CATEGORIES,
};
