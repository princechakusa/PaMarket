import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Line } from "react-native-svg";
import { supabase } from "../../lib/supabase";
import { color, font, radius, shadow, space, type ColorPalette } from "../../lib/theme";
import { useThemedStyles } from "../../lib/theme-provider";
import { businessInitials, type Business } from "../../lib/businesses";
import { CATEGORIES } from "../../lib/constants";
import { Chip, EmptyState, ErrorState, GlassBackButton, ListingRowSkeleton, VerifiedBadge } from "../../components/ui";

// Dedicated shops directory — mirrors www/js/business-profile.js's
// BusinessSearch page (H._bizSearch), which the mobile app never had: "See
// all" on the home Shops rail used to dump the user into the generic
// listings/category search screen instead of a shops-only list, and the
// shop card itself dropped location entirely (web shows "category · city,
// province"; mobile only showed "category · N items").
const BUSINESS_COLUMNS =
  "id,owner_user_id,name,logo,category,province,city,suburb,status,verification_level";
const PAGE_SIZE = 30;

function SearchIcon() {
  return (
    <Svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke={color.textOnBrandSub} strokeWidth={2.4}>
      <Circle cx={11} cy={11} r={8} />
      <Line x1={21} y1={21} x2={16.65} y2={16.65} />
    </Svg>
  );
}

export default function ShopsDirectoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const styles = useThemedStyles(buildStyles);

  const [shops, setShops] = useState<Business[]>([]);
  const [productCounts, setProductCounts] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const pageRef = useRef(0);

  const buildQuery = useCallback(
    (from: number, to: number) => {
      let q = supabase.from("businesses").select(BUSINESS_COLUMNS).eq("status", "active");
      if (categoryFilter !== "all") q = q.eq("category", categoryFilter);
      const trimmed = query.trim();
      if (trimmed) q = q.ilike("name", `%${trimmed}%`);
      return q.order("verification_level", { ascending: false }).order("name", { ascending: true }).range(from, to);
    },
    [categoryFilter, query]
  );

  const loadProductCounts = useCallback(async (page: Business[]) => {
    const businessIds = page.map((b) => b.id);
    const ownerIds = page.map((b) => b.owner_user_id).filter(Boolean);
    if (!businessIds.length) return;
    const { data } = await supabase
      .from("listings")
      .select("seller_id,business_id")
      .eq("status", "active")
      .or(`business_id.in.(${businessIds.join(",")}),seller_id.in.(${ownerIds.join(",")})`);
    const counts: Record<string, number> = {};
    (data ?? []).forEach((l: any) => {
      const match = page.find((b) => b.id === l.business_id || b.owner_user_id === l.seller_id);
      if (match) counts[match.id] = (counts[match.id] ?? 0) + 1;
    });
    setProductCounts((prev) => ({ ...prev, ...counts }));
  }, []);

  const load = useCallback(async () => {
    setHasError(false);
    pageRef.current = 0;
    const { data, error } = await buildQuery(0, PAGE_SIZE - 1);
    if (error) {
      setHasError(true);
      return;
    }
    const page = (data as Business[]) ?? [];
    setShops(page);
    setHasMore(page.length === PAGE_SIZE);
    loadProductCounts(page);
  }, [buildQuery, loadProductCounts]);

  useEffect(() => {
    setIsLoading(true);
    load().finally(() => setIsLoading(false));
  }, [load]);

  const loadMore = useCallback(async () => {
    if (isLoadingMore || isLoading || !hasMore || hasError) return;
    setIsLoadingMore(true);
    const nextPage = pageRef.current + 1;
    const from = nextPage * PAGE_SIZE;
    const { data, error } = await buildQuery(from, from + PAGE_SIZE - 1);
    if (!error) {
      const page = (data as Business[]) ?? [];
      pageRef.current = nextPage;
      setShops((prev) => [...prev, ...page]);
      setHasMore(page.length === PAGE_SIZE);
      loadProductCounts(page);
    }
    setIsLoadingMore(false);
  }, [buildQuery, hasMore, isLoading, isLoadingMore, hasError, loadProductCounts]);

  const categoryOptions = useMemo(() => ["all", ...CATEGORIES.filter((c) => c.id !== "jobs").map((c) => c.id)], []);
  const categoryLabel = useCallback(
    (id: string) => (id === "all" ? "All" : CATEGORIES.find((c) => c.id === id)?.name ?? id),
    []
  );

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <View style={styles.headerRow}>
          <GlassBackButton onPress={() => router.back()} tone="light" flat />
          <Text style={styles.headerTitle}>Shops</Text>
          <View style={{ width: 38 }} />
        </View>
        <View style={styles.searchBar}>
          <SearchIcon />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Search shops or products…"
            placeholderTextColor={color.textOnBrandSub}
            returnKeyType="search"
          />
        </View>
      </View>

      <View style={styles.filterRow}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={categoryOptions}
          keyExtractor={(item) => item}
          contentContainerStyle={styles.filterContent}
          renderItem={({ item }) => (
            <Chip label={categoryLabel(item)} active={categoryFilter === item} onPress={() => setCategoryFilter(item)} />
          )}
        />
      </View>

      {isLoading ? (
        <View style={styles.listContent}>
          {Array.from({ length: 6 }).map((_, i) => (
            <View key={i} style={{ marginBottom: space.md }}>
              <ListingRowSkeleton />
            </View>
          ))}
        </View>
      ) : hasError ? (
        <ErrorState
          onRetry={() => {
            setIsLoading(true);
            load().finally(() => setIsLoading(false));
          }}
        />
      ) : (
        <FlatList
          data={shops}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={{ height: space.md }} />}
          ListHeaderComponent={
            shops.length ? (
              <Text style={styles.countText}>
                {shops.length} shop{shops.length === 1 ? "" : "s"}
              </Text>
            ) : null
          }
          ListEmptyComponent={
            <EmptyState
              title={query || categoryFilter !== "all" ? "No matching shops" : "No shops yet"}
              subtitle={
                query || categoryFilter !== "all"
                  ? "Try a different search or clear your filters."
                  : "Verified shops will appear here as sellers open storefronts."
              }
            />
          }
          renderItem={({ item }) => {
            const catLabel = CATEGORIES.find((c) => c.id === item.category)?.name ?? "";
            const loc = [item.city, item.province].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(", ");
            const metaParts = [catLabel, loc].filter(Boolean);
            const verified = (item.verification_level ?? 0) >= 2;
            const products = productCounts[item.id] ?? 0;
            return (
              <Pressable
                style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
                onPress={() => router.push({ pathname: "/business/[id]", params: { id: item.id } })}
              >
                <View style={styles.logoWrap}>
                  {item.logo ? (
                    <Image source={{ uri: item.logo }} style={styles.logo} contentFit="cover" cachePolicy="memory-disk" />
                  ) : (
                    <Text style={styles.logoInitial}>{businessInitials(item.name)}</Text>
                  )}
                </View>
                <View style={styles.cardBody}>
                  <View style={styles.nameRow}>
                    <Text style={styles.name} numberOfLines={1}>
                      {item.name}
                    </Text>
                    {verified ? <VerifiedBadge /> : null}
                  </View>
                  {metaParts.length ? (
                    <Text style={styles.meta} numberOfLines={1}>
                      {metaParts.join(" · ")}
                    </Text>
                  ) : null}
                  <Text style={styles.products}>
                    {products} product{products === 1 ? "" : "s"}
                  </Text>
                </View>
              </Pressable>
            );
          }}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            isLoadingMore ? (
              <View style={styles.footer}>
                <ActivityIndicator color={color.brand} />
              </View>
            ) : null
          }
        />
      )}
    </View>
  );
}

