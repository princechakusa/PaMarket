import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import Svg, { Path, Polyline, Rect } from "react-native-svg";
import type { ColorPalette } from "../lib/theme";
import { useThemedStyles } from "../lib/theme-provider";

// Mirrors www/js/settings.js pages.MyActivity. The web version also shows
// Purchase History, Recent Searches, and Recently Viewed listings — all
// backed by localStorage state (u.recentSearches, pamarket_rv) and a
// H.fetchPurchaseHistory() call that have no equivalent in this app yet
// (favourites.tsx itself notes saves aren't wired to a Supabase table, and
// there is no recently-viewed/search-history tracking or purchase-history
// RPC call anywhere in apps/mobile). Rather than fabricate empty sections
// for data this app doesn't collect, this screen links to the two real,
// already-working equivalents: My Applications (public.applications) and
// Saved & Favourites.
export default function MyActivityScreen() {
  const styles = useThemedStyles(buildStyles);
  const tones = useThemedStyles(buildTones);
  const router = useRouter();

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <Pressable style={styles.card} onPress={() => router.push("/jobs/applications")}>
        <View style={styles.iconWrap}>
          <Svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke={tones.brand} strokeWidth={2}>
            <Rect x={2} y={7} width={20} height={13} rx={2} />
            <Path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
          </Svg>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>My Applications</Text>
          <Text style={styles.cardSub}>Jobs you've applied to</Text>
        </View>
        <Svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke={tones.chevron} strokeWidth={2}>
          <Polyline points="9 18 15 12 9 6" />
        </Svg>
      </Pressable>

      <Pressable style={styles.card} onPress={() => router.push("/favourites")}>
        <View style={styles.iconWrap}>
          <Svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke={tones.danger} strokeWidth={2}>
            <Path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </Svg>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>Saved &amp; Favourites</Text>
          <Text style={styles.cardSub}>Listings you've saved</Text>
        </View>
        <Svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke={tones.chevron} strokeWidth={2}>
          <Polyline points="9 18 15 12 9 6" />
        </Svg>
      </Pressable>

      <Pressable style={styles.card} onPress={() => router.push("/saved-searches")}>
        <View style={styles.iconWrap}>
          <Svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke={tones.brand} strokeWidth={2}>
            <Path d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14z" />
            <Path d="M21 21l-4.35-4.35" />
          </Svg>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>Saved Searches</Text>
          <Text style={styles.cardSub}>Searches you've bookmarked for quick access</Text>
        </View>
        <Svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke={tones.chevron} strokeWidth={2}>
          <Polyline points="9 18 15 12 9 6" />
        </Svg>
      </Pressable>
    </ScrollView>
  );
}

function buildTones(color: ColorPalette) {
  return { brand: color.brand, danger: color.danger, chevron: color.textMuted };
}

function buildStyles(color: ColorPalette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: color.bg },
    card: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: color.surface,
      borderRadius: 14,
      paddingHorizontal: 16,
      paddingVertical: 14,
      marginBottom: 10,
    },
    iconWrap: { width: 38, height: 38, borderRadius: 10, backgroundColor: color.brandTint, alignItems: "center", justifyContent: "center" },
    cardTitle: { fontSize: 14, fontWeight: "700", color: color.text },
    cardSub: { fontSize: 11.5, color: color.textMuted, marginTop: 2 },
  });
}
