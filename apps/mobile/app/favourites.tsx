import { useCallback, useEffect, useState } from "react";
import { FlatList, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { publicListingExpiryFilter, type Listing } from "../lib/listings";
import { fetchSavedListingIds, toggleSave } from "../lib/saves";
import { loadCache, saveCache } from "../lib/offlineCache";
import { space, type ColorPalette } from "../lib/theme";
import { useThemedStyles } from "../lib/theme-provider";
import { ListingRow } from "../components/ListingRow";
import { EmptyState, ErrorState, ListSkeleton } from "../components/ui";

const LISTING_COLUMNS =
  "id,seller_id,seller_name,seller_phone,title,description,price,currency,category,province,city,suburb,photos,status,boost,featured_until,expires_at,views,business_id,created_at,updated_at,thumbs:attributes->_thumbs";

// Real backend-backed favourites — reads from user_saves (see lib/saves.ts),
// replacing the earlier client-only stub that always showed empty.
export default function FavouritesScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const styles = useThemedStyles(buildStyles);
  const [listings, setListings] = useState<Listing[]>([]);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session?.user) return;
    setError(null);
    // The last good list is kept on the device, so saved ads still show
    // with no signal (common on the road or when data runs out).
    const cacheKey = `favourites-${session.user.id}`;
    try {
      const ids = await fetchSavedListingIds(session.user.id);
      setSavedIds(ids);
      if (!ids.size) {
        setListings([]);
        saveCache(cacheKey, [] as Listing[]).catch(() => {});
        return;
      }
      const { data, error: queryError } = await supabase
        .from("listings")
        .select(LISTING_COLUMNS)
        .eq("status", "active")
        .or(publicListingExpiryFilter())
        .in("id", Array.from(ids));
      if (queryError) throw queryError;
      const rows = (data as Listing[]) ?? [];
      setListings(rows);
      saveCache(cacheKey, rows).catch(() => {});
    } catch {
      const cached = await loadCache<Listing[]>(cacheKey);
      if (cached) {
        setListings(cached);
        setSavedIds(new Set(cached.map((l) => l.id)));
      } else {
        setError("We couldn't load your saved ads. Check your connection and try again.");
        setListings([]);
      }
    }
  }, [session]);

  useEffect(() => {
    setIsLoading(true);
    load().finally(() => setIsLoading(false));
  }, [load]);

  const onToggleSave = useCallback(
    (listingId: string) => {
      if (!session?.user) return;
      const userId = session.user.id;
      setSavedIds((prev) => {
        const next = new Set(prev);
        next.delete(listingId);
        return next;
      });
      setListings((prev) => prev.filter((l) => l.id !== listingId));
      toggleSave(userId, listingId, true).catch(() => load());
    },
    [session, load]
  );

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={{ padding: space.lg }}>
          <ListSkeleton count={5} />
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <ErrorState onRetry={load} />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      data={listings}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.listContent}
      ItemSeparatorComponent={() => <View style={{ height: space.md }} />}
      ListEmptyComponent={
        <EmptyState
          title="Nothing saved yet"
          subtitle="Tap the heart on any listing to save it here for quick access later."
          buttonLabel="Browse Listings"
          onPressButton={() => router.push("/(tabs)/search")}
        />
      }
      renderItem={({ item }) => (
        <ListingRow
          listing={item}
          saved={savedIds.has(item.id)}
          onToggleSave={() => onToggleSave(item.id)}
          onPress={() =>
            item.category === "jobs"
              ? router.push({ pathname: "/jobs/[id]", params: { id: item.id } })
              : router.push({ pathname: "/listing/[id]", params: { id: item.id } })
          }
        />
      )}
    />
  );
}

function buildStyles(color: ColorPalette) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: color.bg,
    },
    listContent: {
      padding: space.lg,
      flexGrow: 1,
    },
  });
}
