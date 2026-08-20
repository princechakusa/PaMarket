import { Pressable, StyleSheet, Text } from "react-native";
import * as Haptics from "expo-haptics";
import { font, radius, space, type ColorPalette } from "../../lib/theme";
import { useThemedStyles } from "../../lib/theme-provider";

type ChipProps = {
  label: string;
  active?: boolean;
  onPress?: () => void;
  tone?: "brand" | "neutral";
};

function buildStyles(color: ColorPalette) {
  return StyleSheet.create({
    chip: {
      minHeight: 44,
      paddingHorizontal: space.lg,
      paddingVertical: space.sm,
      borderRadius: radius.pill,
      borderWidth: 1,
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    },
    inactive: {
      backgroundColor: color.surface,
      borderColor: color.borderStrong,
    },
    pressed: { opacity: 0.8 },
    label: { ...font.caption, textAlign: "center" },
    labelActive: { color: color.textOnBrand },
    labelInactive: { color: color.textSub },
  });
}

function buildActiveBg(color: ColorPalette) {
  return { brand: color.brand, neutral: color.text };
}

// Filter / selector pill. Solid brand fill when active, quiet outline when not.
export function Chip({ label, active, onPress, tone = "brand" }: ChipProps) {
  const styles = useThemedStyles(buildStyles);
  const activeBgByTone = useThemedStyles(buildActiveBg);
  const activeBg = activeBgByTone[tone];

  function handlePress() {
    Haptics.selectionAsync().catch(() => {});
    onPress?.();
  }

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        styles.chip,
        active ? { backgroundColor: activeBg, borderColor: activeBg } : styles.inactive,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.label, active ? styles.labelActive : styles.labelInactive]}>{label}</Text>
    </Pressable>
  );
}
