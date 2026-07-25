import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../lib/auth";
import { BRAND_BLUE } from "../lib/constants";
import { deleteSavedSearch, fetchSavedSearches, type SavedSearch } from "../lib/saved-searches";
import { EmptyState } from "../components/ui/EmptyState";

function timeAgo(iso: string) {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// Mirrors www/js/browse.js pages.SavedSearches.
export default function SavedSearchesScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const [searches, setSearches] = useState<SavedSearch[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    if (!session?.user) return;
    setSearches(await fetchSavedSearches(session.user.id));
  }, [session]);

  useEffect(() => {
    setIsLoading(true);
    load().finally(() => setIsLoading(false));
  }, [load]);

  function runSearch(s: SavedSearch) {
    router.push({
      pathname: "/(tabs)/search",
      params: { category: s.category ?? undefined, query: s.query ?? undefined },
    });
  }

  function confirmDelete(s: SavedSearch) {
    Alert.alert("Delete saved search", undefined, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          setSearches((prev) => prev.filter((x) => x.id !== s.id));
          await deleteSavedSearch(s.id);
        },
      },
    ]);
  }

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={BRAND_BLUE} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 14, paddingBottom: 40 }}>
      {searches.length ? (
        searches.map((s) => (
          <View key={s.id} style={styles.row}>
            <Pressable style={styles.rowMain} onPress={() => runSearch(s)}>
              <Text style={styles.rowTitle} numberOfLines={1}>
                {s.name}
              </Text>
              <Text style={styles.rowSub}>
                {s.category ? `${s.category} · ` : ""}Saved {timeAgo(s.saved_at)}
              </Text>
            </Pressable>
            <Pressable style={styles.searchButton} onPress={() => runSearch(s)}>
              <Text style={styles.searchButtonText}>Search</Text>
            </Pressable>
            <Pressable style={styles.deleteButton} onPress={() => confirmDelete(s)} hitSlop={8}>
              <Text style={styles.deleteButtonText}>✕</Text>
            </Pressable>
          </View>
        ))
      ) : (
        <EmptyState
          title="No saved searches yet"
          subtitle="On the Search screen, search for something and tap Save to find it here quickly."
          buttonLabel="Browse Listings"
          onPressButton={() => router.push("/(tabs)/search")}
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F6F9" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#ffffff",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
  },
  rowMain: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 14, fontWeight: "700", color: "#111827" },
  rowSub: { fontSize: 12, color: "#8A93A6", marginTop: 1 },
  searchButton: { backgroundColor: BRAND_BLUE, borderRadius: 9, paddingHorizontal: 13, paddingVertical: 8 },
  searchButtonText: { color: "#ffffff", fontSize: 12, fontWeight: "700" },
  deleteButton: { padding: 6 },
  deleteButtonText: { color: "#EF4444", fontSize: 16 },
});
