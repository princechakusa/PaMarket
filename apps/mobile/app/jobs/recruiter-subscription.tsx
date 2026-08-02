import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Polyline } from "react-native-svg";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import { RECRUITER_PLAN_ENTITLEMENTS, recruiterPlanEntitlements } from "../../lib/jobs";
import { toast } from "../../components/ui/Toast";
import { color, type ColorPalette } from "../../lib/theme";
import { useThemedStyles } from "../../lib/theme-provider";
import { GlassBackButton } from "../../components/ui";
import { useIOSNativeHeader } from "../../lib/useIOSNativeHeader";
import { purchaseProduct } from "../../lib/iap";
import { RECRUITER_SUBSCRIPTION_PRODUCTS } from "../../lib/billing-products";

const PLAN_ORDER = ["free", "recruiter"];

// planId ("recruiter") -> store productId ("recruiter_monthly") — reverse of
// RECRUITER_SUBSCRIPTION_PRODUCTS, which is keyed the other way round.
const PRODUCT_ID_BY_PLAN: Record<string, string> = Object.fromEntries(
  Object.entries(RECRUITER_SUBSCRIPTION_PRODUCTS).map(([productId, meta]) => [meta.planId, productId])
);

type Styles = ReturnType<typeof buildStyles>;

// Mirrors www/js/jobs.js H.pages.RecruiterSubscription — plan comparison,
// with "Upgrade" now driving a real purchase via lib/iap.ts (expo-iap),
// verified server-side by verify-apple-subscription / verify-play-
// subscription depending on platform. Current plan is read from
// recruiter_profiles.plan_id (defaults to 'free' — the row is only created
// lazily at first purchase).
export default function RecruiterSubscriptionScreen() {
  const styles = useThemedStyles(buildStyles);
  const router = useRouter();
  const { session } = useAuth();
  const insets = useSafeAreaInsets();

  const [planId, setPlanId] = useState("free");
  const [jobsPosted, setJobsPosted] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [purchasingPlan, setPurchasingPlan] = useState<string | null>(null);

  useIOSNativeHeader({ backgroundColor: color.brand, tintColor: color.textOnBrand, title: "Recruiter Plan" });

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

  const handleUpgrade = useCallback(async (planName: string, targetPlanId: string) => {
    const productId = PRODUCT_ID_BY_PLAN[targetPlanId];
    if (!productId) {
      toast(`Upgrading to ${planName} is coming soon`);
      return;
    }
    setPurchasingPlan(targetPlanId);
    const result = await purchaseProduct(productId);
    setPurchasingPlan(null);
    if (result.ok) {
      toast(`Upgraded to ${planName}`);
      load();
    } else if (result.error) {
      toast(result.error);
    }
  }, [load]);

  useEffect(() => {
    setIsLoading(true);
    load().finally(() => setIsLoading(false));
  }, [load]);

  if (isLoading) {
    return (
      <View style={{ flex: 1 }}>
        {Platform.OS !== "ios" ? (
          <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
            <GlassBackButton onPress={() => router.back()} tone="light" flat />
          </View>
        ) : null}
        <View style={styles.centered}>
          <ActivityIndicator color={color.brand} />
        </View>
      </View>
    );
  }

  const ent = recruiterPlanEntitlements(planId);

  return (
    <View style={styles.container}>
      {Platform.OS !== "ios" ? (
        <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
          <GlassBackButton onPress={() => router.back()} tone="light" flat />
          <Text style={styles.headerTitle}>Recruiter Plan</Text>
          <View style={{ width: 20 }} />
        </View>
      ) : null}

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
                <Feature text={`${plan.activeJobPosts < 0 ? "Unlimited" : plan.activeJobPosts} active job posts`} styles={styles} />
                <Feature text={`${plan.candidateAccess} candidate access`} styles={styles} />
                <Feature text={`${plan.profileVisibility} profile visibility`} styles={styles} />
              </View>
              {!isCurrent && higher && plan.price > 0 ? (
                <Pressable
                  style={styles.upgradeButton}
                  disabled={purchasingPlan === id}
                  onPress={() => handleUpgrade(plan.name, id)}
                >
                  {purchasingPlan === id ? (
                    <ActivityIndicator color={color.textOnBrand} />
                  ) : (
                    <Text style={styles.upgradeButtonText}>Upgrade to {plan.name}</Text>
                  )}
                </Pressable>
              ) : null}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

function Feature({ text, styles }: { text: string; styles: Styles }) {
  return (
    <View style={styles.featureRow}>
      <Svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke={color.brand} strokeWidth={2}>
        <Polyline points="20 6 9 17 4 12" />
      </Svg>
      <Text style={styles.featureText}>{text}</Text>
    </View>
  );
}

function buildStyles(color: ColorPalette) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: color.bg },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: color.brand,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerTitle: { fontSize: 17, fontWeight: "700", color: color.textOnBrand },
  hero: { backgroundColor: color.surface, borderRadius: 16, padding: 18, marginBottom: 20 },
  heroLabel: { fontSize: 11, fontWeight: "800", color: color.textMuted, letterSpacing: 0.6 },
  heroPlan: { fontSize: 22, fontWeight: "800", color: color.text, marginTop: 4 },
  heroMeta: { fontSize: 12.5, color: color.textSub, marginTop: 6 },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: color.text, marginBottom: 10 },
  planCard: { backgroundColor: color.surface, borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1.5, borderColor: color.border },
  planCardCurrent: { borderColor: color.brand },
  planHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  planNameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  planName: { fontSize: 16, fontWeight: "800", color: color.text },
  planPrice: { fontSize: 15, fontWeight: "800", color: color.text },
  currentTag: { backgroundColor: color.brand, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  currentTagText: { fontSize: 9.5, fontWeight: "800", color: color.textOnBrand },
  divider: { height: 1, backgroundColor: color.divider, marginVertical: 12 },
  featuresBlock: { gap: 8 },
  featureRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  featureText: { fontSize: 12.5, color: color.text },
  upgradeButton: { backgroundColor: color.brand, borderRadius: 12, paddingVertical: 12, alignItems: "center", marginTop: 14 },
  upgradeButtonText: { color: color.textOnBrand, fontSize: 13.5, fontWeight: "700" },
  });
}
