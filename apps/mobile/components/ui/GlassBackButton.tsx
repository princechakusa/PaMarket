import { useRef } from "react";
import { Animated, Platform, Pressable, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import Svg, { Polyline } from "react-native-svg";
import { glass, hitSlop as defaultHitSlop } from "../../lib/theme";
import { useThemedStyles, useThemePreference } from "../../lib/theme-provider";

// Two back-button looks, chosen explicitly per call site rather than
// inferred: a floating circular glass surface (used when the button floats
// directly over a photo/hero with nothing behind it, so it needs its own
// contrast) and a plain inline arrow matching the native Stack header's own
// back chevron (used everywhere there's already a header bar behind it, on
// both platforms). The flat variant also mimics the native header's own
// press-and-hold "grows into a glass circle" feel (iOS's system back
// button does this natively via its Liquid Glass material; a custom
// component has to fake it by hand with a scaling BlurView).
export type GlassTone = "auto" | "light" | "dark";

type GlassBackButtonProps = {
  onPress?: () => void;
  tone?: GlassTone;
  size?: number;
  label?: string;
  style?: StyleProp<ViewStyle>;
  flat?: boolean;
};

function ChevronIcon({ color, size, strokeWidth = 2.5 }: { color: string; size: number; strokeWidth?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <Polyline points="15 18 9 12 15 6" />
    </Svg>
  );
}

function FlatBackButton({ onPress, tone, label, style, themeColor, isDark }: {
  onPress: () => void;
  tone: GlassTone;
  label: string;
  style?: StyleProp<ViewStyle>;
  themeColor: { text: string };
  isDark: boolean;
}) {
  const iconColor = tone === "light" ? "#FFFFFF" : tone === "dark" ? "#111827" : themeColor.text;
  const glassTint = isDark ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.75)";
  const anim = useRef(new Animated.Value(0)).current;

  function animateTo(value: number) {
    Animated.spring(anim, {
      toValue: value,
      useNativeDriver: true,
      speed: 20,
      bounciness: value ? 6 : 0,
    }).start();
  }

  const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.35] });

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => animateTo(1)}
      onPressOut={() => animateTo(0)}
      hitSlop={defaultHitSlop}
      accessibilityRole="button"
      accessibilityLabel={label ? `Go back to ${label}` : "Go back"}
      style={[styles.flatWrap, style]}
    >
      <Animated.View style={[styles.flatGlass, { opacity: anim, transform: [{ scale }] }]}>
        <BlurView
          intensity={40}
          tint={isDark ? "dark" : "light"}
          blurMethod={Platform.OS === "android" ? glass.androidBlurMethod : undefined}
          style={[StyleSheet.absoluteFill, styles.flatGlassInner, { backgroundColor: glassTint }]}
        />
      </Animated.View>
      <Animated.View style={{ transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) }] }}>
        <ChevronIcon color={iconColor} size={26} strokeWidth={2.4} />
      </Animated.View>
    </Pressable>
  );
}

export function GlassBackButton({ onPress, tone = "auto", size = 52, label = "Back", style, flat = false }: GlassBackButtonProps) {
  const router = useRouter();
  const themeColor = useThemedStyles((c) => c);
  const { resolvedScheme } = useThemePreference();

  function handlePress() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (onPress) onPress();
    else if (router.canGoBack()) router.back();
  }

  if (flat) {
    return (
      <FlatBackButton
        onPress={handlePress}
        tone={tone}
        label={label}
        style={style}
        themeColor={themeColor}
        isDark={resolvedScheme === "dark"}
      />
    );
  }

  const iconColor = tone === "light" ? "#FFFFFF" : "#111827";

  return (
    <Pressable
      onPress={handlePress}
      hitSlop={defaultHitSlop}
      accessibilityRole="button"
      accessibilityLabel={label ? `Go back to ${label}` : "Go back"}
      style={({ pressed }) => [
        styles.wrap,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: tone === "light" ? "rgba(30,36,48,0.55)" : "rgba(255,255,255,0.92)",
          opacity: pressed ? 0.65 : 1,
        },
        style,
      ]}
    >
      <ChevronIcon color={iconColor} size={Math.round(size * 0.5)} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#101828",
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  flatWrap: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  flatGlass: {
    position: "absolute",
    top: 0,
    left: 0,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  flatGlassInner: {
    borderRadius: 20,
  },
});
