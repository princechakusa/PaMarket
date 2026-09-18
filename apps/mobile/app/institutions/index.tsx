import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Line, Path } from "react-native-svg";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import { color, font, radius, space, type ColorPalette } from "../../lib/theme";
import { useThemedStyles } from "../../lib/theme-provider";
import { useTaxonomy } from "../../lib/taxonomy";
import {
  INSTITUTION_TYPE_LABEL,
  INSTITUTION_VISIBILITY_ATTR_KEY,
  type Institution,
  type InstitutionType,
} from "../../lib/institutions";
import { publicListingExpiryFilter, type Listing, type SortMode } from "../../lib/listings";
import { padGridFiller } from "../../lib/listing-grid";
import { fetchSavedListingIds, toggleSave } from "../../lib/saves";
import { ListingCard } from "../../components/ListingCard";
import { EmptyState, ErrorState } from "../../components/ui";
import { useIOSNativeHeader } from "../../lib/useIOSNativeHeader";

// Redesigned per the approved Stitch mock (bright, student-facing palette,
// distinct from the app's brand green -- deliberately scoped to this one
// screen, not a global theme change). Camera/voice search icons from the
// mock were deliberately dropped -- neither has a real backend, and per
// product decision this screen never presents a control with no real
// behaviour behind it. "Campus Picks" reuses the real, already-built
// ListingCard (Phase 3's "no new listing-card implementation" rule) rather
// than the mock's bespoke card treatment -- the fabricated tags in that mock
// ("Student Deal", "Bundled", "Like New") aren't real listing fields, so
// they were not carried over; ListingCard's own real save/heart button is
// used as-is instead of rebuilding one.
const TYPE_META: Record<InstitutionType, { label: string; color: string; badgeBg: string }> = {
  university: { label: "University", color: "#1E56D0", badgeBg: "rgba(255,255,255,0.28)" },
  high_school: { label: "High School", color: "#B8185B", badgeBg: "rgba(255,255,255,0.28)" },
  organization: { label: "Org", color: "#92400E", badgeBg: "rgba(255,255,255,0.28)" },
};
// Derived from the real InstitutionType source of truth (lib/institutions.ts)
// rather than a second hand-typed literal tuple -- was previously written
// out twice in this same file.
const INSTITUTION_TYPES = Object.keys(INSTITUTION_TYPE_LABEL) as InstitutionType[];
const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "price_asc", label: "Price: Low to High" },
  { value: "price_desc", label: "Price: High to Low" },
  { value: "views", label: "Trending" },
];
const LOCATION_ACTIVE = "#2563EB";
const CTA_BG = "#1E293B";
const SAFETY_TIPS = [
  "Meet in public campus spots & verify before you pay",
  "Never send money before seeing the item in person",
  "Report anything suspicious from the listing page",
];
const PICKS_PAGE_SIZE = 20;
const LISTING_COLUMNS =
  "id,seller_id,seller_name,seller_phone,title,description,price,currency,category,province,city,suburb,latitude,longitude,photos,status,boost,featured_until,expires_at,views,business_id,institution_id,is_orderable,attributes,created_at,updated_at";

type InstRow = Institution & { provinces: { name: string } | { name: string }[]; cities: { name: string } | { name: string }[] };
function resolveName(v: { name: string } | { name: string }[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0]?.name : v?.name;
}

