import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Line, Path } from "react-native-svg";
import { Image } from "expo-image";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import { applyBrowseFilters, type BrowseFilters, type Listing } from "../../lib/listings";
import { businessInitials, type Business } from "../../lib/businesses";
import { fetchActiveAds, adsForCategory, type PaidAd } from "../../lib/ads";
import { logSearch } from "../../lib/telemetry";
import { saveSearch } from "../../lib/saved-searches";
import { fetchSavedListingIds, toggleSave } from "../../lib/saves";
import { toast } from "../../components/ui/Toast";
import { loadCache, saveCache } from "../../lib/offlineCache";

const SEARCH_CACHE_KEY = "search-browse";
import { ListingRow } from "../../components/ListingRow";
import { FilterPanel, countActiveFilters } from "../../components/search/FilterPanel";
import { AdCarousel } from "../../components/home/AdCarousel";
import { Chip, EmptyState, ErrorState, ListSkeleton } from "../../components/ui";
import { font, radius, shadow, space, type ColorPalette } from "../../lib/theme";
import { useThemedStyles } from "../../lib/theme-provider";

const LISTING_COLUMNS =
  "id,seller_id,seller_name,seller_phone,title,description,price,currency,category,province,city,suburb,photos,status,boost,featured_until,views,business_id,created_at,updated_at,attributes,condition";

const PAGE_SIZE = 30;

const DEFAULT_FILTERS: BrowseFilters = {
  query: "",
  categories: [],
  priceMin: 0,
  priceMax: Infinity,
  condition: "all",
  currency: "all",
  location: "all",
  verifiedOnly: false,
  sortBy: "recent",
  rentalType: "all",
};

const SORT_OPTIONS = [
  { value: "recent", label: "Latest" },
  { value: "price_asc", label: "Price ↑" },
  { value: "price_desc", label: "Price ↓" },
  { value: "views", label: "Trending" },
] as const;

function SearchIcon({ color }: { color: ColorPalette }) {
  return (
    <Svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke={color.textOnBrand} strokeWidth={2}>
      <Circle cx={11} cy={11} r={8} />
      <Line x1={21} y1={21} x2="16.65" y2="16.65" />
    </Svg>
  );
}

function FilterIcon({ color }: { color: ColorPalette }) {
  return (
    <Svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke={color.brand} strokeWidth={2}>
      <Path d="M4 6h16M4 12h16M4 18h16" />
    </Svg>
  );
}

