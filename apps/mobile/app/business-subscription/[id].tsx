import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import type { Business } from "../../lib/businesses";
import { PLAN_ENTITLEMENTS, planEntitlements } from "../../lib/plan-entitlements";
import { toast } from "../../components/ui/Toast";
import { EmptyState } from "../../components/ui/EmptyState";
import type { ColorPalette } from "../../lib/theme";
import { useThemedStyles } from "../../lib/theme-provider";
import { purchaseProduct } from "../../lib/iap";
import { SHOP_SUBSCRIPTION_PRODUCTS } from "../../lib/billing-products";

const PLAN_ORDER = ["free", "starter", "pro", "premium"];

// planId ("starter"/"pro"/"premium") -> store productId ("shop_starter"/...)
// — reverse of SHOP_SUBSCRIPTION_PRODUCTS, which is keyed the other way.
const PRODUCT_ID_BY_PLAN: Record<string, string> = Object.fromEntries(
  Object.entries(SHOP_SUBSCRIPTION_PRODUCTS).map(([productId, meta]) => [meta.planId, productId])
);

// Mirrors www/js/business-subscription.js pages.BusinessSubscription — plan
// comparison + usage bars. "Upgrade" now drives a real purchase via
// lib/iap.ts (expo-iap), verified server-side by verify-apple-subscription /
// verify-play-subscription depending on platform; downgrading to a lower
// tier is a pure entitlement change with no payment and works fully here.
export default function BusinessSubscriptionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const styles = useThemedStyles(buildStyles);
  const tones = useThemedStyles(buildTones);

  const [business, setBusiness] = useState<Business | null>(null);
  const [isOwner, setIsOwner] = useState<boolean | null>(null);
  const [listingCount, setListingCount] = useState(0);
  const [staffCount, setStaffCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [purchasingPlan, setPurchasingPlan] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id || !session?.user) return;
    const { data } = await supabase.from("businesses").select("*").eq("id", id).maybeSingle();
    if (!data) return;
    setIsOwner(data.owner_user_id === session.user.id);
    setBusiness(data as Business);
    const [{ count: listings }, { count: staff }] = await Promise.all([
      supabase.from("listings").select("id", { count: "exact", head: true }).eq("business_id", id),
      supabase.from("business_staff").select("id", { count: "exact", head: true }).eq("business_id", id).neq("status", "removed"),
    ]);
    setListingCount(listings ?? 0);
    setStaffCount(staff ?? 0);
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

  if (!business) {
    return (
      <View style={styles.centered}>
        <EmptyState title="Business not found" />
      </View>
    );
  }

  const curPlanId = (business as any).plan_id || "free";
  const ent = planEntitlements(curPlanId);

  async function downgrade(planId: string) {
    if (!business) return;
    await supabase.from("businesses").update({ plan_id: planId }).eq("id", business.id);
    setBusiness({ ...business, ...({ plan_id: planId } as any) });
    toast(`Plan changed to ${planEntitlements(planId).name}`);
  }

  async function upgrade(planId: string, planName: string) {
    if (!business) return;
    const productId = PRODUCT_ID_BY_PLAN[planId];
    if (!productId) {
      toast(`Upgrading to ${planName} is coming soon`);
      return;
    }
    setPurchasingPlan(planId);
    const result = await purchaseProduct(productId, { businessId: business.id });
    setPurchasingPlan(null);
    if (result.ok) {
      toast(`Upgraded to ${planName}`);
      load();
    } else if (result.error) {
      toast(result.error);
    }
  }

  function bar(label: string, used: number, limit: number) {
    const limLabel = limit < 0 ? "∞" : String(limit);
    const pct = limit < 0 ? 8 : limit ? Math.min(100, Math.round((used / limit) * 100)) : 0;
    return (
      <View style={{ marginBottom: 12 }} key={label}>
        <View style={styles.barRow}>
          <Text style={styles.barLabel}>{label}</Text>
          <Text style={styles.barValue}>
            {used} / {limLabel}
          </Text>
        </View>
        <View style={styles.barTrack}>
          <View style={[styles.barFill, { width: `${pct}%` }]} />
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <View style={styles.hero}>
        <Text style={styles.heroLabel}>CURRENT PLAN</Text>
        <Text style={styles.heroPlan}>{ent.name}</Text>
      </View>

      <View style={styles.usageBox}>
        <Text style={styles.usageTitle}>Your usage</Text>
        {bar("Listings", listingCount, ent.listingLimit)}
        {bar("Staff seats", staffCount, ent.staffLimit === Infinity ? -1 : ent.staffLimit)}
      </View>

      <Text style={styles.sectionTitle}>Available plans</Text>
      {PLAN_ORDER.map((planId) => {
        const plan = PLAN_ENTITLEMENTS[planId];
        const isCurrent = planId === curPlanId;
        const higher = plan.rank > ent.rank;
        return (
          <View key={planId} style={[styles.planCard, isCurrent && styles.planCardCurrent]}>
            <View style={styles.planHead}>
              <Text style={styles.planName}>{plan.name}</Text>
              {isCurrent ? (
                <View style={styles.currentTag}>
                  <Text style={styles.currentTagText}>CURRENT</Text>
                </View>
              ) : null}
            </View>
            <View style={styles.featuresBlock}>
              <Text style={styles.featureText}>{plan.listingLimit < 0 ? "Unlimited" : plan.listingLimit} listings</Text>
              <Text style={styles.featureText}>{plan.staffLimit === Infinity ? "Unlimited" : plan.staffLimit} staff seats</Text>
              <Text style={styles.featureText}>
                {plan.featuredSlots} featured slot{plan.featuredSlots === 1 ? "" : "s"}
              </Text>
            </View>
            {isCurrent ? (
              <View style={styles.currentButton}>
                <Text style={styles.currentButtonText}>Your current plan</Text>
              </View>
            ) : isOwner ? (
              higher ? (
                <Pressable
                  style={styles.upgradeButton}
                  disabled={purchasingPlan === planId}
                  onPress={() => upgrade(planId, plan.name)}
                >
                  {purchasingPlan === planId ? (
                    <ActivityIndicator color={tones.brand} />
                  ) : (
                    <Text style={styles.upgradeButtonText}>Upgrade to {plan.name}</Text>
                  )}
                </Pressable>
              ) : (
                <Pressable style={styles.downgradeButton} onPress={() => downgrade(planId)}>
                  <Text style={styles.downgradeButtonText}>{planId === "free" ? "Downgrade to Free" : "Downgrade"}</Text>
                </Pressable>
              )
            ) : null}
          </View>
        );
      })}
    </ScrollView>
  );
}

