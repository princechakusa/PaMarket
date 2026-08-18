import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { CATEGORIES } from "../../lib/constants";
import { font, space, type ColorPalette } from "../../lib/theme";
import { useThemedStyles } from "../../lib/theme-provider";

const CAT_ICONS: Record<string, ReturnType<typeof require>> = {
  property: require("../../assets/cats/cat_property.png"),
  vehicles: require("../../assets/cats/cat_vehicles.png"),
  rooms: require("../../assets/cats/cat_rooms.png"),
  electronics: require("../../assets/cats/cat_electronics.png"),
  jobs: require("../../assets/cats/cat_jobs.png"),
  furniture: require("../../assets/cats/cat_furniture.png"),
  fashion: require("../../assets/cats/cat_fashion.png"),
  services: require("../../assets/cats/cat_services.png"),
  agriculture: require("../../assets/cats/cat_agriculture.png"),
  pets: require("../../assets/cats/cat_pets.png"),
  kids: require("../../assets/cats/cat_kids.png"),
  other: require("../../assets/cats/cat_other.png"),
};

// All 12 categories, 4 per row — a "Browse Categories" heading over a 4x3
// grid of the real category cover images.
//
// The cat_*.png assets are fully opaque (no alpha channel) with a white
// square baked into every image, so each icon sits in its own small white
// "iconChip" backing sized to just the image — that keeps the baked-in
// white edge looking deliberate on any background. This used to make the
// ENTIRE section hardcoded white (background, title, "See all", labels)
// so the images had no visible seam — which meant the whole section never
// respected the in-app dark mode toggle at all. Only the icon itself needs
// a white backing; everything else here now follows the theme normally.
export function CategoryGrid({
  onSelectCategory,
  onSeeAll,
  onPressRentals,
}: {
  onSelectCategory: (id: string) => void;
  onSeeAll: () => void;
  // Rentals is a separate vertical with its own tables and detail screens, so
  // it is not a member of CATEGORIES (those ids drive listings.category
  // queries). It still needs a home on this grid: before this, the only public
  // way in was a "Browse Rentals" row buried in Account, which is why a live
  // rental company and an approved vehicle were effectively undiscoverable.
  onPressRentals?: () => void;
}) {
  const styles = useThemedStyles(buildStyles);
  return (
    <View style={styles.section}>
      <View style={styles.head}>
        <Text style={styles.title}>Browse Categories</Text>
        <Pressable onPress={onSeeAll} hitSlop={8}>
          <Text style={styles.seeAll}>See all</Text>
        </Pressable>
      </View>
      <View style={styles.grid}>
        {CATEGORIES.map((c) => (
          <Pressable key={c.id} style={styles.item} onPress={() => onSelectCategory(c.id)}>
            <View style={styles.iconChip}>
              <Image source={CAT_ICONS[c.id]} style={styles.icon} />
            </View>
            <Text style={styles.label} numberOfLines={2}>
              {c.name}
            </Text>
          </Pressable>
        ))}
        {onPressRentals ? (
          <Pressable style={styles.item} onPress={onPressRentals}>
            <View style={styles.iconChip}>
              <Image source={CAT_ICONS.vehicles} style={styles.icon} />
            </View>
            <Text style={styles.label} numberOfLines={2}>
              Car Rentals
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function buildStyles(color: ColorPalette) {
  return StyleSheet.create({
    section: {
      backgroundColor: color.bg,
      paddingHorizontal: space.lg,
      paddingTop: space.lg,
      paddingBottom: space.md,
    },
    head: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: space.md,
    },
    title: {
      ...font.h3,
      color: color.text,
    },
    seeAll: {
      ...font.caption,
      color: color.brand,
    },
    grid: {
      flexDirection: "row",
      flexWrap: "wrap",
    },
    item: {
      width: "25%",
      alignItems: "center",
      gap: space.sm,
      marginBottom: space.lg,
    },
    iconChip: {
      width: 64,
      height: 64,
      borderRadius: 16,
      backgroundColor: "#FFFFFF",
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
    },
    icon: {
      width: 64,
      height: 64,
      resizeMode: "contain",
    },
    label: {
      ...font.caption,
      color: color.text,
      textAlign: "center",
      paddingHorizontal: 2,
    },
  });
}