function buildStyles(color: ColorPalette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: color.bg },
    header: {
      backgroundColor: color.brand,
      paddingHorizontal: space.lg,
      paddingBottom: space.md,
      gap: space.md,
    },
    headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    headerTitle: { ...font.title, color: color.textOnBrand },
    searchBar: {
      flexDirection: "row",
      alignItems: "center",
      gap: space.sm,
      backgroundColor: "rgba(255,255,255,0.14)",
      borderRadius: radius.md,
      paddingHorizontal: space.md,
      height: 44,
    },
    searchInput: { flex: 1, ...font.body, color: color.textOnBrand, paddingVertical: 0 },
    filterRow: {
      backgroundColor: color.surface,
      borderBottomWidth: 1,
      borderBottomColor: color.border,
      paddingVertical: space.md,
    },
    filterContent: { paddingHorizontal: space.lg, gap: space.sm },
    countText: { ...font.caption, color: color.textMuted, marginBottom: space.md },
    listContent: { padding: space.lg, paddingBottom: space.huge },
    footer: { paddingVertical: space.lg, alignItems: "center" },
    card: {
      flexDirection: "row",
      gap: space.md,
      backgroundColor: color.surface,
      borderRadius: radius.lg,
      padding: space.lg,
      borderWidth: 1,
      borderColor: color.border,
      alignItems: "center",
      ...shadow.sm,
    },
    cardPressed: { opacity: 0.9, transform: [{ scale: 0.995 }] },
    logoWrap: {
      width: 52,
      height: 52,
      borderRadius: radius.pill,
      backgroundColor: color.brandTint,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
      flexShrink: 0,
    },
    logo: { width: "100%", height: "100%" },
    logoInitial: { ...font.h3, color: color.brand },
    cardBody: { flex: 1, gap: 3, minWidth: 0 },
    nameRow: { flexDirection: "row", alignItems: "center", gap: space.xs },
    name: { ...font.title, color: color.text, flexShrink: 1 },
    meta: { ...font.caption, color: color.textMuted, fontWeight: "500" },
    products: { ...font.caption, color: color.textMuted },
  });
}
