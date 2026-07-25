import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Polyline } from "react-native-svg";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import { BRAND_BLUE, BRAND_GOLD, CATEGORIES } from "../../lib/constants";
import type { Business } from "../../lib/businesses";
import { businessInitials } from "../../lib/businesses";
import { formatPrice, type Listing } from "../../lib/listings";
import { averageRating } from "../../lib/sellers";
import { StarRow } from "../../components/StarRow";

const LISTING_COLUMNS =
  "id,seller_id,seller_name,seller_phone,title,description,price,currency,category,province,city,suburb,photos,status,boost,featured_until,views,business_id,created_at,updated_at";

function BackIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth={2.4}>
      <Polyline points="15 18 9 12 15 6" />
    </Svg>
  );
}

export default function BusinessShopScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const insets = useSafeAreaInsets();

  const [business, setBusiness] = useState<Business | null>(null);
  const [products, setProducts] = useState<Listing[]>([]);
  const [reviews, setReviews] = useState<{ rating: number }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    const [businessRes, productsRes, reviewsRes] = await Promise.all([
      supabase
        .from("businesses")
        .select(
          "id,owner_user_id,name,logo,cover,description,biz_type,category,phone,whatsapp,email,province,city,suburb,status,verification_level,featured_listing_ids,updated_at"
        )
        .eq("id", id)
        .maybeSingle(),
      supabase.from("listings").select(LISTING_COLUMNS).eq("business_id", id).eq("status", "active"),
      supabase.from("business_reviews").select("rating").eq("business_id", id),
    ]);

    if (businessRes.data) setBusiness(businessRes.data as Business);
    setProducts((productsRes.data as Listing[]) ?? []);
    setReviews((reviewsRes.data as { rating: number }[]) ?? []);
  }, [id]);

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

  async function messageShop() {
    if (!session?.user || !business) {
      router.push("/(auth)/sign-in");
      return;
    }
    if (isOwner) return;
    const convId = `biz_${business.id.slice(-8)}_${session.user.id.slice(-6)}`;
    const { data: existing } = await supabase.from("conversations").select("id").eq("id", convId).maybeSingle();
    if (!existing) {
      await supabase.from("conversations").upsert({
        id: convId,
        members: [session.user.id, business.owner_user_id],
        listing_id: null,
      });
    }
    router.push({ pathname: "/chat/[id]", params: { id: convId } });
  }

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={BRAND_BLUE} />
      </View>
    );
  }

  if (!business) {
    return (
      <View style={styles.centered}>
        <Text style={styles.notFoundTitle}>Shop not found</Text>
      </View>
    );
  }

  const isVerified = (business.verification_level ?? 0) >= 2;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <BackIcon />
        </Pressable>
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

      <ScrollView contentContainerStyle={{ paddingBottom: isOwner ? 24 : 90 }}>
        <View style={styles.cover}>{business.cover ? <Image source={{ uri: business.cover }} style={styles.coverImage} /> : null}</View>

        <View style={styles.identity}>
          <View style={styles.logoWrap}>
            {business.logo ? (
              <Image source={{ uri: business.logo }} style={styles.logo} />
            ) : (
              <Text style={styles.logoInitial}>{businessInitials(business.name)}</Text>
            )}
          </View>

          <Text style={styles.name}>{business.name}</Text>
          {business.city || business.province ? (
            <Text style={styles.location}>{[business.city, business.province].filter(Boolean).join(", ")}</Text>
          ) : null}

          <View style={styles.ratingRow}>
            <StarRow rating={avgRating} />
            <Text style={styles.ratingText}>
              {reviews.length ? `${avgRating.toFixed(1)} (${reviews.length})` : "No reviews yet"}
            </Text>
            <Text style={styles.ratingDot}>·</Text>
            <Text style={styles.ratingText}>
              {products.length} {products.length === 1 ? "item" : "items"}
            </Text>
          </View>

          {business.description ? <Text style={styles.description}>{business.description}</Text> : null}

          <View style={styles.contactRow}>
            {business.phone ? (
              <Pressable style={styles.contactPill} onPress={() => Linking.openURL(`tel:${business.phone}`)}>
                <Text style={styles.contactPillText}>Call</Text>
              </Pressable>
            ) : null}
            {business.whatsapp ? (
              <Pressable
                style={[styles.contactPill, styles.contactPillWhatsapp]}
                onPress={() => Linking.openURL(`https://wa.me/${business.whatsapp!.replace(/[^0-9]/g, "")}`)}
              >
                <Text style={styles.contactPillText}>WhatsApp</Text>
              </Pressable>
            ) : null}
            {!isOwner ? (
              <Pressable style={[styles.contactPill, styles.contactPillMessage]} onPress={messageShop}>
                <Text style={styles.contactPillText}>Message</Text>
              </Pressable>
            ) : (
              <Pressable
                style={[styles.contactPill, styles.contactPillMessage]}
                onPress={() => router.push(`/business-manage/${business.id}`)}
              >
                <Text style={styles.contactPillText}>Manage Shop</Text>
              </Pressable>
            )}
          </View>
        </View>

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
                  <Image source={{ uri: product.photos[0] }} style={styles.productPhoto} />
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  notFoundTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: BRAND_BLUE,
    paddingHorizontal: 14,
    paddingBottom: 12,
  },
  headerTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
    color: "#ffffff",
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
    color: "#ffffff",
  },
  cover: {
    height: 120,
    backgroundColor: BRAND_BLUE,
  },
  coverImage: {
    width: "100%",
    height: "100%",
  },
  identity: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  logoWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#EEF0F4",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    marginTop: -32,
    borderWidth: 3,
    borderColor: "#ffffff",
  },
  logo: {
    width: "100%",
    height: "100%",
  },
  logoInitial: {
    fontSize: 22,
    fontWeight: "700",
    color: BRAND_BLUE,
  },
  name: {
    fontSize: 19,
    fontWeight: "800",
    color: "#111827",
    marginTop: 10,
  },
  location: {
    fontSize: 13,
    color: "#8A93A6",
    marginTop: 2,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
  },
  ratingText: {
    fontSize: 12,
    color: "#8A93A6",
  },
  ratingDot: {
    color: "#8A93A6",
  },
  description: {
    fontSize: 13,
    color: "#3A4258",
    lineHeight: 19,
    marginTop: 10,
  },
  contactRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 14,
  },
  contactPill: {
    flex: 1,
    backgroundColor: "#F5F6F9",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  contactPillWhatsapp: {
    backgroundColor: "#E7F9EF",
  },
  contactPillMessage: {
    backgroundColor: BRAND_GOLD,
  },
  contactPillText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#111827",
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
    backgroundColor: "#F5F6F9",
  },
  categoryChipActive: {
    backgroundColor: BRAND_BLUE,
  },
  categoryChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#111827",
  },
  categoryChipTextActive: {
    color: "#ffffff",
  },
  resultCount: {
    fontSize: 12,
    color: "#8A93A6",
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
    backgroundColor: "#E4E7EF",
  },
  productPrice: {
    fontSize: 14,
    fontWeight: "800",
    color: BRAND_BLUE,
  },
  productTitle: {
    fontSize: 12,
    color: "#3A4258",
    marginTop: 2,
  },
  ctaBar: {
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: "#F0F1F5",
    backgroundColor: "#ffffff",
  },
  ctaButton: {
    backgroundColor: BRAND_GOLD,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  ctaButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#ffffff",
  },
});
