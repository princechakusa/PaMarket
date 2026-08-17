import { ReactNode } from "react";
import { StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";
import { useThemedStyles } from "../../lib/theme-provider";
import { font, radius, space, type ColorPalette } from "../../lib/theme";

/**
 * Puts two fields side by side, collapsing gracefully on narrow screens
 * because each half is flex:1 with minWidth:0 rather than a fixed width.
 */
export function FieldRow({ children }: { children: ReactNode }) {
  const styles = useThemedStyles(buildStyles);
  return <View style={styles.row}>{children}</View>;
}

export function FieldCol({ children }: { children: ReactNode }) {
  return <View style={{ flex: 1, minWidth: 0 }}>{children}</View>;
}

export function FieldLabel({
  text,
  required,
}: {
  text: string;
  required?: boolean;
}) {
  const styles = useThemedStyles(buildStyles);
  return (
    <Text style={styles.label}>
      {text}
      {required ? <Text style={styles.required}> *</Text> : null}
    </Text>
  );
}

/**
 * Multi-line input with the character count shown inside the field's bottom
 * right, matching the approved design. `limit` is advisory — it colours the
 * counter once exceeded but never truncates, because the real constraint is
 * on the *generated* description, not any single field.
 */
export function CountedTextArea({
  value,
  limit,
  minHeight = 96,
  ...props
}: TextInputProps & { value: string; limit: number; minHeight?: number }) {
  const styles = useThemedStyles(buildStyles);
  const tones = useThemedStyles((c: ColorPalette) => ({
    muted: c.textMuted,
    danger: c.danger,
  }));
  const over = value.length > limit;
  return (
    <View style={styles.areaWrap}>
      <TextInput
        {...props}
        value={value}
        multiline
        style={[styles.area, { minHeight }]}
        placeholderTextColor={tones.muted}
        textAlignVertical="top"
      />
      <Text
        style={[styles.counter, over && { color: tones.danger, fontWeight: "700" }]}
      >
        {value.length} / {limit}
      </Text>
    </View>
  );
}

function buildStyles(color: ColorPalette) {
  return StyleSheet.create({
    row: { flexDirection: "row", gap: space.md },
    label: {
      ...font.caption,
      color: color.text,
      fontWeight: "700",
      marginBottom: 6,
    },
    required: { color: color.danger },
    areaWrap: { position: "relative" },
    area: {
      ...font.body,
      color: color.text,
      backgroundColor: color.surface,
      borderWidth: 1,
      borderColor: color.border,
      borderRadius: radius.md,
      paddingHorizontal: space.md,
      paddingTop: space.md,
      paddingBottom: 26,
    },
    counter: {
      ...font.caption,
      color: color.textMuted,
      position: "absolute",
      right: space.md,
      bottom: 8,
    },
  });
}
