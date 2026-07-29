import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import { planEntitlements } from "../../lib/plan-entitlements";
import { EmptyState } from "../../components/ui/EmptyState";
import type { ColorPalette } from "../../lib/theme";
import { useThemedStyles } from "../../lib/theme-provider";

type PlaySubscription = {
  id: string;
  product_id: string;
  plan_id: string;
  billing_cycle: string;
  subscription_state: string;
  expiry_time: string | null;
  created_at: string;
};

type SlotPack = {
  id: string;
  product_id: string;
  extra_slots: number;
  status: string;
  created_at: string;
};

type Styles = ReturnType<typeof buildStyles>;

function buildBadgeTones(color: ColorPalette) {
  return {
    brand: color.brand,
    sub: {
      active: [color.successTint, color.success, "Active"],
      in_grace_period: [color.warningTint, color.warning, "Grace period"],
      on_hold: [color.warningTint, color.warning, "On hold"],
      canceled: [color.dangerTint, color.danger, "Canceled"],
      expired: [color.surfaceAlt, color.textMuted, "Expired"],
      paused: [color.surfaceAlt, color.textMuted, "Paused"],
      pending: [color.brandTint, color.brand, "Pending"],
    } as Record<string, [string, string, string]>,
    pack: {
      consumed: [color.successTint, color.success, "Active"],
      verified: [color.brandTint, color.brand, "Verifying"],
      pending: [color.warningTint, color.warning, "Pending"],
      failed: [color.dangerTint, color.danger, "Failed"],
    } as Record<string, [string, string, string]>,
  };
}

function Badge({ tuple, styles }: { tuple: [string, string, string]; styles: Styles }) {
  return (
    <View style={[styles.badge, { backgroundColor: tuple[0] }]}>
      <Text style={[styles.badgeText, { color: tuple[1] }]}>{tuple[2]}</Text>
    </View>
  );
}

// Read-only history of app-store purchases. No purchase logic here; the
// underlying tables will simply be empty until react-native-iap is wired up.
export default function BusinessBillingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const styles = useThemedStyles(buildStyles);
  const tones = useThemedStyles(buildBadgeTones);

  const [isOwner, setIsOwner] = useState<boolean | null>(null);
  const [subs, setSubs] = useState<PlaySubscription[]>([]);
  const [packs, setPacks] = useState<SlotPack[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const storeName = Platform.OS === "ios" ? "App Store" : "Google Play";

  const load = useCallback(async () => {
    if (!id || !session?.user) return;
    const { data: biz } = await supabase.from("businesses").select("owner_user_id").eq("id", id).maybeSingle();
    if (!biz || biz.owner_user_id !== session.user.id) {
      setIsOwner(false);
      return;
    }
    setIsOwner(true);
    const [subsRes, packsRes] = await Promise.all([
      supabase
        .from("play_subscriptions")
        .select("id,product_id,plan_id,billing_cycle,subscription_state,expiry_time,created_at")
        .eq("business_id", id)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("featured_slot_packs")
        .select("id,product_id,extra_slots,status,created_at")
        .eq("business_id", id)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);
    setSubs((subsRes.data as PlaySubscription[]) ?? []);
    setPacks((packsRes.data as SlotPack[]) ?? []);
  }, [id, session]);

  useEffect(() => {
    setIsLoading(true);
    load().finally(() => setIsLoading(false));
  }, [load]);

  if (isLoading || isOwner === null) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={tones.brand} />
      </View>
    );
  }

  if (!isOwner) {
    return (
      <View style={styles.centered}>
        <EmptyState title="Owner only" subtitle="Only the owner can view billing." />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <View style={styles.infoBox}>
        <Text style={styles.infoTitle}>Billed through {storeName}</Text>
        <Text style={styles.infoText}>
          All purchases are made and managed through {storeName}. To update your payment method or cancel a
          subscription, use your {storeName} account settings.
        </Text>
      </View>

      <Text style={styles.sectionTitle}>Subscription History</Text>
      <View style={styles.box}>
        {subs.length ? (
          subs.map((s) => (
            <View key={s.id} style={styles.row}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.rowTitle}>
                  {planEntitlements(s.plan_id).name} · {s.billing_cycle}
                </Text>
                {s.expiry_time ? (
                  <Text style={styles.rowSub}>Renews/expires {new Date(s.expiry_time).toLocaleDateString()}</Text>
                ) : null}
              </View>
              <Badge tuple={tones.sub[s.subscription_state] || tones.sub.pending} styles={styles} />
            </View>
          ))
        ) : (
          <Text style={styles.emptyText}>No subscription purchases yet.</Text>
        )}
      </View>

      <Text style={styles.sectionTitle}>Featured Slot Purchases</Text>
      <View style={styles.box}>
        {packs.length ? (
          packs.map((p) => (
            <View key={p.id} style={styles.row}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.rowTitle}>
                  +{p.extra_slots} featured slot{p.extra_slots === 1 ? "" : "s"}
                </Text>
                <Text style={styles.rowSub}>{new Date(p.created_at).toLocaleDateString()}</Text>
              </View>
              <Badge tuple={tones.pack[p.status] || tones.pack.pending} styles={styles} />
            </View>
          ))
        ) : (
          <Text style={styles.emptyText}>No slot purchases yet.</Text>
        )}
      </View>
    </ScrollView>
  );
}

function buildStyles(color: ColorPalette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: color.bg },
    centered: { flex: 1, alignItems: "center", justifyContent: "center" },
    infoBox: { backgroundColor: color.brandTint, borderWidth: 1, borderColor: color.brandTintStrong, borderRadius: 14, padding: 16, marginBottom: 18 },
    infoTitle: { fontSize: 13, fontWeight: "800", color: color.brand, marginBottom: 4 },
    infoText: { fontSize: 12.5, color: color.textSub, lineHeight: 19 },
    sectionTitle: { fontSize: 13, fontWeight: "800", color: color.text, marginBottom: 6 },
    box: { backgroundColor: color.surface, borderRadius: 16, paddingHorizontal: 16, marginBottom: 18 },
    row: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 12,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: color.border,
    },
    rowTitle: { fontSize: 13.5, fontWeight: "700", color: color.text },
    rowSub: { fontSize: 11.5, color: color.textMuted, marginTop: 2 },
    badge: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 },
    badgeText: { fontSize: 9.5, fontWeight: "800" },
    emptyText: { textAlign: "center", color: color.textMuted, fontSize: 13, paddingVertical: 20 },
  });
}
