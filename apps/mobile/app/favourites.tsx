import { useCallback, useEffect, useState } from "react";
import { FlatList, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { publicListingExpiryFilter, type Listing } from "../lib/listings";
import { fetchSavedListingIds, toggleSave } from "../lib/saves";
import { space, type ColorPalette } from "../lib/theme";
import { useThemedStyles } from "../lib/theme-provider";
import { ListingRow } from "../components/ListingRow";
import { EmptyState, ErrorState, ListSkeleton } from "../components/ui";

const LISTING_COLUMNS =
  "id,seller_id,seller_name,seller_phone,title,description,price,currency,category,province,city,suburb,photos,status,boost,featured_until,expires_at,views,business_id,created_at,updated_at";

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
    const ids = await fetchSavedListingIds(session.user.id);
    setSavedIds(ids);
    if (!ids.size) {
      setListings([]);
      return;
    }
    const { data, error: queryError } = await supabase
      .from("listings")
      .select(LISTING_COLUMNS)
      .eq("status", "active")
      .or(publicListingExpiryFilter())
      .in("id", Array.from(ids));
    if (queryError) {
      setError(queryError.message);
      setListings([]);
      return;
    }
    setListings((data as Listing[]) ?? []);
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
