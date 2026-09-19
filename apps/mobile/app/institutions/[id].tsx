import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "../../lib/supabase";
import { color, font, radius, space, type ColorPalette } from "../../lib/theme";
import { useThemedStyles } from "../../lib/theme-provider";
import { institutionAbbreviation, INSTITUTION_TYPE_LABEL, type Institution } from "../../lib/institutions";
import { INSTITUTION_LISTING_FILTERS, applyInstitutionListingFilter, type InstitutionListingFilter } from "../../lib/institution-listing-filters";
import { type Listing } from "../../lib/listings";
import { padGridFiller } from "../../lib/listing-grid";
import { ListingCard } from "../../components/ListingCard";
import { Chip, EmptyState, ErrorState, ListingGridSkeleton, VerifiedBadge } from "../../components/ui";
import { useIOSNativeHeader } from "../../lib/useIOSNativeHeader";

// Detail screen -- mirrors app/business/[id].tsx's overall shape (header +
// category chips + listing grid) but reuses the real ListingCard (per the
// Phase 3 brief) rather than business/[id]'s own hand-rolled inline card.
// Listings are fetched via get_institution_listings (Phase 8B) -- that RPC
// already selects every public.listings column and applies its own
// status/expiry filtering server-side, so no client-side column list or
// expiry clause is needed here anymore.
const LISTINGS_PAGE_SIZE = 20;

type SortKey = "newest" | "price_asc" | "price_desc";
const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "newest", label: "Newest" },
  { key: "price_asc", label: "Price: Low to High" },
  { key: "price_desc", label: "Price: High to Low" },
];

type PriceKey = "any" | "under50" | "50to200" | "200to500" | "500plus";
const PRICE_OPTIONS: { key: PriceKey; label: string; min: number | null; max: number | null }[] = [
  { key: "any", label: "Any Price", min: null, max: null },
  { key: "under50", label: "Under $50", min: 0, max: 50 },
  { key: "50to200", label: "$50 - $200", min: 50, max: 200 },
  { key: "200to500", label: "$200 - $500", min: 200, max: 500 },
  { key: "500plus", label: "$500+", min: 500, max: null },
];

type InstitutionRow = Institution & {
  provinces: { name: string } | { name: string }[];
  cities: { name: string } | { name: string }[];
};

function resolveName(v: { name: string } | { name: string }[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0]?.name : v?.name;
}

