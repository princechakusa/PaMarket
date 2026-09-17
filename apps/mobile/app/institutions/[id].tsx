import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "../../lib/supabase";
import { color, font, radius, space, type ColorPalette } from "../../lib/theme";
import { useThemedStyles } from "../../lib/theme-provider";
import { institutionInitials, INSTITUTION_TYPE_LABEL, type Institution } from "../../lib/institutions";
import { INSTITUTION_LISTING_FILTERS, applyInstitutionListingFilter, type InstitutionListingFilter } from "../../lib/institution-listing-filters";
import { type Listing } from "../../lib/listings";
import { ListingCard } from "../../components/ListingCard";
import { Chip, EmptyState, ErrorState, GlassBackButton, ListingGridSkeleton } from "../../components/ui";
import { useIOSNativeHeader } from "../../lib/useIOSNativeHeader";

// Detail screen -- mirrors app/business/[id].tsx's overall shape (header +
// category chips + listing grid) but reuses the real ListingCard (per the
// Phase 3 brief) rather than business/[id]'s own hand-rolled inline card.
// Listings are fetched via get_institution_listings (Phase 8B) -- that RPC
// already selects every public.listings column and applies its own
// status/expiry filtering server-side, so no client-side column list or
// expiry clause is needed here anymore.
const LISTINGS_PAGE_SIZE = 20;

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
  const pageRef = useRef(0);

  useIOSNativeHeader({ backgroundColor: color.brand, tintColor: color.textOnBrand, title: institution?.official_name || "Institution" });

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
      .select("id,type,official_name,short_name,search_aliases,province_id,city_id,suburb,logo_url,description,is_active,sort_order,provinces(name),cities(name)")
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
      let q = supabase.rpc("get_institution_listings", { p_institution_id: id, p_limit: to - from + 1, p_offset: from });
      q = applyInstitutionListingFilter(q as any, filter) as typeof q;
      return q;
    },
    [id, filter]
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

  useEffect(() => {
    setIsLoadingListings(true);
    loadListings().finally(() => setIsLoadingListings(false));
  }, [loadListings]);

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
        {Platform.OS !== "ios" ? <View style={[styles.backRow, { paddingTop: insets.top + 10 }]}><GlassBackButton onPress={() => router.back()} flat /></View> : null}
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
        {Platform.OS !== "ios" ? <View style={[styles.backRow, { paddingTop: insets.top + 10 }]}><GlassBackButton onPress={() => router.back()} flat /></View> : null}
        <View style={styles.centered}>
          {institutionError ? <ErrorState onRetry={() => void loadInstitution()} /> : <Text style={styles.notFoundTitle}>Institution not found</Text>}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={listings}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={[styles.listContent, { paddingBottom: 58 + insets.bottom + space.xxl }]}
        ListHeaderComponent={
          <>
            {Platform.OS !== "ios" ? <View style={[styles.backRow, { paddingTop: insets.top + 10 }]}><GlassBackButton onPress={() => router.back()} flat /></View> : null}

            <View style={styles.header}>
              <View style={styles.headerTopRow}>
                <View style={styles.logoWrap}>
                  {institution.logo_url ? (
                    <Image source={{ uri: institution.logo_url }} style={styles.logo} contentFit="cover" cachePolicy="memory-disk" />
                  ) : (
                    <Text style={styles.logoInitial}>{institutionInitials(institution.official_name)}</Text>
                  )}
                </View>
                <Pressable
                  style={styles.postHereButton}
                  onPress={() => router.push({ pathname: "/institutions/post-setup", params: { institutionId: institution.id } })}
                >
                  <Text style={styles.postHereButtonText}>Post for {institution.short_name || institution.official_name}</Text>
                </Pressable>
              </View>

              <Text style={styles.name}>{institution.official_name}</Text>
              <Text style={styles.type}>
                {INSTITUTION_TYPE_LABEL[institution.type]}
                {meta || institution.suburb ? ` • ${[institution.suburb, meta].filter(Boolean).join(", ")}` : ""}
              </Text>
              {institution.description ? <Text style={styles.description}>{institution.description}</Text> : null}

              {activeCount !== null ? (
                <View style={styles.statChip}>
                  <Text style={styles.statChipText}>
                    {activeCount} active listing{activeCount === 1 ? "" : "s"}
                  </Text>
                </View>
              ) : null}
            </View>

            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={INSTITUTION_LISTING_FILTERS}
              keyExtractor={(item) => item.key}
              contentContainerStyle={styles.filterContent}
              renderItem={({ item }) => <Chip label={item.label} active={filter === item.key} onPress={() => setFilter(item.key)} />}
            />

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
        renderItem={({ item }) => (
          <ListingCard listing={item} onPress={() => router.push({ pathname: "/listing/[id]", params: { id: item.id } })} />
        )}
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
    backRow: { paddingHorizontal: space.lg, paddingBottom: space.sm },
    notFoundTitle: { ...font.title, color: color.text },
    header: { paddingHorizontal: space.xl, paddingTop: space.md, paddingBottom: space.lg },
    headerTopRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: space.sm },
    logoWrap: {
      width: 68, height: 68, borderRadius: radius.lg, backgroundColor: color.brand,
      alignItems: "center", justifyContent: "center", overflow: "hidden",
    },
    logo: { width: "100%", height: "100%" },
    logoInitial: { ...font.h2, color: color.textOnBrand },
    postHereButton: {
      backgroundColor: color.gold, paddingHorizontal: space.lg, paddingVertical: space.sm,
      borderRadius: radius.pill, maxWidth: "62%",
    },
    postHereButtonText: { ...font.caption, fontWeight: "800", color: color.textOnBrand },
    name: { ...font.h3, color: color.text, marginTop: space.md },
    type: { ...font.caption, color: color.brand, fontWeight: "700", marginTop: space.xs, textTransform: "uppercase" },
    description: { ...font.body, color: color.text, marginTop: space.md },
    statChip: {
      alignSelf: "flex-start", backgroundColor: color.surfaceAlt, borderWidth: 1, borderColor: color.border,
      borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: space.xs, marginTop: space.md,
    },
    statChipText: { ...font.caption, color: color.text },
    filterContent: { paddingHorizontal: space.lg, gap: space.sm, paddingBottom: space.md },
    gridRow: { paddingHorizontal: space.lg, gap: space.md },
    listContent: { paddingBottom: space.huge },
    footer: { paddingVertical: space.lg, alignItems: "center" },
  });
}
