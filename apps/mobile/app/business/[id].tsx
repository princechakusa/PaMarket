import { useCallback, useEffect, useMemo, useState } from "react";
import { openWhatsApp } from "../../lib/open-url";
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import { CATEGORIES } from "../../lib/constants";
import type { Business } from "../../lib/businesses";
import { businessInitials } from "../../lib/businesses";
import { recordShopLead, type LeadType } from "../../lib/business-leads";
import { formatPrice, type Listing } from "../../lib/listings";
import { averageRating } from "../../lib/sellers";
import { StarRow } from "../../components/StarRow";
import { space, type ColorPalette } from "../../lib/theme";
import { useThemedStyles } from "../../lib/theme-provider";
import { Card, GlassBackButton, VerifiedBadge } from "../../components/ui";
import { useIOSNativeHeader } from "../../lib/useIOSNativeHeader";

const LISTING_COLUMNS =
  "id,seller_id,seller_name,seller_phone,title,description,price,currency,category,province,city,suburb,photos,status,boost,featured_until,views,business_id,created_at,updated_at";

export default function BusinessShopScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const insets = useSafeAreaInsets();
  const styles = useThemedStyles(buildStyles);
  const tones = useThemedStyles(buildTones);

  const [business, setBusiness] = useState<Business | null>(null);
  const [products, setProducts] = useState<Listing[]>([]);
  const [reviews, setReviews] = useState<{ rating: number }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [followerCount, setFollowerCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);

  useIOSNativeHeader({
    backgroundColor: tones.brand,
    tintColor: tones.textOnBrand,
    title: business?.name || "Shop",
    headerRight:
      business && (business.verification_level ?? 0) >= 2
        ? () => (
            <View style={styles.verifiedPill}>
              <Text style={styles.verifiedPillText}>Verified</Text>
            </View>
          )
        : undefined,
  });

  const load = useCallback(async () => {
    if (!id) return;
    const myId = session?.user?.id;
    const businessRes = await supabase
      .from("businesses")
      .select(
        "id,owner_user_id,name,logo,cover,description,biz_type,category,phone,whatsapp,email,province,city,suburb,status,verification_level,featured_listing_ids,updated_at"
      )
      .eq("id", id)
      .maybeSingle();
    const [productsRes, reviewsRes, followerCountRes, myFollowRes] = await Promise.all([
      // Only listings actually assigned to this shop (business_id) belong to
      // its catalog — matches the legacy web app's storefront logic. A
      // fallback to the owner's personal seller_id here was leaking that
      // person's unrelated personal listings into the shop's product grid.
      supabase
        .from("listings")
        .select(LISTING_COLUMNS)
        .eq("business_id", id)
        .eq("status", "active")
        .neq("category", "jobs"),
      supabase.from("business_reviews").select("rating").eq("business_id", id),
      supabase.from("business_followers").select("user_id", { count: "exact", head: true }).eq("business_id", id),
      myId
        ? supabase.from("business_followers").select("user_id").eq("business_id", id).eq("user_id", myId).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    if (businessRes.data) setBusiness(businessRes.data as Business);
    setProducts((productsRes.data as Listing[]) ?? []);
    setReviews((reviewsRes.data as { rating: number }[]) ?? []);
    setFollowerCount(followerCountRes.count ?? 0);
    setIsFollowing(!!myFollowRes.data);
  }, [id, session?.user?.id]);

  useEffect(() => {
    setIsLoading(true);
    load().finally(() => setIsLoading(false));
  }, [load]);

  const isOwner = session?.user?.id === business?.owner_user_id;
  const avgRating = useMemo(() => averageRating(reviews.map((r) => ({ reviewer_id: "", rating: r.rating, created_at: "" }))), [reviews]);

  const categoryChips = useMemo(() => {
    const cats = new Set(products.map((p) => p.category).filter(Boolean) as string[]);
    return Array.from(cats).map((id) => ({ id, name: CATEGORIES.find((c) => c.id === id)?.name ?? id }));
  }, [products]);

  const filteredProducts = activeCategory ? products.filter((p) => p.category === activeCategory) : products;

  async function toggleFollow() {
    if (!session?.user || !business) {
      router.push("/(auth)/sign-in");
      return;
    }
    if (followBusy) return;
    setFollowBusy(true);
    const wasFollowing = isFollowing;
    setIsFollowing(!wasFollowing);
    setFollowerCount((c) => Math.max(0, c + (wasFollowing ? -1 : 1)));
    const query = wasFollowing
      ? supabase.from("business_followers").delete().eq("business_id", business.id).eq("user_id", session.user.id)
      : supabase
          .from("business_followers")
          .upsert({ business_id: business.id, user_id: session.user.id }, { onConflict: "business_id,user_id", ignoreDuplicates: true });
    const { error } = await query;
    if (error) {
      setIsFollowing(wasFollowing);
      setFollowerCount((c) => Math.max(0, c + (wasFollowing ? 1 : -1)));
    }
    setFollowBusy(false);
  }

  async function messageShop() {
    if (!session?.user || !business) {
      router.push("/(auth)/sign-in");
      return;
    }
    if (isOwner) return;
    await captureShopLead("chat");
    const convId = `biz_${business.id.slice(-8)}_${session.user.id.slice(-6)}`;
    const { data: existing } = await supabase.from("conversations").select("id").eq("id", convId).maybeSingle();
    if (!existing) {
      await supabase.from("conversations").upsert({
        id: convId,
        members: [session.user.id, business.owner_user_id],
        listing_id: null,
        business_id: business.id,
      });
    }
    router.push({
      pathname: "/chat/[id]",
      params: { id: convId, name: business.name || "", avatar: business.logo ?? "" },
    });
  }

  async function captureShopLead(type: LeadType) {
    if (!business) return;
    const userName =
      (session?.user?.user_metadata?.name as string | undefined) ||
      (session?.user?.user_metadata?.full_name as string | undefined) ||
      session?.user?.email ||
      "Guest";
    try {
      await recordShopLead(business.id, type, session?.user?.id ?? null, userName);
    } catch (e) {
      console.warn("shop lead capture:", e);
    }
  }

  async function callShop() {
    if (!business?.phone) return;
    await captureShopLead("call");
    Linking.openURL(`tel:${business.phone}`);
  }

  async function whatsappShop() {
    if (!business?.whatsapp) return;
    await captureShopLead("whatsapp");
    const digits = business.whatsapp.replace(/[^0-9]/g, "");
    openWhatsApp(digits);
  }

  if (isLoading) {
    return (
      <View style={styles.container}>
        {Platform.OS !== "ios" ? (
          <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
            <GlassBackButton onPress={() => router.back()} tone="light" flat />
          </View>
        ) : null}
        <View style={styles.centered}>
          <ActivityIndicator color={tones.brand} />
        </View>
      </View>
    );
  }

  if (!business) {
    return (
      <View style={styles.container}>
        {Platform.OS !== "ios" ? (
          <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
            <GlassBackButton onPress={() => router.back()} tone="light" flat />
          </View>
        ) : null}
        <View style={styles.centered}>
          <Text style={styles.notFoundTitle}>Shop not found</Text>
        </View>
      </View>
    );
  }

  const isVerified = (business.verification_level ?? 0) >= 2;

  return (
    <View style={styles.container}>
      {Platform.OS !== "ios" ? (
        <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
          <GlassBackButton onPress={() => router.back()} tone="light" flat />
          <Text style={styles.headerTitle} numberOfLines={1}>
            {business.name}
          </Text>
          {isVerified ? (
            <View style={styles.verifiedPill}>
              <Text style={styles.verifiedPillText}>Verified</Text>
            </View>
          ) : (
            <View style={{ width: 60 }} />
          )}
        </View>
      ) : null}

      <ScrollView contentContainerStyle={{ paddingBottom: isOwner ? 24 : 90 }}>
        <View style={styles.cover}>
          {business.cover ? (
            <Image source={{ uri: business.cover }} style={styles.coverImage} contentFit="cover" transition={150} cachePolicy="memory-disk" />
          ) : null}
        </View>

        <Card style={styles.identity} elevated>
          <View style={styles.logoWrap}>
            {business.logo ? (
              <Image source={{ uri: business.logo }} style={styles.logo} contentFit="cover" cachePolicy="memory-disk" />
            ) : (
              <Text style={styles.logoInitial}>{businessInitials(business.name)}</Text>
            )}
          </View>

          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>
              {business.name}
            </Text>
            {isVerified ? <VerifiedBadge /> : null}
          </View>
          {business.city || business.province ? (
            <Text style={styles.location}>{[business.city, business.province].filter(Boolean).join(", ")}</Text>
          ) : null}

          {business.description ? <Text style={styles.description}>{business.description}</Text> : null}

          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{products.length}</Text>
              <Text style={styles.statLabel}>{products.length === 1 ? "Item" : "Items"}</Text>
            </View>
            <View style={styles.statDivider} />
            <Pressable
              style={styles.statBox}
              onPress={() => router.push({ pathname: "/reviews/[id]", params: { id: business.id, type: "business" } })}
            >
              <Text style={styles.statValue}>{reviews.length ? avgRating.toFixed(1) : "—"}</Text>
              <Text style={styles.statLabel}>{reviews.length ? `${reviews.length} rating${reviews.length === 1 ? "" : "s"}` : "No ratings"}</Text>
            </Pressable>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{followerCount}</Text>
              <Text style={styles.statLabel}>{followerCount === 1 ? "Follower" : "Followers"}</Text>
            </View>
          </View>

          <View style={styles.contactRow}>
            {business.phone ? (
              <Pressable style={styles.contactPill} onPress={callShop}>
                <Text style={styles.contactPillText}>Call</Text>
              </Pressable>
            ) : null}
            {business.whatsapp ? (
              <Pressable
                style={[styles.contactPill, styles.contactPillWhatsapp]}
                onPress={whatsappShop}
              >
                <Text style={styles.contactPillText}>WhatsApp</Text>
              </Pressable>
            ) : null}
            {!isOwner ? (
              <Pressable
                style={[styles.contactPill, isFollowing ? styles.contactPillFollowing : styles.contactPillFollow]}
                onPress={toggleFollow}
              >
                <Text
                  style={[
                    styles.contactPillText,
                    isFollowing ? styles.contactPillFollowingText : styles.contactPillFollowText,
                  ]}
                >
                  {isFollowing ? "Following" : "Follow"}
                </Text>
              </Pressable>
            ) : null}
            {isOwner ? (
              <Pressable
                style={[styles.contactPill, styles.contactPillMessage]}
                onPress={() => router.push(`/business-manage/${business.id}`)}
              >
                <Text style={styles.contactPillText}>Manage Shop</Text>
              </Pressable>
            ) : null}
          </View>
        </Card>

        <Card style={styles.reviewsCard} elevated>
          <View style={styles.reviewsHeaderRow}>
            <View>
              <Text style={styles.reviewsTitle}>Reviews</Text>
              {reviews.length ? (
                <View style={styles.reviewsSummaryRow}>
                  <StarRow rating={avgRating} />
                  <Text style={styles.reviewsSummaryText}>
                    {avgRating.toFixed(1)} ({reviews.length})
                  </Text>
                </View>
              ) : (
                <Text style={styles.reviewsSummaryText}>No reviews yet</Text>
              )}
            </View>
            {!isOwner ? (
              <Pressable
                style={styles.writeReviewButton}
                onPress={() => router.push({ pathname: "/reviews/[id]", params: { id: business.id, type: "business" } })}
              >
                <Text style={styles.writeReviewButtonText}>Write a Review</Text>
              </Pressable>
            ) : (
              <Pressable
                style={styles.seeReviewsButton}
                onPress={() => router.push({ pathname: "/reviews/[id]", params: { id: business.id, type: "business" } })}
              >
                <Text style={styles.seeReviewsButtonText}>See all</Text>
              </Pressable>
            )}
          </View>
        </Card>

        {categoryChips.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryChips}>
            <Pressable
              style={[styles.categoryChip, !activeCategory && styles.categoryChipActive]}
              onPress={() => setActiveCategory(null)}
            >
              <Text style={[styles.categoryChipText, !activeCategory && styles.categoryChipTextActive]}>All</Text>
            </Pressable>
            {categoryChips.map((c) => (
              <Pressable
                key={c.id}
                style={[styles.categoryChip, activeCategory === c.id && styles.categoryChipActive]}
                onPress={() => setActiveCategory(c.id)}
              >
                <Text style={[styles.categoryChipText, activeCategory === c.id && styles.categoryChipTextActive]}>
                  {c.name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}

        <Text style={styles.resultCount}>Showing {filteredProducts.length} items</Text>

        <View style={styles.productGrid}>
          {filteredProducts.map((product) => (
            <Pressable
              key={product.id}
              style={styles.productCard}
              onPress={() => router.push({ pathname: "/listing/[id]", params: { id: product.id } })}
            >
              <View style={styles.productPhotoWrap}>
                {product.photos?.[0] ? (
                  <Image source={{ uri: product.photos[0] }} style={styles.productPhoto} contentFit="cover" cachePolicy="memory-disk" />
                ) : (
                  <View style={[styles.productPhoto, styles.productPhotoPlaceholder]} />
                )}
              </View>
              <Text style={styles.productPrice}>{formatPrice(product)}</Text>
              <Text style={styles.productTitle} numberOfLines={2}>
                {product.title}
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      {!isOwner ? (
        <View style={styles.ctaBar}>
          <Pressable style={styles.ctaButton} onPress={messageShop}>
            <Text style={styles.ctaButtonText}>Message This Shop</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.ctaBar}>
          <Pressable
            style={styles.ctaButton}
            onPress={() => router.push({ pathname: "/business-listings/[id]", params: { id: business.id } })}
          >
            <Text style={styles.ctaButtonText}>Manage Listings</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function buildTones(color: ColorPalette) {
  return { brand: color.brand, textOnBrand: color.textOnBrand };
}

function buildStyles(color: ColorPalette) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: color.surface,
    },
    centered: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    notFoundTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: color.text,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      backgroundColor: color.brand,
      paddingHorizontal: 14,
      paddingBottom: 12,
    },
    headerTitle: {
      flex: 1,
      fontSize: 15,
      fontWeight: "700",
      color: color.textOnBrand,
    },
    verifiedPill: {
      backgroundColor: "rgba(255,255,255,0.15)",
      borderRadius: 12,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    verifiedPillText: {
      fontSize: 10,
      fontWeight: "700",
      color: color.textOnBrand,
    },
    cover: {
      height: 120,
      backgroundColor: color.brand,
    },
    coverImage: {
      width: "100%",
      height: "100%",
    },
    identity: {
      marginHorizontal: 12,
      marginTop: -28,
    },
    logoWrap: {
      width: 68,
      height: 68,
      borderRadius: 34,
      backgroundColor: color.surfaceAlt,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
      marginTop: -44,
      borderWidth: 3,
      borderColor: color.surface,
    },
    logo: {
      width: "100%",
      height: "100%",
    },
    logoInitial: {
      fontSize: 22,
      fontWeight: "700",
      color: color.brand,
    },
    nameRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginTop: 10,
    },
    name: {
      fontSize: 19,
      fontWeight: "800",
      color: color.text,
      flexShrink: 1,
    },
    location: {
      fontSize: 13,
      color: color.textMuted,
      marginTop: 2,
    },
    description: {
      fontSize: 13,
      color: color.textSub,
      lineHeight: 19,
      marginTop: 10,
    },
    statsRow: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: color.surfaceAlt,
      borderRadius: 14,
      marginTop: space.md,
      paddingVertical: space.sm,
    },
    statBox: {
      flex: 1,
      alignItems: "center",
    },
    statDivider: {
      width: 1,
      alignSelf: "stretch",
      backgroundColor: color.border,
    },
    statValue: {
      fontSize: 16,
      fontWeight: "800",
      color: color.text,
    },
    statLabel: {
      fontSize: 11,
      color: color.textMuted,
      marginTop: 2,
    },
    contactRow: {
      flexDirection: "row",
      gap: 8,
      marginTop: 14,
    },
    contactPill: {
      flex: 1,
      backgroundColor: color.surfaceAlt,
      borderRadius: 10,
      paddingVertical: 10,
      alignItems: "center",
    },
    contactPillWhatsapp: {
      backgroundColor: color.successTint,
    },
    contactPillMessage: {
      backgroundColor: color.gold,
    },
    contactPillFollow: {
      backgroundColor: color.brand,
    },
    contactPillFollowing: {
      backgroundColor: color.brandTint,
      borderWidth: 1.5,
      borderColor: color.brand,
    },
    contactPillText: {
      fontSize: 12,
      fontWeight: "700",
      color: color.text,
    },
    contactPillFollowText: {
      color: color.textOnBrand,
    },
    contactPillFollowingText: {
      color: color.brand,
    },
    reviewsCard: {
      marginHorizontal: 12,
      marginTop: space.md,
    },
    reviewsHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: space.md,
    },
    reviewsTitle: {
      fontSize: 15,
      fontWeight: "800",
      color: color.text,
      marginBottom: 4,
    },
    reviewsSummaryRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    reviewsSummaryText: {
      fontSize: 12,
      color: color.textMuted,
    },
    writeReviewButton: {
      backgroundColor: color.brand,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    writeReviewButtonText: {
      fontSize: 12.5,
      fontWeight: "700",
      color: color.textOnBrand,
    },
    seeReviewsButton: {
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    seeReviewsButtonText: {
      fontSize: 12.5,
      fontWeight: "700",
      color: color.brand,
    },
    categoryChips: {
      paddingHorizontal: 16,
      gap: 8,
      paddingBottom: 12,
    },
    categoryChip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: color.surfaceAlt,
    },
    categoryChipActive: {
      backgroundColor: color.brand,
    },
    categoryChipText: {
      fontSize: 12,
      fontWeight: "600",
      color: color.text,
    },
    categoryChipTextActive: {
      color: color.textOnBrand,
    },
    resultCount: {
      fontSize: 12,
      color: color.textMuted,
      paddingHorizontal: 16,
      marginBottom: 8,
    },
    productGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      paddingHorizontal: 12,
      gap: 8,
    },
    productCard: {
      width: "47%",
      marginHorizontal: 4,
      marginBottom: 12,
    },
    productPhotoWrap: {
      width: "100%",
      aspectRatio: 1,
      borderRadius: 12,
      overflow: "hidden",
      marginBottom: 6,
    },
    productPhoto: {
      width: "100%",
      height: "100%",
    },
    productPhotoPlaceholder: {
      backgroundColor: color.skeleton,
    },
    productPrice: {
      fontSize: 14,
      fontWeight: "800",
      color: color.brand,
    },
    productTitle: {
      fontSize: 12,
      color: color.textSub,
      marginTop: 2,
    },
    ctaBar: {
      padding: 12,
      borderTopWidth: 1,
      borderTopColor: color.divider,
      backgroundColor: color.surface,
    },
    ctaButton: {
      backgroundColor: color.gold,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: "center",
    },
    ctaButtonText: {
      fontSize: 15,
      fontWeight: "700",
      color: color.textOnBrand,
    },
  });
}
