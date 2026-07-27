import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import Svg, { Polyline } from "react-native-svg";
import { hitSlop as defaultHitSlop } from "../../lib/theme";

// One shared custom back button. It mirrors the rounded iOS-style control
// used by the app's native Stack headers: a floating circular surface with a
// single chevron. `label` is kept for accessibility only.
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

export function GlassBackButton({ onPress, tone = "auto", size = 52, label = "Back", style }: GlassBackButtonProps) {
  const router = useRouter();
  void tone;

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
      accessibilityLabel={label ? `Go back to ${label}` : "Go back"}
      style={({ pressed }) => [
        styles.wrap,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          opacity: pressed ? 0.65 : 1,
        },
        style,
      ]}
    >
      <ChevronIcon color="#111827" size={Math.round(size * 0.5)} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.92)",
    shadowColor: "#101828",
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
});
