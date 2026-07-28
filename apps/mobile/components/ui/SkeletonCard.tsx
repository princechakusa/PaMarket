import { StyleSheet, View } from "react-native";
import type { ColorPalette } from "../../lib/theme";
import { useThemedStyles } from "../../lib/theme-provider";

// Mirrors www/js/app.js H.skeletonCards — loading placeholder shaped like a
// listing card (thumb + 3 lines).
export function SkeletonCard() {
  const styles = useThemedStyles(buildStyles);
  return (
    <View style={styles.row}>
      <View style={styles.thumb} />
      <View style={styles.body}>
        <View style={[styles.line, { width: "70%" }]} />
        <View style={[styles.line, { width: "40%" }]} />
        <View style={[styles.line, { width: "55%" }]} />
      </View>
    </View>
  );
}

export function SkeletonCards({ count = 6 }: { count?: number }) {
  return (
    <View style={{ gap: 10 }}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </View>
  );
}

function buildStyles(color: ColorPalette) {
  return StyleSheet.create({
    row: {
      flexDirection: "row",
      gap: 12,
      backgroundColor: color.surface,
      borderRadius: 12,
      padding: 12,
    },
    thumb: {
      width: 72,
      height: 72,
      borderRadius: 10,
      backgroundColor: color.skeleton,
    },
    body: {
      flex: 1,
      justifyContent: "center",
      gap: 8,
    },
    line: {
      height: 10,
      borderRadius: 5,
      backgroundColor: color.skeleton,
    },
  });
}
