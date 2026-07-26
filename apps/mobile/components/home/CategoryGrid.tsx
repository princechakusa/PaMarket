import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { CATEGORIES } from "../../lib/constants";
import { font, radius, shadow, space, type ColorPalette } from "../../lib/theme";
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

// Grid card (2 rows x 4 columns), the top 8 categories with a "See all" for
// the rest — mirrors the reference home-screen mockup's Browse Categories
// card (eyebrow + serif title + 4-col icon grid) instead of the previous
// bare horizontal icon rail.
const GRID_CATEGORIES = CATEGORIES.slice(0, 8);

export function CategoryGrid({ onSelectCategory, onSeeAll }: { onSelectCategory: (id: string) => void; onSeeAll: () => void }) {
  const styles = useThemedStyles(buildStyles);
  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>Explore PaMarket</Text>
          <Text style={styles.title}>Browse Categories</Text>
        </View>
        <Pressable onPress={onSeeAll} hitSlop={8}>
          <Text style={styles.seeAll}>See all</Text>
        </Pressable>
      </View>
      <View style={styles.grid}>
        {GRID_CATEGORIES.map((c) => (
          <Pressable key={c.id} style={styles.item} onPress={() => onSelectCategory(c.id)}>
            <View style={styles.iconWrap}>
              <Image source={CAT_ICONS[c.id]} style={styles.icon} />
            </View>
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
    card: {
      backgroundColor: color.surface,
      borderWidth: 1,
      borderColor: color.border,
      borderRadius: radius.xl,
      padding: space.lg,
      marginHorizontal: space.lg,
      marginBottom: space.md,
      ...shadow.sm,
    },
    head: {
      flexDirection: "row",
      alignItems: "flex-end",
      justifyContent: "space-between",
      marginBottom: space.md,
    },
    eyebrow: {
      ...font.micro,
      color: color.brand,
      textTransform: "uppercase",
    },
    title: {
      ...font.h3,
      color: color.text,
      marginTop: 3,
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
      marginBottom: space.md,
    },
    iconWrap: {
      width: 56,
      height: 56,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: color.border,
      backgroundColor: color.brandTint,
      alignItems: "center",
      justifyContent: "center",
      ...shadow.sm,
    },
    icon: {
      width: 40,
      height: 40,
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
