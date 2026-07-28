import { StyleSheet, Text, View } from "react-native";
import { font, radius, space, type ColorPalette } from "../../lib/theme";
import { useThemedStyles } from "../../lib/theme-provider";
import { Button } from "./Button";

type EmptyStateProps = {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  buttonLabel?: string;
  onPressButton?: () => void;
};

function buildStyles(color: ColorPalette) {
  return StyleSheet.create({
    container: { alignItems: "center", paddingHorizontal: space.xxl, paddingVertical: space.huge },
    iconWrap: {
      width: 72,
      height: 72,
      borderRadius: radius.xl,
      backgroundColor: color.brandTint,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: space.lg,
    },
    title: { ...font.h3, color: color.text, textAlign: "center" },
    subtitle: { ...font.body, color: color.textMuted, textAlign: "center", marginTop: space.sm, maxWidth: 300 },
    action: { marginTop: space.xl },
  });
}

// Warm, on-brand empty state — never a bare "nothing here" line.
export function EmptyState({ icon, title, subtitle, buttonLabel, onPressButton }: EmptyStateProps) {
  const styles = useThemedStyles(buildStyles);
  return (
    <View style={styles.container}>
      {icon ? <View style={styles.iconWrap}>{icon}</View> : null}
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {buttonLabel && onPressButton ? (
        <View style={styles.action}>
          <Button label={buttonLabel} onPress={onPressButton} size="md" fullWidth={false} />
        </View>
      ) : null}
    </View>
  );
}
