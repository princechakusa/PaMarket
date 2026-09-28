// "Usually replies within an hour" — from seller_response_stats() (median
// reply time over the last 90 days). Shown only with 3+ replies of history
// and only when the answer is a day or less, so it's always a positive
// signal. Silently renders nothing if the function isn't deployed yet.
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Polyline } from "react-native-svg";
import { supabase } from "../lib/supabase";
import { font, radius, space, type ColorPalette } from "../lib/theme";
import { useThemedStyles } from "../lib/theme-provider";

const cache = new Map<string, string | null>();

export function responseLabel(medianMinutes: number | null | undefined, replies: number): string | null {
  if (replies < 3 || medianMinutes == null || !Number.isFinite(medianMinutes)) return null;
  if (medianMinutes <= 60) return "Usually replies within an hour";
  if (medianMinutes <= 4 * 60) return "Usually replies within a few hours";
  if (medianMinutes <= 24 * 60) return "Usually replies within a day";
  return null;
}

export function ResponseTimeChip({ userId }: { userId: string | null | undefined }) {
  const styles = useThemedStyles(buildStyles);
  const tones = useThemedStyles((c: ColorPalette) => ({ brand: c.brand }));
  const [label, setLabel] = useState<string | null>(userId ? cache.get(userId) ?? null : null);

  useEffect(() => {
    if (!userId) return;
    if (cache.has(userId)) {
      setLabel(cache.get(userId) ?? null);
      return;
    }
    let cancelled = false;
    supabase.rpc("seller_response_stats", { p_user: userId }).then(({ data, error }) => {
      const stats = data as { replies?: number; median_minutes?: number | null } | null;
      const value = error || !stats ? null : responseLabel(stats.median_minutes, Number(stats.replies ?? 0));
      cache.set(userId, value);
      if (!cancelled) setLabel(value);
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (!label) return null;
  return (
    <View style={styles.chip}>
      <Svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke={tones.brand} strokeWidth={2.4} strokeLinecap="round">
        <Circle cx={12} cy={12} r={9} />
        <Polyline points="12 7 12 12 15 14" />
      </Svg>
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

function buildStyles(color: ColorPalette) {
  return StyleSheet.create({
    chip: {
      flexDirection: "row",
      alignItems: "center",
      alignSelf: "flex-start",
      gap: space.xs,
      backgroundColor: color.surfaceAlt,
      borderRadius: radius.pill,
      paddingHorizontal: space.sm,
      paddingVertical: 3,
      marginTop: space.xs,
    },
    text: { ...font.micro, color: color.textSub },
  });
}
