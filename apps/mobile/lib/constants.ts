export type Category = {
  id: string;
  name: string;
};

// Matches www/js/app.js H.CATEGORIES (order and ids are load-bearing —
// used as keys into listings.cat and www/img/cats/cat_<id>.png).
export const CATEGORIES: Category[] = [
  { id: "property", name: "Property" },
  { id: "vehicles", name: "Vehicles" },
  { id: "rooms", name: "Rooms" },
  { id: "electronics", name: "Electronics" },
  { id: "jobs", name: "Jobs" },
  { id: "furniture", name: "Furniture" },
  { id: "fashion", name: "Fashion" },
  { id: "services", name: "Services" },
  { id: "agriculture", name: "Agriculture" },
  { id: "pets", name: "Pets" },
  { id: "kids", name: "Baby & Kids" },
  { id: "other", name: "Other" },
];

export const CAT_COLORS: Record<string, string> = {
  vehicles: "#e53935",
  property: "#1E88E5",
  electronics: "#8E24AA",
  fashion: "#F06292",
  furniture: "#6D4C41",
  services: "#00897B",
  jobs: "#F5A623",
  rooms: "#00838F",
  other: "#546E7A",
  agriculture: "#558B2F",
  pets: "#FB8C00",
  kids: "#E91E63",
};

export const ZW_CITIES = [
  "All Zimbabwe",
  "Harare",
  "Bulawayo",
  "Mutare",
  "Gweru",
  "Masvingo",
  "Chinhoyi",
  "Kwekwe",
  "Kadoma",
];

export const BRAND_BLUE = "#1A3A8F";
export const BRAND_GOLD = "#F5A623";

export const PROVINCES = [
  "Harare",
  "Bulawayo",
  "Manicaland",
  "Mashonaland West",
  "Mashonaland East",
  "Mashonaland Central",
  "Midlands",
  "Masvingo",
  "Matabeleland North",
  "Matabeleland South",
];

// Generated verbatim from www/js/app.js H.CITIES_BY_PROV — 324 cities/suburbs
// across the 10 provinces above. Do not hand-edit; regenerate from the source
// if the Capacitor app's location list changes.
export const CITIES_BY_PROVINCE: Record<string, string[]> = require("./cities-by-province.json");
