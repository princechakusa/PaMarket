import { useCallback, useEffect, useState, type ReactElement } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import Svg, { Circle, Path, Polyline } from "react-native-svg";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { toast } from "../components/ui/Toast";
import type { ColorPalette } from "../lib/theme";
import { useThemedStyles } from "../lib/theme-provider";

// Mirrors www/js/settings.js pages.PrivacySettings / H._privacySettings.toggle.
// Persists to the real profiles.privacy jsonb column (see
// supabase/migrations/stabilize_schema_2026_06.sql — "profiles.privacy" —
// per-user privacy toggles), same column the web app writes to, so toggles
// made here are visible on the web app and vice versa.
type PrivacyKey = "profilePublic" | "showPhoneInListings" | "allowMessages" | "showActivity";

const DEFAULTS: Record<PrivacyKey, boolean> = {
  profilePublic: true,
  showPhoneInListings: false,
  allowMessages: true,
  showActivity: false,
};

const LABELS: Record<PrivacyKey, { on: string; off: string }> = {
  profilePublic: { on: "Profile is now public", off: "Profile is now private" },
  showPhoneInListings: { on: "Phone number visible in listings", off: "Phone number hidden from listings" },
  allowMessages: { on: "Direct messages allowed", off: "Direct messages are blocked" },
  showActivity: { on: "Activity status is visible", off: "Activity status is hidden" },
};

function buildRows(color: ColorPalette): { key: PrivacyKey; label: string; sub: string; icon: ReactElement }[] {
  return [
    {
      key: "profilePublic",
      label: "Public Profile",
      sub: "Others can view your profile",
      icon: (
        <Svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke={color.brand} strokeWidth={2}>
          <Path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <Circle cx={12} cy={12} r={3} />
        </Svg>
      ),
    },
    {
      key: "showPhoneInListings",
      label: "Show Phone in Listings",
      sub: "Buyers see your phone number",
      icon: (
        <Svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke={color.textMuted} strokeWidth={2}>
          <Path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.362 2.1.74 3.26a2 2 0 0 1-.45 2.11l-1.27 1.27a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c1.16.38 2.3.61 3.26.74a2 2 0 0 1 1.72 2.03z" />
        </Svg>
      ),
    },
    {
      key: "allowMessages",
      label: "Allow Direct Messages",
      sub: "Others can message you directly",
      icon: (
        <Svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke={color.brand} strokeWidth={2}>
          <Path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </Svg>
      ),
    },
    {
      key: "showActivity",
      label: "Show Activity Status",
      sub: "Others see when you are online",
      icon: (
        <Svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke={color.textMuted} strokeWidth={2}>
          <Circle cx={12} cy={12} r={10} />
          <Polyline points="12 6 12 12 16 14" />
        </Svg>
      ),
    },
  ];
}

export default function PrivacySettingsScreen() {
  const styles = useThemedStyles(buildStyles);
  const tones = useThemedStyles(buildTones);
  const palette = useThemedStyles(identityPalette);
  const rows = buildRows(palette);
  const { session } = useAuth();
  const [privacy, setPrivacy] = useState<Record<PrivacyKey, boolean>>(DEFAULTS);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    if (!session?.user) return;
    const { data } = await supabase.from("profiles").select("privacy").eq("id", session.user.id).maybeSingle();
    if (data?.privacy) setPrivacy({ ...DEFAULTS, ...data.privacy });
  }, [session]);

  useEffect(() => {
    setIsLoading(true);
    load().finally(() => setIsLoading(false));
  }, [load]);

  async function toggle(key: PrivacyKey, value: boolean) {
    if (!session?.user) return;
    const next = { ...privacy, [key]: value };
    setPrivacy(next);
    toast(value ? LABELS[key].on : LABELS[key].off);
    const { error } = await supabase.from("profiles").update({ privacy: next }).eq("id", session.user.id);
    if (error) {
      setPrivacy(privacy);
      toast("Could not update privacy setting. Try again.", 3000, true);
    }
  }

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={tones.brand} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <Text style={styles.sectionLabel}>Profile</Text>
      <View style={styles.card}>
        {rows.map((row, i) => (
          <View key={row.key} style={[styles.row, i > 0 && styles.rowBorder]}>
            <View style={styles.iconWrap}>{row.icon}</View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>{row.label}</Text>
              <Text style={styles.rowSub}>{row.sub}</Text>
            </View>
            <Switch
              value={privacy[row.key]}
              onValueChange={(v) => toggle(row.key, v)}
              trackColor={{ true: tones.brand }}
            />
          </View>
        ))}
      </View>
      <Text style={styles.note}>
        Changes apply immediately. Other users see the updated visibility on their next visit to your profile.
      </Text>
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
    centered: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: color.bg },
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
    rowLabel: { fontSize: 14, fontWeight: "600", color: color.text },
    rowSub: { fontSize: 11.5, color: color.textMuted, marginTop: 2 },
    note: { fontSize: 12, color: color.textMuted, lineHeight: 18, marginTop: 12, paddingHorizontal: 4 },
  });
}
