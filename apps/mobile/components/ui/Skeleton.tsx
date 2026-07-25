import { useEffect, useRef } from "react";
import { Animated, StyleSheet, View, type ViewStyle } from "react-native";
import { radius, space, type ColorPalette } from "../../lib/theme";
import { useThemedStyles } from "../../lib/theme-provider";

function buildStyles(color: ColorPalette) {
  return StyleSheet.create({
    card: { backgroundColor: color.surface, borderRadius: radius.lg, padding: space.md },
    row: {
      flexDirection: "row",
      gap: space.md,
      backgroundColor: color.surface,
      borderRadius: radius.lg,
      padding: space.md,
    },
    grid: { flexDirection: "row", flexWrap: "wrap" },
    gridCell: { width: "50%", padding: space.xs },
    shimmerBlock: { backgroundColor: color.skeleton },
  });
}

// A single shimmering block. Compose these into skeleton screens.
export function Skeleton({ width, height, radius: r = radius.sm, style }: { width?: number | string; height: number; radius?: number; style?: ViewStyle }) {
  const shimmer = useRef(new Animated.Value(0)).current;
  const styles = useThemedStyles(buildStyles);
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 800, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [shimmer]);
  const opacity = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] });
  return (
    <Animated.View
      style={[
        styles.shimmerBlock,
        { width: (width as number) ?? "100%", height, borderRadius: r, opacity },
        style,
      ]}
    />
  );
}

// Vertical listing card skeleton (matches ListingCard footprint).
export function ListingCardSkeleton() {
  const styles = useThemedStyles(buildStyles);
  return (
    <View style={styles.card}>
      <Skeleton height={132} radius={radius.md} />
      <Skeleton height={13} width="55%" style={{ marginTop: space.md }} />
      <Skeleton height={11} width="80%" style={{ marginTop: space.sm }} />
    </View>
  );
}

// Horizontal row skeleton (search results).
export function ListingRowSkeleton() {
  const styles = useThemedStyles(buildStyles);
  return (
    <View style={styles.row}>
      <Skeleton height={84} width={84} radius={radius.md} />
      <View style={{ flex: 1, gap: space.sm }}>
        <Skeleton height={13} width="70%" />
        <Skeleton height={12} width="40%" />
        <Skeleton height={11} width="55%" />
      </View>
    </View>
  );
}

export function ListingGridSkeleton({ count = 6 }: { count?: number }) {
  const styles = useThemedStyles(buildStyles);
  return (
    <View style={styles.grid}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={styles.gridCell}>
          <ListingCardSkeleton />
        </View>
      ))}
    </View>
  );
}

export function ListSkeleton({ count = 6 }: { count?: number }) {
  return (
    <View style={{ gap: space.md }}>
      {Array.from({ length: count }).map((_, i) => (
        <ListingRowSkeleton key={i} />
      ))}
    </View>
  );
}
