// Category artwork, shared by the home grid and the post-an-ad picker.
//
// categories.icon (Admin → Taxonomy) may hold either one of the bundled
// artwork keys below or an https:// image URL for a category added after
// this build shipped. Anything else falls back to the artwork for the
// category's own id, then to the generic "other" image — a category is never
// hidden just because it has no bundled artwork.
import type { ImageSourcePropType } from "react-native";

export const BUNDLED_CATEGORY_ICONS: Record<string, ImageSourcePropType> = {
  property: require("../assets/cats/cat_property.webp"),
  vehicles: require("../assets/cats/cat_vehicles.webp"),
  rooms: require("../assets/cats/cat_rooms.webp"),
  electronics: require("../assets/cats/cat_electronics.webp"),
  jobs: require("../assets/cats/cat_jobs.webp"),
  furniture: require("../assets/cats/cat_furniture.webp"),
  fashion: require("../assets/cats/cat_fashion.webp"),
  services: require("../assets/cats/cat_services.webp"),
  agriculture: require("../assets/cats/cat_agriculture.webp"),
  pets: require("../assets/cats/cat_pets.webp"),
  kids: require("../assets/cats/cat_kids.webp"),
  other: require("../assets/cats/cat_other.webp"),
};

export function categoryIconSource(id: string, icon?: string | null): ImageSourcePropType {
  const value = (icon ?? "").trim();
  if (/^https:\/\//i.test(value)) return { uri: value };
  if (value && BUNDLED_CATEGORY_ICONS[value]) return BUNDLED_CATEGORY_ICONS[value];
  return BUNDLED_CATEGORY_ICONS[id] ?? BUNDLED_CATEGORY_ICONS.other;
}
