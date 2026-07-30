import type { ReactNode } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { font, glass, space, type ColorPalette } from "../../lib/theme";
import { useThemePreference, useThemedStyles } from "../../lib/theme-provider";
import { GlassBackButton, type GlassTone } from "./GlassBackButton";

// Shared frosted header bar for the ~20 detail-style screens that set
// headerShown:false in app/_layout.tsx and render their own header body —
// consolidates safe-area handling, back button and title styling that were
// previously reinvented per screen.
type GlassHeaderProps = {
  title?: string;
  onBack?: () => void;
  tone?: GlassTone;
  trailing?: ReactNode;
  transparentBg?: boolean; // true when floating over a photo hero (no solid surface behind the blur)
};

export function GlassHeader({ title, onBack, tone = "auto", trailing, transparentBg = false }: GlassHeaderProps) {
  const insets = useSafeAreaInsets();
  const styles = useThemedStyles(buildStyles);
  const { resolvedScheme } = useThemePreference();

  // Same tone→surface mapping as GlassBackButton: "light" means a light
  // (white) title/icon, which needs a DARK-tinted blur behind it for
  // contrast, and vice versa. "auto" follows the resolved app theme.
  const effectiveDark = tone === "light" ? true : tone === "dark" ? false : resolvedScheme === "dark";
  const titleColor = effectiveDark ? "#FFFFFF" : styles.title.color;

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + space.sm }]}>
      {!transparentBg && (
        <BlurView
          intensity={glass.intensity.standard}
          tint={effectiveDark ? "dark" : "light"}
          blurMethod={Platform.OS === "android" ? glass.androidBlurMethod : undefined}
          style={StyleSheet.absoluteFill}
        />
      )}
      <View style={styles.row}>
        <GlassBackButton onPress={onBack} tone={tone} />
        {title ? (
          <Text style={[styles.title, { color: titleColor }]} numberOfLines={1}>
            {title}
          </Text>
        ) : (
          <View style={{ flex: 1 }} />
        )}
        <View style={styles.trailing}>{trailing}</View>
      </View>
    </View>
  );
}

function buildStyles(color: ColorPalette) {
  return StyleSheet.create({
    wrap: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      zIndex: 20,
      paddingBottom: space.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: color.glassBorder,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: space.lg,
      gap: space.md,
    },
    title: {
      ...font.title,
      flex: 1,
      color: color.text,
    },
    trailing: {
      flexDirection: "row",
      alignItems: "center",
      gap: space.sm,
      minWidth: 38,
      justifyContent: "flex-end",
    },
  });
}
