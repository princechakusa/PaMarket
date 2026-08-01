import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import Svg, { Polyline } from "react-native-svg";
import { hitSlop as defaultHitSlop } from "../../lib/theme";
import { useThemedStyles } from "../../lib/theme-provider";

// Two back-button looks, chosen explicitly per call site rather than
// inferred: a floating circular glass surface (used when the button floats
// directly over a photo/hero with nothing behind it, so it needs its own
// contrast) and a plain inline arrow matching the native Stack header's own
// back chevron (used everywhere there's already a header bar behind it, on
// both platforms — explicit user direction: every screen should look like
// the native-header ones, e.g. Legal Hub/Notifications settings).
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

export function GlassBackButton({ onPress, tone = "auto", size = 52, label = "Back", style, flat = false }: GlassBackButtonProps) {
  const router = useRouter();
  const themeColor = useThemedStyles((c) => c);

  function handlePress() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (onPress) onPress();
    else if (router.canGoBack()) router.back();
  }

  if (flat) {
    const iconColor = tone === "light" ? "#FFFFFF" : tone === "dark" ? "#111827" : themeColor.text;
    return (
      <Pressable
        onPress={handlePress}
        hitSlop={defaultHitSlop}
        accessibilityRole="button"
        accessibilityLabel={label ? `Go back to ${label}` : "Go back"}
        style={({ pressed }) => [styles.flatWrap, { opacity: pressed ? 0.5 : 1 }, style]}
      >
        <ChevronIcon color={iconColor} size={26} strokeWidth={2.4} />
      </Pressable>
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
});
