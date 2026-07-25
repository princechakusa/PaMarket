import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Polyline } from "react-native-svg";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import { BRAND_BLUE } from "../../lib/constants";
import { RECRUITER_PLAN_ENTITLEMENTS, recruiterPlanEntitlements } from "../../lib/jobs";
import { toast } from "../../components/ui/Toast";

const PLAN_ORDER = ["free", "recruiter"];

function BackIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth={2.4}>
      <Polyline points="15 18 9 12 15 6" />
    </Svg>
  );
}

// Mirrors www/js/jobs.js H.pages.RecruiterSubscription — plan comparison
// only, matching the app/business-subscription/[id].tsx precedent: real
// upgrades go through Google Play Billing (supabase/migrations/
// add_recruiter_subscriptions.sql — recruiter_profiles / recruiter_
// subscriptions / play_recruiter_subscriptions + activate_recruiter_
// subscription RPC all exist server-side already), which is out of scope
// here, so "Upgrade" surfaces a coming-soon toast instead of a purchase
// flow. Current plan is read from recruiter_profiles.plan_id (defaults to
// 'free' — the row is only created lazily at first purchase).
export default function RecruiterSubscriptionScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const insets = useSafeAreaInsets();

  const [planId, setPlanId] = useState("free");
  const [jobsPosted, setJobsPosted] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    if (!session?.user) return;
    const [{ data: recruiterProfile }, { count }] = await Promise.all([
      supabase.from("recruiter_profiles").select("plan_id").eq("user_id", session.user.id).maybeSingle(),
      supabase
        .from("listings")
        .select("id", { count: "exact", head: true })
        .eq("category", "jobs")
        .eq("seller_id", session.user.id)
        .neq("status", "deleted"),
    ]);
    setPlanId((recruiterProfile as any)?.plan_id || "free");
    setJobsPosted(count ?? 0);
  }, [session]);

  useEffect(() => {
    setIsLoading(true);
    load().finally(() => setIsLoading(false));
  }, [load]);

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={BRAND_BLUE} />
      </View>
    );
  }

  const ent = recruiterPlanEntitlements(planId);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <BackIcon />
        </Pressable>
        <Text style={styles.headerTitle}>Recruiter Plan</Text>
        <View style={{ width: 20 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <View style={styles.hero}>
          <Text style={styles.heroLabel}>CURRENT PLAN</Text>
          <Text style={styles.heroPlan}>{ent.name}</Text>
          <Text style={styles.heroMeta}>
            {jobsPosted} active job post{jobsPosted === 1 ? "" : "s"}
            {ent.activeJobPosts < 0 ? "" : ` of ${ent.activeJobPosts}`}
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Available plans</Text>
        {PLAN_ORDER.map((id) => {
          const plan = RECRUITER_PLAN_ENTITLEMENTS[id];
          const isCurrent = id === planId;
          const higher = plan.rank > ent.rank;
          return (
            <View key={id} style={[styles.planCard, isCurrent && styles.planCardCurrent]}>
              <View style={styles.planHead}>
                <View style={styles.planNameRow}>
                  <Text style={styles.planName}>{plan.name}</Text>
                  {isCurrent ? (
                    <View style={styles.currentTag}>
                      <Text style={styles.currentTagText}>CURRENT</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.planPrice}>{plan.price === 0 ? "Free" : `$${plan.price}/mo`}</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.featuresBlock}>
                <Feature text={`${plan.activeJobPosts < 0 ? "Unlimited" : plan.activeJobPosts} active job posts`} />
                <Feature text={`${plan.candidateAccess} candidate access`} />
                <Feature text={`${plan.profileVisibility} profile visibility`} />
              </View>
              {!isCurrent && higher && plan.price > 0 ? (
                <Pressable
                  style={styles.upgradeButton}
                  onPress={() => toast(`Upgrading to ${plan.name} is coming soon`)}
                >
                  <Text style={styles.upgradeButtonText}>Upgrade to {plan.name}</Text>
                </Pressable>
              ) : null}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

function Feature({ text }: { text: string }) {
  return (
    <View style={styles.featureRow}>
      <Svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke={BRAND_BLUE} strokeWidth={2}>
        <Polyline points="20 6 9 17 4 12" />
      </Svg>
      <Text style={styles.featureText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F6F9" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: BRAND_BLUE,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerTitle: { fontSize: 17, fontWeight: "700", color: "#ffffff" },
  hero: { backgroundColor: "#ffffff", borderRadius: 16, padding: 18, marginBottom: 20 },
  heroLabel: { fontSize: 11, fontWeight: "800", color: "#8A93A6", letterSpacing: 0.6 },
  heroPlan: { fontSize: 22, fontWeight: "800", color: "#111827", marginTop: 4 },
  heroMeta: { fontSize: 12.5, color: "#5A6478", marginTop: 6 },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: "#111827", marginBottom: 10 },
  planCard: { backgroundColor: "#ffffff", borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1.5, borderColor: "#E8ECF4" },
  planCardCurrent: { borderColor: BRAND_BLUE },
  planHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  planNameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  planName: { fontSize: 16, fontWeight: "800", color: "#111827" },
  planPrice: { fontSize: 15, fontWeight: "800", color: "#111827" },
  currentTag: { backgroundColor: BRAND_BLUE, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  currentTagText: { fontSize: 9.5, fontWeight: "800", color: "#ffffff" },
  divider: { height: 1, backgroundColor: "#F0F0F0", marginVertical: 12 },
  featuresBlock: { gap: 8 },
  featureRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  featureText: { fontSize: 12.5, color: "#111827" },
  upgradeButton: { backgroundColor: BRAND_BLUE, borderRadius: 12, paddingVertical: 12, alignItems: "center", marginTop: 14 },
  upgradeButtonText: { color: "#ffffff", fontSize: 13.5, fontWeight: "700" },
});
