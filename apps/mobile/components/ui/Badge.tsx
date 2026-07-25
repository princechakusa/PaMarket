import { StyleSheet, Text, View } from "react-native";
import Svg, { Polyline } from "react-native-svg";
import { font, radius, space, type ColorPalette } from "../../lib/theme";
import { useThemedStyles } from "../../lib/theme-provider";

type Tone = "brand" | "gold" | "success" | "warning" | "danger" | "info" | "neutral";

function buildTones(color: ColorPalette): Record<Tone, { bg: string; fg: string }> {
  return {
    brand: { bg: color.brandTint, fg: color.brand },
    gold: { bg: color.goldTint, fg: color.goldDark },
    success: { bg: color.successTint, fg: color.success },
    warning: { bg: color.warningTint, fg: color.warning },
    danger: { bg: color.dangerTint, fg: color.danger },
    info: { bg: color.infoTint, fg: color.info },
    neutral: { bg: color.surfaceAlt, fg: color.textSub },
  };
}

function buildStyles(color: ColorPalette) {
  return StyleSheet.create({
    badge: {
      borderRadius: radius.sm,
      paddingHorizontal: space.sm,
      paddingVertical: 3,
      alignSelf: "flex-start",
    },
    label: { ...font.micro },
    verified: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: color.info,
      borderRadius: radius.pill,
      paddingHorizontal: 8,
      paddingVertical: 3,
      alignSelf: "flex-start",
    },
    verifiedText: { ...font.micro, color: "#FFFFFF" },
  });
}

export function Badge({ label, tone = "neutral" }: { label: string; tone?: Tone }) {
  const styles = useThemedStyles(buildStyles);
  const tones = useThemedStyles(buildTones);
  const t = tones[tone];
  return (
    <View style={[styles.badge, { backgroundColor: t.bg }]}>
      <Text style={[styles.label, { color: t.fg }]}>{label}</Text>
    </View>
  );
}

// The "Verified" seller badge — a filled check pill, used consistently.
export function VerifiedBadge({ label = "Verified", compact }: { label?: string; compact?: boolean }) {
  const styles = useThemedStyles(buildStyles);
  return (
    <View style={styles.verified}>
      <Svg width={compact ? 9 : 11} height={compact ? 9 : 11} viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth={3.5}>
        <Polyline points="20 6 9 17 4 12" />
      </Svg>
      {!compact ? <Text style={styles.verifiedText}>{label}</Text> : null}
    </View>
  );
}
