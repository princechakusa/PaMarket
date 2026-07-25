import { Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import Svg, { Path, Polyline } from "react-native-svg";
import type { Listing } from "../lib/listings";
import { formatPrice, isFeatured, isNew, listingLocation } from "../lib/listings";
import { color, font, radius, shadow, space, type ColorPalette } from "../lib/theme";
import { useThemedStyles } from "../lib/theme-provider";

type ListingCardProps = {
  listing: Listing;
  onPress: () => void;
  width?: number; // omit for fluid (grid) width
  saved?: boolean;
  onToggleSave?: () => void;
  verified?: boolean;
};

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill={filled ? color.danger : "none"} stroke={filled ? color.danger : color.textOnBrand} strokeWidth={2.2}>
      <Path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </Svg>
  );
}

function PinIcon() {
  return (
    <Svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke={color.textMuted} strokeWidth={2}>
      <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <Path d="M12 10a2 2 0 100-4 2 2 0 000 4z" fill={color.textMuted} />
    </Svg>
  );
}

export function ListingCard({ listing, onPress, width, saved, onToggleSave, verified }: ListingCardProps) {
  const styles = useThemedStyles(buildStyles);
  const photo = listing.photos?.[0];
  const featured = isFeatured(listing);
  const fresh = !featured && isNew(listing);

  return (
    <Pressable style={[styles.card, width ? { width } : styles.fluid, shadow.sm]} onPress={onPress}>
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

        {onToggleSave ? (
          <Pressable style={styles.saveBtn} onPress={onToggleSave} hitSlop={8}>
            <HeartIcon filled={!!saved} />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.body}>
        <Text style={styles.price} numberOfLines={1}>
          {formatPrice(listing)}
        </Text>
        <Text style={styles.title} numberOfLines={2}>
          {listing.title}
        </Text>
        <View style={styles.metaRow}>
          <PinIcon />
          <Text style={styles.location} numberOfLines={1}>
            {listingLocation(listing)}
          </Text>
          {verified ? (
            <View style={styles.verifiedDot}>
              <Svg width={8} height={8} viewBox="0 0 24 24" fill="none" stroke={color.textOnBrand} strokeWidth={4}>
                <Polyline points="20 6 9 17 4 12" />
              </Svg>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

function buildStyles(color: ColorPalette) {
  return StyleSheet.create({
    card: {
      backgroundColor: color.surface,
      borderRadius: radius.lg,
      overflow: "hidden",
    },
    fluid: { flex: 1 },
    photoWrap: { width: "100%", aspectRatio: 1.18, position: "relative", backgroundColor: color.surfaceAlt },
    photo: { width: "100%", height: "100%" },
    placeholder: { backgroundColor: color.skeleton },
    ribbon: {
      position: "absolute",
      top: space.sm,
      left: space.sm,
      borderRadius: radius.sm,
      paddingHorizontal: space.sm,
      paddingVertical: 3,
    },
    ribbonGold: { backgroundColor: color.gold },
    ribbonGreen: { backgroundColor: color.success },
    ribbonText: { ...font.micro, color: color.textOnBrand },
    saveBtn: {
      position: "absolute",
      top: space.sm,
      right: space.sm,
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: "rgba(17,24,39,0.35)",
      alignItems: "center",
      justifyContent: "center",
    },
    body: { padding: space.md, gap: 3 },
    price: { ...font.price, color: color.brand },
    title: { ...font.sub, color: color.text, fontWeight: "600" },
    metaRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
    location: { ...font.caption, color: color.textMuted, flex: 1 },
    verifiedDot: {
      width: 14,
      height: 14,
      borderRadius: 7,
      backgroundColor: color.info,
      alignItems: "center",
      justifyContent: "center",
    },
  });
}
