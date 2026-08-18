import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import Svg, { Polyline } from "react-native-svg";
import { color, font, space, type ColorPalette } from "../lib/theme";
import { useThemedStyles } from "../lib/theme-provider";

// Vehicles is the one category with a real second destination behind it —
// PaMarket's own for-sale listings, and the separate rental_* tables/screens
// under /rentals. This is that fork, not a general subcategory picker: the
// listings.category field has no finer split than "vehicles" today, so any
// row beyond these two would be a label with nothing behind it.
function ChevronRight() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={color.textMuted} strokeWidth={2.5}>
      <Polyline points="9 18 15 12 9 6" />
    </Svg>
  );
}

type Styles = ReturnType<typeof buildStyles>;

function Row({ label, subtitle, onPress, styles }: { label: string; subtitle: string; onPress: () => void; styles: Styles }) {
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowSubtitle}>{subtitle}</Text>
      </View>
      <ChevronRight />
    </Pressable>
  );
}

export default function VehiclesScreen() {
  const styles = useThemedStyles(buildStyles);
  const router = useRouter();

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={styles.list}>
        <Row
          label="All Vehicles"
          subtitle="Cars, bikes and more for sale"
          onPress={() => router.push({ pathname: "/(tabs)/search", params: { category: "vehicles" } })}
          styles={styles}
        />
        <Row
          label="Car Rentals"
          subtitle="Rent from verified rental companies"
          onPress={() => router.push("/rentals")}
          styles={styles}
        />
      </View>
    </ScrollView>
  );
}

function buildStyles(c: ColorPalette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    list: {
      marginTop: space.md,
      marginHorizontal: space.lg,
      backgroundColor: c.surface,
      borderRadius: 14,
      overflow: "hidden",
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: space.md,
      paddingHorizontal: space.lg,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
      gap: space.sm,
    },
    rowLabel: { ...font.body, fontWeight: "700", color: c.text },
    rowSubtitle: { ...font.caption, color: c.textMuted, marginTop: 2 },
  });
}
