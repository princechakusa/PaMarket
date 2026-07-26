import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { CATEGORIES } from "../../lib/constants";
import { font, shadow, space, type ColorPalette } from "../../lib/theme";
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

// All 12 categories, 4 per row, plain (no card border/shadow wrapper, no
// tinted icon box) — matches the actual home screen exactly: a plain
// "Browse Categories" heading over a 4x3 grid of the real category cover
// images. The earlier card-with-eyebrow-and-8-icons version didn't match
// the app at all.
export function CategoryGrid({ onSelectCategory, onSeeAll }: { onSelectCategory: (id: string) => void; onSeeAll: () => void }) {
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
            <Image source={CAT_ICONS[c.id]} style={styles.icon} />
            <Text style={styles.label} numberOfLines={2}>
              {c.name}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function buildStyles(color: ColorPalette) {
  return StyleSheet.create({
    section: {
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
    icon: {
      width: 64,
      height: 64,
      resizeMode: "contain",
      ...shadow.sm,
    },
    label: {
      ...font.caption,
      color: color.text,
      textAlign: "center",
      paddingHorizontal: 2,
    },
  });
}
