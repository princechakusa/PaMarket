import { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Path } from "react-native-svg";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import { conversationIdFor, isPersonalConversationFor, type ConversationRow } from "../../lib/messages";
import { averageRating, sellerInitials, type PublicProfile, type Review } from "../../lib/sellers";
import { formatPrice, isFeatured, isNew, listingLocation, type Listing } from "../../lib/listings";
import { Avatar, EmptyState, GlassBackButton, ListSkeleton, VerifiedBadge } from "../../components/ui";
import { StarRow } from "../../components/StarRow";
import { color, font, radius, shadow, space, type ColorPalette } from "../../lib/theme";
import { useThemedStyles } from "../../lib/theme-provider";

type FullProfile = PublicProfile & {
  bio: string | null;
  city: string | null;
  created_at: string | null;
};

type BusinessLite = { id: string; name: string | null };

function memberSince(dateString: string | null | undefined): string {
  if (!dateString) return "";
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

function joinedYear(dateString: string | null | undefined): string {
  if (!dateString) return "New";
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return "New";
  return String(d.getFullYear());
}

function listingTag(listing: Listing): string {
  if (isFeatured(listing)) return "Featured";
  if (isNew(listing)) return "New";
  return listing.category ? listing.category.charAt(0).toUpperCase() + listing.category.slice(1) : "Listing";
}

function PinIcon({ size = 17, stroke = color.textMuted }: { size?: number; stroke?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={2.3} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0Z" />
      <Circle cx={12} cy={10} r={3} />
    </Svg>
  );
}

function HeartIcon() {
  return (
    <Svg width={25} height={25} viewBox="0 0 24 24" fill="none" stroke={color.brand} strokeWidth={2.35} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78Z" />
    </Svg>
  );
}

function SellerListingRow({ listing, onPress }: { listing: Listing; onPress: () => void }) {
  const styles = useThemedStyles(buildStyles);
  const photo = listing.photos?.[0];

  return (
    <Pressable style={[styles.listingRow, shadow.md]} onPress={onPress}>
      <View style={styles.rowPhotoWrap}>
        {photo ? (
          <Image source={{ uri: photo }} style={styles.rowPhoto} contentFit="cover" transition={150} cachePolicy="memory-disk" />
        ) : (
          <View style={[styles.rowPhoto, styles.rowPhotoPlaceholder]} />
        )}
        <View style={styles.rowTag}>
          <Text style={styles.rowTagText} numberOfLines={1}>
            {listingTag(listing)}
          </Text>
        </View>
      </View>

      <View style={styles.rowBody}>
        <View style={styles.rowTop}>
          <View style={styles.rowTextBlock}>
            <Text style={styles.rowPrice} numberOfLines={1}>
              {formatPrice(listing)}
            </Text>
            <Text style={styles.rowTitle} numberOfLines={2}>
              {listing.title}
            </Text>
          </View>
          <View style={styles.rowSave}>
            <HeartIcon />
          </View>
        </View>
        <View style={styles.locationRow}>
          <PinIcon />
          <Text style={styles.rowLocation} numberOfLines={1}>
            {listingLocation(listing)}
          </Text>
        </View>
        <View style={styles.rowFooter}>
          <View style={styles.rowDivider} />
          <Text style={styles.viewText}>Tap to view</Text>
        </View>
      </View>
    </Pressable>
  );
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
        .neq("category", "jobs")
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
    const myId = session.user.id;
    const convId = conversationIdFor(session.user.id, id);
    const { data: conversations } = await supabase
      .from("conversations")
      .select("id,members,listing_id,business_id,created_at,updated_at")
      .contains("members", [myId])
      .limit(100);

    const candidates = ((conversations as ConversationRow[]) ?? []).filter((conversation) => isPersonalConversationFor(conversation, myId, id));
    const latestByConversation = new Map<string, string>();

    if (candidates.length) {
      const { data: latestMessages } = await supabase
        .from("messages")
        .select("conversation_id,created_at")
        .in(
          "conversation_id",
          candidates.map((conversation) => conversation.id)
        )
        .order("created_at", { ascending: false })
        .limit(Math.max(candidates.length * 3, 20));

      ((latestMessages as { conversation_id: string; created_at: string }[]) ?? []).forEach((message) => {
        if (!latestByConversation.has(message.conversation_id)) {
          latestByConversation.set(message.conversation_id, message.created_at);
        }
      });
    }

    candidates.sort((a, b) => {
      const aTime = new Date(latestByConversation.get(a.id) || a.updated_at || a.created_at || 0).getTime();
      const bTime = new Date(latestByConversation.get(b.id) || b.updated_at || b.created_at || 0).getTime();
      return bTime - aTime;
    });

    const existing = candidates[0];
    if (existing) {
      const members = Array.isArray(existing.members) ? existing.members : [];
      if (!members.includes(myId) || !members.includes(id)) {
        await supabase.from("conversations").update({ members: [myId, id] }).eq("id", existing.id);
      }
      router.push({ pathname: "/chat/[id]", params: { id: existing.id } });
      return;
    }

    {
      await supabase.from("conversations").upsert({ id: convId, members: [session.user.id, id] });
    }
    router.push({ pathname: "/chat/[id]", params: { id: convId } });
  }

  if (isLoading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <GlassBackButton onPress={() => router.back()} />
        <View style={styles.skeletonWrap}>
          <ListSkeleton count={5} />
        </View>
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <GlassBackButton onPress={() => router.back()} />
        <EmptyState title="Profile not found" subtitle="This user profile doesn't exist or was removed." />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      data={listings}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.content}
      alwaysBounceVertical
      bounces
      decelerationRate="normal"
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={
        <View>
          <View style={styles.hero}>
            <View style={[styles.header, { paddingTop: insets.top + space.sm }]}>
              <GlassBackButton onPress={() => router.back()} tone="light" />
            </View>
            <Text style={styles.headerTitle}>Seller profile</Text>
          </View>

          <View style={[styles.profileCard, shadow.lg]}>
            <View style={styles.avatarShell}>
              <Avatar uri={profile.avatar} name={profile.name} size={96} />
            </View>

            <View style={styles.nameRow}>
              <Text style={styles.name} numberOfLines={1}>
                {profile.name || sellerInitials(profile.name)}
              </Text>
              {profile.verified ? <VerifiedBadge compact /> : null}
            </View>

            {memberSince(profile.created_at) ? <Text style={styles.meta}>Member since {memberSince(profile.created_at)}</Text> : null}
            {profile.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}

            <View style={styles.statsCard}>
              <Pressable style={styles.statItem} onPress={() => router.push({ pathname: "/reviews/[id]", params: { id } })}>
                <Text style={[styles.statValue, styles.statGold]}>{reviews.length ? avgRating.toFixed(1) : "0"}</Text>
                <Text style={styles.statLabel}>{reviews.length ? `${reviews.length} review${reviews.length === 1 ? "" : "s"}` : "No reviews"}</Text>
              </Pressable>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{listings.length}</Text>
                <Text style={styles.statLabel}>active listings</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue} numberOfLines={1}>
                  {profile.city || joinedYear(profile.created_at)}
                </Text>
                <Text style={styles.statLabel}>{profile.city ? "location" : "joined"}</Text>
              </View>
            </View>

            <Pressable style={styles.ratingLine} onPress={() => router.push({ pathname: "/reviews/[id]", params: { id } })}>
              <StarRow rating={avgRating} size={13} />
              <Text style={styles.ratingText}>
                {reviews.length ? `${avgRating.toFixed(1)} from ${reviews.length} review${reviews.length === 1 ? "" : "s"}` : "No reviews yet"}
              </Text>
            </Pressable>

            <View style={styles.actionRow}>
              {!isOwn ? (
                <Pressable style={styles.messageButton} onPress={messageUser}>
                  <Text style={styles.messageButtonText}>Message</Text>
                </Pressable>
              ) : (
                <Pressable style={styles.messageButton} onPress={() => router.push("/edit-profile")}>
                  <Text style={styles.messageButtonText}>Edit profile</Text>
                </Pressable>
              )}
              <Pressable style={styles.reviewsButton} onPress={() => router.push({ pathname: "/reviews/[id]", params: { id } })}>
                <Text style={styles.reviewsButtonText}>Reviews</Text>
              </Pressable>
            </View>

            {business ? (
              <Pressable style={styles.shopLink} onPress={() => router.push({ pathname: "/business/[id]", params: { id: business.id } })}>
                <Text style={styles.shopLinkText}>{`Visit ${business.name || "Shop"} ->`}</Text>
              </Pressable>
            ) : null}
          </View>

          <View style={styles.sectionHeader}>
            <View style={styles.sectionTextBlock}>
              <Text style={styles.sectionTitle}>Available from seller</Text>
              <Text style={styles.sectionSubtitle}>Browse their active PaMarket listings</Text>
            </View>
            {listings.length ? <Text style={styles.countText}>{listings.length} active</Text> : null}
          </View>
        </View>
      }
      ListEmptyComponent={
        <View style={styles.emptyWrap}>
          <EmptyState title="No active listings" subtitle="This user has no listings live right now." />
        </View>
      }
      renderItem={({ item }) => (
        <SellerListingRow listing={item} onPress={() => router.push({ pathname: "/listing/[id]", params: { id: item.id } })} />
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
    content: {
      paddingBottom: space.xxl,
    },
    skeletonWrap: {
      padding: space.lg,
    },
    hero: {
      minHeight: 260,
      backgroundColor: color.brand,
      overflow: "hidden",
    },
    header: {
      paddingHorizontal: space.lg,
      paddingBottom: space.sm,
      zIndex: 2,
    },
    headerTitle: {
      ...font.title,
      position: "absolute",
      top: 54,
      alignSelf: "center",
      color: color.textOnBrand,
    },
    profileCard: {
      marginHorizontal: space.lg,
      marginTop: -74,
      borderRadius: 28,
      backgroundColor: color.surface,
      paddingHorizontal: space.xl,
      paddingTop: 70,
      paddingBottom: space.xl,
      alignItems: "center",
    },
    avatarShell: {
      position: "absolute",
      top: -58,
      width: 116,
      height: 116,
      borderRadius: 58,
      backgroundColor: color.surface,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 6,
      borderColor: color.surface,
      ...shadow.md,
    },
    nameRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: space.sm,
      maxWidth: "100%",
    },
    name: {
      ...font.h1,
      color: color.text,
      flexShrink: 1,
      textAlign: "center",
    },
    meta: {
      ...font.bodyStrong,
      color: color.textSub,
      marginTop: 2,
      textAlign: "center",
    },
    bio: {
      ...font.bodyStrong,
      color: color.textSub,
      textAlign: "center",
      marginTop: space.lg,
    },
    statsCard: {
      width: "100%",
      marginTop: space.xl,
      borderRadius: 22,
      backgroundColor: color.surfaceAlt,
      paddingVertical: space.md,
      paddingHorizontal: space.xs,
      flexDirection: "row",
      alignItems: "center",
    },
    statItem: {
      flex: 1,
      alignItems: "center",
      gap: 2,
    },
    statValue: {
      ...font.h2,
      color: color.brand,
    },
    statGold: {
      color: color.gold,
    },
    statLabel: {
      ...font.caption,
      color: color.textSub,
      textAlign: "center",
    },
    statDivider: {
      width: 1,
      height: 42,
      backgroundColor: color.border,
    },
    ratingLine: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginTop: space.md,
    },
    ratingText: {
      ...font.caption,
      color: color.textMuted,
    },
    actionRow: {
      width: "100%",
      flexDirection: "row",
      gap: space.md,
      marginTop: space.xl,
    },
    messageButton: {
      flex: 1,
      minHeight: 54,
      backgroundColor: color.brand,
      borderRadius: radius.xl,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: space.md,
    },
    messageButtonText: {
      ...font.bodyStrong,
      color: color.textOnBrand,
      fontSize: 16,
    },
    reviewsButton: {
      flex: 1,
      minHeight: 54,
      backgroundColor: color.gold,
      borderRadius: radius.xl,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: space.md,
    },
    reviewsButtonText: {
      ...font.bodyStrong,
      color: color.brandDark,
      fontSize: 16,
    },
    shopLink: {
      marginTop: space.md,
    },
    shopLinkText: {
      ...font.bodyStrong,
      color: color.brand,
    },
    sectionHeader: {
      flexDirection: "row",
      alignItems: "flex-end",
      justifyContent: "space-between",
      gap: space.md,
      paddingHorizontal: space.lg,
      marginTop: space.xxxl,
      marginBottom: space.md,
    },
    sectionTextBlock: {
      flex: 1,
    },
    sectionTitle: {
      ...font.h2,
      color: color.text,
    },
    sectionSubtitle: {
      ...font.sub,
      color: color.textSub,
      marginTop: 2,
      fontWeight: "700",
    },
    countText: {
      ...font.bodyStrong,
      color: color.brand,
      marginBottom: 1,
    },
    emptyWrap: {
      paddingHorizontal: space.lg,
    },
    listingRow: {
      marginHorizontal: space.lg,
      marginBottom: space.md,
      borderRadius: 24,
      backgroundColor: color.surface,
      flexDirection: "row",
      alignItems: "flex-start",
      overflow: "hidden",
    },
    // width + aspectRatio (not width + height:"100%" stretched to match
    // rowBody's variable text height) — previously this had no fixed
    // height at all, so it stretched to whatever height the row's text
    // content produced (1-line vs 2-line titles, etc.), rendering as an
    // inconsistent, sometimes very elongated photo instead of a normal
    // listing thumbnail.
    rowPhotoWrap: {
      width: 142,
      aspectRatio: 1.05,
      backgroundColor: color.surfaceAlt,
      position: "relative",
    },
    rowPhoto: {
      width: "100%",
      height: "100%",
    },
    rowPhotoPlaceholder: {
      backgroundColor: color.skeleton,
    },
    rowTag: {
      position: "absolute",
      top: space.sm,
      left: space.sm,
      maxWidth: 104,
      borderRadius: radius.pill,
      backgroundColor: "rgba(17,24,39,0.58)",
      paddingHorizontal: space.sm,
      paddingVertical: 4,
    },
    rowTagText: {
      ...font.micro,
      color: color.textOnBrand,
    },
    rowBody: {
      flex: 1,
      padding: space.lg,
      gap: space.sm,
    },
    rowTop: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: space.sm,
    },
    rowTextBlock: {
      flex: 1,
      minWidth: 0,
    },
    rowPrice: {
      ...font.h2,
      color: color.brand,
    },
    rowTitle: {
      ...font.title,
      color: color.text,
      marginTop: space.xs,
    },
    rowSave: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: color.surfaceAlt,
      alignItems: "center",
      justifyContent: "center",
    },
    locationRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: space.xs,
      marginTop: "auto",
    },
    rowLocation: {
      ...font.bodyStrong,
      color: color.textMuted,
      flex: 1,
    },
    rowFooter: {
      flexDirection: "row",
      alignItems: "center",
      gap: space.lg,
    },
    rowDivider: {
      flex: 1,
      height: 1,
      backgroundColor: color.border,
    },
    viewText: {
      ...font.caption,
      color: color.goldDark,
    },
  });
}
