import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import type { Business } from "../../lib/businesses";
import { businessInitials } from "../../lib/businesses";
import { CATEGORIES } from "../../lib/constants";
import type { Listing } from "../../lib/listings";
import { color, font, radius, shadow, space, type ColorPalette } from "../../lib/theme";
import { useThemedStyles } from "../../lib/theme-provider";
import { SectionHeader, VerifiedBadge } from "../ui";

export function ShopsRail({
  businesses,
  listings,
  onPressShop,
  onSeeAll,
}: {
  businesses: Business[];
  listings: Listing[];
  onPressShop: (business: Business) => void;
  onSeeAll: () => void;
}) {
  const styles = useThemedStyles(buildStyles);
  if (!businesses.length) return null;

  return (
    <View style={styles.section}>
      <SectionHeader
        title="Verified Shops"
        subtitle="Trusted sellers near you"
        actionLabel="See all"
        onAction={onSeeAll}
        actionColor={color.goldDark}
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
        {businesses.slice(0, 12).map((business) => {
          const products = listings.filter(
            (l) => l.status === "active" && (l.seller_id === business.owner_user_id || l.business_id === business.id)
          );
          const categoryNames = (business.category ? [business.category] : [])
            .map((id) => CATEGORIES.find((c) => c.id === id)?.name)
            .filter(Boolean)
            .join(" / ");
          const niche = categoryNames || "Local Shop";
          const loc = [business.city, business.province].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(", ");
          const thumbs = products.filter((l) => l.photos?.[0]).slice(0, 2);
          const verified = (business.verification_level ?? 0) >= 2;

          return (
            <Pressable key={business.id} style={[styles.card, shadow.sm]} onPress={() => onPressShop(business)}>
              <View style={styles.topRow}>
                <View style={styles.logoWrap}>
                  {business.logo ? (
                    <Image source={{ uri: business.logo }} style={styles.logo} cachePolicy="memory-disk" />
                  ) : (
                    <Text style={styles.logoInitial}>{businessInitials(business.name)}</Text>
                  )}
                </View>
                <View style={styles.copy}>
                  <View style={styles.nameRow}>
                    <Text style={styles.name} numberOfLines={1}>
                      {business.name}
                    </Text>
                    {verified ? <VerifiedBadge /> : null}
                  </View>
                  <Text style={styles.meta} numberOfLines={1}>
                    {[niche, loc].filter(Boolean).join(" · ")}
                  </Text>
                  <Text style={styles.metaSub} numberOfLines={1}>
                    {products.length} {products.length === 1 ? "item" : "items"}
                  </Text>
                </View>
              </View>
              <View style={styles.thumbRow}>
                {[0, 1].map((i) => (
                  <View key={i} style={styles.thumb}>
                    {thumbs[i] ? (
                      <Image source={{ uri: thumbs[i].photos![0] }} style={styles.thumbImage} cachePolicy="memory-disk" />
                    ) : null}
                  </View>
                ))}
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

function buildStyles(color: ColorPalette) {
  return StyleSheet.create({
    section: {
      marginBottom: space.xl,
    },
    rail: {
      paddingHorizontal: space.lg,
      gap: space.md,
    },
    card: {
      width: 220,
      backgroundColor: color.surface,
      borderRadius: radius.lg,
      padding: space.md,
      gap: space.md,
    },
    topRow: {
      flexDirection: "row",
      gap: space.md,
    },
    logoWrap: {
      width: 48,
      height: 48,
      borderRadius: radius.pill,
      backgroundColor: color.goldTint,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
    },
    logo: {
      width: "100%",
      height: "100%",
    },
    logoInitial: {
      ...font.title,
      color: color.goldDark,
    },
    copy: {
      flex: 1,
      gap: 2,
    },
    nameRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    name: {
      ...font.bodyStrong,
      fontSize: 15.5,
      letterSpacing: -0.1,
      color: color.text,
      flexShrink: 1,
    },
    meta: {
      ...font.caption,
      color: color.textMuted,
      fontWeight: "500",
    },
    metaSub: {
      ...font.caption,
      color: color.textMuted,
      marginTop: 1,
    },
    thumbRow: {
      flexDirection: "row",
      gap: space.sm,
    },
    thumb: {
      flex: 1,
      height: 64,
      borderRadius: radius.md,
      backgroundColor: color.surfaceAlt,
      overflow: "hidden",
    },
    thumbImage: {
      width: "100%",
      height: "100%",
    },
  });
}
