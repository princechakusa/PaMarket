import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as SecureStore from "expo-secure-store";
import Svg, { Line } from "react-native-svg";
import { supabase } from "../../lib/supabase";
import { filterListings, isFeatured, type Listing } from "../../lib/listings";
import { CATEGORIES } from "../../lib/constants";
import type { Business } from "../../lib/businesses";
import { fetchActiveAds, type PaidAd } from "../../lib/ads";
import { subscribeToFeedChanges } from "../../lib/realtime-feed";
import { loadCache, saveCache } from "../../lib/offlineCache";

type HomeCache = { listings: Listing[]; businesses: Business[]; ads: PaidAd[] };
const HOME_CACHE_KEY = "home-feed";
import { useAuth } from "../../lib/auth";
import { fetchSavedListingIds, toggleSave } from "../../lib/saves";
import { HomeHeader } from "../../components/home/HomeHeader";
import { CityPicker } from "../../components/home/CityPicker";
import { CategoryGrid } from "../../components/home/CategoryGrid";
import { ShopsRail } from "../../components/home/ShopsRail";
import { CategoryRail } from "../../components/home/CategoryRail";
import { AdCarousel } from "../../components/home/AdCarousel";
import { ListingCard } from "../../components/ListingCard";
import {
  Button,
  EmptyState,
  ErrorState,
  ListingCardSkeleton,
  ListSkeleton,
  SectionHeader,
  Skeleton,
} from "../../components/ui";
import { color, radius, space, type ColorPalette } from "../../lib/theme";
import { useThemedStyles } from "../../lib/theme-provider";

const LISTING_COLUMNS =
  "id,seller_id,title,price,currency,category,province,city,suburb,photos,status,boost,featured_until,business_id,created_at";
const BUSINESS_COLUMNS =
  "id,owner_user_id,name,logo,category,province,city,status,verification_level";

const RAIL_CARD_WIDTH = 160;
const RAIL_CARD_WIDTH_COMPACT = 122;
const CITY_STORAGE_KEY = "pamarket.home-city-filter";

