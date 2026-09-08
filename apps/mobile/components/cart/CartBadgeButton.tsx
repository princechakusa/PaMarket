// Small reusable cart entry point — a bag icon with a unit-count badge,
// used from both the listing detail screen's floating hero actions and the
// storefront header. Renders nothing when the cart is empty, so it never
// occupies space or draws attention on screens that don't need it.
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { useRouter } from "expo-router";
import { useCart } from "../../lib/cart-context";
import { hitSlop, type ColorPalette } from "../../lib/theme";
import { useThemedStyles } from "../../lib/theme-provider";

export function CartBadgeButton({ tone = "light", style }: { tone?: "light" | "dark"; style?: object }) {
  const router = useRouter();
  const { cart, unitCount } = useCart();
  const styles = useThemedStyles(buildStyles);

  if (!cart.items.length) return null;

  const iconColor = tone === "light" ? "#FFFFFF" : styles.darkIconColor.color;

  return (
    <Pressable
      style={[tone === "light" ? styles.buttonLight : styles.buttonDark, style]}
      onPress={() => router.push("/shop-cart")}
      hitSlop={hitSlop}
    >
      <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth={2}>
        <Path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
        <Path d="M3 6h18" />
        <Path d="M16 10a4 4 0 0 1-8 0" />
      </Svg>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>{unitCount > 99 ? "99+" : unitCount}</Text>
      </View>
    </Pressable>
  );
}

function buildStyles(color: ColorPalette) {
  return StyleSheet.create({
    buttonLight: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: "rgba(16,24,40,0.42)",
      alignItems: "center",
      justifyContent: "center",
    },
    buttonDark: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: color.surfaceAlt,
      alignItems: "center",
      justifyContent: "center",
    },
    darkIconColor: { color: color.text },
    badge: {
      position: "absolute",
      top: -2,
      right: -2,
      minWidth: 18,
      height: 18,
      borderRadius: 9,
      paddingHorizontal: 4,
      backgroundColor: color.gold,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1.5,
      borderColor: color.surface,
    },
    badgeText: { fontSize: 10, fontWeight: "800", color: "#FFFFFF" },
  });
}
