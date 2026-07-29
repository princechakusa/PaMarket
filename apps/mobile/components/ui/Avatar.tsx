import { StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { font, type ColorPalette } from "../../lib/theme";
import { useThemedStyles } from "../../lib/theme-provider";

type AvatarProps = {
  uri?: string | null;
  name?: string | null;
  size?: number;
  online?: boolean;
  ring?: boolean;
};

function initials(name?: string | null) {
  const n = (name || "").trim();
  if (!n) return "?";
  const parts = n.split(/\s+/);
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

function buildStyles(color: ColorPalette) {
  return StyleSheet.create({
    wrap: {
      backgroundColor: color.brandTint,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
    },
    ring: { borderWidth: 2, borderColor: color.surface },
    initials: { ...font.bodyStrong, color: color.brand },
    dot: {
      position: "absolute",
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: color.online,
      borderWidth: 2,
      borderColor: color.surface,
    },
  });
}

export function Avatar({ uri, name, size = 44, online, ring }: AvatarProps) {
  const styles = useThemedStyles(buildStyles);
  const r = size / 2;
  return (
    <View style={{ width: size, height: size }}>
      <View
        style={[
          styles.wrap,
          { width: size, height: size, borderRadius: r },
          ring && styles.ring,
        ]}
      >
        {uri ? (
          <Image source={{ uri }} style={{ width: "100%", height: "100%" }} />
        ) : (
          // lineHeight must scale with fontSize here — font.bodyStrong's fixed
          // lineHeight:21 was clipping the glyphs top/bottom on any avatar
          // larger than ~50px, where fontSize (size * 0.4) exceeds that box.
          <Text style={[styles.initials, { fontSize: size * 0.4, lineHeight: size * 0.46 }]}>{initials(name)}</Text>
        )}
      </View>
      {online ? <View style={[styles.dot, { right: 0, bottom: 0 }]} /> : null}
    </View>
  );
}
