import { StyleSheet, Text, View } from "react-native";
import Svg, { Line, Path } from "react-native-svg";
import { font, radius, space, type ColorPalette } from "../../lib/theme";
import { useThemePreference, useThemedStyles } from "../../lib/theme-provider";
import { Button } from "./Button";

type ErrorStateProps = {
  title?: string;
  subtitle?: string;
  onRetry?: () => void;
};

function buildStyles(color: ColorPalette) {
  return StyleSheet.create({
    container: { alignItems: "center", paddingHorizontal: space.xxl, paddingVertical: space.huge },
    iconWrap: {
      width: 72,
      height: 72,
      borderRadius: radius.xl,
      backgroundColor: color.dangerTint,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: space.lg,
    },
    title: { ...font.h3, color: color.text, textAlign: "center" },
    subtitle: { ...font.body, color: color.textMuted, textAlign: "center", marginTop: space.sm, maxWidth: 300 },
    action: { marginTop: space.xl },
  });
}

export function ErrorState({
  title = "Something went wrong",
  subtitle = "Please check your connection and try again.",
  onRetry,
}: ErrorStateProps) {
  const styles = useThemedStyles(buildStyles);
  const { resolvedScheme } = useThemePreference();
  const dangerStroke = resolvedScheme === "dark" ? "#EF4444" : "#DC2626";
  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>
        <Svg width={30} height={30} viewBox="0 0 24 24" fill="none" stroke={dangerStroke} strokeWidth={2}>
          <Path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <Line x1={12} y1={9} x2={12} y2={13} />
          <Line x1={12} y1={17} x2={12.01} y2={17} />
        </Svg>
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
      {onRetry ? (
        <View style={styles.action}>
          <Button label="Try Again" onPress={onRetry} variant="secondary" size="md" fullWidth={false} />
        </View>
      ) : null}
    </View>
  );
}
