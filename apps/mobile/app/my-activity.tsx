import { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import Svg, { Path, Polyline, Rect } from "react-native-svg";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { publicListingExpiryFilter, type Listing } from "../lib/listings";
import { ListingCard } from "../components/ListingCard";
import { SectionHeader } from "../components/ui";
import type { ColorPalette } from "../lib/theme";
import { useThemedStyles } from "../lib/theme-provider";

const RECENTLY_VIEWED_COLUMNS =
  "id,seller_id,seller_name,title,description,price,currency,category,province,city,suburb,photos,status,boost,featured_until,expires_at,views,business_id,created_at,updated_at";
const RECENT_CARD_WIDTH = 170;

// Mirrors www/js/settings.js pages.MyActivity. Purchase History and Recent
// Searches still have no server-side equivalent in this app, but Recently
// Viewed is now real: viewed_listings (populated by increment_listing_view,
// called from listing/[id].tsx on every view) backs this section instead of
// the web app's localStorage-only pamarket_rv.
export default function MyActivityScreen() {
  const styles = useThemedStyles(buildStyles);
  const tones = useThemedStyles(buildTones);
  const router = useRouter();
  const { session } = useAuth();

  const [recentlyViewed, setRecentlyViewed] = useState<Listing[]>([]);

  const loadRecentlyViewed = useCallback(async () => {
    if (!session?.user) return;
    const { data: views } = await supabase
      .from("viewed_listings")
      .select("listing_id,viewed_at")
      .eq("user_id", session.user.id)
      .order("viewed_at", { ascending: false })
      .limit(12);
    const ids = (views ?? []).map((v: any) => v.listing_id);
    if (!ids.length) {
      setRecentlyViewed([]);
      return;
    }
    const { data: listings } = await supabase
      .from("listings")
      .select(RECENTLY_VIEWED_COLUMNS)
      .in("id", ids)
      .eq("status", "active")
      .or(publicListingExpiryFilter());
    const byId = new Map((listings ?? []).map((l: any) => [l.id, l as Listing]));
    setRecentlyViewed(ids.map((id: string) => byId.get(id)).filter((l): l is Listing => !!l));
  }, [session?.user]);

  useEffect(() => {
    loadRecentlyViewed();
  }, [loadRecentlyViewed]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      {recentlyViewed.length ? (
        <View style={{ marginBottom: 18 }}>
          <SectionHeader title="Recently Viewed" />
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={recentlyViewed}
            keyExtractor={(l) => l.id}
            contentContainerStyle={{ gap: 10, paddingVertical: 4 }}
            renderItem={({ item }) => (
              <ListingCard listing={item} width={RECENT_CARD_WIDTH} onPress={() => router.push(`/listing/${item.id}`)} />
            )}
          />
        </View>
      ) : null}

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
