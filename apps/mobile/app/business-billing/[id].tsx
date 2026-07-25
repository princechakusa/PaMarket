import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import { BRAND_BLUE } from "../../lib/constants";
import { planEntitlements } from "../../lib/plan-entitlements";
import { EmptyState } from "../../components/ui/EmptyState";

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

const SUB_BADGE: Record<string, [string, string, string]> = {
  active: ["#EAF7EF", "#0f7a3d", "Active"],
  in_grace_period: ["#FFF4D6", "#92670A", "Grace period"],
  on_hold: ["#FFF4D6", "#92670A", "On hold"],
  canceled: ["#FEE4E2", "#B42318", "Canceled"],
  expired: ["#F1F5F9", "#64748B", "Expired"],
  paused: ["#F1F5F9", "#64748B", "Paused"],
  pending: ["#EEF2FF", "#1A3A8F", "Pending"],
};
const PACK_BADGE: Record<string, [string, string, string]> = {
  consumed: ["#EAF7EF", "#0f7a3d", "Active"],
  verified: ["#EEF2FF", "#1A3A8F", "Verifying"],
  pending: ["#FFF4D6", "#92670A", "Pending"],
  failed: ["#FEE4E2", "#B42318", "Failed"],
};

function Badge({ tuple }: { tuple: [string, string, string] }) {
  return (
    <View style={[styles.badge, { backgroundColor: tuple[0] }]}>
      <Text style={[styles.badgeText, { color: tuple[1] }]}>{tuple[2]}</Text>
    </View>
  );
}

// Mirrors www/js/business-monetization.js pages.BusinessBilling — read-only
// history of Google Play Billing purchases. No purchase logic here (that's
// billing.js, deferred); the underlying tables will simply be empty until
// react-native-iap is wired up.
export default function BusinessBillingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();

  const [isOwner, setIsOwner] = useState<boolean | null>(null);
  const [subs, setSubs] = useState<PlaySubscription[]>([]);
  const [packs, setPacks] = useState<SlotPack[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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
        <ActivityIndicator color={BRAND_BLUE} />
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
        <Text style={styles.infoTitle}>Billed through Google Play</Text>
        <Text style={styles.infoText}>
          All purchases are made and managed through Google Play. To update your payment method or cancel a
          subscription, use the Google Play Store app.
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
              <Badge tuple={SUB_BADGE[s.subscription_state] || SUB_BADGE.pending} />
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
              <Badge tuple={PACK_BADGE[p.status] || PACK_BADGE.pending} />
            </View>
          ))
        ) : (
          <Text style={styles.emptyText}>No slot purchases yet.</Text>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F6F9" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  infoBox: { backgroundColor: "#EEF2FB", borderWidth: 1, borderColor: "#C7D7F8", borderRadius: 14, padding: 16, marginBottom: 18 },
  infoTitle: { fontSize: 13, fontWeight: "800", color: BRAND_BLUE, marginBottom: 4 },
  infoText: { fontSize: 12.5, color: "#475569", lineHeight: 19 },
  sectionTitle: { fontSize: 13, fontWeight: "800", color: "#111827", marginBottom: 6 },
  box: { backgroundColor: "#ffffff", borderRadius: 16, paddingHorizontal: 16, marginBottom: 18 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E8ECF4",
  },
  rowTitle: { fontSize: 13.5, fontWeight: "700", color: "#111827" },
  rowSub: { fontSize: 11.5, color: "#8A93A6", marginTop: 2 },
  badge: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontSize: 9.5, fontWeight: "800" },
  emptyText: { textAlign: "center", color: "#8A93A6", fontSize: 13, paddingVertical: 20 },
});