// Pagination note: we paginate the RAW query in pages of PAGE_SIZE via .range(),
// accumulate into `listings`, and apply applyBrowseFilters (client-side) to the
// accumulated list. Category/query params drive both the DB query (category) and
// the client filter, so filtered pages stay consistent as more pages load.
export default function SearchScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ category?: string; query?: string }>();
  const { session } = useAuth();

  const [listings, setListings] = useState<Listing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<BrowseFilters>(DEFAULT_FILTERS);
  const [filterPanelVisible, setFilterPanelVisible] = useState(false);
  const [ads, setAds] = useState<PaidAd[]>([]);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [matchingShops, setMatchingShops] = useState<Business[]>([]);
  const [showingCached, setShowingCached] = useState(false);

  const pageRef = useRef(0);
  const styles = useThemedStyles(buildStyles);
  const themeColor = useThemedStyles((c) => c);

  useEffect(() => {
    fetchActiveAds().then(setAds);
  }, []);

  useEffect(() => {
    if (!session?.user) return;
    fetchSavedListingIds(session.user.id).then(setSavedIds);
  }, [session?.user?.id]);

  useEffect(() => {
    if (params.category || params.query) {
      setFilters((f) => ({
        ...f,
        categories: params.category ? [params.category!] : f.categories,
        query: params.query ?? f.query,
      }));
    }
  }, [params.category, params.query]);

  const buildQuery = useCallback((from: number, to: number) => {
    return supabase
      .from("listings")
      .select(LISTING_COLUMNS)
      .eq("status", "active")
      .neq("category", "jobs")
      .order("created_at", { ascending: false })
      .range(from, to);
  }, []);

  const loadFirstPage = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    pageRef.current = 0;
    const { data, error: queryError } = await buildQuery(0, PAGE_SIZE - 1);
    if (queryError) {
      setError(queryError.message);
    } else {
      const page = (data as Listing[]) ?? [];
      setListings(page);
      setShowingCached(false);
      setHasMore(page.length === PAGE_SIZE);
      saveCache<Listing[]>(SEARCH_CACHE_KEY, page);
    }
    setIsLoading(false);
  }, [buildQuery]);

  useEffect(() => {
    let cancelled = false;
    // Hydrate from the last successful browse load immediately — if the
    // network call below fails (no connection), this stays on screen
    // instead of an empty/error state, matching the home feed's behavior.
    loadCache<Listing[]>(SEARCH_CACHE_KEY).then((cached) => {
      if (cancelled || !cached) return;
      setListings((current) => (current.length ? current : cached));
      setShowingCached(true);
      setIsLoading(false);
    });
    loadFirstPage();
    return () => {
      cancelled = true;
    };
  }, [loadFirstPage]);

  const loadMore = useCallback(async () => {
    if (isLoadingMore || isLoading || !hasMore || error) return;
    setIsLoadingMore(true);
    const nextPage = pageRef.current + 1;
    const from = nextPage * PAGE_SIZE;
    const { data, error: queryError } = await buildQuery(from, from + PAGE_SIZE - 1);
    if (!queryError) {
      const page = (data as Listing[]) ?? [];
      pageRef.current = nextPage;
      setListings((prev) => [...prev, ...page]);
      setHasMore(page.length === PAGE_SIZE);
    }
    setIsLoadingMore(false);
  }, [buildQuery, hasMore, isLoading, isLoadingMore, error]);

  const locations = useMemo(() => {
    const set = new Set<string>();
    listings.forEach((l) => {
      const loc = l.city || l.province;
      if (loc) set.add(loc);
    });
    return Array.from(set).sort();
  }, [listings]);

  const results = useMemo(() => applyBrowseFilters(listings, filters), [listings, filters]);

  useEffect(() => {
    if (!filters.query.trim()) return;
    const timer = setTimeout(() => logSearch(filters.query, results.length), 600);
    return () => clearTimeout(timer);
  }, [filters.query, results.length]);

  // Search only covers `listings` (the .neq("category","jobs") query above) —
  // shops/businesses have no search entry point anywhere else in the app, so
  // surface name matches here too rather than leaving Shops unsearchable.
  useEffect(() => {
    const q = filters.query.trim();
    if (q.length < 2) {
      setMatchingShops([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from("businesses")
        .select("id,owner_user_id,name,logo,cover,description,biz_type,category,phone,whatsapp,email,province,city,suburb,status,verification_level,featured_listing_ids,updated_at")
        .eq("status", "active")
        .ilike("name", `%${q}%`)
        .limit(6);
      if (!cancelled) setMatchingShops((data as Business[]) ?? []);
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [filters.query]);

  const categoryAds = useMemo(
    () => adsForCategory(ads, filters.categories.length === 1 ? filters.categories[0] : null),
    [ads, filters.categories]
  );

  const onToggleSave = useCallback(
    async (id: string) => {
      if (!session?.user) {
        router.push("/(auth)/sign-in");
        return;
      }
      const currentlySaved = savedIds.has(id);
      setSavedIds((prev) => {
        const next = new Set(prev);
        if (currentlySaved) next.delete(id);
        else next.add(id);
        return next;
      });
      try {
        await toggleSave(session.user.id, id, currentlySaved);
      } catch {
        setSavedIds((prev) => {
          const next = new Set(prev);
          if (currentlySaved) next.add(id);
          else next.delete(id);
          return next;
        });
      }
    },
    [session?.user?.id, savedIds, router]
  );

  const showSaveSearch = !!(filters.query.trim() || filters.categories.length);
  const activeFilterCount = useMemo(() => countActiveFilters(filters), [filters]);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>
            Browse <Text style={styles.headerTitleAccent}>All</Text>
          </Text>
          <View style={styles.countPill}>
            <Text style={styles.countPillText}>{results.length} ads</Text>
          </View>
        </View>
        <View style={styles.searchBar}>
          <SearchIcon color={themeColor} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search all listings…"
            placeholderTextColor="rgba(255,255,255,0.6)"
            value={filters.query}
            onChangeText={(q) => setFilters((f) => ({ ...f, query: q }))}
            returnKeyType="search"
          />
        </View>
      </View>

      {/* Horizontal scroll rather than a flex row: Filters + Save + four sort
          chips cannot fit an iPhone width, and sharing leftover space via
          flex:1 squeezed every chip until labels clipped. Scrolling keeps each
          control at its natural size and its full touch target. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.controlsRow}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable style={styles.filterButton} onPress={() => setFilterPanelVisible(true)}>
          <FilterIcon color={themeColor} />
          <Text style={styles.filterButtonText}>Filters</Text>
          {activeFilterCount ? (
            <View style={styles.filterCountDot}>
              <Text style={styles.filterCountDotText}>{activeFilterCount}</Text>
            </View>
          ) : null}
        </Pressable>
        {showSaveSearch ? (
          <Pressable
            style={styles.filterButton}
            onPress={async () => {
              if (!session?.user) {
                router.push("/(auth)/sign-in");
                return;
              }
              await saveSearch(session.user.id, filters);
              toast("Search saved");
            }}
          >
            <Text style={styles.filterButtonText}>Save</Text>
          </Pressable>
        ) : null}
        <View style={styles.sortWrap}>
          {SORT_OPTIONS.map((opt) => (
            <Chip
              key={opt.value}
              label={opt.label}
              active={filters.sortBy === opt.value}
              onPress={() => setFilters((f) => ({ ...f, sortBy: opt.value }))}
            />
          ))}
        </View>
      </ScrollView>

      {isLoading ? (
        <View style={styles.listContent}>
          <ListSkeleton count={7} />
        </View>
      ) : error && !listings.length ? (
        <ErrorState subtitle={error} onRetry={loadFirstPage} />
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <>
              {error ? (
                <View style={styles.offlineBanner}>
                  <Text style={styles.offlineBannerText}>
                    {showingCached ? "You're offline — showing your last saved results." : "Couldn't refresh — showing what we last loaded."}
                  </Text>
                </View>
              ) : null}
              {matchingShops.length ? (
                <View style={styles.shopsSection}>
                  <Text style={styles.shopsSectionTitle}>Shops matching &ldquo;{filters.query.trim()}&rdquo;</Text>
                  <FlatList
                    horizontal
                    data={matchingShops}
                    keyExtractor={(b) => b.id}
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.shopsRow}
                    renderItem={({ item }) => (
                      <Pressable
                        style={styles.shopCard}
                        onPress={() => router.push({ pathname: "/business/[id]", params: { id: item.id } })}
                      >
                        <View style={styles.shopLogoWrap}>
                          {item.logo ? (
                            <Image source={{ uri: item.logo }} style={styles.shopLogo} contentFit="cover" cachePolicy="memory-disk" />
                          ) : (
                            <Text style={styles.shopLogoInitial}>{businessInitials(item.name)}</Text>
                          )}
                        </View>
                        <Text style={styles.shopName} numberOfLines={1}>
                          {item.name}
                        </Text>
                      </Pressable>
                    )}
                  />
                </View>
              ) : null}
              {categoryAds.length ? <AdCarousel ads={categoryAds} /> : null}
            </>
          }
          ListEmptyComponent={
            <EmptyState
              title="No matches"
              subtitle="Try a different search term or clear your filters."
              buttonLabel="Reset filters"
              onPressButton={() => setFilters(DEFAULT_FILTERS)}
            />
          }
          renderItem={({ item }) => (
            <ListingRow
              listing={item}
              saved={savedIds.has(item.id)}
              onToggleSave={() => onToggleSave(item.id)}
              onPress={() => router.push({ pathname: "/listing/[id]", params: { id: item.id } })}
            />
          )}
          ItemSeparatorComponent={() => <View style={{ height: space.sm }} />}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            isLoadingMore ? (
              <View style={styles.footer}>
                <ActivityIndicator color={themeColor.brand} />
              </View>
            ) : null
          }
        />
      )}

      <FilterPanel
        visible={filterPanelVisible}
        filters={filters}
        locations={locations}
        onChange={setFilters}
        onApply={() => setFilterPanelVisible(false)}
        onReset={() => setFilters(DEFAULT_FILTERS)}
        onClose={() => setFilterPanelVisible(false)}
      />
    </View>
  );
}

function buildStyles(color: ColorPalette) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: color.bg },
  offlineBanner: {
    marginHorizontal: space.lg,
    marginTop: space.md,
    backgroundColor: color.goldTint,
    borderRadius: radius.md,
    padding: space.md,
  },
  offlineBannerText: { ...font.sub, color: color.text, fontWeight: "600" },
  shopsSection: { paddingTop: space.lg, paddingBottom: space.sm },
  shopsSectionTitle: { ...font.caption, color: color.textMuted, paddingHorizontal: space.lg, marginBottom: space.sm },
  shopsRow: { paddingHorizontal: space.lg, gap: space.md },
  shopCard: { alignItems: "center", width: 76, gap: space.xs },
  shopLogoWrap: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: color.brandTint,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  shopLogo: { width: "100%", height: "100%" },
  shopLogoInitial: { ...font.title, color: color.brand },
  shopName: { ...font.caption, color: color.text, textAlign: "center" },
  header: {
    backgroundColor: color.brand,
    paddingHorizontal: space.lg,
    paddingBottom: space.lg,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: space.md,
  },
  headerTitle: { ...font.h2, color: color.textOnBrand },
  headerTitleAccent: { fontStyle: "italic", color: color.gold },
  countPill: {
    backgroundColor: "rgba(255,255,255,0.14)",
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
  },
  countPillText: { ...font.caption, color: color.textOnBrandSub },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: radius.md,
    paddingHorizontal: space.md,
  },
  searchInput: { flex: 1, paddingVertical: space.md, ...font.body, color: color.textOnBrand },
  controlsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  controlsScroll: { flexGrow: 0 },
  filterButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    gap: space.xs,
    backgroundColor: color.surface,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderWidth: 1,
    borderColor: color.borderStrong,
    ...shadow.sm,
  },
  filterButtonText: { ...font.caption, color: color.text },
  filterCountDot: {
    minWidth: 16,
    height: 16,
    borderRadius: radius.pill,
    backgroundColor: color.brand,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  filterCountDotText: { fontSize: 9, fontWeight: "800", color: color.textOnBrand },
  // No flex:1 — inside a horizontal ScrollView the row must size to its
  // content, otherwise the chips are squeezed back into the visible width.
  sortWrap: { flexDirection: "row", gap: space.xs },
  listContent: { paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: space.xxl },
  footer: { paddingVertical: space.lg, alignItems: "center" },
  });
}
