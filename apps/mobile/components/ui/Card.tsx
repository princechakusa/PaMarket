import { StyleSheet, View, type ViewProps, type ViewStyle } from "react-native";
import { radius, shadow, space, type ColorPalette } from "../../lib/theme";
import { useThemedStyles } from "../../lib/theme-provider";

type CardProps = ViewProps & {
  padded?: boolean;
  elevated?: boolean;
  style?: ViewStyle | ViewStyle[];
};

function buildStyles(color: ColorPalette) {
  return StyleSheet.create({
    card: {
      backgroundColor: color.surface,
      borderRadius: radius.lg,
    },
    padded: {
      padding: space.lg,
    },
    flatBorder: {
      borderWidth: 1,
      borderColor: color.border,
    },
  });
}

// The canonical surface. Every content block sits on a Card so corner radius,
// border and elevation are identical everywhere.
export function Card({ padded = true, elevated = true, style, children, ...rest }: CardProps) {
  const styles = useThemedStyles(buildStyles);
  return (
    <View
      style={[styles.card, padded && styles.padded, elevated ? shadow.sm : styles.flatBorder, style]}
      {...rest}
    >
      {children}
    </View>
  );
}
