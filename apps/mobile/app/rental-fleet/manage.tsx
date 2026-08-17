import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import Svg, { Rect, Path } from "react-native-svg";
import { supabase } from "../../lib/supabase";
import type { RentalFleetVehicle } from "../../lib/rentals";
import { fleetVehicleLabel } from "../../lib/rentals";
import { RENTAL_FEATURED_SLOT_PRODUCTS } from "../../lib/billing-products";
import { purchaseProduct } from "../../lib/iap";
import { useStoreProducts } from "../../lib/use-store-products";
import { StoreProductOption } from "../../components/StoreProductOption";
import { toast } from "../../components/ui/Toast";
import { EmptyState } from "../../components/ui/EmptyState";
import type { ColorPalette } from "../../lib/theme";
import { useThemedStyles } from "../../lib/theme-provider";

type Tab = "all" | "active" | "paused" | "draft";
const RENTAL_FEATURED_PRODUCT_IDS = Object.keys(RENTAL_FEATURED_SLOT_PRODUCTS);

function buildStatusStyles(
  color: ColorPalette
): Record<string, { fg: string; bg: string; label: string }> {
  return {
    active: { fg: color.success, bg: color.successTint, label: "Active" },
    paused: { fg: color.warning, bg: color.warningTint, label: "Paused" },
    draft: { fg: color.textMuted, bg: color.surfaceAlt, label: "Draft" },
    archived: { fg: color.textMuted, bg: color.surfaceAlt, label: "Archived" },
  };
}

function StatusPill({
  status,
  styles,
  statusStyles,
}: {
  status: string;
  styles: ReturnType<typeof buildStyles>;
  statusStyles: Record<string, { fg: string; bg: string; label: string }>;
}) {
  const s = statusStyles[status] || statusStyles.draft;
  return (
    <View style={[styles.pill, { backgroundColor: s.bg }]}>
      <Text style={[styles.pillText, { color: s.fg }]}>{s.label}</Text>
    </View>
  );
}

function CarPlaceholderIcon({ stroke }: { stroke: string }) {
  return (
    <Svg
      width={22}
      height={22}
      viewBox="0 0 24 24"
      fill="none"
      stroke={stroke}
      strokeWidth={1.5}
    >
      <Rect x="1" y="3" width="22" height="13" rx="2" />
      <Path d="M8 21h8M12 17v4" />
    </Svg>
  );
}

