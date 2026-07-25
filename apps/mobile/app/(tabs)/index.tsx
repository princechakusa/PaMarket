import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import Svg, { Line } from "react-native-svg";
import { supabase } from "../../lib/supabase";
import { filterListings, isFeatured, type Listing } from "../../lib/listings";
import { CATEGORIES } from "../../lib/constants";
import type { Business } from "../../lib/businesses";
import { fetchActiveAds, type PaidAd } from "../../lib/ads";
import { subscribeToFeedChanges } from "../../lib/realtime-feed";
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
  "id,seller_id,seller_name,seller_phone,title,description,price,currency,category,province,city,suburb,photos,status,boost,featured_until,views,business_id,created_at,updated_at";
const BUSINESS_COLUMNS =
  "id,owner_user_id,name,logo,cover,description,biz_type,category,phone,whatsapp,email,province,city,suburb,status,verification_level,featured_listing_ids,updated_at";

const RAIL_CARD_WIDTH = 160;

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
}: {
  title: string;
  subtitle?: string;
  listings: Listing[];
  savedIds: Set<string>;
  verifiedSellerIds: Set<string>;
  onSeeAll: () => void;
  onPressListing: (listing: Listing) => void;
  onToggleSave: (listing: Listing) => void;
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
            width={RAIL_CARD_WIDTH}
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
  const { session } = useAuth();
  const [listings, setListings] = useState<Listing[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [ads, setAds] = useState<PaidAd[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cityFilter, setCityFilter] = useState("All Zimbabwe");
  const [cityPickerVisible, setCityPickerVisible] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [unreadNotifs, setUnreadNotifs] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  const loadData = useCallback(async () => {
    setError(null);
    const [listingsRes, businessesRes] = await Promise.all([
      supabase
        .from("listings")
        .select(LISTING_COLUMNS)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(120),
      supabase
        .from("businesses")
        .select(BUSINESS_COLUMNS)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    if (listingsRes.error) setError(listingsRes.error.message);
    else setListings((listingsRes.data as Listing[]) ?? []);

    if (!businessesRes.error) setBusinesses((businessesRes.data as Business[]) ?? []);

    fetchActiveAds().then(setAds);

    if (session?.user) {
      const [notifRes, msgRes] = await Promise.all([
        supabase
          .from("notifications")
          .select("id", { count: "exact", head: true })
          .eq("user_id", session.user.id)
          .eq("read", false)
          .neq("type", "message")
          .or("category.is.null,category.neq.rental"),
        supabase.from("messages").select("id", { count: "exact", head: true }).eq("read", false).neq("sender_id", session.user.id),
      ]);
      setUnreadNotifs(notifRes.count ?? 0);
      setUnreadMessages(msgRes.count ?? 0);
      fetchSavedListingIds(session.user.id).then(setSavedIds);
    }
  }, [session]);

  useEffect(() => {
    setIsLoading(true);
    loadData().finally(() => setIsLoading(false));
  }, [loadData]);

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

  const recent = useMemo(() => filtered.slice(0, 12), [filtered]);

  const nearCity = useMemo(() => {
    if (cityFilter === "All Zimbabwe") return [];
    return filtered.slice(0, 12);
  }, [filtered, cityFilter]);

  const categorySections = useMemo(() => {
    return CATEGORIES.filter((c) => c.id !== "jobs")
      .map((cat) => ({
        ...cat,
        items: filtered.filter((l) => l.category === cat.id).slice(0, 10),
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
        onPressCity={() => setCityPickerVisible(true)}
      />
      <CityPicker
        visible={cityPickerVisible}
        selected={cityFilter}
        onSelect={setCityFilter}
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
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={color.brand} />}
        showsVerticalScrollIndicator={false}
      >
        {error ? (
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
              onSeeAll={() => router.push("/(tabs)/search")}
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
      paddingBottom: space.xxl,
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
