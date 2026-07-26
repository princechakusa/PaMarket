import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path, Polyline } from "react-native-svg";
import { supabase } from "../../lib/supabase";
import {
  BRAND_LABELS,
  CATEGORY_LABELS,
  RENTAL_FUEL_TYPES,
  RENTAL_TRANSMISSIONS,
  brandLabel,
  categoryLabel,
  type RentalListingSummary,
} from "../../lib/rentals";
import { Chip } from "../../components/ui";
import type { ColorPalette } from "../../lib/theme";
import { useThemedStyles } from "../../lib/theme-provider";

function BackIcon({ stroke }: { stroke: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={2.4}>
      <Polyline points="15 18 9 12 15 6" />
    </Svg>
  );
}

function FilterIcon({ stroke }: { stroke: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={2}>
      <Path d="M4 6h16M4 12h16M4 18h16" />
    </Svg>
  );
}

type RentalFilters = {
  category: string | null;
  brand: string | null;
  transmission: string | null;
  fuelType: string | null;
  availableOnly: boolean;
};

const DEFAULT_FILTERS: RentalFilters = {
  category: null,
  brand: null,
  transmission: null,
  fuelType: null,
  availableOnly: false,
};

function countActive(f: RentalFilters): number {
  return (f.category ? 1 : 0) + (f.brand ? 1 : 0) + (f.transmission ? 1 : 0) + (f.fuelType ? 1 : 0) + (f.availableOnly ? 1 : 0);
}

export default function RentalsListScreen() {
  const styles = useThemedStyles(buildStyles);
  const tones = useThemedStyles(buildTones);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [vehicles, setVehicles] = useState<RentalListingSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<RentalFilters>(DEFAULT_FILTERS);
  const [filterVisible, setFilterVisible] = useState(false);
  const activeCount = useMemo(() => countActive(filters), [filters]);

  const load = useCallback(async () => {
    setError(null);
    const { data, error: rpcError } = await supabase.rpc("rental_search_listings", {
      p_category_slug: filters.category,
      p_city: null,
      p_brand_slug: filters.brand,
      p_price_min: null,
      p_price_max: null,
      p_transmission: filters.transmission,
      p_fuel_type: filters.fuelType,
      p_available_only: filters.availableOnly,
      p_featured_first: true,
      p_limit: 30,
      p_offset: 0,
    });
    if (rpcError) setError(rpcError.message);
    else setVehicles((data as RentalListingSummary[]) ?? []);
  }, [filters]);

  useEffect(() => {
    setIsLoading(true);
    load().finally(() => setIsLoading(false));
  }, [load]);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <BackIcon stroke={tones.textOnBrand} />
        </Pressable>
        <Text style={styles.headerTitle}>Rentals</Text>
        <Pressable onPress={() => setFilterVisible(true)} hitSlop={10} style={styles.filterBtn}>
          <FilterIcon stroke={tones.textOnBrand} />
          {activeCount ? (
            <View style={styles.filterCountDot}>
              <Text style={styles.filterCountDotText}>{activeCount}</Text>
            </View>
          ) : null}
        </Pressable>
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={tones.brand} />
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
                  <Image source={{ uri: item.cover_url }} style={styles.photo} contentFit="cover" transition={150} cachePolicy="memory-disk" />
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

      <Modal visible={filterVisible} animationType="slide" transparent onRequestClose={() => setFilterVisible(false)}>
        <View style={styles.filterBackdrop}>
          <Pressable style={styles.filterBackdropTouch} onPress={() => setFilterVisible(false)} />
          <View style={styles.filterSheet}>
            <View style={styles.filterHeader}>
              <Text style={styles.filterTitle}>Filter Rentals</Text>
              <Pressable onPress={() => setFilterVisible(false)} hitSlop={12}>
                <Text style={styles.filterClose}>Close</Text>
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.filterBody}>
              <Text style={styles.filterSectionTitle}>Vehicle Type</Text>
              <View style={styles.filterChipWrap}>
                {Object.entries(CATEGORY_LABELS).map(([slug, label]) => (
                  <Chip
                    key={slug}
                    label={label}
                    active={filters.category === slug}
                    onPress={() => setFilters((f) => ({ ...f, category: f.category === slug ? null : slug }))}
                  />
                ))}
              </View>

              <Text style={styles.filterSectionTitle}>Brand</Text>
              <View style={styles.filterChipWrap}>
                {Object.entries(BRAND_LABELS).map(([slug, label]) => (
                  <Chip
                    key={slug}
                    label={label}
                    active={filters.brand === slug}
                    onPress={() => setFilters((f) => ({ ...f, brand: f.brand === slug ? null : slug }))}
                  />
                ))}
              </View>

              <Text style={styles.filterSectionTitle}>Transmission</Text>
              <View style={styles.filterChipWrap}>
                {RENTAL_TRANSMISSIONS.map((t) => (
                  <Chip
                    key={t}
                    label={t === "automatic" ? "Automatic" : "Manual"}
                    active={filters.transmission === t}
                    onPress={() => setFilters((f) => ({ ...f, transmission: f.transmission === t ? null : t }))}
                  />
                ))}
              </View>

              <Text style={styles.filterSectionTitle}>Fuel Type</Text>
              <View style={styles.filterChipWrap}>
                {RENTAL_FUEL_TYPES.map((t) => (
                  <Chip
                    key={t}
                    label={t.charAt(0).toUpperCase() + t.slice(1)}
                    active={filters.fuelType === t}
                    onPress={() => setFilters((f) => ({ ...f, fuelType: f.fuelType === t ? null : t }))}
                  />
                ))}
              </View>

              <Text style={styles.filterSectionTitle}>Availability</Text>
              <View style={styles.filterChipWrap}>
                <Chip
                  label="Available now only"
                  active={filters.availableOnly}
                  onPress={() => setFilters((f) => ({ ...f, availableOnly: !f.availableOnly }))}
                />
              </View>
            </ScrollView>
            <View style={styles.filterFooter}>
              <Pressable style={styles.filterResetBtn} onPress={() => setFilters(DEFAULT_FILTERS)}>
                <Text style={styles.filterResetText}>Reset</Text>
              </Pressable>
              <Pressable style={styles.filterApplyBtn} onPress={() => setFilterVisible(false)}>
                <Text style={styles.filterApplyText}>Show results</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function buildTones(color: ColorPalette) {
  return { brand: color.brand, textOnBrand: color.textOnBrand };
}

