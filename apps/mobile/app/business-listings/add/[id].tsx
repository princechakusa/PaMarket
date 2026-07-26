import { StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Pressable } from "react-native";
import type { ColorPalette } from "../../../lib/theme";
import { useThemedStyles } from "../../../lib/theme-provider";

// Mirrors www/js/business-listings.js pages.BusinessAddProduct — chooser
// between importing an existing personal listing or creating a fresh one.
export default function BusinessAddProductScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const styles = useThemedStyles(buildStyles);

  return (
    <View style={styles.container}>
      <Text style={styles.intro}>How would you like to add products to your store?</Text>

      <Pressable
        style={styles.option}
        onPress={() => router.push({ pathname: "/business-listings/import/[id]", params: { id: id! } })}
      >
        <View style={styles.iconWrap}>
          <Text style={styles.iconText}>↓</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.optionTitle}>Import from my Marketplace</Text>
          <Text style={styles.optionDesc}>Bring products you already posted into this business.</Text>
        </View>
      </Pressable>

      <Pressable
        style={[styles.option, styles.optionGold]}
        onPress={() => router.push({ pathname: "/(tabs)/post", params: { businessId: id! } })}
      >
        <View style={[styles.iconWrap, styles.iconWrapGold]}>
          <Text style={[styles.iconText, styles.iconTextGold]}>+</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.optionTitle}>Create new business product</Text>
          <Text style={styles.optionDesc}>Build a fresh product with photos, price, and category.</Text>
        </View>
      </Pressable>
    </View>
  );
}

function buildStyles(color: ColorPalette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: color.bg, padding: 16 },
    intro: { fontSize: 13, color: color.textSub, lineHeight: 19, marginBottom: 18 },
    option: {
      flexDirection: "row",
      gap: 13,
      alignItems: "flex-start",
      backgroundColor: color.surface,
      borderWidth: 1.5,
      borderColor: color.border,
      borderRadius: 16,
      padding: 16,
      marginBottom: 13,
    },
    optionGold: { borderColor: color.gold },
    iconWrap: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: color.brandTint,
      alignItems: "center",
      justifyContent: "center",
    },
    iconWrapGold: { backgroundColor: color.goldTint },
    iconText: { fontSize: 20, fontWeight: "700", color: color.brand },
    iconTextGold: { color: color.goldDark },
    optionTitle: { fontSize: 15, fontWeight: "800", color: color.text },
    optionDesc: { fontSize: 12, color: color.textMuted, marginTop: 3, lineHeight: 17 },
  });
}
