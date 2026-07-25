import { ScrollView, StyleSheet, Text, View } from "react-native";
import Svg, { Polyline } from "react-native-svg";
import { BRAND_BLUE } from "../lib/constants";

// Mirrors www/js/settings.js pages.LanguageSettings — the app only supports
// English today, so this is an informational single-option screen.
export default function LanguageSettingsScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <View style={styles.card}>
        <View style={styles.row}>
          <View style={styles.radioOn} />
          <View style={{ flex: 1 }}>
            <Text style={styles.rowLabel}>English</Text>
            <Text style={styles.rowSub}>App display language</Text>
          </View>
          <Svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke={BRAND_BLUE} strokeWidth={2.5}>
            <Polyline points="20 6 9 17 4 12" />
          </Svg>
        </View>
      </View>
      <Text style={styles.note}>PaMarket uses English for all app screens and account communication.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F6F9" },
  card: { backgroundColor: "#ffffff", borderRadius: 14, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 14 },
  radioOn: { width: 20, height: 20, borderRadius: 10, borderWidth: 6, borderColor: BRAND_BLUE },
  rowLabel: { fontSize: 14, fontWeight: "700", color: "#111827" },
  rowSub: { fontSize: 12, color: "#8A93A6", marginTop: 2 },
  note: { fontSize: 12, color: "#8A93A6", lineHeight: 18, marginTop: 12, paddingHorizontal: 4 },
});
