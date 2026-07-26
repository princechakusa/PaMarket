import { Platform, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import Svg, { Polyline } from "react-native-svg";
import { glass, hitSlop as defaultHitSlop } from "../../lib/theme";
import { useThemePreference } from "../../lib/theme-provider";

// One shared back button, replacing the ~21 screens that each hand-rolled
// their own Pressable + inline chevron SVG + one-off circle/opacity values.
// `tone` lets a screen opt into a light or dark icon+blur combo for use over
// photo heroes or brand-colored banners, without re-implementing the button.
export type GlassTone = "auto" | "light" | "dark";

type GlassBackButtonProps = {
  onPress?: () => void;
  tone?: GlassTone;
  size?: number;
  style?: StyleProp<ViewStyle>;
};

function ChevronIcon({ color, size }: { color: string; size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round">
      <Polyline points="15 18 9 12 15 6" />
    </Svg>
  );
}

export function GlassBackButton({ onPress, tone = "auto", size = 38, style }: GlassBackButtonProps) {
  const router = useRouter();
  const { resolvedScheme } = useThemePreference();
  const isDark = resolvedScheme === "dark";

  // "auto" follows the active theme; "light"/"dark" let a screen force a
  // legible icon+blur combo when the surface behind it is a photo or a
  // brand-colored banner rather than the app's own background.
  const effectiveDark = tone === "light" ? false : tone === "dark" ? true : isDark;
  const iconColor = effectiveDark ? "#FFFFFF" : "#111827";
  const blurTint = effectiveDark ? "dark" : "light";
  const borderColor = effectiveDark ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.7)";

  function handlePress() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (onPress) onPress();
    else if (router.canGoBack()) router.back();
  }

  return (
    <Pressable
      onPress={handlePress}
      hitSlop={defaultHitSlop}
      accessibilityRole="button"
      accessibilityLabel="Go back"
      style={({ pressed }) => [
        styles.wrap,
        { width: size, height: size, borderRadius: size / 2, borderColor, opacity: pressed ? 0.7 : 1 },
        style,
      ]}
    >
      <BlurView
        intensity={glass.intensity.standard}
        tint={blurTint}
        experimentalBlurMethod={Platform.OS === "android" ? glass.androidBlurMethod : undefined}
        style={StyleSheet.absoluteFill}
      />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: effectiveDark ? "rgba(0,0,0,0.18)" : "rgba(255,255,255,0.28)" }]} />
      <ChevronIcon color={iconColor} size={Math.round(size * 0.5)} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth * 1.5,
  },
});
