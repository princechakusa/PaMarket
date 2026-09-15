import { StyleSheet, Text, View } from "react-native";
import { useCurrentLocation, type ResolvedLocation } from "../../lib/useCurrentLocation";
import { font, space, type ColorPalette } from "../../lib/theme";
import { useThemedStyles } from "../../lib/theme-provider";
import { Button } from "./Button";
import { PinIcon } from "./SectionIcons";

// Shared "Use my current location" control for anywhere PaMarket collects a
// Province/City/Suburb (listings, businesses, and future location-aware
// flows) — one-shot GPS + reverse-geocode, no map rendered on-device. The
// caller owns the form state; this just resolves a location and hands it
// back for the caller to review/apply.
export function UseCurrentLocationButton({
  provinces,
  citiesByProvince,
  onResolved,
}: {
  provinces: readonly string[];
  citiesByProvince: Record<string, readonly string[]>;
  onResolved: (location: ResolvedLocation) => void;
}) {
  const styles = useThemedStyles(buildStyles);
  const { loading, error, resolve } = useCurrentLocation(provinces, citiesByProvince);

  async function handlePress() {
    const location = await resolve();
    if (location) onResolved(location);
  }

  return (
    <View style={styles.wrap}>
      <Button
        label={loading ? "Locating…" : "Use my current location"}
        onPress={handlePress}
        variant="secondary"
        size="sm"
        loading={loading}
        fullWidth={false}
        icon={<PinIcon c={styles.iconColor.color} size={15} />}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

function buildStyles(color: ColorPalette) {
  return StyleSheet.create({
    wrap: { gap: space.xs, alignItems: "flex-start" },
    iconColor: { color: color.text },
    error: { ...font.caption, color: color.danger, marginTop: 2 },
  });
}