// Horizontal rail of ListingCards with a SectionHeader — used for Featured,
// Recently posted, and Near-<city> sections.
function ListingRail({
  title,
  subtitle,
  listings,
  savedIds,
  verifiedSellerIds,
  onSeeAll,
  onPressListing,
  onToggleSave,
  compact,
}: {
  title: string;
  subtitle?: string;
  listings: Listing[];
  savedIds: Set<string>;
  verifiedSellerIds: Set<string>;
  onSeeAll: () => void;
  onPressListing: (listing: Listing) => void;
  onToggleSave: (listing: Listing) => void;
  // Recently Posted was reported as "too big" next to the other rails —
  // opt this rail into the same compact ListingCard size CategoryRail's
  // "Latest in X" sections already use, without touching Featured/Near-City.
  compact?: boolean;
}) {
  const styles = useThemedStyles(buildStyles);
  if (!listings.length) return null;
  return (
    <View style={styles.railSection}>
      <SectionHeader title={title} subtitle={subtitle} actionLabel="See all" onAction={onSeeAll} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
        {listings.map((listing) => (
          <ListingCard
            key={listing.id}
            listing={listing}
            width={compact ? RAIL_CARD_WIDTH_COMPACT : RAIL_CARD_WIDTH}
            compact={compact}
            saved={savedIds.has(listing.id)}
            onToggleSave={() => onToggleSave(listing)}
            verified={verifiedSellerIds.has(listing.seller_id)}
            onPress={() => onPressListing(listing)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

function HomeSkeleton() {
  const styles = useThemedStyles(buildStyles);
  return (
    <View style={styles.skeletonWrap}>
      <Skeleton height={90} radius={radius.lg} />
      <View style={styles.skeletonRail}>
        <ListingCardSkeleton />
        <ListingCardSkeleton />
      </View>
      <ListSkeleton count={3} />
    </View>
  );
}

export default function HomeScreen() {
  const styles = useThemedStyles(buildStyles);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const [listings, setListings] = useState<Listing[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [ads, setAds] = useState<PaidAd[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showingCached, setShowingCached] = useState(false);
  const [cityFilter, setCityFilter] = useState("All Zimbabwe");
  const [cityPickerVisible, setCityPickerVisible] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [unreadNotifs, setUnreadNotifs] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  // Persist the selected city across app restarts, same SecureStore pattern
  // as lib/theme-provider.tsx's theme preference.
  useEffect(() => {
    SecureStore.getItemAsync(CITY_STORAGE_KEY).then((stored) => {
      if (stored) setCityFilter(stored);
    }).catch(() => {});
  }, []);

  function selectCity(city: string) {
    setCityFilter(city);
    SecureStore.setItemAsync(CITY_STORAGE_KEY, city).catch(() => {});
  }

  const loadData = useCallback(async () => {
    setError(null);
    const listingsRequest = supabase
      .from("listings")
      .select(LISTING_COLUMNS)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(60)
      .then((result) => result);
    const businessesRequest = supabase
      .from("businesses")
      .select(BUSINESS_COLUMNS)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(20)
      .then((result) => result);

    const listingsRes = await listingsRequest;

    let freshListings: Listing[] | null = null;
    if (listingsRes.error) setError(listingsRes.error.message);
    else {
      freshListings = (listingsRes.data as Listing[]) ?? [];
      setListings(freshListings);
      setShowingCached(false);
    }
    // The marketplace can render as soon as its core listing feed arrives.
    // A slower shops/count request must not keep the entire home page behind
    // a loading skeleton.
    setIsLoading(false);

    const businessesRes = await businessesRequest;
    let freshBusinesses: Business[] | null = null;
    if (!businessesRes.error) {
      freshBusinesses = (businessesRes.data as Business[]) ?? [];
      setBusinesses(freshBusinesses);
    }

    const freshAds = await fetchActiveAds();
    setAds(freshAds);

    // Only overwrite the on-disk snapshot once every part of this load
    // succeeded — a partial/failed load must never stomp a good cache.
    if (freshListings && freshBusinesses) {
      saveCache<HomeCache>(HOME_CACHE_KEY, { listings: freshListings, businesses: freshBusinesses, ads: freshAds });
    }

    // Unread notification/message counts are handled entirely by the
    // useFocusEffect below (fires on this same initial mount too) --
    // fetching them here as well just fired the same two count queries
    // twice back to back on every first visit.
    if (session?.user) {
      fetchSavedListingIds(session.user.id).then(setSavedIds);
    }
  }, [session]);

  useEffect(() => {
    setIsLoading(true);
    let cancelled = false;
    // Hydrate from the last successful load immediately — if the network
    // call below fails (no connection), this is what stays on screen
    // instead of an empty/error state. Overwritten the moment fresh data
    // arrives, so it's never shown alongside outdated data unknowingly.
    loadCache<HomeCache>(HOME_CACHE_KEY).then((cached) => {
      if (cancelled || !cached) return;
      setListings((current) => (current.length ? current : cached.listings));
      setBusinesses((current) => (current.length ? current : cached.businesses));
      setAds((current) => (current.length ? current : cached.ads));
      setShowingCached(true);
      setIsLoading(false);
    });
    loadData().finally(() => setIsLoading(false));
    return () => {
      cancelled = true;
    };
  }, [loadData]);

  // The notification/message badge counts were only ever fetched once on
  // mount (inside loadData) — reading your messages elsewhere and coming
  // back to Home left this screen showing a stale count until the whole
  // app remounted. Refresh just these two lightweight counts on every
  // focus instead of the full listings/businesses/ads load.
  useFocusEffect(
    useCallback(() => {
      if (!session?.user) return;
      supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", session.user.id)
        .eq("read", false)
        .neq("type", "message")
        .or("category.is.null,category.neq.rental")
        .then(({ count }) => setUnreadNotifs(count ?? 0), () => {});
      supabase
        .rpc("get_unread_message_count")
        .then(({ data }) => setUnreadMessages(data ?? 0), () => {});
    }, [session])
  );

  useEffect(() => {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const unsubscribe = subscribeToFeedChanges(() => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => loadData(), 800);
    });
    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      unsubscribe();
    };
  }, [loadData]);

  async function onRefresh() {
    setIsRefreshing(true);
    await loadData();
    setIsRefreshing(false);
  }

  const onToggleSave = useCallback(
    (listing: Listing) => {
      if (!session?.user) {
        router.push("/(tabs)/profile");
        return;
      }
      const userId = session.user.id;
      const currentlySaved = savedIds.has(listing.id);
      // Optimistic update.
      setSavedIds((prev) => {
        const next = new Set(prev);
        if (currentlySaved) next.delete(listing.id);
        else next.add(listing.id);
        return next;
      });
      toggleSave(userId, listing.id, currentlySaved).catch(() => {
        // Roll back on failure.
        setSavedIds((prev) => {
          const next = new Set(prev);
          if (currentlySaved) next.add(listing.id);
          else next.delete(listing.id);
          return next;
        });
      });
    },
    [session, savedIds, router]
  );

  const activeNonJobListings = useMemo(
    () => listings.filter((l) => l.status === "active" && (l.category || "").toLowerCase() !== "jobs"),
    [listings]
  );

  const verifiedSellerIds = useMemo(() => {
    const ids = new Set<string>();
    for (const b of businesses) {
      if ((b.verification_level ?? 0) >= 2) ids.add(b.owner_user_id);
    }
    return ids;
  }, [businesses]);

  const filtered = useMemo(
    () => filterListings(activeNonJobListings, { cityFilter }),
    [activeNonJobListings, cityFilter]
  );

  const featured = useMemo(() => filtered.filter(isFeatured).slice(0, 12), [filtered]);

  const recent = useMemo(() => {
    const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
    return filtered.filter((l) => new Date(l.created_at).getTime() >= dayAgo).slice(0, 12);
  }, [filtered]);

  const nearCity = useMemo(() => {
    if (cityFilter === "All Zimbabwe") return [];
    return filtered.slice(0, 12);
  }, [filtered, cityFilter]);

  const categorySections = useMemo(() => {
    return CATEGORIES.filter((c) => c.id !== "jobs")
      .map((cat) => ({
        ...cat,
        items: filtered.filter((l) => l.category === cat.id).slice(0, 6),
      }))
      .filter((section) => section.items.length > 0);
  }, [filtered]);

  const hasAnyContent = filtered.length > 0 || businesses.length > 0;

  function openListing(listing: Listing) {
    router.push({ pathname: "/listing/[id]", params: { id: listing.id } });
  }

  function openCategory(categoryId: string) {
    if (categoryId === "jobs") {
      router.push("/jobs");
      return;
    }
    router.push({ pathname: "/(tabs)/search", params: { category: categoryId } });
  }

  function submitSearch() {
    const q = searchValue.trim();
    if (!q) return;
    router.push({ pathname: "/(tabs)/search", params: { query: q } });
  }

  const header = (
    <>
      <HomeHeader
        cityFilter={cityFilter}
        unreadNotifs={unreadNotifs}
        unreadMessages={unreadMessages}
        searchValue={searchValue}
        onChangeSearch={setSearchValue}
        onSubmitSearch={submitSearch}
        onPressNotifications={() => router.push("/notifications")}
        onPressMessages={() => router.push("/(tabs)/messages")}
        onPressCity={() => setCityPickerVisible((v) => !v)}
      />
      <CityPicker
        visible={cityPickerVisible}
        selected={cityFilter}
        onSelect={selectCity}
        onClose={() => setCityPickerVisible(false)}
      />
    </>
  );

  if (isLoading) {
    return (
      <View style={styles.container}>
        {header}
        <HomeSkeleton />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {header}

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 64 + insets.bottom + space.xxxl }]}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={color.brand} />}
        showsVerticalScrollIndicator={false}
      >
        {error && !hasAnyContent ? (
          <ErrorState subtitle={error} onRetry={onRefresh} />
        ) : !hasAnyContent ? (
          <EmptyState
            title="Nothing here yet"
            subtitle="Be the first to post an ad in your area and reach buyers across Zimbabwe."
            buttonLabel="Post a Free Ad"
            onPressButton={() => router.push("/(tabs)/post")}
          />
        ) : (
          <>
            {error ? (
              <View style={styles.offlineBanner}>
                <Text style={styles.offlineBannerText}>
                  {showingCached ? "You're offline — showing your last saved listings." : "Couldn't refresh — showing what we last loaded."}
                </Text>
              </View>
            ) : null}
            <CategoryGrid onSelectCategory={openCategory} onSeeAll={() => router.push("/(tabs)/search")} />

            <AdCarousel ads={ads} />

            <ListingRail
              title="Featured"
              subtitle="Promoted listings"
              listings={featured}
              savedIds={savedIds}
              verifiedSellerIds={verifiedSellerIds}
              onSeeAll={() => router.push("/(tabs)/search")}
              onPressListing={openListing}
              onToggleSave={onToggleSave}
            />

            {nearCity.length ? (
              <ListingRail
                title={`Near ${cityFilter}`}
                subtitle="Listings close to you"
                listings={nearCity}
                savedIds={savedIds}
                verifiedSellerIds={verifiedSellerIds}
                onSeeAll={() => router.push("/(tabs)/search")}
                onPressListing={openListing}
                onToggleSave={onToggleSave}
              />
            ) : null}

            <ShopsRail
              businesses={businesses}
              listings={listings}
              onPressShop={(b) => router.push({ pathname: "/business/[id]", params: { id: b.id } })}
              onSeeAll={() => router.push("/shops")}
            />

            <ListingRail
              title="Recently Posted"
              subtitle="Fresh from sellers"
              listings={recent}
              savedIds={savedIds}
              verifiedSellerIds={verifiedSellerIds}
              onSeeAll={() => router.push("/(tabs)/search")}
              onPressListing={openListing}
              onToggleSave={onToggleSave}
              compact
            />

            <View style={styles.ctaWrap}>
              <Button
                label="Post a Free Ad"
                variant="gold"
                size="lg"
                onPress={() => router.push("/(tabs)/post")}
                icon={
                  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={color.textOnBrand} strokeWidth={2.5}>
                    <Line x1={12} y1={5} x2={12} y2={19} />
                    <Line x1={5} y1={12} x2={19} y2={12} />
                  </Svg>
                }
              />
            </View>

            {categorySections.map((section) => (
              <CategoryRail
                key={section.id}
                title={`Latest in ${section.name}`}
                listings={section.items}
                savedIds={savedIds}
                verifiedSellerIds={verifiedSellerIds}
                onSeeAll={() => openCategory(section.id)}
                onPressListing={openListing}
                onToggleSave={onToggleSave}
              />
            ))}

            <View style={styles.footerSpacer} />
          </>
        )}
      </ScrollView>
    </View>
  );
}

function buildStyles(color: ColorPalette) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: color.bg,
    },
    scrollContent: {
      paddingTop: space.sm,
    },
    railSection: {
      marginBottom: space.xl,
    },
    rail: {
      paddingHorizontal: space.lg,
      gap: space.md,
    },
    ctaWrap: {
      paddingHorizontal: space.lg,
      marginBottom: space.xl,
    },
    offlineBanner: {
      marginHorizontal: space.lg,
      marginBottom: space.lg,
      backgroundColor: color.goldTint,
      borderRadius: radius.md,
      padding: space.md,
    },
    offlineBannerText: {
      fontSize: 12.5,
      fontWeight: "600",
      color: color.text,
    },
    skeletonWrap: {
      padding: space.lg,
      gap: space.lg,
    },
    skeletonRail: {
      flexDirection: "row",
      gap: space.md,
    },
    footerSpacer: {
      height: space.sm,
    },
  });
}
