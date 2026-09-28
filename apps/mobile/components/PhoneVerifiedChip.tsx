// Public "Phone verified" trust badge for sellers. Loads
// profiles_public.phone_verified on its own, so a database that hasn't run
// 20260928130000_phone_auth_and_verification.sql yet simply shows nothing
// instead of breaking the screen that hosts it.
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { supabase } from "../lib/supabase";
import { font, radius, space, type ColorPalette } from "../lib/theme";
import { useThemedStyles } from "../lib/theme-provider";

const cache = new Map<string, boolean>();

export function PhoneVerifiedChip({ userId }: { userId: string | null | undefined }) {
  const styles = useThemedStyles(buildStyles);
  const tones = useThemedStyles((c: ColorPalette) => ({ success: c.success }));
  const [verified, setVerified] = useState<boolean>(userId ? cache.get(userId) ?? false : false);

  useEffect(() => {
    if (!userId || cache.has(userId)) {
      if (userId) setVerified(cache.get(userId) ?? false);
      return;
    }
    let cancelled = false;
    supabase
      .from("profiles_public")
      .select("phone_verified")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data, error }) => {
        const value = !error && (data as { phone_verified?: boolean } | null)?.phone_verified === true;
        cache.set(userId, value);
        if (!cancelled) setVerified(value);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (!verified) return null;
  return (
    <View style={styles.chip} accessibilityLabel="Phone number verified">
      <Svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke={tones.success} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
        <Path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.18 2 2 0 0 1 4.08 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.1 9.9a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
        <Path d="M15 5l2 2 4-4" />
      </Svg>
      <Text style={styles.text}>Phone verified</Text>
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
      backgroundColor: color.successTint,
      borderRadius: radius.pill,
      paddingHorizontal: space.sm,
      paddingVertical: 3,
      marginTop: space.xs,
    },
    text: { ...font.micro, color: color.success },
  });
}
