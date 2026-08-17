import { ReactNode, useState } from "react";
import { LayoutAnimation, Platform, Pressable, StyleSheet, Text, UIManager, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { useThemedStyles } from "../../lib/theme-provider";
import { font, radius, space, type ColorPalette } from "../../lib/theme";

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

function Chevron({ color, open }: { color: string; open: boolean }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path
        d={open ? "M18 15l-6-6-6 6" : "M6 9l6 6 6-6"}
        stroke={color}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/**
 * A titled section that can be folded away, with a tinted icon badge on the
 * left and a chevron on the right. The Post a Job form is long enough that a
 * flat list of every field at once is hard to scan; grouping it into a few
 * collapsible cards lets a seller work through one part at a time.
 *
 * `defaultOpen` rather than a controlled prop: each card owns its own state so
 * the parent screen does not have to track a panel per section.
 */
export function CollapsibleCard({
  title,
  icon,
  children,
  defaultOpen = true,
  subtitle,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  subtitle?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const styles = useThemedStyles(buildStyles);
  const tones = useThemedStyles((c: ColorPalette) => ({ muted: c.textMuted }));

  return (
    <View style={styles.card}>
      <Pressable
        style={styles.header}
        onPress={() => {
          LayoutAnimation.configureNext(
            LayoutAnimation.Presets.easeInEaseOut
          );
          setOpen((v) => !v);
        }}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={title}
      >
        <View style={styles.iconBadge}>{icon}</View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        <Chevron color={tones.muted} open={open} />
      </Pressable>
      {open ? <View style={styles.body}>{children}</View> : null}
    </View>
  );
}

function buildStyles(color: ColorPalette) {
  return StyleSheet.create({
    card: {
      backgroundColor: color.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: color.border,
      marginBottom: space.md,
      overflow: "hidden",
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: space.md,
      padding: space.md,
    },
    iconBadge: {
      width: 34,
      height: 34,
      borderRadius: radius.sm,
      backgroundColor: color.brandTint,
      alignItems: "center",
      justifyContent: "center",
    },
    title: { ...font.title, color: color.text },
    subtitle: { ...font.caption, color: color.textMuted, marginTop: 1 },
    body: {
      paddingHorizontal: space.md,
      paddingBottom: space.md,
      gap: space.md,
    },
  });
}