function GradCapIcon({ color: c }: { color: string }) {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2}>
      <Path d="M12 14l9-5-9-5-9 5 9 5z" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M12 14l6.16-3.42a12.08 12.08 0 01.665 6.48A11.95 11.95 0 0012 20.05a11.95 11.95 0 00-6.82-3 12.08 12.08 0 01.665-6.48L12 14z" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function PinIcon({ color: c, size = 12 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2}>
      <Path d="M17.66 16.66L13.41 20.9a2 2 0 01-2.83 0l-4.24-4.24a8 8 0 1111.32 0z" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function ChevronDownIcon() {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={color.text} strokeWidth={2.2}>
      <Path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export default function InstitutionsDirectoryScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const insets = useSafeAreaInsets();
  const styles = useThemedStyles(buildStyles);
  const { provinces, citiesByProvince } = useTaxonomy();

  useIOSNativeHeader({ backgroundColor: color.bg, tintColor: color.text, title: "", androidNative: true });

  const [typeCounts, setTypeCounts] = useState<Record<InstitutionType, number>>({ university: 0, high_school: 0, organization: 0 });
  const [typeFilter, setTypeFilter] = useState<InstitutionType | "all">("all");
  const [locationFilter, setLocationFilter] = useState<string>(provinces[0] ?? "");
  const [query, setQuery] = useState("");

  const [institutions, setInstitutions] = useState<InstRow[]>([]);
  const institutionIds = useMemo(() => institutions.map((i) => i.id), [institutions]);

  const [listings, setListings] = useState<Listing[]>([]);
  const [isLoadingListings, setIsLoadingListings] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [listingsError, setListingsError] = useState(false);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const pageRef = useRef(0);
  const [tipIndex, setTipIndex] = useState(0);
  const [sort, setSort] = useState<SortMode>("newest");
  const [sortOpen, setSortOpen] = useState(false);

  useEffect(() => {
    if (!locationFilter && provinces.length) setLocationFilter(provinces[0]);
  }, [provinces, locationFilter]);

  useEffect(() => {
    const timer = setInterval(() => setTipIndex((i) => (i + 1) % SAFETY_TIPS.length), 6000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!session?.user) { setSavedIds(new Set()); return; }
    fetchSavedListingIds(session.user.id).then(setSavedIds).catch(() => {});
  }, [session?.user?.id]);

  // Real per-type counts (active institutions only) for the badges -- three
  // small head:true count queries; the institutions table is tens of rows,
  // not a scale that justifies a dedicated aggregate RPC.
  useEffect(() => {
    INSTITUTION_TYPES.forEach((t) => {
      supabase.from("institutions").select("*", { count: "exact", head: true }).eq("is_active", true).eq("type", t)
        .then(({ count }) => setTypeCounts((prev) => ({ ...prev, [t]: count ?? 0 })));
    });
  }, []);

  // Institution chips row -- filtered by the selected location + type, and
  // by search. Tapping a chip navigates to /institutions/[id] (Phase 3) --
  // the full institution page (logo, description, "Post here", the fixed
  // category filters) -- rather than filtering in place here, so that page
  // stays the single place "view one institution" is actually built.
  useEffect(() => {
    let q = supabase
      .from("institutions")
      .select("id,type,official_name,short_name,search_aliases,province_id,city_id,suburb,logo_url,description,is_active,sort_order,provinces!inner(name),cities!inner(name)")
      .eq("is_active", true);
    if (locationFilter) q = q.eq("provinces.name", locationFilter);
    if (typeFilter !== "all") q = q.eq("type", typeFilter);
    const trimmed = query.trim();
    if (trimmed) q = q.or(`official_name.ilike.%${trimmed}%,short_name.ilike.%${trimmed}%,search_aliases.cs.{${trimmed}}`);
    q.order("sort_order", { ascending: true }).limit(20).then(({ data }) => {
      setInstitutions((data as InstRow[]) ?? []);
    });
  }, [locationFilter, typeFilter, query]);

  const buildListingsQuery = useCallback(
    (from: number, to: number) => {
      let q = supabase.from("listings").select(LISTING_COLUMNS).eq("status", "active").or(publicListingExpiryFilter());
      // Institution-only listings (Phase 4) never surface in this general
      // picks feed, same exclusion as Home/Search -- explicit is-null/neq OR,
      // not a bare not-equal, so an ordinary listing with no
      // institution_visibility key at all isn't silently dropped.
      q = q.or(
        `attributes->>${INSTITUTION_VISIBILITY_ATTR_KEY}.is.null,attributes->>${INSTITUTION_VISIBILITY_ATTR_KEY}.neq.institution_only`
      );
      // General discovery feed, not one institution's page -- that's what
      // /institutions/[id] is for (full info, "Post here", the fixed
      // category filters). Scoped to whichever institutions currently match
      // the type/location chips above, so the feed still narrows as you
      // filter, without duplicating the detail screen's job.
      if (institutionIds.length > 0) q = q.in("institution_id", institutionIds);
      else q = q.not("institution_id", "is", null);
      if (sort === "price_asc") q = q.order("price", { ascending: true });
      else if (sort === "price_desc") q = q.order("price", { ascending: false });
      else if (sort === "views") q = q.order("views", { ascending: false });
      else q = q.order("created_at", { ascending: false });
      return q.range(from, to);
    },
    [institutionIds, sort]
  );

  const loadListings = useCallback(async () => {
    setListingsError(false);
    pageRef.current = 0;
    const { data, error } = await buildListingsQuery(0, PICKS_PAGE_SIZE - 1);
    if (error) { setListingsError(true); return; }
    const page = (data as Listing[]) ?? [];
    setListings(page);
    setHasMore(page.length === PICKS_PAGE_SIZE);
  }, [buildListingsQuery]);

  useEffect(() => {
    setIsLoadingListings(true);
    loadListings().finally(() => setIsLoadingListings(false));
  }, [loadListings]);

  const loadMoreListings = useCallback(async () => {
    if (isLoadingMore || isLoadingListings || !hasMore || listingsError) return;
    setIsLoadingMore(true);
    const nextPage = pageRef.current + 1;
    const from = nextPage * PICKS_PAGE_SIZE;
    const { data, error } = await buildListingsQuery(from, from + PICKS_PAGE_SIZE - 1);
    if (!error) {
      const page = (data as Listing[]) ?? [];
      pageRef.current = nextPage;
      setListings((prev) => {
        const existingIds = new Set(prev.map((l) => l.id));
        return [...prev, ...page.filter((l) => !existingIds.has(l.id))];
      });
      setHasMore(page.length === PICKS_PAGE_SIZE);
    }
    setIsLoadingMore(false);
  }, [buildListingsQuery, hasMore, isLoadingListings, isLoadingMore, listingsError]);

  async function onToggleSaveListing(listing: Listing) {
    if (!session?.user) { router.push("/(auth)/sign-in"); return; }
    const wasSaved = savedIds.has(listing.id);
    setSavedIds((prev) => {
      const next = new Set(prev);
      wasSaved ? next.delete(listing.id) : next.add(listing.id);
      return next;
    });
    await toggleSave(session.user.id, listing.id, wasSaved).catch(() => {
      setSavedIds((prev) => {
        const next = new Set(prev);
        wasSaved ? next.add(listing.id) : next.delete(listing.id);
        return next;
      });
    });
  }

  const typeOptions = INSTITUTION_TYPES;

  return (
    <View style={styles.container}>
      {/* Rendered outside the FlatList (not inside ListHeaderComponent) so it
          stays fixed at the top instead of scrolling away with the rest of
          the header content (type/location filter pills, institution list,
          Campus Picks) -- the simplest, lowest-risk way to make just this
          block "sticky" without touching the FlatList's own virtualization
          or introducing stickyHeaderIndices against a header built from
          several nested horizontal FlatLists. */}
      <View style={styles.titleBlock}>
        <Text style={styles.h1}>Institutions</Text>
        <Text style={styles.subtitle}>Find your campus or organization.</Text>
      </View>

      <FlatList
        data={padGridFiller(listings, 2)}
        keyExtractor={(item, index) => item?.id ?? `filler-${index}`}
        numColumns={2}
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 58 + insets.bottom + space.xxl }]}
        renderItem={({ item }) =>
          item ? (
            <ListingCard
              listing={item}
              saved={savedIds.has(item.id)}
              onToggleSave={() => void onToggleSaveListing(item)}
              onPress={() => router.push({ pathname: "/listing/[id]", params: { id: item.id } })}
            />
          ) : (
            <View style={{ flex: 1 }} />
          )
        }
        ListEmptyComponent={
          !isLoadingListings && !listingsError ? (
            <EmptyState title="No listings yet" subtitle="Institution-tagged listings will appear here." />
          ) : null
        }
        onEndReached={loadMoreListings}
        onEndReachedThreshold={0.5}
        ListFooterComponent={isLoadingMore ? <View style={styles.footer}><ActivityIndicator color={LOCATION_ACTIVE} /></View> : null}
        ListHeaderComponent={
          <>
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={typeOptions}
              keyExtractor={(t) => t}
              contentContainerStyle={styles.pillRow}
              renderItem={({ item: t }) => {
                const meta = TYPE_META[t];
                const active = typeFilter === t;
                return (
                  <Pressable
                    style={[styles.typePill, { backgroundColor: active ? meta.color : color.surfaceAlt }]}
                    onPress={() => setTypeFilter(active ? "all" : t)}
                  >
                    <GradCapIcon color={active ? "#fff" : meta.color} />
                    <Text style={[styles.typePillLabel, { color: active ? "#fff" : color.text }]}>{meta.label}</Text>
                    <View style={[styles.countBadge, { backgroundColor: active ? "rgba(255,255,255,0.3)" : meta.color }]}>
                      <Text style={styles.countBadgeText}>{typeCounts[t]}</Text>
                    </View>
                  </Pressable>
                );
              }}
            />

            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={provinces}
              keyExtractor={(p) => p}
              contentContainerStyle={styles.pillRow}
              renderItem={({ item: p }) => {
                const active = locationFilter === p;
                return (
                  <Pressable style={[styles.locationPill, active && styles.locationPillActive]} onPress={() => setLocationFilter(p)}>
                    <PinIcon color={active ? "#fff" : color.textMuted} />
                    <Text style={[styles.locationPillLabel, active && styles.locationPillLabelActive]}>{p}</Text>
                  </Pressable>
                );
              }}
            />

            {institutions.length > 0 ? (
              <FlatList
                horizontal
                showsHorizontalScrollIndicator={false}
                data={institutions}
                keyExtractor={(i) => i.id}
                contentContainerStyle={styles.pillRow}
                renderItem={({ item, index }) => {
                  const tint = index % 2 === 0 ? styles.instChipBlue : styles.instChipPurple;
                  return (
                    <Pressable
                      style={[styles.instChip, tint]}
                      onPress={() => router.push({ pathname: "/institutions/[id]", params: { id: item.id } })}
                    >
                      <Text style={styles.instChipLabel} numberOfLines={1}>
                        {item.short_name ? `${item.official_name} (${item.short_name})` : item.official_name}
                      </Text>
                    </Pressable>
                  );
                }}
              />
            ) : null}

            <View style={styles.searchBar}>
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={LOCATION_ACTIVE} strokeWidth={2}>
                <Circle cx={11} cy={11} r={8} />
                <Line x1={21} y1={21} x2={16.65} y2={16.65} />
              </Svg>
              <TextInput
                style={styles.searchInput}
                value={query}
                onChangeText={setQuery}
                placeholder="Search institutions, universities…"
                placeholderTextColor={color.textMuted}
                returnKeyType="search"
              />
            </View>

            <View style={styles.safetyBanner}>
              <View style={styles.safetyIconWrap}>
                <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={LOCATION_ACTIVE} strokeWidth={2.5}>
                  <Path d="M9 12l2 2 4-4m5.62-4.02A11.96 11.96 0 0112 2.94a11.96 11.96 0 01-8.62 3.04A12.02 12.02 0 003 9c0 5.59 3.82 10.29 9 11.62 5.18-1.33 9-6.03 9-11.62 0-1.04-.13-2.05-.38-3.02z" strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              </View>
              <Text style={styles.safetyText} numberOfLines={1}>
                <Text style={styles.safetyLabel}>Safety Tip: </Text>
                {SAFETY_TIPS[tipIndex]}
              </Text>
              <View style={styles.dotsRow}>
                {SAFETY_TIPS.map((_, i) => (
                  <View key={i} style={[styles.dot, i === tipIndex && styles.dotActive]} />
                ))}
              </View>
            </View>

            <Pressable style={styles.ctaCard} onPress={() => router.push("/business-onboarding")}>
              <View style={styles.ctaLeft}>
                <Text style={styles.ctaEyebrow}>CAMPUS LEADERS</Text>
                <Text style={styles.ctaHeadline}>Run a Student Org or Club?</Text>
                <Text style={styles.ctaSub}>Get verified & list items directly to your members</Text>
              </View>
              <View style={styles.ctaButton}>
                <Text style={styles.ctaButtonText}>Register →</Text>
              </View>
            </Pressable>

            <View style={styles.picksHeader}>
              <View style={styles.picksHeaderLeft}>
                <Text style={styles.picksTitle}>Campus Picks</Text>
                <View style={styles.picksCountPill}>
                  <Text style={styles.picksCountText}>{listings.length} items</Text>
                </View>
              </View>
              <Pressable style={styles.sortPill} onPress={() => setSortOpen(true)}>
                <Text style={styles.sortPillText}>
                  Sort: {SORT_OPTIONS.find((o) => o.value === sort)?.label ?? "Newest"}
                </Text>
                <ChevronDownIcon />
              </Pressable>
            </View>

            {isLoadingListings ? <ActivityIndicator color={LOCATION_ACTIVE} style={{ marginTop: space.lg }} /> : null}
            {!isLoadingListings && listingsError ? <ErrorState onRetry={() => void loadListings()} /> : null}
          </>
        }
      />

      <Modal visible={sortOpen} transparent animationType="fade" onRequestClose={() => setSortOpen(false)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setSortOpen(false)}>
          <Pressable style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]} onPress={() => {}}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Sort Campus Picks by</Text>
            {SORT_OPTIONS.map((opt) => (
              <Pressable
                key={opt.value}
                style={styles.sortRow}
                onPress={() => {
                  setSort(opt.value);
                  setSortOpen(false);
                }}
              >
                <Text style={[styles.sortRowText, opt.value === sort && styles.sortRowTextActive]}>{opt.label}</Text>
                {opt.value === sort ? (
                  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={LOCATION_ACTIVE} strokeWidth={2.5}>
                    <Path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
                ) : null}
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function buildStyles(color: ColorPalette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: color.bg },
    backRow: { paddingHorizontal: space.lg, paddingBottom: space.xs },
    scrollContent: { paddingHorizontal: space.lg, paddingBottom: space.huge },
    titleBlock: { paddingTop: space.sm, paddingHorizontal: space.lg, marginBottom: space.md },
    h1: { ...font.h1, color: color.text },
    subtitle: { ...font.body, color: color.textMuted, fontWeight: "600", marginTop: 2 },
    pillRow: { gap: space.sm, paddingBottom: space.sm },
    typePill: { flexDirection: "row", alignItems: "center", gap: 7, paddingLeft: 13, paddingRight: 8, paddingVertical: 9, borderRadius: radius.pill },
    typePillLabel: { ...font.caption, fontWeight: "800" },
    countBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: radius.pill },
    countBadgeText: { fontSize: 10.5, fontWeight: "800", color: "#fff" },
    locationPill: {
      flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 13, paddingVertical: 8, borderRadius: radius.pill,
      backgroundColor: color.surface, borderWidth: 1, borderColor: color.border,
    },
    locationPillActive: { backgroundColor: LOCATION_ACTIVE, borderColor: LOCATION_ACTIVE },
    locationPillLabel: { ...font.caption, fontWeight: "700", color: color.text },
    locationPillLabelActive: { color: "#fff" },
    instChip: { paddingHorizontal: 13, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1, maxWidth: 220 },
    instChipBlue: { backgroundColor: "rgba(37,99,235,0.08)", borderColor: "rgba(37,99,235,0.35)" },
    instChipPurple: { backgroundColor: "rgba(126,34,206,0.08)", borderColor: "rgba(126,34,206,0.35)" },
    instChipLabel: { ...font.caption, fontWeight: "700", color: color.text },
    searchBar: {
      flexDirection: "row", alignItems: "center", gap: space.sm, backgroundColor: color.surface,
      borderWidth: 1, borderColor: color.border, borderRadius: radius.lg, paddingHorizontal: space.md, height: 46, marginTop: space.xs,
    },
    searchInput: { flex: 1, ...font.body, color: color.text, paddingVertical: 0 },
    safetyBanner: {
      flexDirection: "row", alignItems: "center", gap: space.sm, backgroundColor: "rgba(37,99,235,0.08)",
      borderWidth: 1, borderColor: "rgba(37,99,235,0.18)", borderRadius: radius.lg, padding: space.sm, marginTop: space.md,
    },
    safetyIconWrap: { width: 28, height: 28, borderRadius: radius.md, backgroundColor: "rgba(37,99,235,0.14)", alignItems: "center", justifyContent: "center" },
    safetyText: { flex: 1, ...font.caption, color: color.text },
    safetyLabel: { color: LOCATION_ACTIVE, fontWeight: "800" },
    dotsRow: { flexDirection: "row", gap: 4 },
    dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: "rgba(37,99,235,0.3)" },
    dotActive: { backgroundColor: LOCATION_ACTIVE },
    ctaCard: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.md, backgroundColor: CTA_BG, borderRadius: radius.xl, padding: space.lg, marginTop: space.md },
    ctaLeft: { flex: 1, gap: 3 },
    ctaEyebrow: { fontSize: 10.5, fontWeight: "800", color: "#F59E0B", letterSpacing: 0.8 },
    ctaHeadline: { ...font.title, color: "#fff" },
    ctaSub: { fontSize: 11, color: "rgba(255,255,255,0.7)", fontWeight: "500" },
    ctaButton: { backgroundColor: "#fff", borderRadius: radius.pill, paddingHorizontal: space.lg, paddingVertical: 11 },
    ctaButtonText: { ...font.caption, fontWeight: "800", color: CTA_BG },
    picksHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: space.xl, marginBottom: space.md },
    picksHeaderLeft: { flexDirection: "row", alignItems: "center", gap: space.sm, flexShrink: 1 },
    picksTitle: { ...font.h3, color: color.text, flexShrink: 1 },
    picksCountPill: { backgroundColor: "rgba(37,99,235,0.1)", borderWidth: 1, borderColor: "rgba(37,99,235,0.25)", borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 3 },
    picksCountText: { fontSize: 10.5, fontWeight: "800", color: LOCATION_ACTIVE },
    sortPill: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: color.surface, borderWidth: 1, borderColor: color.border, borderRadius: radius.pill, paddingHorizontal: 11, paddingVertical: 7 },

    sheetBackdrop: { flex: 1, backgroundColor: color.overlay, justifyContent: "flex-end" },
    sheet: { backgroundColor: color.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, paddingHorizontal: space.lg, paddingTop: space.md },
    sheetHandle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: color.borderStrong, marginBottom: space.md },
    sheetTitle: { ...font.h3, color: color.text, marginBottom: space.sm },
    sortRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: color.divider },
    sortRowText: { ...font.body, color: color.text },
    sortRowTextActive: { color: LOCATION_ACTIVE, fontWeight: "700" },
    sortPillText: { ...font.caption, fontWeight: "700", color: color.text },
    gridRow: { gap: space.md },
    footer: { paddingVertical: space.lg, alignItems: "center" },
  });
}
