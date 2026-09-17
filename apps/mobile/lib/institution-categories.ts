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
  // Approved one-line description shown under the label, matching the
  // Stitch mock's copy -- plain static UI text, not derived from any data
  // source.
  description: string;
  // Reuses the app's existing bundled category art (assets/cats/*.webp,
  // the same images already used by components/post/CategoryPicker.tsx)
  // rather than introducing new photographic assets.
  icon: ReturnType<typeof require>;
};

// Dedicated, real photographic-style art for each institution category tile
// (assets/institution-cats/*.webp, resized to 400x400 and re-encoded to
// WebP from the original 1024x1024 source PNGs -- ~1.5MB each raw down to
// ~15-30KB each, so bundling all 10 costs the app well under 250KB total).
// Distinct from assets/cats/*.webp (the normal marketplace CategoryPicker's
// icon set) -- these were commissioned specifically for the Institutions
// Post Setup screen, so every tile now gets its own real image instead of
// sharing the generic marketplace icon.
const imgTextbooks = require("../assets/institution-cats/textbooks.webp");
const imgElectronics = require("../assets/institution-cats/electronics.webp");
const imgAccommodation = require("../assets/institution-cats/accommodation.webp");
const imgRoomFurniture = require("../assets/institution-cats/room-furniture.webp");
const imgStationeryLab = require("../assets/institution-cats/stationery-lab.webp");
const imgStudentServices = require("../assets/institution-cats/student-services.webp");
const imgUniforms = require("../assets/institution-cats/uniforms.webp");
const imgSports = require("../assets/institution-cats/sports.webp");
const imgEquipment = require("../assets/institution-cats/equipment.webp");
const imgBoarding = require("../assets/institution-cats/boarding.webp");

const UNIVERSITY_CATEGORIES: InstitutionCategoryTile[] = [
  { categoryId: "other", label: "Textbooks", icon: imgTextbooks, description: "Course packs, study guides, academic and faculty books" },
  { categoryId: "electronics", label: "Electronics", icon: imgElectronics, description: "Laptops, phones, tablets, chargers and student gadgets" },
  { categoryId: "rooms", label: "Accommodation", icon: imgAccommodation, description: "Student rooms, room shares, cottages and boarding vacancies" },
  { categoryId: "furniture", label: "Room & Furniture", icon: imgRoomFurniture, description: "Desks, chairs, lamps, mattresses and mini fridges" },
  { categoryId: "other", label: "Stationery & Lab", icon: imgStationeryLab, description: "Lab coats, notebooks, practical apparatus and supplies" },
  { categoryId: "services", label: "Student Services", icon: imgStudentServices, description: "Tutoring, thesis binding, printing, design and repairs" },
];

// Matches the approved High School Institution Post Setup design exactly:
// Uniforms, Sports, Textbooks, Calculators & Equipment, Boarding. Sports,
// Textbooks, and Calculators & Equipment all pre-select "other" (school
// supplies/equipment isn't split into dedicated top-level categories in the
// existing taxonomy) -- same "distinct tiles, shared underlying category"
// pattern already used by the University set's Textbooks/Stationery & Lab
// pair, refined later via the existing subcategory picker where available.
// Each tile still gets its own distinct real image now, even where the
// underlying categoryId is shared.
const HIGH_SCHOOL_CATEGORIES: InstitutionCategoryTile[] = [
  { categoryId: "fashion", label: "Uniforms", icon: imgUniforms, description: "School uniforms, blazers, ties and formal school clothing" },
  { categoryId: "other", label: "Sports", icon: imgSports, description: "Sports clothing, athletic tracksuits, boots and equipment" },
  { categoryId: "other", label: "Textbooks", icon: imgTextbooks, description: "O-Level, A-Level, ZIMSEC & Cambridge textbooks & setbooks" },
  { categoryId: "other", label: "Calculators & Equipment", icon: imgEquipment, description: "Calculators, geometry sets, drawing & practical equipment" },
  { categoryId: "other", label: "Boarding", icon: imgBoarding, description: "Trunks, tuckboxes, padlocks, laundry bags and hostel supplies" },
];

// "organization" institutions fall back to the university set (the closer
// analog of the two) since no dedicated shortlist has been approved for
// that type yet.
export const INSTITUTION_CATEGORIES: Record<InstitutionType, InstitutionCategoryTile[]> = {
  university: UNIVERSITY_CATEGORIES,
  high_school: HIGH_SCHOOL_CATEGORIES,
  organization: UNIVERSITY_CATEGORIES,
};
