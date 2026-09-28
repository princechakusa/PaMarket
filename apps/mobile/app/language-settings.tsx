import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Svg, { Polyline } from "react-native-svg";
import { useAuth } from "../lib/auth";
import { LANGUAGES, setLanguage, useLanguage, useT } from "../lib/i18n";
import { toast } from "../components/ui";
import type { ColorPalette } from "../lib/theme";
import { useThemedStyles } from "../lib/theme-provider";

// English / chiShona / isiNdebele (lib/i18n.ts). Applies instantly and is
// remembered on this device and on the user's profile.
export default function LanguageSettingsScreen() {
  const styles = useThemedStyles(buildStyles);
  const tones = useThemedStyles(buildTones);
  const { session } = useAuth();
  const lang = useLanguage();
  const tr = useT();

  async function choose(code: (typeof LANGUAGES)[number]["code"]) {
    if (code === lang) return;
    await setLanguage(code, session?.user?.id ?? null);
    const picked = LANGUAGES.find((l) => l.code === code);
    toast(picked ? picked.name : "");
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <View style={styles.card}>
        {LANGUAGES.map((l, i) => {
          const on = l.code === lang;
          return (
            <Pressable
              key={l.code}
              style={[styles.row, i > 0 && styles.rowBorder]}
              onPress={() => void choose(l.code)}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
            >
              <View style={on ? styles.radioOn : styles.radioOff} />
              <View style={{ flex: 1 }}>
                <Text style={styles.rowLabel}>{l.name}</Text>
                <Text style={styles.rowSub}>{l.english}</Text>
              </View>
              {on ? (
                <Svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke={tones.brand} strokeWidth={2.5}>
                  <Polyline points="20 6 9 17 4 12" />
                </Svg>
              ) : null}
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.note}>{tr("settings.languageNote")}</Text>
    </ScrollView>
  );
}

function buildTones(color: ColorPalette) {
  return { brand: color.brand };
}

function buildStyles(color: ColorPalette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: color.bg },
    card: { backgroundColor: color.surface, borderRadius: 14, overflow: "hidden" },
    row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 14 },
    rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.border },
    radioOn: { width: 20, height: 20, borderRadius: 10, borderWidth: 6, borderColor: color.brand },
    radioOff: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: color.borderStrong },
    rowLabel: { fontSize: 15, fontWeight: "700", color: color.text },
    rowSub: { fontSize: 12, color: color.textSub, marginTop: 2 },
    note: { fontSize: 13, color: color.textSub, marginTop: 14, lineHeight: 19, paddingHorizontal: 4 },
  });
}