function buildStyles(color: ColorPalette) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: color.bg,
    },
    centered: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingTop: 60,
    },
    emptyText: {
      fontSize: 13,
      color: color.textMuted,
    },
    errorText: {
      fontSize: 13,
      color: color.danger,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: color.brand,
      paddingHorizontal: 16,
      paddingBottom: 12,
    },
    filterBtn: {
      width: 20,
      height: 20,
      alignItems: "center",
      justifyContent: "center",
    },
    filterCountDot: {
      position: "absolute",
      top: -6,
      right: -8,
      minWidth: 16,
      height: 16,
      borderRadius: 8,
      backgroundColor: color.gold,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 3,
    },
    filterCountDotText: {
      fontSize: 9,
      fontWeight: "800",
      color: color.text,
    },
    filterBackdrop: {
      flex: 1,
      justifyContent: "flex-end",
      backgroundColor: color.overlay,
    },
    filterBackdropTouch: {
      flex: 1,
    },
    filterSheet: {
      backgroundColor: color.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: "80%",
    },
    filterHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: color.divider,
    },
    filterTitle: {
      fontSize: 17,
      fontWeight: "800",
      color: color.text,
    },
    filterClose: {
      fontSize: 14,
      fontWeight: "700",
      color: color.brand,
    },
    filterBody: {
      padding: 20,
      gap: 4,
    },
    filterSectionTitle: {
      fontSize: 12,
      fontWeight: "700",
      color: color.textMuted,
      textTransform: "uppercase",
      marginTop: 16,
      marginBottom: 8,
    },
    filterChipWrap: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    filterFooter: {
      flexDirection: "row",
      gap: 12,
      padding: 16,
      borderTopWidth: 1,
      borderTopColor: color.divider,
    },
    filterResetBtn: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 14,
      borderRadius: 12,
      backgroundColor: color.surfaceAlt,
    },
    filterResetText: {
      fontSize: 14,
      fontWeight: "700",
      color: color.text,
    },
    filterApplyBtn: {
      flex: 2,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 14,
      borderRadius: 12,
      backgroundColor: color.brand,
    },
    filterApplyText: {
      fontSize: 14,
      fontWeight: "700",
      color: color.textOnBrand,
    },
    headerTitle: {
      fontSize: 17,
      fontWeight: "700",
      color: color.textOnBrand,
    },
    listContent: {
      padding: 12,
    },
    row: {
      gap: 10,
    },
    card: {
      flex: 1,
      backgroundColor: color.surface,
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
      backgroundColor: color.skeleton,
    },
    featuredBadge: {
      position: "absolute",
      top: 8,
      left: 8,
      backgroundColor: color.gold,
      borderRadius: 6,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    featuredBadgeText: {
      fontSize: 9,
      fontWeight: "800",
      color: color.textOnBrand,
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
      color: color.textOnBrand,
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
      color: color.text,
    },
    price: {
      fontSize: 12,
      fontWeight: "800",
      color: color.brand,
    },
    meta: {
      fontSize: 11,
      color: color.textMuted,
      marginTop: 2,
    },
    company: {
      fontSize: 11,
      color: color.textSub,
      marginTop: 4,
    },
  });
}
