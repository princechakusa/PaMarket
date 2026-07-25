import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Line, Path, Polyline } from "react-native-svg";
import { toast } from "../components/ui/Toast";
import { useThemePreference, useThemedStyles, type ThemePreference } from "../lib/theme-provider";
import { font, radius, space, type ColorPalette } from "../lib/theme";

// Persists via expo-secure-store (lib/theme-provider.tsx) and applies
// app-wide immediately — screens built on useThemedStyles() re-render in
// the new palette as soon as this is selected.
type ThemeId = ThemePreference;

const OPTIONS: { id: ThemeId; name: string; desc: string }[] = [
  { id: "light", name: "Light", desc: "White background, navy text" },
  { id: "dark", name: "Dark", desc: "Dark background, soft text" },
  { id: "system", name: "System Default", desc: "Follows your device setting" },
];

function PreviewIcon({ id, stroke }: { id: ThemeId; stroke: string }) {
  if (id === "dark") {
    return (
      <Svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke={stroke} strokeWidth={2}>
        <Path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      </Svg>
    );
  }
  return (
    <Svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke={stroke} strokeWidth={2}>
      <Circle cx={12} cy={12} r={id === "light" ? 5 : 3} />
      <Line x1={12} y1={1} x2={12} y2={3} />
      <Line x1={12} y1={21} x2={12} y2={23} />
      <Line x1={4.22} y1={4.22} x2={5.64} y2={5.64} />
      <Line x1={18.36} y1={18.36} x2={19.78} y2={19.78} />
      <Line x1={1} y1={12} x2={3} y2={12} />
      <Line x1={21} y1={12} x2={23} y2={12} />
    </Svg>
  );
}

function buildStyles(color: ColorPalette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: color.bg },
    card: { backgroundColor: color.surface, borderRadius: radius.lg, overflow: "hidden" },
    row: { flexDirection: "row", alignItems: "center", gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.lg },
    rowBorder: { borderTopWidth: 1, borderTopColor: color.divider },
    radio: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 2,
      borderColor: color.borderStrong,
      alignItems: "center",
      justifyContent: "center",
    },
    radioOn: { borderColor: color.brand },
    radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: color.brand },
    preview: {
      width: 40,
      height: 40,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: color.border,
      backgroundColor: color.surfaceAlt,
      alignItems: "center",
      justifyContent: "center",
    },
    name: { ...font.title, color: color.text },
    desc: { ...font.caption, color: color.textMuted, marginTop: 2 },
    note: { ...font.caption, color: color.textMuted, lineHeight: 18, marginTop: space.lg, paddingHorizontal: space.xs },
  });
}

export default function ThemeSettingsScreen() {
  const { preference: current, setPreference, resolvedScheme } = useThemePreference();
  const styles = useThemedStyles(buildStyles);
  const iconStroke = resolvedScheme === "dark" ? "#4C6FD6" : "#1A3A8F";
  const goldStroke = "#F5A623";

  function selectTheme(id: ThemeId) {
    setPreference(id);
    toast("Theme updated");
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: space.lg }}>
      <View style={styles.card}>
        {OPTIONS.map((opt, i) => (
          <Pressable
            key={opt.id}
            style={[styles.row, i > 0 && styles.rowBorder]}
            onPress={() => selectTheme(opt.id)}
          >
            <View style={[styles.radio, current === opt.id && styles.radioOn]}>
              {current === opt.id ? <View style={styles.radioDot} /> : null}
            </View>
            <View style={styles.preview}>
              <PreviewIcon id={opt.id} stroke={opt.id === "dark" ? iconStroke : goldStroke} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{opt.name}</Text>
              <Text style={styles.desc}>{opt.desc}</Text>
            </View>
            {current === opt.id ? (
              <Svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke={iconStroke} strokeWidth={2.5}>
                <Polyline points="20 6 9 17 4 12" />
              </Svg>
            ) : null}
          </Pressable>
        ))}
      </View>
      <Text style={styles.note}>
        Your theme applies across the whole app immediately, and is remembered next time you open PaMarket.
      </Text>
    </ScrollView>
  );
}
