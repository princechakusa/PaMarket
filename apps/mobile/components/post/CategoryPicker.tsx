import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { CATEGORIES, type Category } from "../../lib/constants";
import { categoryIconSource } from "../../lib/category-icons";
import type { ColorPalette } from "../../lib/theme";
import { useThemedStyles } from "../../lib/theme-provider";


export function CategoryPicker({
  onSelect,
  categories,
}: {
  onSelect: (id: string) => void;
  // Stage 5: optional silently-upgraded list from lib/taxonomy.ts's
  // useTaxonomy() (see app/(tabs)/post.tsx). Defaults to the bundled
  // CATEGORIES, unchanged, if the caller doesn't pass one.
  categories?: Category[];
}) {
  const styles = useThemedStyles(buildStyles);
  const list = categories ?? CATEGORIES;
  return (
    <View>
      <Text style={styles.label}>What are you posting?</Text>
      <View style={styles.grid}>
        {list.map((c) => (
          <Pressable key={c.id} style={styles.item} onPress={() => onSelect(c.id)}>
            <View style={styles.iconChip}>
              <Image source={categoryIconSource(c.id, c.icon)} style={styles.icon} />
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
    // The cat_*.webp assets are fully opaque with a white square baked into
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