// Mirrors www/js/rentals-business.js H.pages.RentalManageFleet — owner's
// vehicle list with status tabs, search, and per-vehicle actions.
export default function RentalManageFleetScreen() {
  const styles = useThemedStyles(buildStyles);
  const tones = useThemedStyles(buildTones);
  const statusStyles = useThemedStyles(buildStatusStyles);
  const { bizId } = useLocalSearchParams<{ bizId: string }>();
  const router = useRouter();

  const [fleet, setFleet] = useState<RentalFleetVehicle[]>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [canWrite, setCanWrite] = useState(false);
  const [tab, setTab] = useState<Tab>("all");
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [featurePickerFor, setFeaturePickerFor] = useState<string | null>(null);
  const [purchasingFeature, setPurchasingFeature] = useState<string | null>(
    null
  );
  const {
    prices: featurePrices,
    availableProductIds: availableFeatureIds,
    isLoading: isLoadingFeatures,
    error: featureProductError,
    retry: retryFeatureProducts,
  } = useStoreProducts(RENTAL_FEATURED_PRODUCT_IDS, "consumable");

  const load = useCallback(async () => {
    if (!bizId) return;
    const { data: accessData } = await supabase.rpc("get_user_rental_access");
    setCanWrite(!!accessData?.can_create_fleet);

    const { data: rcRows } = await supabase
      .from("rental_companies")
      .select("id")
      .eq("business_id", bizId)
      .maybeSingle();
    if (!rcRows) return;
    setCompanyId(rcRows.id);

    const { data: fleetRows } = await supabase
      .from("rental_vehicle_listings")
      .select(
        "id,model,year,daily_rate,weekly_rate,monthly_rate,status,is_available,view_count,save_count,inquiry_count,brand_id,category_id"
      )
      .eq("company_id", rcRows.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(50);

    const rows = (fleetRows as any[]) ?? [];
    const brandIds = Array.from(
      new Set(rows.map((v) => v.brand_id).filter(Boolean))
    );
    let brandMap: Record<string, { slug: string; label: string }> = {};
    if (brandIds.length) {
      const { data: brandRows } = await supabase
        .from("rental_brands")
        .select("id,slug,label")
        .in("id", brandIds);
      (brandRows ?? []).forEach((b: any) => {
        brandMap[b.id] = { slug: b.slug, label: b.label };
      });
    }
    let coverMap: Record<string, string> = {};
    if (rows.length) {
      const { data: mediaRows } = await supabase
        .from("rental_vehicle_media")
        .select("listing_id,url")
        .eq("is_cover", true)
        .in(
          "listing_id",
          rows.map((v) => v.id)
        );
      (mediaRows ?? []).forEach((m: any) => {
        coverMap[m.listing_id] = m.url;
      });
    }
    let featuredMap: Record<string, string> = {};
    if (rows.length) {
      const { data: featuredRows } = await supabase
        .from("rental_featured_listings")
        .select("listing_id,ends_at")
        .in(
          "listing_id",
          rows.map((v) => v.id)
        )
        .eq("is_active", true)
        .gt("ends_at", new Date().toISOString());
      (featuredRows ?? []).forEach((f: any) => {
        featuredMap[f.listing_id] = f.ends_at;
      });
    }
    setFleet(
      rows.map((v) => ({
        ...v,
        brand_slug: brandMap[v.brand_id]?.slug ?? null,
        brand_label: brandMap[v.brand_id]?.label ?? null,
        cover_url: coverMap[v.id] ?? null,
        featured_until: featuredMap[v.id] ?? null,
      }))
    );
  }, [bizId]);

  async function buyFeature(vehicleId: string, productId: string) {
    if (!availableFeatureIds.includes(productId)) {
      toast(
        "This featured placement is unavailable from the store. Retry loading prices."
      );
      return;
    }
    setPurchasingFeature(productId);
    try {
      const result = await purchaseProduct(productId, { listingId: vehicleId });
      if (result.ok) {
        setFeaturePickerFor(null);
        toast("Vehicle featured!");
        load();
      } else if (result.code === "user-cancelled") {
        toast("Purchase cancelled");
      } else {
        toast(result.error);
      }
    } finally {
      setPurchasingFeature(null);
    }
  }

  useEffect(() => {
    setIsLoading(true);
    load().finally(() => setIsLoading(false));
  }, [load]);

  const counts = useMemo(
    () => ({
      all: fleet.length,
      active: fleet.filter((v) => v.status === "active").length,
      paused: fleet.filter((v) => v.status === "paused").length,
      draft: fleet.filter((v) => v.status === "draft").length,
    }),
    [fleet]
  );

  const filtered = useMemo(() => {
    let rows = tab === "all" ? fleet : fleet.filter((v) => v.status === tab);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      rows = rows.filter((v) => fleetVehicleLabel(v).toLowerCase().includes(q));
    }
    return rows;
  }, [fleet, tab, query]);

  async function toggleStatus(vehicleId: string, newStatus: string) {
    const { data, error } = await supabase
      .from("rental_vehicle_listings")
      .update({ status: newStatus })
      .eq("id", vehicleId)
      .select("id");
    if (error || !data?.length) {
      toast("Access denied. Your company account is not active.", 4000, true);
      return;
    }
    setFleet((prev) =>
      prev.map((v) =>
        v.id === vehicleId ? { ...v, status: newStatus as any } : v
      )
    );
    toast(newStatus === "active" ? "Vehicle activated." : "Vehicle paused.");
  }

  function confirmRemove(vehicleId: string) {
    Alert.alert(
      "Remove this vehicle?",
      "This will archive the vehicle and hide it from the marketplace. Your listing history and analytics are preserved.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            const { data, error } = await supabase
              .from("rental_vehicle_listings")
              .update({
                status: "archived",
                deleted_at: new Date().toISOString(),
              })
              .eq("id", vehicleId)
              .select("id");
            if (error || !data?.length) {
              toast(
                "Access denied. Your company account is not active.",
                4000,
                true
              );
              return;
            }
            setFleet((prev) => prev.filter((v) => v.id !== vehicleId));
            toast("Vehicle removed.");
          },
        },
      ]
    );
  }

  function showActions(v: RentalFleetVehicle) {
    Alert.alert(fleetVehicleLabel(v), undefined, [
      {
        text: "View Public Listing",
        onPress: () => router.push(`/rentals/${v.id}`),
      },
      {
        text: "Edit Vehicle",
        onPress: () =>
          router.push(`/rental-fleet/edit-vehicle?id=${v.id}&bizId=${bizId}`),
      },
      {
        text: v.status === "active" ? "Pause Listing" : "Activate Listing",
        onPress: () =>
          toggleStatus(v.id, v.status === "active" ? "paused" : "active"),
      },
      {
        text: "Manage Availability",
        onPress: () => router.push(`/rental-fleet/availability?id=${v.id}`),
      },
      {
        text: "Remove Vehicle",
        style: "destructive",
        onPress: () => confirmRemove(v.id),
      },
      { text: "Cancel", style: "cancel" },
    ]);
  }

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={tones.brand} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {!canWrite ? (
        <View style={styles.blockedBox}>
          <Text style={styles.blockedTitle}>Vehicle management locked</Text>
          <Text style={styles.blockedBody}>
            Your company must be approved before you can add or edit vehicles.
          </Text>
        </View>
      ) : null}

      <View style={styles.tabRow}>
        {(["all", "active", "paused", "draft"] as Tab[]).map((t) => (
          <Pressable key={t} style={styles.tabButton} onPress={() => setTab(t)}>
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t[0].toUpperCase() + t.slice(1)} ({counts[t]})
            </Text>
            {tab === t ? <View style={styles.tabUnderline} /> : null}
          </Pressable>
        ))}
      </View>

      <View style={styles.searchWrap}>
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="Search fleet..."
          placeholderTextColor={tones.textMuted}
        />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        {filtered.length ? (
          filtered.map((v) => {
            const isFeatured =
              !!v.featured_until &&
              new Date(v.featured_until).getTime() > Date.now();
            return (
              <View key={v.id}>
                <Pressable
                  style={styles.vehicleRow}
                  onPress={() => (canWrite ? showActions(v) : undefined)}
                >
                  <View style={styles.thumbWrap}>
                    {v.cover_url ? (
                      <Image
                        source={{ uri: v.cover_url }}
                        style={styles.thumb}
                        contentFit="cover"
                        transition={150}
                        cachePolicy="memory-disk"
                      />
                    ) : (
                      <CarPlaceholderIcon stroke={tones.textMuted} />
                    )}
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.vehicleTitle} numberOfLines={1}>
                      {fleetVehicleLabel(v)}{" "}
                      {v.year ? (
                        <Text style={styles.vehicleYear}>{v.year}</Text>
                      ) : null}
                    </Text>
                    <View style={styles.vehicleMetaRow}>
                      <Text style={styles.vehiclePrice}>
                        ${(v.daily_rate ?? 0).toLocaleString()}/day
                      </Text>
                      <StatusPill
                        status={v.status}
                        styles={styles}
                        statusStyles={statusStyles}
                      />
                    </View>
                    <Text style={styles.vehicleStats}>
                      {(v.inquiry_count ?? 0).toLocaleString()} inquiries ·{" "}
                      {(v.view_count ?? 0).toLocaleString()} views ·{" "}
                      {(v.save_count ?? 0).toLocaleString()} saves
                    </Text>
                  </View>
                  {isFeatured ? (
                    <View style={styles.featuredBadge}>
                      <Text style={styles.featuredBadgeText}>Featured</Text>
                    </View>
                  ) : (
                    <Pressable
                      style={styles.featureButton}
                      onPress={() =>
                        setFeaturePickerFor(
                          featurePickerFor === v.id ? null : v.id
                        )
                      }
                    >
                      {/* "Options" gave no hint this was a paid promotion, so
                          the rental featured-slot products were effectively
                          undiscoverable. */}
                      <Text style={styles.featureButtonText}>
                        {featurePickerFor === v.id ? "Hide" : "Feature"}
                      </Text>
                    </Pressable>
                  )}
                </Pressable>

                {featurePickerFor === v.id ? (
                  <View style={styles.featureOptions}>
                    {Object.entries(RENTAL_FEATURED_SLOT_PRODUCTS).map(
                      ([productId, p]) => (
                        <StoreProductOption
                          key={productId}
                          title={`${p.days}-Day Rental Featured Placement`}
                          price={featurePrices[productId]}
                          description={`Features this rental listing for ${p.days} days.`}
                          buttonLabel="Feature Listing"
                          isLoading={isLoadingFeatures}
                          isAvailable={availableFeatureIds.includes(productId)}
                          isPurchasing={purchasingFeature === productId}
                          purchaseBlocked={!!purchasingFeature}
                          error={featureProductError}
                          recommended={p.days === 30}
                          onPurchase={() => buyFeature(v.id, productId)}
                          onRetry={retryFeatureProducts}
                        />
                      )
                    )}
                  </View>
                ) : null}
              </View>
            );
          })
        ) : (
          <View style={{ paddingTop: 40 }}>
            <EmptyState
              title="No vehicles in this category"
              buttonLabel={canWrite ? "Add Vehicle" : undefined}
              onPressButton={
                canWrite
                  ? () =>
                      router.push(`/rental-fleet/add-vehicle?bizId=${bizId}`)
                  : undefined
              }
            />
          </View>
        )}
      </ScrollView>

      {canWrite ? (
        <Pressable
          style={styles.fab}
          onPress={() =>
            router.push(`/rental-fleet/add-vehicle?bizId=${bizId}`)
          }
        >
          <Text style={styles.fabText}>+ Add</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function buildTones(color: ColorPalette) {
  return { brand: color.brand, textMuted: color.textMuted };
}

function buildStyles(color: ColorPalette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: color.bg },
    centered: { flex: 1, alignItems: "center", justifyContent: "center" },
    blockedBox: {
      margin: 16,
      backgroundColor: color.surfaceAlt,
      borderWidth: 1.5,
      borderColor: color.border,
      borderRadius: 14,
      padding: 16,
      alignItems: "center",
    },
    blockedTitle: {
      fontSize: 14,
      fontWeight: "700",
      color: color.textSub,
      marginBottom: 4,
    },
    blockedBody: {
      fontSize: 12,
      color: color.textMuted,
      textAlign: "center",
      lineHeight: 17,
    },
    tabRow: {
      flexDirection: "row",
      backgroundColor: color.surface,
      borderBottomWidth: 1,
      borderBottomColor: color.border,
    },
    tabButton: { flex: 1, alignItems: "center", paddingVertical: 12 },
    tabText: { fontSize: 12.5, fontWeight: "600", color: color.textMuted },
    tabTextActive: { fontWeight: "800", color: color.brand },
    tabUnderline: {
      height: 2.5,
      backgroundColor: color.brand,
      width: "60%",
      borderRadius: 2,
      marginTop: 6,
    },
    searchWrap: {
      padding: 10,
      paddingHorizontal: 16,
      backgroundColor: color.surface,
      borderBottomWidth: 1,
      borderBottomColor: color.border,
    },
    searchInput: {
      height: 38,
      borderWidth: 1.5,
      borderColor: color.border,
      borderRadius: 999,
      paddingHorizontal: 14,
      fontSize: 13,
      color: color.text,
    },
    vehicleRow: {
      flexDirection: "row",
      gap: 12,
      padding: 12,
      paddingHorizontal: 16,
      borderBottomWidth: 1,
      borderBottomColor: color.border,
      alignItems: "center",
      backgroundColor: color.surface,
    },
    thumbWrap: {
      width: 72,
      height: 52,
      borderRadius: 10,
      backgroundColor: color.skeleton,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
    },
    thumb: { width: "100%", height: "100%" },
    vehicleTitle: { fontSize: 14, fontWeight: "700", color: color.text },
    vehicleYear: { fontWeight: "500", color: color.textMuted },
    vehicleMetaRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginTop: 4,
    },
    vehiclePrice: { fontSize: 14, fontWeight: "800", color: color.brand },
    vehicleStats: {
      fontSize: 11.5,
      fontWeight: "600",
      color: color.textMuted,
      marginTop: 4,
    },
    pill: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
    pillText: { fontSize: 11, fontWeight: "700" },
    featuredBadge: {
      backgroundColor: color.goldTint,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 5,
      flexShrink: 0,
    },
    featuredBadgeText: { fontSize: 11, fontWeight: "800", color: "#B9720A" },
    featureButton: {
      backgroundColor: color.brand,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 6,
      flexShrink: 0,
    },
    featureButtonText: {
      fontSize: 11.5,
      fontWeight: "800",
      color: color.textOnBrand,
    },
    featureOptions: {
      gap: 8,
      paddingHorizontal: 16,
      paddingBottom: 12,
      backgroundColor: color.surface,
    },
    featureOpt: {
      flex: 1,
      alignItems: "center",
      gap: 4,
      backgroundColor: color.surfaceAlt,
      borderRadius: 10,
      paddingVertical: 12,
      borderWidth: 1.5,
      borderColor: "transparent",
      position: "relative",
    },
    featureOptReco: {
      borderColor: color.gold,
      backgroundColor: color.goldTint,
    },
    featureOptTag: {
      position: "absolute",
      top: -9,
      alignSelf: "center",
      backgroundColor: color.gold,
      borderRadius: 20,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    featureOptTagText: {
      fontSize: 9,
      fontWeight: "800",
      color: "#fff",
      letterSpacing: 0.3,
    },
    featureOptLabel: { fontSize: 13, fontWeight: "700", color: color.text },
    featureOptCta: { fontSize: 12, fontWeight: "800", color: color.brand },
    fab: {
      position: "absolute",
      right: 16,
      bottom: 20,
      backgroundColor: color.brand,
      borderRadius: 24,
      paddingHorizontal: 20,
      paddingVertical: 12,
    },
    fabText: { color: color.textOnBrand, fontSize: 14, fontWeight: "700" },
  });
}
