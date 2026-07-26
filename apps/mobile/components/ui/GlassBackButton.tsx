import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import Svg, { Polyline } from "react-native-svg";
import { hitSlop as defaultHitSlop } from "../../lib/theme";
import { useThemePreference } from "../../lib/theme-provider";

// One shared back button — a plain chevron, no background/circle/blur,
// matching the plain native back arrow used everywhere a screen relies on
// the default Stack header (e.g. My Listings). `tone` only controls icon
// color for legibility over photo heroes / brand-colored banners; it no
// longer implies any background treatment.
export type GlassTone = "auto" | "light" | "dark";

type GlassBackButtonProps = {
  onPress?: () => void;
  tone?: GlassTone;
  size?: number;
  style?: StyleProp<ViewStyle>;
};

function ChevronIcon({ color, size }: { color: string; size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <Polyline points="15 18 9 12 15 6" />
    </Svg>
  );
}

export function GlassBackButton({ onPress, tone = "auto", size = 38, style }: GlassBackButtonProps) {
  const router = useRouter();
  const { resolvedScheme } = useThemePreference();
  const isDark = resolvedScheme === "dark";

  // "auto" follows the active theme; "light"/"dark" let a screen force a
  // legible icon color when the surface behind it is a photo or a
  // brand-colored banner rather than the app's own background. `tone`
  // names the ICON's rendered tone — "light" means a light/white icon (for
  // a dark backdrop), "dark" means a dark icon (for a light backdrop).
  const effectiveDark = tone === "light" ? true : tone === "dark" ? false : isDark;
  const iconColor = effectiveDark ? "#FFFFFF" : "#111827";

  function handlePress() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (onPress) onPress();
    else if (router.canGoBack()) router.back();
  }

  return (
    <>
      {/* A forced tone means the surface behind this screen's header isn't
          the app's own background (a photo hero or a brand-colored banner),
          so the status bar needs to match that surface, not the app theme.
          expo-status-bar stacks mounted <StatusBar> instances and reverts to
          the previous one on unmount, so this only applies while this
          screen is focused. */}
      {tone !== "auto" && <StatusBar style={effectiveDark ? "light" : "dark"} />}
      <Pressable
        onPress={handlePress}
        hitSlop={defaultHitSlop}
        accessibilityRole="button"
        accessibilityLabel="Go back"
        style={({ pressed }) => [styles.wrap, { width: size, height: size, opacity: pressed ? 0.5 : 1 }, style]}
      >
        <ChevronIcon color={iconColor} size={Math.round(size * 0.58)} />
      </Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
  },
});
