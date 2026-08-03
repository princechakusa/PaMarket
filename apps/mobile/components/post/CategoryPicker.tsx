import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { CATEGORIES } from "../../lib/constants";
import type { ColorPalette } from "../../lib/theme";
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

export function CategoryPicker({ onSelect }: { onSelect: (id: string) => void }) {
  const styles = useThemedStyles(buildStyles);
  return (
    <View>
      <Text style={styles.label}>What are you posting?</Text>
      <View style={styles.grid}>
        {CATEGORIES.map((c) => (
          <Pressable key={c.id} style={styles.item} onPress={() => onSelect(c.id)}>
            <View style={styles.iconChip}>
              <Image source={CAT_ICONS[c.id]} style={styles.icon} />
            </View>
            <Text style={styles.itemLabel} numberOfLines={2}>
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
    label: {
      fontSize: 13,
      fontWeight: "700",
      color: color.text,
      marginBottom: 14,
    },
    grid: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "space-between",
      rowGap: 8,
    },
    item: {
      width: "32%",
      alignItems: "center",
      gap: 6,
      backgroundColor: color.surface,
      borderWidth: 1.5,
      borderColor: color.border,
      borderRadius: 12,
      paddingVertical: 14,
      paddingHorizontal: 4,
    },
    // The cat_*.png assets are fully opaque with a white square baked into
    // every image (same assets used on the Home screen's category grid) —
    // a small white chip sized to the icon keeps that edge looking
    // deliberate against this card's own themed (dark-in-dark-mode)
    // background, instead of the image's white square butting straight up
    // against the card.
    iconChip: {
      width: 40,
      height: 40,
      borderRadius: 10,
      backgroundColor: "#FFFFFF",
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
    },
    icon: {
      width: 40,
      height: 40,
      resizeMode: "contain",
    },
    itemLabel: {
      fontSize: 11,
      fontWeight: "600",
      color: color.text,
      textAlign: "center",
    },
  });
}
