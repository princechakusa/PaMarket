import { Pressable, StyleSheet, Text, View } from "react-native";
import { color, font, radius, shadow, space, type ColorPalette } from "../../lib/theme";
import { useThemedStyles } from "../../lib/theme-provider";

// Deliberately the smallest possible Home entry point (Phase 3 explicitly
// rules out rotating labels, heavy graphics, or a new dashboard section) --
// a single static row, same visual tier as the other Home sections but
// with no data to rail through (there's nothing to preview here, just a
// door into /institutions), so a Card-style row rather than a Rail is the
// honest shape for this.
export function InstitutionsEntry({ onPress }: { onPress: () => void }) {
  const styles = useThemedStyles(buildStyles);
  return (
    <Pressable style={({ pressed }) => [styles.row, pressed && styles.rowPressed]} onPress={onPress}>
      <View style={styles.iconWrap}>
        <Text style={styles.icon}>🎓</Text>
      </View>
      <View style={styles.body}>
        <Text style={styles.title}>Institutions</Text>
        <Text style={styles.subtitle}>Universities · High Schools · Organizations</Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

function buildStyles(color: ColorPalette) {
  return StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: space.md,
      marginHorizontal: space.lg,
      marginBottom: space.xl,
      backgroundColor: color.surface,
      borderRadius: radius.lg,
      padding: space.lg,
      borderWidth: 1,
      borderColor: color.border,
      ...shadow.sm,
    },
    rowPressed: { opacity: 0.9 },
    iconWrap: {
      width: 44, height: 44, borderRadius: radius.pill, backgroundColor: color.brandTint,
      alignItems: "center", justifyContent: "center",
    },
    icon: { fontSize: 20 },
    body: { flex: 1, gap: 2 },
    title: { ...font.title, color: color.text },
    subtitle: { ...font.caption, color: color.textMuted },
    chevron: { ...font.h3, color: color.textMuted },
  });
}
