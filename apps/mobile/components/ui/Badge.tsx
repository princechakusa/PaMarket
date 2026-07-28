import { StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
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
    },
    verifiedText: { ...font.micro, color: color.text },
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

// The scalloped azure verified seal (Instagram/Meta style) — matches
// www/js/app.js H.verifiedBadge exactly (same path data, same #00A0E9 blue),
// replacing a plain blue "Verified" pill that had no equivalent on the web.
// Icon-only by default, same as every web call site; pass `label` only where
// a visible text label next to the seal is actually wanted.
export function VerifiedBadge({ label, compact }: { label?: string; compact?: boolean }) {
  const styles = useThemedStyles(buildStyles);
  const size = compact ? 12 : 15;
  return (
    <View style={styles.verified}>
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path
          fill="#00A0E9"
          d="M23 12l-2.44-2.79.34-3.69-3.61-.82-1.89-3.2L12 2.96 8.6 1.5 6.71 4.69 3.1 5.5l.34 3.7L1 12l2.44 2.78-.34 3.7 3.61.82L8.6 22.5l3.4-1.47 3.4 1.46 1.89-3.19 3.61-.82-.34-3.69L23 12z"
        />
        <Path d="M9.6 12.3l1.9 1.9 4.1-5.1" fill="none" stroke="#FFFFFF" strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
      {label ? <Text style={styles.verifiedText}>{label}</Text> : null}
    </View>
  );
}
