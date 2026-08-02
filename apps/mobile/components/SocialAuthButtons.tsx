import { type ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { font, space, type ColorPalette } from "../lib/theme";
import { useThemedStyles } from "../lib/theme-provider";

// Shared between sign-in.tsx and sign-up.tsx — both need identical Google
// and Apple buttons (Guideline 4.8 requires Sign in with Apple wherever a
// third-party login is offered, and that pairing has to be consistent
// wherever a new account can be created, not just on one of the two
// screens).
export function GoogleIcon({ size = 17 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z"
      />
      <Path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.6 15.9 18.9 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4c-7.4 0-13.8 4.2-17.7 10.7z"
      />
      <Path
        fill="#4CAF50"
        d="M24 44c5.5 0 10.4-1.9 14.3-5.1l-6.6-5.6c-2 1.4-4.6 2.2-7.7 2.2-5.2 0-9.6-3.3-11.3-7.9l-6.6 5.1C9.9 39.7 16.4 44 24 44z"
      />
      <Path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.3-4.1 5.7l6.6 5.6C41.4 36.4 44 30.9 44 24c0-1.3-.1-2.7-.4-3.5z"
      />
    </Svg>
  );
}

export function AppleIcon({ size = 16, fill = "#FFFFFF" }: { size?: number; fill?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 384 512">
      <Path
        fill={fill}
        d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.6-2.8-74.5 20.7-88.5 20.7-14.8 0-48.8-19.7-75.6-19.2-39 .6-75 22.7-95.1 57.6-40.6 70.5-10.4 174.9 29.2 232.1 19.4 28 42.4 59.5 72.7 58.4 29.2-1.2 40.2-18.9 75.5-18.9 35.1 0 45.3 18.9 76.2 18.3 31.5-.6 51.4-28.6 70.6-56.8 22.3-32.5 31.5-64.1 32-65.7-.7-.3-61.7-23.7-62.3-97.1zM260.6 101.9C276.7 82.4 287.6 55.3 284.6 28c-23.3.9-51.5 15.5-68.2 35-15 17.3-28.1 45.1-24.6 71.6 26 .2 52.6-13.2 68.8-32.7z"
      />
    </Svg>
  );
}

export function SocialButton({
  label,
  icon,
  onPress,
  isLoading,
  dark = false,
}: {
  label: string;
  icon: ReactNode;
  onPress: () => void;
  isLoading?: boolean;
  dark?: boolean;
}) {
  const styles = useThemedStyles(buildStyles);
  const tones = useThemedStyles((c) => ({ brand: c.brand }));

  return (
    <Pressable
      style={[styles.socialButton, dark ? styles.socialButtonDark : styles.socialButtonLight, isLoading && styles.disabled]}
      onPress={onPress}
      disabled={isLoading}
    >
      {isLoading ? <ActivityIndicator color={dark ? "#FFFFFF" : tones.brand} /> : icon}
      <Text style={[styles.socialText, dark ? styles.socialTextDark : styles.socialTextLight]}>{label}</Text>
    </Pressable>
  );
}

export function SocialDivider({ label = "OR" }: { label?: string }) {
  const styles = useThemedStyles(buildStyles);
  return (
    <View style={styles.divider}>
      <View style={styles.dividerLine} />
      <Text style={styles.dividerText}>{label}</Text>
      <View style={styles.dividerLine} />
    </View>
  );
}

function buildStyles(color: ColorPalette) {
  return StyleSheet.create({
    divider: {
      flexDirection: "row",
      alignItems: "center",
      gap: space.sm,
      marginBottom: space.lg,
    },
    dividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: color.border,
    },
    dividerText: {
      ...font.caption,
      fontWeight: "700",
      color: color.textMuted,
    },
    socialButton: {
      minHeight: 48,
      borderRadius: 10,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: space.sm,
      paddingHorizontal: space.lg,
      borderWidth: 1.5,
    },
    socialButtonDark: {
      backgroundColor: "#111827",
      borderColor: "#111827",
    },
    socialButtonLight: {
      backgroundColor: color.surface,
      borderColor: color.border,
    },
    socialText: {
      ...font.caption,
      fontWeight: "700",
      fontSize: 13.5,
    },
    socialTextDark: {
      color: "#FFFFFF",
    },
    socialTextLight: {
      color: color.text,
    },
    disabled: {
      opacity: 0.6,
    },
  });
}
