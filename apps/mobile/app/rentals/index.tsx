import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Polyline } from "react-native-svg";
import { supabase } from "../../lib/supabase";
import { BRAND_BLUE, BRAND_GOLD } from "../../lib/constants";
import { brandLabel, categoryLabel, type RentalListingSummary } from "../../lib/rentals";

function BackIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth={2.4}>
      <Polyline points="15 18 9 12 15 6" />
    </Svg>
  );
}

export default function RentalsListScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [vehicles, setVehicles] = useState<RentalListingSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const { data, error: rpcError } = await supabase.rpc("rental_search_listings", {
      p_category_slug: null,
      p_city: null,
      p_brand_slug: null,
      p_price_min: null,
      p_price_max: null,
      p_transmission: null,
      p_fuel_type: null,
      p_available_only: false,
      p_featured_first: true,
      p_limit: 30,
      p_offset: 0,
    });
    if (rpcError) setError(rpcError.message);
    else setVehicles((data as RentalListingSummary[]) ?? []);
  }, []);

  useEffect(() => {
    setIsLoading(true);
    load().finally(() => setIsLoading(false));
  }, [load]);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <BackIcon />
        </Pressable>
        <Text style={styles.headerTitle}>Rentals</Text>
        <View style={{ width: 20 }} />
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={BRAND_BLUE} />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : (
        <FlatList
          data={vehicles}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.centered}>
              <Text style={styles.emptyText}>No rental vehicles available yet.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              style={styles.card}
              onPress={() => router.push({ pathname: "/rentals/[id]", params: { id: item.id } })}
            >
              <View style={styles.photoWrap}>
                {item.cover_url ? (
                  <Image source={{ uri: item.cover_url }} style={styles.photo} />
                ) : (
                  <View style={[styles.photo, styles.photoPlaceholder]} />
                )}
                {item.is_featured ? (
                  <View style={styles.featuredBadge}>
                    <Text style={styles.featuredBadgeText}>FEATURED</Text>
                  </View>
                ) : null}
                <View style={[styles.availabilityPill, !item.is_available && styles.availabilityPillBusy]}>
                  <Text style={styles.availabilityPillText}>{item.is_available ? "Available" : "Booked"}</Text>
                </View>
              </View>
              <View style={styles.cardBody}>
                <View style={styles.cardTopRow}>
                  <Text style={styles.vehicleName} numberOfLines={1}>
                    {brandLabel(item.brand_slug)} {item.model}
                  </Text>
                  {item.daily_rate != null ? (
                    <Text style={styles.price}>${item.daily_rate}/day</Text>
                  ) : null}
                </View>
                <Text style={styles.meta} numberOfLines={1}>
                  {[item.year, categoryLabel(item.category_slug), item.city].filter(Boolean).join(" · ")}
                </Text>
                <Text style={styles.company} numberOfLines={1}>
                  {item.company_name}
                </Text>
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F6F9",
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 60,
  },
  emptyText: {
    fontSize: 13,
    color: "#8A93A6",
  },
  errorText: {
    fontSize: 13,
    color: "#C0392B",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: BRAND_BLUE,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#ffffff",
  },
  listContent: {
    padding: 12,
  },
  row: {
    gap: 10,
  },
  card: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderRadius: 18,
    overflow: "hidden",
    marginBottom: 12,
  },
  photoWrap: {
    width: "100%",
    aspectRatio: 1.6,
    position: "relative",
  },
  photo: {
    width: "100%",
    height: "100%",
  },
  photoPlaceholder: {
    backgroundColor: "#E4E7EF",
  },
  featuredBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: BRAND_GOLD,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  featuredBadgeText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#ffffff",
  },
  availabilityPill: {
    position: "absolute",
    bottom: 8,
    left: 8,
    backgroundColor: "rgba(34,197,94,0.9)",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  availabilityPillBusy: {
    backgroundColor: "rgba(239,68,68,0.9)",
  },
  availabilityPillText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#ffffff",
  },
  cardBody: {
    padding: 10,
    gap: 2,
  },
  cardTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  vehicleName: {
    flex: 1,
    fontSize: 13,
    fontWeight: "700",
    color: "#111827",
  },
  price: {
    fontSize: 12,
    fontWeight: "800",
    color: BRAND_BLUE,
  },
  meta: {
    fontSize: 11,
    color: "#8A93A6",
    marginTop: 2,
  },
  company: {
    fontSize: 11,
    color: "#5A6478",
    marginTop: 4,
  },
});
