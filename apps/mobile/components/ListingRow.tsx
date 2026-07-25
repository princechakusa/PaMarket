import { Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import Svg, { Path } from "react-native-svg";
import type { Listing } from "../lib/listings";
import { formatPrice, isFeatured, isNew, listingLocation } from "../lib/listings";
import { color, font, radius, shadow, space, type ColorPalette } from "../lib/theme";
import { useThemedStyles } from "../lib/theme-provider";

type ListingRowProps = {
  listing: Listing;
  onPress: () => void;
  saved?: boolean;
  onToggleSave?: () => void;
};

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill={filled ? color.danger : "none"} stroke={filled ? color.danger : color.textMuted} strokeWidth={2}>
      <Path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </Svg>
  );
}

export function ListingRow({ listing, onPress, saved, onToggleSave }: ListingRowProps) {
  const styles = useThemedStyles(buildStyles);
  const photo = listing.photos?.[0];
  const featured = isFeatured(listing);
  const fresh = !featured && isNew(listing);

  return (
    <Pressable style={[styles.row, shadow.sm]} onPress={onPress}>
      <View style={styles.photoWrap}>
        {photo ? (
          <Image source={{ uri: photo }} style={styles.photo} contentFit="cover" transition={150} cachePolicy="memory-disk" />
        ) : (
          <View style={[styles.photo, styles.placeholder]} />
        )}
        {featured ? (
          <View style={[styles.ribbon, styles.ribbonGold]}>
            <Text style={styles.ribbonText}>FEATURED</Text>
          </View>
        ) : fresh ? (
          <View style={[styles.ribbon, styles.ribbonGreen]}>
            <Text style={styles.ribbonText}>NEW</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={2}>
          {listing.title}
        </Text>
        <Text style={styles.price}>{formatPrice(listing)}</Text>
        <View style={styles.metaRow}>
          <Text style={styles.location} numberOfLines={1}>
            {listingLocation(listing)}
          </Text>
          {listing.views ? <Text style={styles.views}>· {listing.views} views</Text> : null}
        </View>
      </View>

      {onToggleSave ? (
        <Pressable style={styles.saveBtn} onPress={onToggleSave} hitSlop={8}>
          <HeartIcon filled={!!saved} />
        </Pressable>
      ) : null}
    </Pressable>
  );
}

function buildStyles(color: ColorPalette) {
  return StyleSheet.create({
    row: {
      flexDirection: "row",
      backgroundColor: color.surface,
      borderRadius: radius.lg,
      overflow: "hidden",
    },
    photoWrap: { width: 104, height: 104, position: "relative", backgroundColor: color.surfaceAlt },
    photo: { width: "100%", height: "100%" },
    placeholder: { backgroundColor: color.skeleton },
    ribbon: {
      position: "absolute",
      top: space.sm,
      left: space.sm,
      borderRadius: radius.sm,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    ribbonGold: { backgroundColor: color.gold },
    ribbonGreen: { backgroundColor: color.success },
    ribbonText: { fontSize: 8.5, fontWeight: "800", color: color.textOnBrand, letterSpacing: 0.3 },
    body: { flex: 1, paddingVertical: space.md, paddingHorizontal: space.lg, justifyContent: "center", gap: 3 },
    title: { ...font.body, color: color.text, fontWeight: "600" },
    price: { ...font.price, color: color.brand },
    metaRow: { flexDirection: "row", alignItems: "center", gap: 4 },
    location: { ...font.caption, color: color.textMuted },
    views: { ...font.caption, color: color.textMuted },
    saveBtn: { paddingHorizontal: space.md, justifyContent: "center" },
  });
}
