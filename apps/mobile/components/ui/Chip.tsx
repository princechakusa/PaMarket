import { Pressable, StyleSheet, Text } from "react-native";
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
      paddingHorizontal: space.lg,
      paddingVertical: space.sm,
      borderRadius: radius.pill,
      borderWidth: 1,
    },
    inactive: {
      backgroundColor: color.surface,
      borderColor: color.borderStrong,
    },
    pressed: { opacity: 0.8 },
    label: { ...font.caption },
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
  return (
    <Pressable
      onPress={onPress}
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
