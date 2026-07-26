import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from "react-native";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import Svg, { Polyline } from "react-native-svg";
import { font, hitSlop as defaultHitSlop } from "../../lib/theme";
import { useThemePreference } from "../../lib/theme-provider";

// One shared back button — a chevron plus a text label, matching the plain
// native back button style used everywhere a screen relies on the default
// Stack header (e.g. My Listings shows "‹ Account" when reached from the
// Account tab). No background/circle/blur. `tone` only controls color for
// legibility over photo heroes / brand-colored banners.
export type GlassTone = "auto" | "light" | "dark";

type GlassBackButtonProps = {
  onPress?: () => void;
  tone?: GlassTone;
  size?: number;
  label?: string;
  style?: StyleProp<ViewStyle>;
};

function ChevronIcon({ color, size }: { color: string; size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <Polyline points="15 18 9 12 15 6" />
    </Svg>
  );
}

// Defaults to "Back" (matching iOS's own "generic" back-button mode) rather
// than leaving every one of the ~20 custom-header screens to work out
// exactly which screen a user would have come from — pass `label` to
// override with something more specific where it's known and useful.
export function GlassBackButton({ onPress, tone = "auto", size = 38, label = "Back", style }: GlassBackButtonProps) {
  const router = useRouter();
  const { resolvedScheme } = useThemePreference();
  const isDark = resolvedScheme === "dark";

  // "auto" follows the active theme; "light"/"dark" let a screen force a
  // legible color when the surface behind it is a photo or a brand-colored
  // banner rather than the app's own background. `tone` names the icon/text
  // tone — "light" means white (for a dark backdrop), "dark" means near-
  // black (for a light backdrop).
  const effectiveDark = tone === "light" ? true : tone === "dark" ? false : isDark;
  const tint = effectiveDark ? "#FFFFFF" : "#111827";

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
        accessibilityLabel={label ? `Go back to ${label}` : "Go back"}
        style={({ pressed }) => [styles.wrap, { height: size, opacity: pressed ? 0.5 : 1 }, style]}
      >
        <ChevronIcon color={tint} size={Math.round(size * 0.58)} />
        {label ? (
          <Text style={[styles.label, { color: tint }]} numberOfLines={1}>
            {label}
          </Text>
        ) : null}
      </Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  label: {
    ...font.body,
    marginLeft: -2,
  },
});
