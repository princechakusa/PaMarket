import { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Polyline } from "react-native-svg";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import { conversationIdFor } from "../../lib/messages";
import { averageRating, sellerInitials, type PublicProfile, type Review } from "../../lib/sellers";
import { formatPrice, type Listing } from "../../lib/listings";
import { Avatar, EmptyState, ListSkeleton, VerifiedBadge } from "../../components/ui";
import { ListingCard } from "../../components/ListingCard";
import { StarRow } from "../../components/StarRow";
import { font, radius, space, type ColorPalette } from "../../lib/theme";
import { useThemedStyles } from "../../lib/theme-provider";

type FullProfile = PublicProfile & {
  bio: string | null;
  city: string | null;
  created_at: string | null;
};

type BusinessLite = { id: string; name: string | null };

function BackIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.4}>
      <Polyline points="15 18 9 12 15 6" />
    </Svg>
  );
}

function memberSince(dateString: string | null | undefined): string {
  if (!dateString) return "";
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

export default function UserProfileScreen() {
  const styles = useThemedStyles(buildStyles);
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const insets = useSafeAreaInsets();

  const [profile, setProfile] = useState<FullProfile | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [business, setBusiness] = useState<BusinessLite | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isOwn = session?.user?.id === id;

  const load = useCallback(async () => {
    if (!id) return;
    const [profileRes, reviewsRes, listingsRes, businessRes] = await Promise.all([
      supabase.from("profiles_public").select("id,name,avatar,verified,bio,city,created_at").eq("id", id).maybeSingle(),
      supabase.from("reviews").select("reviewer_id,rating,created_at").eq("seller_id", id).limit(200),
      supabase
        .from("listings")
        .select("id,seller_id,seller_name,title,price,currency,category,province,city,suburb,photos,status,boost,featured_until,created_at")
        .eq("seller_id", id)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(30),
      supabase.from("businesses").select("id,name").eq("owner_user_id", id).maybeSingle(),
    ]);
    setProfile((profileRes.data as FullProfile) ?? null);
    setReviews((reviewsRes.data as Review[]) ?? []);
    setListings((listingsRes.data as Listing[]) ?? []);
    setBusiness((businessRes.data as BusinessLite) ?? null);
  }, [id]);

  useEffect(() => {
    setIsLoading(true);
    load().finally(() => setIsLoading(false));
  }, [load]);

  const avgRating = averageRating(reviews);

  async function messageUser() {
    if (!session?.user || !id) {
      router.push("/(auth)/sign-in");
      return;
    }
    const convId = conversationIdFor(session.user.id, id);
    const { data: existing } = await supabase.from("conversations").select("id").eq("id", convId).maybeSingle();
    if (!existing) {
      await supabase.from("conversations").upsert({ id: convId, members: [session.user.id, id] });
    }
    router.push({ pathname: "/chat/[id]", params: { id: convId } });
  }

  if (isLoading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={{ padding: space.lg }}>
          <ListSkeleton count={5} />
        </View>
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtnAlone}>
          <BackIcon color={styles.backIconColor.color} />
        </Pressable>
        <EmptyState title="Profile not found" subtitle="This user profile doesn't exist or was removed." />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      data={listings}
      keyExtractor={(item) => item.id}
      numColumns={2}
      columnWrapperStyle={styles.gridRow}
      contentContainerStyle={{ paddingBottom: space.xxl }}
      ListHeaderComponent={
        <View>
          <View style={[styles.header, { paddingTop: insets.top + space.sm }]}>
            <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
              <BackIcon color={styles.backIconColor.color} />
            </Pressable>
          </View>

          <View style={styles.identity}>
            <Avatar uri={profile.avatar} name={profile.name} size={84} />
            <View style={styles.nameRow}>
              <Text style={styles.name} numberOfLines={1}>
                {profile.name || sellerInitials(profile.name)}
              </Text>
              {profile.verified ? <VerifiedBadge compact /> : null}
            </View>
            {profile.city ? <Text style={styles.meta}>{profile.city}</Text> : null}
            {memberSince(profile.created_at) ? (
              <Text style={styles.meta}>Member since {memberSince(profile.created_at)}</Text>
            ) : null}

            <Pressable style={styles.ratingRow} onPress={() => router.push({ pathname: "/reviews/[id]", params: { id } })}>
              <StarRow rating={avgRating} />
              <Text style={styles.ratingText}>
                {reviews.length ? `${avgRating.toFixed(1)} (${reviews.length} review${reviews.length === 1 ? "" : "s"})` : "No reviews yet"}
              </Text>
            </Pressable>

            {profile.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}

            {!isOwn ? (
              <Pressable style={styles.messageButton} onPress={messageUser}>
                <Text style={styles.messageButtonText}>Message</Text>
              </Pressable>
            ) : null}

            {business ? (
              <Pressable style={styles.shopLink} onPress={() => router.push({ pathname: "/business/[id]", params: { id: business.id } })}>
                <Text style={styles.shopLinkText}>Visit {business.name || "Shop"} →</Text>
              </Pressable>
            ) : null}
          </View>

          <Text style={styles.sectionTitle}>
            {listings.length ? `Listings (${listings.length})` : "Listings"}
          </Text>
        </View>
      }
      ListEmptyComponent={
        <View style={{ paddingHorizontal: space.lg }}>
          <EmptyState title="No active listings" subtitle="This user has no listings live right now." />
        </View>
      }
      renderItem={({ item }) => (
        <View style={styles.gridItem}>
          <ListingCard
            listing={item}
            onPress={() => router.push({ pathname: "/listing/[id]", params: { id: item.id } })}
          />
        </View>
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
    header: {
      paddingHorizontal: space.lg,
      paddingBottom: space.sm,
    },
    backBtn: {
      width: 36,
      height: 36,
      alignItems: "center",
      justifyContent: "center",
    },
    backBtnAlone: {
      width: 36,
      height: 36,
      alignItems: "center",
      justifyContent: "center",
      marginLeft: space.md,
      marginTop: space.sm,
    },
    backIconColor: {
      color: color.text,
    },
    identity: {
      alignItems: "center",
      paddingHorizontal: space.lg,
      paddingBottom: space.lg,
      gap: 4,
    },
    nameRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: space.sm,
      marginTop: space.md,
    },
    name: {
      ...font.h2,
      color: color.text,
    },
    meta: {
      ...font.sub,
      color: color.textMuted,
    },
    ratingRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginTop: space.sm,
    },
    ratingText: {
      ...font.caption,
      color: color.textMuted,
    },
    bio: {
      ...font.body,
      color: color.textSub,
      textAlign: "center",
      marginTop: space.md,
    },
    messageButton: {
      marginTop: space.lg,
      backgroundColor: color.brand,
      borderRadius: radius.lg,
      paddingHorizontal: space.xxl,
      paddingVertical: space.sm + 4,
    },
    messageButtonText: {
      ...font.bodyStrong,
      color: color.textOnBrand,
    },
    shopLink: {
      marginTop: space.md,
    },
    shopLinkText: {
      ...font.bodyStrong,
      color: color.brand,
    },
    sectionTitle: {
      ...font.h3,
      color: color.text,
      paddingHorizontal: space.lg,
      marginBottom: space.md,
    },
    gridRow: {
      paddingHorizontal: space.lg,
      gap: space.md,
    },
    gridItem: {
      flex: 1,
      marginBottom: space.md,
    },
  });
}
