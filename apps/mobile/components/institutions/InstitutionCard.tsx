import { Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { institutionInitials, INSTITUTION_TYPE_LABEL, type Institution } from "../../lib/institutions";
import { color, font, radius, shadow, space, type ColorPalette } from "../../lib/theme";
import { useThemedStyles } from "../../lib/theme-provider";

// A dedicated card, not a repurposed ListingCard -- an institution is a
// place/entity, not a listing, and has a different data shape entirely
// (no price/photos array/seller). Structurally mirrors the Shops
// directory's own inline card in app/shops/index.tsx (logo circle + name +
// meta line) so it feels native to the rest of the directory UX.
export function InstitutionCard({ institution, cityName, onPress }: { institution: Institution; cityName?: string; onPress: () => void }) {
  const styles = useThemedStyles(buildStyles);
  const meta = [INSTITUTION_TYPE_LABEL[institution.type], cityName].filter(Boolean).join(" · ");
  return (
    <Pressable style={({ pressed }) => [styles.card, pressed && styles.cardPressed]} onPress={onPress}>
      <View style={styles.logoWrap}>
        {institution.logo_url ? (
          <Image source={{ uri: institution.logo_url }} style={styles.logo} contentFit="cover" cachePolicy="memory-disk" />
        ) : (
          <Text style={styles.logoInitial}>{institutionInitials(institution.official_name)}</Text>
        )}
      </View>
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>{institution.official_name}</Text>
        {institution.short_name ? <Text style={styles.shortName} numberOfLines={1}>{institution.short_name}</Text> : null}
        {meta ? <Text style={styles.meta} numberOfLines={1}>{meta}</Text> : null}
      </View>
    </Pressable>
  );
}

function buildStyles(color: ColorPalette) {
  return StyleSheet.create({
    card: {
      flexDirection: "row",
      gap: space.md,
      backgroundColor: color.surface,
      borderRadius: radius.lg,
      padding: space.lg,
      borderWidth: 1,
      borderColor: color.border,
      alignItems: "center",
      ...shadow.sm,
    },
    cardPressed: { opacity: 0.9, transform: [{ scale: 0.995 }] },
    logoWrap: {
      width: 52,
      height: 52,
      borderRadius: radius.pill,
      backgroundColor: color.brandTint,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
      flexShrink: 0,
    },
    logo: { width: "100%", height: "100%" },
    logoInitial: { ...font.h3, color: color.brand },
    body: { flex: 1, gap: 3, minWidth: 0 },
    name: { ...font.title, color: color.text },
    shortName: { ...font.caption, color: color.textMuted, fontWeight: "600" },
    meta: { ...font.caption, color: color.textMuted },
  });
}
