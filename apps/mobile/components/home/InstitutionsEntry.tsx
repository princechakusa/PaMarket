import { useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Line, Path } from "react-native-svg";
import { DARK_COLORS, font, radius, space, type ColorPalette } from "../../lib/theme";
import { useThemedStyles } from "../../lib/theme-provider";

// Real, visible rotation -- the full headline swaps, not just a subtitle
// caption. Kept short enough to fit two lines on a small phone at this
// font size; the card's height is fixed (numberOfLines={2}) so rotation
// never reflows anything else on Home.
const ROTATING_MESSAGES = [
  "See what's available around your university",
  "Buy and sell within your campus community",
  "Find study materials from fellow students",
  "Discover listings near your institution",
  "Connect with your campus marketplace",
];

function PlusIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={DARK_COLORS.text} strokeWidth={2.5} strokeLinecap="round">
      <Line x1={12} y1={5} x2={12} y2={19} />
      <Line x1={5} y1={12} x2={19} y2={12} />
    </Svg>
  );
}

function ArrowIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M5 12h14" />
      <Path d="M13 6l6 6-6 6" />
    </Svg>
  );
}

// Production Readiness: a promotional hero card per the approved reference
// design (a card the user supplied, not invented here) -- a "Campus Hub"
// badge, a live status line, a rotating headline, and two explicit actions
// (Post / Explore), both of which route through the existing Institutions
// directory since that is the only entry point that lets someone pick
// *which* institution they mean -- there is no institution picker inside
// the post flow itself (apps/mobile/app/(tabs)/post.tsx only reads an
// institutionId route param; it has no picker of its own), so a shortcut
// straight into posting would land with no institution attached. Colors are
// PaMarket's own existing brand/gold/success tokens (lib/theme.ts) -- no
// new palette, no gradient library. Rotation reuses the same plain
// Animated fade+slide pattern already established by HomeHeader's
// AnimatedSearchPlaceholder elsewhere on this same screen.
export function InstitutionsEntry({ onPress }: { onPress: () => void }) {
  const styles = useThemedStyles(buildStyles);
  const [index, setIndex] = useState(0);
  const opacity = useRef(new Animated.Value(1)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let mounted = true;
    let timer: ReturnType<typeof setTimeout>;

    function cycle() {
      timer = setTimeout(() => {
        if (!mounted) return;
        Animated.timing(opacity, { toValue: 0, duration: 320, useNativeDriver: true }).start(() => {
          if (!mounted) return;
          setIndex((i) => (i + 1) % ROTATING_MESSAGES.length);
          opacity.setValue(0);
          translateY.setValue(6);
          Animated.timing(opacity, { toValue: 1, duration: 380, useNativeDriver: true }).start();
          Animated.timing(translateY, { toValue: 0, duration: 380, useNativeDriver: true }).start();
          timer = setTimeout(cycle, 20);
        });
        Animated.timing(translateY, { toValue: -6, duration: 320, useNativeDriver: true }).start();
      }, 3400);
    }
    cycle();
    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, []);

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>CAMPUS HUB</Text>
        </View>
        <View style={styles.statusWrap}>
          <Text style={styles.statusText}>Students &amp; Staff</Text>
        </View>
      </View>

      <Animated.View style={{ opacity, transform: [{ translateY }] }}>
        <Text style={styles.headline} numberOfLines={2}>
          {ROTATING_MESSAGES[index]}
        </Text>
      </Animated.View>

      <View style={styles.actionsRow}>
        <Pressable style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]} onPress={onPress}>
          <PlusIcon />
          <Text style={styles.primaryButtonText}>Post for Your Campus</Text>
        </Pressable>
        <Pressable style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]} onPress={onPress}>
          <Text style={styles.secondaryButtonText}>Explore</Text>
          <ArrowIcon />
        </Pressable>
      </View>
    </View>
  );
}

function buildStyles(color: ColorPalette) {
  return StyleSheet.create({
    card: {
      marginHorizontal: space.lg,
      marginBottom: space.xl,
      backgroundColor: color.brand,
      borderRadius: radius.xl,
      padding: space.lg,
      gap: space.md,
    },
    topRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    badge: {
      backgroundColor: color.gold,
      borderRadius: radius.pill,
      paddingHorizontal: space.md,
      paddingVertical: 4,
    },
    badgeText: {
      ...font.caption,
      fontWeight: "800",
      letterSpacing: 0.4,
      color: DARK_COLORS.text,
    },
    statusWrap: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    statusText: {
      ...font.caption,
      fontWeight: "600",
      color: "rgba(255,255,255,0.85)",
    },
    headline: {
      ...font.h3,
      fontWeight: "800",
      color: "#FFFFFF",
      lineHeight: 24,
    },
    actionsRow: {
      flexDirection: "row",
      gap: space.sm,
    },
    primaryButton: {
      flex: 1.3,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      backgroundColor: color.gold,
      borderRadius: radius.pill,
      paddingVertical: space.sm + 2,
    },
    primaryButtonText: {
      ...font.caption,
      fontWeight: "800",
      color: DARK_COLORS.text,
    },
    secondaryButton: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      backgroundColor: "rgba(255,255,255,0.16)",
      borderRadius: radius.pill,
      paddingVertical: space.sm + 2,
    },
    secondaryButtonText: {
      ...font.caption,
      fontWeight: "800",
      color: "#FFFFFF",
    },
    buttonPressed: {
      opacity: 0.85,
    },
  });
}
