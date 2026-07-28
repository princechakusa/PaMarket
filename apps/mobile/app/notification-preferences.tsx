import { useEffect, useState, type ReactElement } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import Svg, { Line, Path, Polygon, Polyline, Rect } from "react-native-svg";
import { toast } from "../components/ui/Toast";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import type { ColorPalette } from "../lib/theme";
import { useThemedStyles } from "../lib/theme-provider";

type PrefKey =
  | "messages"
  | "listings"
  | "approvals"
  | "promotions"
  | "favorites"
  | "priceDrops"
  | "recommendations"
  | "verificationReminders";

const DEFAULTS: Record<PrefKey, boolean> = {
  messages: true,
  listings: true,
  approvals: true,
  promotions: true,
  favorites: true,
  priceDrops: true,
  recommendations: true,
  verificationReminders: true,
};

const DB_COLUMNS: Record<PrefKey, string> = {
  messages: "messages",
  listings: "listing_updates",
  approvals: "approvals",
  promotions: "promotions",
  favorites: "favourites",
  priceDrops: "price_drops",
  recommendations: "recommendations",
  verificationReminders: "verification_reminders",
};

function buildRows(color: ColorPalette): { key: PrefKey; label: string; icon: ReactElement }[] {
  return [
    {
      key: "messages",
      label: "Messages",
      icon: (
        <Svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke={color.brand} strokeWidth={2}>
          <Path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </Svg>
      ),
    },
    {
      key: "listings",
      label: "Listing Updates",
      icon: (
        <Svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke={color.textMuted} strokeWidth={2}>
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
        <Svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke={color.success} strokeWidth={2}>
          <Polyline points="9 11 12 14 22 4" />
          <Path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
        </Svg>
      ),
    },
    {
      key: "promotions",
      label: "Promotions & Boosts",
      icon: (
        <Svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke={color.gold} strokeWidth={2}>
          <Polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </Svg>
      ),
    },
    {
      key: "favorites",
      label: "Saved Search & Favourite Alerts",
      icon: (
        <Svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke={color.danger} strokeWidth={2}>
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
    {
      key: "recommendations",
      label: "Recommendations & Reminders",
      icon: (
        <Svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke={color.gold} strokeWidth={2}>
          <Path d="M12 2l2.6 5.3L20 8l-4 3.9.9 5.5L12 14.8 7.1 17.4 8 11.9 4 8l5.4-.7L12 2z" />
        </Svg>
      ),
    },
    {
      key: "verificationReminders",
      label: "Verification Reminders",
      icon: (
        <Svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke={color.brand} strokeWidth={2}>
          <Path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <Polyline points="9 12 11 14 15 10" />
        </Svg>
      ),
    },
  ];
}

export default function NotificationPreferencesScreen() {
  const { session } = useAuth();
  const styles = useThemedStyles(buildStyles);
  const tones = useThemedStyles(buildTones);
  const palette = useThemedStyles(identityPalette);
  const rows = buildRows(palette);
  const [prefs, setPrefs] = useState<Record<PrefKey, boolean>>(DEFAULTS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function loadPreferences() {
      if (!session?.user.id) {
        if (active) setLoading(false);
        return;
      }
      const { data, error } = await supabase
        .from("notification_preferences")
        .select("messages,listing_updates,approvals,promotions,favourites,price_drops,recommendations,verification_reminders")
        .eq("user_id", session.user.id)
        .maybeSingle();
      if (!active) return;
      if (error) {
        toast("Could not load notification settings");
      } else if (data) {
        setPrefs({
          messages: data.messages ?? true,
          listings: data.listing_updates ?? true,
          approvals: data.approvals ?? true,
          promotions: data.promotions ?? true,
          favorites: data.favourites ?? true,
          priceDrops: data.price_drops ?? true,
          recommendations: data.recommendations ?? true,
          verificationReminders: data.verification_reminders ?? true,
        });
      }
      setLoading(false);
    }
    void loadPreferences();
    return () => {
      active = false;
    };
  }, [session?.user.id]);

  async function toggle(key: PrefKey) {
    if (!session?.user.id) return;
    const previous = prefs;
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);

    const payload: Record<string, string | boolean> = {
      user_id: session.user.id,
      updated_at: new Date().toISOString(),
    };
    for (const prefKey of Object.keys(DB_COLUMNS) as PrefKey[]) {
      payload[DB_COLUMNS[prefKey]] = next[prefKey];
    }
    const { error } = await supabase.from("notification_preferences").upsert(payload, { onConflict: "user_id" });
    if (error) {
      setPrefs(previous);
      toast("Could not save notification setting");
      return;
    }
    toast(next[key] ? "Enabled" : "Disabled");
  }

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={tones.brand} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <Text style={styles.sectionLabel}>Alerts</Text>
      <View style={styles.card}>
        {rows.map((row, i) => (
          <View key={row.key} style={[styles.row, i > 0 && styles.rowBorder]}>
            <View style={styles.iconWrap}>{row.icon}</View>
            <Text style={styles.rowLabel}>{row.label}</Text>
            <Switch
              value={prefs[row.key]}
              onValueChange={() => void toggle(row.key)}
              trackColor={{ true: tones.brand }}
            />
          </View>
        ))}
        <View style={[styles.row, styles.rowBorder]}>
          <View style={styles.iconWrap}>
            <Svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke={tones.brand} strokeWidth={2}>
              <Rect x={3} y={11} width={18} height={11} rx={2} />
              <Path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </Svg>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowLabel}>Security Alerts</Text>
            <Text style={styles.rowSub}>Login attempts & suspicious activity</Text>
          </View>
          <Switch value disabled trackColor={{ true: tones.brand }} />
        </View>
      </View>
      <Text style={styles.note}>Security Alerts cannot be disabled — they protect your account.</Text>
    </ScrollView>
  );
}

function buildTones(color: ColorPalette) {
  return { brand: color.brand };
}

function identityPalette(color: ColorPalette): ColorPalette {
  return color;
}

function buildStyles(color: ColorPalette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: color.bg },
    loading: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: color.bg },
    sectionLabel: {
      fontSize: 11,
      fontWeight: "700",
      color: color.textMuted,
      textTransform: "uppercase",
      letterSpacing: 0.4,
      marginBottom: 8,
    },
    card: { backgroundColor: color.surface, borderRadius: 14, overflow: "hidden" },
    row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
    rowBorder: { borderTopWidth: 1, borderTopColor: color.divider },
    iconWrap: { width: 30, height: 30, borderRadius: 8, backgroundColor: color.surfaceAlt, alignItems: "center", justifyContent: "center" },
    rowLabel: { flex: 1, fontSize: 14, fontWeight: "600", color: color.text },
    rowSub: { fontSize: 11.5, color: color.textMuted, marginTop: 2 },
    note: { fontSize: 12, color: color.textMuted, lineHeight: 18, marginTop: 12, paddingHorizontal: 4 },
  });
}
