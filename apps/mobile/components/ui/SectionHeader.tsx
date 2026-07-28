import { Pressable, StyleSheet, Text, View } from "react-native";
import { font, space, type ColorPalette } from "../../lib/theme";
import { useThemedStyles } from "../../lib/theme-provider";

type SectionHeaderProps = {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
};

function buildStyles(color: ColorPalette) {
  return StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "flex-end",
      justifyContent: "space-between",
      paddingHorizontal: space.lg,
      marginBottom: space.md,
    },
    titleWrap: { flex: 1, minWidth: 0 },
    title: { ...font.h3, color: color.text },
    subtitle: { ...font.sub, color: color.textMuted, marginTop: 2 },
    action: { ...font.caption, color: color.brand },
  });
}

// Consistent rail/section heading with an optional "See all" affordance.
export function SectionHeader({ title, subtitle, actionLabel, onAction }: SectionHeaderProps) {
  const styles = useThemedStyles(buildStyles);
  return (
    <View style={styles.row}>
      <View style={styles.titleWrap}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} hitSlop={8}>
          <Text style={styles.action}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
