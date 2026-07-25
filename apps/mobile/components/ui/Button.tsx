import { ActivityIndicator, Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { font, radius, space, type ColorPalette } from "../../lib/theme";
import { useThemedStyles } from "../../lib/theme-provider";

type Variant = "primary" | "gold" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

type ButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  fullWidth?: boolean;
  style?: ViewStyle | ViewStyle[];
};

const HEIGHTS: Record<Size, number> = { sm: 38, md: 46, lg: 54 };
const FONTSIZES: Record<Size, number> = { sm: 13, md: 15, lg: 16 };

function buildVariants(color: ColorPalette): Record<Variant, { bg: string; fg: string; border?: string }> {
  return {
    primary: { bg: color.brand, fg: color.textOnBrand },
    gold: { bg: color.gold, fg: "#FFFFFF" },
    secondary: { bg: color.surface, fg: color.text, border: color.borderStrong },
    ghost: { bg: "transparent", fg: color.brand },
    danger: { bg: color.dangerTint, fg: color.danger },
  };
}

function buildStyles(_color: ColorPalette) {
  return StyleSheet.create({
    base: {
      borderRadius: radius.md,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: space.xl,
    },
    bordered: { borderWidth: 1 },
    fullWidth: { alignSelf: "stretch" },
    pressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
    disabled: { opacity: 0.5 },
    content: { flexDirection: "row", alignItems: "center", gap: space.sm },
    label: { ...font.bodyStrong },
  });
}

export function Button({
  label,
  onPress,
  variant = "primary",
  size = "md",
  loading,
  disabled,
  icon,
  fullWidth = true,
  style,
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const styles = useThemedStyles(buildStyles);
  const variants = useThemedStyles(buildVariants);
  const palette = variants[variant];

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        { height: HEIGHTS[size], backgroundColor: palette.bg, borderColor: palette.border },
        palette.border ? styles.bordered : null,
        fullWidth && styles.fullWidth,
        pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.fg} size="small" />
      ) : (
        <View style={styles.content}>
          {icon}
          <Text style={[styles.label, { color: palette.fg, fontSize: FONTSIZES[size] }]}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}
