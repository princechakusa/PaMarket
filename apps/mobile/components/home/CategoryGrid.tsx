import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { CATEGORIES } from "../../lib/constants";
import { font, radius, space, type ColorPalette } from "../../lib/theme";
import { useThemedStyles } from "../../lib/theme-provider";
import { SectionHeader } from "../ui";

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

export function CategoryGrid({ onSelectCategory, onSeeAll }: { onSelectCategory: (id: string) => void; onSeeAll: () => void }) {
  const styles = useThemedStyles(buildStyles);
  return (
    <View style={styles.container}>
      <SectionHeader title="Browse Categories" actionLabel="See all" onAction={onSeeAll} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
        {CATEGORIES.map((c) => (
          <Pressable key={c.id} style={styles.item} onPress={() => onSelectCategory(c.id)}>
            <View style={styles.iconWrap}>
              <Image source={CAT_ICONS[c.id]} style={styles.icon} />
            </View>
            <Text style={styles.label} numberOfLines={2}>
              {c.name}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

function buildStyles(color: ColorPalette) {
  return StyleSheet.create({
    container: {
      backgroundColor: color.surface,
      paddingTop: space.lg,
      paddingBottom: space.lg,
      marginBottom: space.sm,
    },
    rail: {
      paddingHorizontal: space.lg,
      gap: space.lg,
    },
    item: {
      width: 68,
      alignItems: "center",
      gap: space.sm,
    },
    iconWrap: {
      width: 60,
      height: 60,
      borderRadius: radius.lg,
      backgroundColor: color.brandTint,
      alignItems: "center",
      justifyContent: "center",
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
    },
  });
}
