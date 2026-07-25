import { useState, type ReactElement } from "react";
import { ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import Svg, { Circle, Line, Path, Polygon, Polyline, Rect } from "react-native-svg";
import { BRAND_BLUE } from "../lib/constants";
import { toast } from "../components/ui/Toast";

// Mirrors www/js/settings.js pages.NotificationSettings. The web app keeps
// these in u.notificationPrefs, which is localStorage-only (no Supabase
// column backs it — verified against supabase/migrations, only
// profiles.privacy is a real jsonb column). This screen mirrors that: prefs
// live in local state for the session, not persisted server-side yet.
type PrefKey = "messages" | "listings" | "approvals" | "promotions" | "favorites" | "priceDrops";

const DEFAULTS: Record<PrefKey, boolean> = {
  messages: true,
  listings: true,
  approvals: true,
  promotions: true,
  favorites: true,
  priceDrops: true,
};

const ROWS: { key: PrefKey; label: string; icon: ReactElement }[] = [
  {
    key: "messages",
    label: "Messages",
    icon: (
      <Svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="#1A3A8F" strokeWidth={2}>
        <Path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </Svg>
    ),
  },
  {
    key: "listings",
    label: "Listing Updates",
    icon: (
      <Svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="#6B7280" strokeWidth={2}>
        <Line x1={8} y1={6} x2={21} y2={6} />
        <Line x1={8} y1={12} x2={21} y2={12} />
        <Line x1={8} y1={18} x2={21} y2={18} />
        <Line x1={3} y1={6} x2={3.01} y2={6} />
        <Line x1={3} y1={12} x2={3.01} y2={12} />
        <Line x1={3} y1={18} x2={3.01} y2={18} />
      </Svg>
    ),
  },
  {
    key: "approvals",
    label: "Approval Status",
    icon: (
      <Svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="#16A34A" strokeWidth={2}>
        <Polyline points="9 11 12 14 22 4" />
        <Path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
      </Svg>
    ),
  },
  {
    key: "promotions",
    label: "Promotions & Boosts",
    icon: (
      <Svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="#F5A623" strokeWidth={2}>
        <Polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </Svg>
    ),
  },
  {
    key: "favorites",
    label: "Saves on My Listings",
    icon: (
      <Svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="#DC2626" strokeWidth={2}>
        <Path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </Svg>
    ),
  },
  {
    key: "priceDrops",
    label: "Price Drop Alerts",
    icon: (
      <Svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="#7C3AED" strokeWidth={2}>
        <Polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
        <Polyline points="17 6 23 6 23 12" />
      </Svg>
    ),
  },
];

export default function NotificationPreferencesScreen() {
  const [prefs, setPrefs] = useState<Record<PrefKey, boolean>>(DEFAULTS);

  function toggle(key: PrefKey) {
    setPrefs((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      toast(next[key] ? "Enabled" : "Disabled");
      return next;
    });
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <Text style={styles.sectionLabel}>Alerts</Text>
      <View style={styles.card}>
        {ROWS.map((row, i) => (
          <View key={row.key} style={[styles.row, i > 0 && styles.rowBorder]}>
            <View style={styles.iconWrap}>{row.icon}</View>
            <Text style={styles.rowLabel}>{row.label}</Text>
            <Switch
              value={prefs[row.key]}
              onValueChange={() => toggle(row.key)}
              trackColor={{ true: BRAND_BLUE }}
            />
          </View>
        ))}
        <View style={[styles.row, styles.rowBorder]}>
          <View style={styles.iconWrap}>
            <Svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="#1A3A8F" strokeWidth={2}>
              <Rect x={3} y={11} width={18} height={11} rx={2} />
              <Path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </Svg>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowLabel}>Security Alerts</Text>
            <Text style={styles.rowSub}>Login attempts & suspicious activity</Text>
          </View>
          <Switch value disabled trackColor={{ true: BRAND_BLUE }} />
        </View>
      </View>
      <Text style={styles.note}>Security Alerts cannot be disabled — they protect your account.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F6F9" },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#8A93A6",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 8,
  },
  card: { backgroundColor: "#ffffff", borderRadius: 14, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  rowBorder: { borderTopWidth: 1, borderTopColor: "#F0F1F5" },
  iconWrap: { width: 30, height: 30, borderRadius: 8, backgroundColor: "#F0F1F5", alignItems: "center", justifyContent: "center" },
  rowLabel: { flex: 1, fontSize: 14, fontWeight: "600", color: "#111827" },
  rowSub: { fontSize: 11.5, color: "#8A93A6", marginTop: 2 },
  note: { fontSize: 12, color: "#8A93A6", lineHeight: 18, marginTop: 12, paddingHorizontal: 4 },
});