export default function InstitutionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const styles = useThemedStyles(buildStyles);

  const [institution, setInstitution] = useState<InstitutionRow | null>(null);
  const [isLoadingInstitution, setIsLoadingInstitution] = useState(true);
  const [institutionError, setInstitutionError] = useState(false);
  // Real count (not a fabricated stat) -- same {count:"exact", head:true}
  // pattern already used by app/institutions/index.tsx's per-type counts.
  // Always "all" categories regardless of the active filter chip, so the
  // header stat doesn't visually flicker as the user switches filters.
  const [activeCount, setActiveCount] = useState<number | null>(null);

  const [listings, setListings] = useState<Listing[]>([]);
  const [isLoadingListings, setIsLoadingListings] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [listingsError, setListingsError] = useState(false);
  const [filter, setFilter] = useState<InstitutionListingFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("newest");
  const [priceKey, setPriceKey] = useState<PriceKey>("any");
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [priceMenuOpen, setPriceMenuOpen] = useState(false);
  const priceOption = PRICE_OPTIONS.find((p) => p.key === priceKey) ?? PRICE_OPTIONS[0];
  const sortOption = SORT_OPTIONS.find((s) => s.key === sortKey) ?? SORT_OPTIONS[0];
  const pageRef = useRef(0);

  useIOSNativeHeader({ backgroundColor: color.brand, tintColor: color.textOnBrand, title: institution?.official_name || "Institution", androidNative: true });

  const loadInstitution = useCallback(async () => {
    if (!id) return;
    setIsLoadingInstitution(true);
    setInstitutionError(false);
    // is_active=true here is defense in depth, matching lib/listings.ts's
    // publicListingExpiryFilter comment convention -- RLS (Phase 1) is the
    // real, authoritative boundary: an inactive institution's row simply
    // never comes back from Supabase for a non-admin caller regardless of
    // this clause, so someone who knows the UUID directly cannot see it.
    const { data, error } = await supabase
      .from("institutions")
      .select("id,type,official_name,short_name,search_aliases,province_id,city_id,suburb,logo_url,cover_image,founded_year,description,is_active,sort_order,provinces(name),cities(name)")
      .eq("id", id)
      .eq("is_active", true)
      .maybeSingle();
    if (error) { setInstitutionError(true); setIsLoadingInstitution(false); return; }
    setInstitution((data as InstitutionRow) ?? null);
    setIsLoadingInstitution(false);
  }, [id]);

  useEffect(() => { void loadInstitution(); }, [loadInstitution]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    supabase
      .rpc("get_institution_listings", { p_institution_id: id, p_limit: 1, p_offset: 0 }, { count: "exact", head: true })
      .then(({ count }) => {
        if (!cancelled) setActiveCount(count ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const buildListingsQuery = useCallback(
    (from: number, to: number) => {
      // Institutions Phase 8B: the only path allowed to return
      // institution_only listings is this RPC -- a raw .from("listings")
      // query here would now correctly get zero institution_only rows back
      // (the tightened RLS policy), silently breaking the institution
      // feed's whole reason for existing. get_institution_listings scopes
      // entirely by its own institution_id parameter (re-validates the
      // institution is active server-side too) -- pagination matches the
      // house convention already used by search_active_jobs (p_limit/
      // p_offset params, not a chained .range()). The existing fixed
      // category-filter chips still chain onto the result exactly as
      // before, since PostgREST filters a `returns setof listings`
      // function's output the same way it filters a table.
      let q = supabase.rpc("get_institution_listings", {
        p_institution_id: id,
        p_limit: to - from + 1,
        p_offset: from,
        p_sort: sortKey,
        p_min_price: priceOption.min,
        p_max_price: priceOption.max,
      });
      q = applyInstitutionListingFilter(q as any, filter) as typeof q;
      return q;
    },
    [id, filter, sortKey, priceOption.min, priceOption.max]
  );

  const loadListings = useCallback(async () => {
    if (!id) return;
    setListingsError(false);
    pageRef.current = 0;
    const { data, error } = await buildListingsQuery(0, LISTINGS_PAGE_SIZE - 1);
    if (error) { setListingsError(true); return; }
    const page = (data as Listing[]) ?? [];
    setListings(page);
    setHasMore(page.length === LISTINGS_PAGE_SIZE);
  }, [id, buildListingsQuery]);

  // Refetch every time this screen gains focus, not just once on mount --
  // otherwise deleting/editing a listing elsewhere and coming back here
  // left this grid showing a stale copy that 404'd when tapped (the
  // listing genuinely no longer existed; this screen just never knew).
  useFocusEffect(
    useCallback(() => {
      setIsLoadingListings(true);
      loadListings().finally(() => setIsLoadingListings(false));
    }, [loadListings])
  );

  const loadMoreListings = useCallback(async () => {
    if (isLoadingMore || isLoadingListings || !hasMore || listingsError) return;
    setIsLoadingMore(true);
    const nextPage = pageRef.current + 1;
    const from = nextPage * LISTINGS_PAGE_SIZE;
    const { data, error } = await buildListingsQuery(from, from + LISTINGS_PAGE_SIZE - 1);
    if (!error) {
      const page = (data as Listing[]) ?? [];
      pageRef.current = nextPage;
      setListings((prev) => {
        const existingIds = new Set(prev.map((l) => l.id));
        return [...prev, ...page.filter((l) => !existingIds.has(l.id))];
      });
      setHasMore(page.length === LISTINGS_PAGE_SIZE);
    }
    setIsLoadingMore(false);
  }, [buildListingsQuery, hasMore, isLoadingListings, isLoadingMore, listingsError]);

  const meta = useMemo(() => {
    if (!institution) return "";
    const parts = [resolveName(institution.cities), resolveName(institution.provinces)].filter((v, i, a) => v && a.indexOf(v) === i);
    return parts.join(", ");
  }, [institution]);

  if (isLoadingInstitution) {
    return (
      <View style={styles.container}>
        <View style={styles.centered}><ActivityIndicator color={color.brand} /></View>
      </View>
    );
  }

  // Nonexistent AND inactive institutions land here identically -- RLS
  // already made both indistinguishable from Supabase's point of view, and
  // the UI must not leak which case it was either (that itself would be a
  // side-channel revealing an inactive institution's existence).
  if (institutionError || !institution) {
    return (
      <View style={styles.container}>
        <View style={styles.centered}>
          {institutionError ? <ErrorState onRetry={() => void loadInstitution()} /> : <Text style={styles.notFoundTitle}>Institution not found</Text>}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={padGridFiller(listings, 2)}
        keyExtractor={(item, index) => item?.id ?? `filler-${index}`}
        numColumns={2}
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={[styles.listContent, { paddingBottom: 58 + insets.bottom + space.xxl }]}
        ListHeaderComponent={
          <>
            <View style={styles.cover}>
              {institution.cover_image ? (
                <Image source={{ uri: institution.cover_image }} style={styles.coverImage} contentFit="cover" transition={150} cachePolicy="memory-disk" />
              ) : null}
              <View style={styles.liveHubPill}>
                <VerifiedBadge compact />
                <Text style={styles.liveHubPillText}>Verified Community</Text>
              </View>
            </View>

            <View style={styles.header}>
              <View style={styles.identityRow}>
                <View style={styles.logoOuter}>
                  {institution.logo_url ? (
                    <Image source={{ uri: institution.logo_url }} style={styles.logo} contentFit="cover" cachePolicy="memory-disk" />
                  ) : (
                    <View style={styles.logoInner}>
                      <Text style={styles.logoInitial}>{institutionAbbreviation(institution)}</Text>
                      {institution.founded_year ? <Text style={styles.logoYear}>{institution.founded_year}</Text> : null}
                    </View>
                  )}
                </View>
                <Pressable
                  style={styles.postHereButton}
                  onPress={() => router.push({ pathname: "/institutions/post-setup", params: { institutionId: institution.id } })}
                >
                  <Text style={styles.postHereButtonText}>+ Post for {institution.short_name || institution.official_name}</Text>
                </Pressable>
              </View>

              <View style={styles.nameRow}>
                <Text style={styles.name}>{institution.official_name}</Text>
                <VerifiedBadge />
              </View>
              <Text style={styles.type}>
                {INSTITUTION_TYPE_LABEL[institution.type]}
                {meta || institution.suburb ? ` • ${[institution.suburb, meta].filter(Boolean).join(", ")}` : ""}
              </Text>
              {institution.description ? <Text style={styles.description}>{institution.description}</Text> : null}

              <View style={styles.statChipRow}>
                {activeCount !== null ? (
                  <View style={styles.statChip}>
                    <Text style={styles.statChipText}>
                      {activeCount} active listing{activeCount === 1 ? "" : "s"}
                    </Text>
                  </View>
                ) : null}
                <View style={styles.verifiedChip}>
                  <Text style={styles.verifiedChipText}>Verified Campus</Text>
                </View>
              </View>
            </View>

            <ScrollView horizontal nestedScrollEnabled showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterContent}>
              {INSTITUTION_LISTING_FILTERS.map((item) => (
                <Chip key={item.key} label={`${item.emoji} ${item.label}`} active={filter === item.key} onPress={() => setFilter(item.key)} />
              ))}
            </ScrollView>

            <View style={styles.sortPriceRow}>
              <Pressable style={styles.sortPriceButton} onPress={() => setSortMenuOpen(true)}>
                <Text style={styles.sortPriceButtonText} numberOfLines={1}>Sort: {sortOption.label}</Text>
                <Text style={styles.sortPriceButtonChevron}>▾</Text>
              </Pressable>
              <Pressable style={styles.sortPriceButton} onPress={() => setPriceMenuOpen(true)}>
                <Text style={styles.sortPriceButtonText} numberOfLines={1}>{priceOption.label}</Text>
                <Text style={styles.sortPriceButtonChevron}>▾</Text>
              </Pressable>
              <View style={{ flex: 1 }} />
              {!isLoadingListings ? <Text style={styles.showingCountText}>Showing {listings.length}</Text> : null}
            </View>

            <Modal visible={sortMenuOpen} transparent animationType="fade" onRequestClose={() => setSortMenuOpen(false)}>
              <Pressable style={styles.dropdownOverlay} onPress={() => setSortMenuOpen(false)}>
                <View style={styles.dropdownSheet}>
                  <Text style={styles.dropdownTitle}>Sort by</Text>
                  {SORT_OPTIONS.map((opt) => (
                    <Pressable
                      key={opt.key}
                      style={styles.dropdownOption}
                      onPress={() => {
                        setSortKey(opt.key);
                        setSortMenuOpen(false);
                      }}
                    >
                      <Text style={[styles.dropdownOptionText, opt.key === sortKey && styles.dropdownOptionTextActive]}>
                        {opt.label}
                      </Text>
                      {opt.key === sortKey ? <Text style={styles.dropdownCheck}>✓</Text> : null}
                    </Pressable>
                  ))}
                </View>
              </Pressable>
            </Modal>

            <Modal visible={priceMenuOpen} transparent animationType="fade" onRequestClose={() => setPriceMenuOpen(false)}>
              <Pressable style={styles.dropdownOverlay} onPress={() => setPriceMenuOpen(false)}>
                <View style={styles.dropdownSheet}>
                  <Text style={styles.dropdownTitle}>Price range</Text>
                  {PRICE_OPTIONS.map((opt) => (
                    <Pressable
                      key={opt.key}
                      style={styles.dropdownOption}
                      onPress={() => {
                        setPriceKey(opt.key);
                        setPriceMenuOpen(false);
                      }}
                    >
                      <Text style={[styles.dropdownOptionText, opt.key === priceKey && styles.dropdownOptionTextActive]}>
                        {opt.label}
                      </Text>
                      {opt.key === priceKey ? <Text style={styles.dropdownCheck}>✓</Text> : null}
                    </Pressable>
                  ))}
                </View>
              </Pressable>
            </Modal>

            {isLoadingListings ? <ListingGridSkeleton count={4} /> : null}
            {!isLoadingListings && listingsError ? <ErrorState onRetry={() => void loadListings()} /> : null}
          </>
        }
        ListEmptyComponent={
          !isLoadingListings && !listingsError ? (
            <EmptyState
              title="No listings yet"
              subtitle={filter === "all" ? "Listings tagged to this institution will appear here." : "No listings match this filter yet."}
            />
          ) : null
        }
        renderItem={({ item }) =>
          item ? (
            <ListingCard listing={item} onPress={() => router.push({ pathname: "/listing/[id]", params: { id: item.id } })} />
          ) : (
            <View style={{ flex: 1 }} />
          )
        }
        onEndReached={loadMoreListings}
        onEndReachedThreshold={0.5}
        ListFooterComponent={isLoadingMore ? <View style={styles.footer}><ActivityIndicator color={color.brand} /></View> : null}
      />
    </View>
  );
}

function buildStyles(color: ColorPalette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: color.bg },
    centered: { flex: 1, alignItems: "center", justifyContent: "center" },
    notFoundTitle: { ...font.title, color: color.text },
    cover: { height: 230, backgroundColor: color.brand },
    coverImage: { width: "100%", height: "100%" },
    liveHubPill: {
      position: "absolute", top: space.md, right: space.md,
      flexDirection: "row", alignItems: "center", gap: 6,
      backgroundColor: "rgba(255,255,255,0.92)", borderRadius: radius.pill,
      paddingHorizontal: space.sm, paddingVertical: 6,
    },
    liveHubPillText: { fontSize: 11, fontWeight: "800", color: "#16211D" },
    header: { paddingHorizontal: space.xl, paddingTop: 0, paddingBottom: space.lg },
    identityRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: space.sm, marginTop: -32 },
    logoOuter: {
      width: 64, height: 64, borderRadius: radius.lg, backgroundColor: color.surface,
      alignItems: "center", justifyContent: "center", overflow: "hidden", padding: 5,
    },
    logoInner: {
      width: "100%", height: "100%", borderRadius: radius.md, backgroundColor: color.brand,
      alignItems: "center", justifyContent: "center",
    },
    logo: { width: "100%", height: "100%", borderRadius: radius.md },
    logoInitial: { ...font.h3, color: color.textOnBrand, fontWeight: "800" },
    logoYear: { fontSize: 9, fontWeight: "700", color: color.textOnBrand, opacity: 0.85, marginTop: 1, letterSpacing: 0.5 },
    postHereButton: {
      backgroundColor: color.gold, paddingHorizontal: space.lg, paddingVertical: space.sm,
      borderRadius: radius.pill, maxWidth: "62%",
    },
    postHereButtonText: { ...font.caption, fontWeight: "800", color: color.textOnBrand },
    nameRow: { flexDirection: "row", alignItems: "center", gap: space.xs, marginTop: space.md },
    name: { ...font.h3, color: color.text, flexShrink: 1 },
    type: { ...font.caption, color: color.brand, fontWeight: "700", marginTop: space.xs, textTransform: "uppercase" },
    description: { ...font.body, color: color.text, marginTop: space.md },
    statChipRow: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginTop: space.md },
    statChip: {
      alignSelf: "flex-start", backgroundColor: color.surfaceAlt, borderWidth: 1, borderColor: color.border,
      borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: space.xs,
    },
    statChipText: { ...font.caption, color: color.text },
    verifiedChip: {
      alignSelf: "flex-start", backgroundColor: color.brandTint,
      borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: space.xs,
    },
    verifiedChipText: { ...font.caption, color: color.brand, fontWeight: "700" },
    filterContent: { paddingHorizontal: space.lg, gap: space.sm, paddingBottom: space.md },
    sortPriceRow: { flexDirection: "row", gap: space.sm, paddingHorizontal: space.lg, paddingBottom: space.md },
    sortPriceButton: {
      flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: color.surface,
      borderWidth: 1, borderColor: color.border,
      borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: space.xs,
    },
    sortPriceButtonText: { ...font.caption, color: color.text, fontWeight: "700" },
    sortPriceButtonChevron: { ...font.caption, color: color.textMuted },
    showingCountText: { ...font.caption, color: color.textMuted, alignSelf: "center" },
    dropdownOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "flex-end" },
    dropdownSheet: {
      backgroundColor: color.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg,
      paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.xxl,
    },
    dropdownTitle: { ...font.title, color: color.text, marginBottom: space.sm },
    dropdownOption: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      paddingVertical: space.md, borderBottomWidth: 1, borderBottomColor: color.border,
    },
    dropdownOptionText: { ...font.body, color: color.text },
    dropdownOptionTextActive: { color: color.brand, fontWeight: "700" },
    dropdownCheck: { color: color.brand, fontWeight: "800" },
    gridRow: { paddingHorizontal: space.lg, gap: space.md },
    listContent: { paddingBottom: space.huge },
    footer: { paddingVertical: space.lg, alignItems: "center" },
  });
}