function buildTones(color: ColorPalette) {
  return { brand: color.brand };
}

function buildStyles(color: ColorPalette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: color.bg },
    centered: { flex: 1, alignItems: "center", justifyContent: "center" },
    hero: { backgroundColor: color.brand, borderRadius: 16, padding: 18, marginBottom: 16 },
    heroLabel: { fontSize: 10.5, fontWeight: "800", color: color.textOnBrandSub, letterSpacing: 0.5 },
    heroPlan: { fontSize: 22, fontWeight: "900", color: color.textOnBrand, marginTop: 6 },
    usageBox: { backgroundColor: color.surface, borderRadius: 16, padding: 16, marginBottom: 18 },
    usageTitle: { fontSize: 13, fontWeight: "800", color: color.text, marginBottom: 12 },
    barRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 5 },
    barLabel: { fontSize: 12.5, color: color.textMuted },
    barValue: { fontSize: 12.5, fontWeight: "700", color: color.text },
    barTrack: { height: 6, backgroundColor: color.border, borderRadius: 4, overflow: "hidden" },
    barFill: { height: "100%", backgroundColor: color.brand },
    sectionTitle: { fontSize: 12, fontWeight: "800", color: color.textMuted, marginBottom: 10, textTransform: "uppercase" },
    planCard: { backgroundColor: color.surface, borderWidth: 1.5, borderColor: color.border, borderRadius: 16, padding: 16, marginBottom: 12 },
    planCardCurrent: { borderColor: color.brand },
    planHead: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
    planName: { fontSize: 16, fontWeight: "800", color: color.text },
    currentTag: { backgroundColor: color.brandTint, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 },
    currentTagText: { fontSize: 9.5, fontWeight: "800", color: color.brand },
    featuresBlock: { gap: 4, marginBottom: 12 },
    featureText: { fontSize: 12.5, color: color.textSub },
    currentButton: { paddingVertical: 11, borderRadius: 10, backgroundColor: color.surfaceAlt, alignItems: "center" },
    currentButtonText: { fontSize: 12.5, fontWeight: "700", color: color.textMuted },
    upgradeButton: { paddingVertical: 11, borderRadius: 10, backgroundColor: color.gold, alignItems: "center" },
    upgradeButtonText: { fontSize: 12.5, fontWeight: "700", color: color.textOnBrand },
    downgradeButton: { paddingVertical: 11, borderRadius: 10, borderWidth: 1, borderColor: color.border, alignItems: "center" },
    downgradeButtonText: { fontSize: 12.5, fontWeight: "700", color: color.text },
  });
}
