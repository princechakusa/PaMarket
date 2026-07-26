import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { formatPrice, type Listing } from "../lib/listings";
import { listingStatus } from "../lib/safety";
import type { ColorPalette } from "../lib/theme";
import { useThemedStyles } from "../lib/theme-provider";

const LISTING_COLUMNS =
  "id,seller_id,seller_name,seller_phone,title,description,price,currency,category,province,city,suburb,photos,status,boost,featured_until,views,business_id,created_at,updated_at";

function timeAgo(dateString: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

export default function MyListingsScreen() {
  const styles = useThemedStyles(buildStyles);
  const tones = useThemedStyles(buildTones);
  const { session } = useAuth();
  const router = useRouter();
  const [listings, setListings] = useState<Listing[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    if (!session?.user) return;
    const { data } = await supabase
      .from("listings")
      .select(LISTING_COLUMNS)
      .eq("seller_id", session.user.id)
      .order("created_at", { ascending: false });
    setListings((data as Listing[]) ?? []);
  }, [session]);

  useEffect(() => {
    setIsLoading(true);
    load().finally(() => setIsLoading(false));
  }, [load]);

  function confirmDelete(listing: Listing) {
    Alert.alert("Delete listing", `Remove "${listing.title}"? This cannot be undone.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await supabase.from("listings").delete().eq("id", listing.id);
          setListings((prev) => prev.filter((l) => l.id !== listing.id));
        },
      },
    ]);
  }

  async function setStatus(listingId: string, status: "active" | "paused" | "sold") {
    const previous = listings;
    setListings((prev) => prev.map((l) => (l.id === listingId ? { ...l, status } : l)));
    const { error } = await supabase.from("listings").update({ status }).eq("id", listingId);
    if (error) {
      setListings(previous);
      Alert.alert("Couldn't update listing", error.message);
    }
  }

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={tones.brand} />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      data={listings}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.listContent}
      ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
      ListEmptyComponent={
        <View style={styles.centered}>
          <Text style={styles.emptyTitle}>No listings yet</Text>
          <Text style={styles.emptyText}>Your posted ads will appear here.</Text>
          <Pressable style={styles.postButton} onPress={() => router.push("/(tabs)/post")}>
            <Text style={styles.postButtonText}>Post an Ad</Text>
          </Pressable>
        </View>
      }
      renderItem={({ item }) => (
        <View style={styles.card}>
          <Pressable
            style={styles.cardBody}
            onPress={() => router.push({ pathname: "/listing/[id]", params: { id: item.id } })}
          >
            {item.photos?.[0] ? (
              <Image source={{ uri: item.photos[0] }} style={styles.thumb} contentFit="cover" transition={150} cachePolicy="memory-disk" />
            ) : (
              <View style={[styles.thumb, styles.thumbPlaceholder]} />
            )}
            <View style={styles.info}>
              <Text style={styles.title} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={styles.price}>{formatPrice(item)}</Text>
              <View style={styles.metaRow}>
                <View style={[styles.statusPill, { backgroundColor: listingStatus(item.status).bg }]}>
                  <Text style={[styles.statusPillText, { color: listingStatus(item.status).color }]}>
                    {listingStatus(item.status).label}
                  </Text>
                </View>
                <Text style={styles.metaText}>
                  {item.views ?? 0} views · {timeAgo(item.created_at)}
                </Text>
              </View>
            </View>
          </Pressable>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.actions}>
            <Pressable
              style={styles.actionButton}
              onPress={() => router.push({ pathname: "/listing/[id]", params: { id: item.id } })}
            >
              <Text style={styles.actionText}>View</Text>
            </Pressable>
            <Pressable
              style={styles.actionButton}
              onPress={() => router.push({ pathname: "/listing/edit/[id]", params: { id: item.id } })}
            >
              <Text style={styles.actionText}>Edit</Text>
            </Pressable>
            {item.status === "active" ? (
              <Pressable style={styles.actionButton} onPress={() => setStatus(item.id, "paused")}>
                <Text style={styles.actionText}>Pause</Text>
              </Pressable>
            ) : null}
            {item.status === "paused" ? (
              <Pressable style={styles.actionButton} onPress={() => setStatus(item.id, "active")}>
                <Text style={styles.actionText}>Reactivate</Text>
              </Pressable>
            ) : null}
            {item.status === "active" || item.status === "paused" ? (
              <Pressable style={styles.actionButton} onPress={() => setStatus(item.id, "sold")}>
                <Text style={styles.actionText}>Mark sold</Text>
              </Pressable>
            ) : null}
            {item.status === "sold" ? (
              <Pressable style={styles.actionButton} onPress={() => setStatus(item.id, "active")}>
                <Text style={styles.actionText}>Relist</Text>
              </Pressable>
            ) : null}
            {item.status === "active" ? (
              <Pressable style={[styles.actionButton, styles.actionButtonDanger]} onPress={() => confirmDelete(item)}>
                <Text style={[styles.actionText, styles.actionTextDanger]}>Delete</Text>
              </Pressable>
            ) : null}
          </ScrollView>
        </View>
      )}
    />
  );
}

function buildTones(color: ColorPalette) {
  return { brand: color.brand };
}

function buildStyles(color: ColorPalette) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: color.bg,
    },
    centered: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingTop: 80,
      paddingHorizontal: 32,
    },
    listContent: {
      padding: 16,
    },
    emptyTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: color.text,
      marginBottom: 6,
    },
    emptyText: {
      fontSize: 13,
      color: color.textMuted,
      textAlign: "center",
      marginBottom: 16,
    },
    postButton: {
      backgroundColor: color.brand,
      borderRadius: 10,
      paddingHorizontal: 20,
      paddingVertical: 12,
    },
    postButtonText: {
      color: color.textOnBrand,
      fontSize: 14,
      fontWeight: "700",
    },
    card: {
      backgroundColor: color.surface,
      borderRadius: 12,
      overflow: "hidden",
    },
    cardBody: {
      flexDirection: "row",
    },
    thumb: {
      width: 88,
      height: 88,
    },
    thumbPlaceholder: {
      backgroundColor: color.skeleton,
    },
    info: {
      flex: 1,
      padding: 12,
      gap: 4,
    },
    title: {
      fontSize: 14,
      fontWeight: "600",
      color: color.text,
    },
    price: {
      fontSize: 15,
      fontWeight: "800",
      color: color.brand,
    },
    metaRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    statusPill: {
      borderRadius: 6,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    statusPillText: {
      fontSize: 10,
      fontWeight: "700",
      color: "#ffffff",
      textTransform: "capitalize",
    },
    metaText: {
      fontSize: 11,
      color: color.textMuted,
    },
    actions: {
      flexDirection: "row",
      gap: 8,
      padding: 12,
      paddingTop: 0,
    },
    actionButton: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: color.surfaceAlt,
    },
    actionButtonDanger: {
      backgroundColor: color.dangerTint,
    },
    actionText: {
      fontSize: 12,
      fontWeight: "700",
      color: color.text,
    },
    actionTextDanger: {
      color: color.danger,
    },
  });
}
