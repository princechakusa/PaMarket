import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import Svg, { Path, Polyline, Rect } from "react-native-svg";
import { BRAND_BLUE } from "../lib/constants";

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
  const router = useRouter();

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <Pressable style={styles.card} onPress={() => router.push("/jobs/applications")}>
        <View style={styles.iconWrap}>
          <Svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke={BRAND_BLUE} strokeWidth={2}>
            <Rect x={2} y={7} width={20} height={13} rx={2} />
            <Path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
          </Svg>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>My Applications</Text>
          <Text style={styles.cardSub}>Jobs you've applied to</Text>
        </View>
        <Svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="#C4C9D4" strokeWidth={2}>
          <Polyline points="9 18 15 12 9 6" />
        </Svg>
      </Pressable>

      <Pressable style={styles.card} onPress={() => router.push("/favourites")}>
        <View style={styles.iconWrap}>
          <Svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="#DC2626" strokeWidth={2}>
            <Path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </Svg>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>Saved &amp; Favourites</Text>
          <Text style={styles.cardSub}>Listings you've saved</Text>
        </View>
        <Svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="#C4C9D4" strokeWidth={2}>
          <Polyline points="9 18 15 12 9 6" />
        </Svg>
      </Pressable>

      <Pressable style={styles.card} onPress={() => router.push("/saved-searches")}>
        <View style={styles.iconWrap}>
          <Svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke={BRAND_BLUE} strokeWidth={2}>
            <Path d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14z" />
            <Path d="M21 21l-4.35-4.35" />
          </Svg>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>Saved Searches</Text>
          <Text style={styles.cardSub}>Searches you've bookmarked for quick access</Text>
        </View>
        <Svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="#C4C9D4" strokeWidth={2}>
          <Polyline points="9 18 15 12 9 6" />
        </Svg>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F6F9" },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#ffffff",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 10,
  },
  iconWrap: { width: 38, height: 38, borderRadius: 10, backgroundColor: "#EEF2FF", alignItems: "center", justifyContent: "center" },
  cardTitle: { fontSize: 14, fontWeight: "700", color: "#111827" },
  cardSub: { fontSize: 11.5, color: "#8A93A6", marginTop: 2 },
});
