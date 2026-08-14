import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Polyline } from "react-native-svg";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import {
  RECRUITER_PLAN_ENTITLEMENTS,
  recruiterPlanEntitlements,
} from "../../lib/jobs";
import { toast } from "../../components/ui/Toast";
import { color, type ColorPalette } from "../../lib/theme";
import { useThemedStyles } from "../../lib/theme-provider";
import { GlassBackButton } from "../../components/ui";
import { useIOSNativeHeader } from "../../lib/useIOSNativeHeader";
import { purchaseProduct, restoreAllPurchases } from "../../lib/iap";
import { RECRUITER_SUBSCRIPTION_PRODUCTS } from "../../lib/billing-products";
import { useStoreProducts } from "../../lib/use-store-products";
import { PRIVACY_URL, TERMS_URL } from "../../lib/legal";
import { deepLinkToSubscriptions } from "expo-iap";

const PLAN_ORDER = ["free", "recruiter"];
const RECRUITER_PRODUCT_IDS = Object.keys(RECRUITER_SUBSCRIPTION_PRODUCTS);

// planId ("recruiter") -> store productId ("recruiter_monthly") — reverse of
// RECRUITER_SUBSCRIPTION_PRODUCTS, which is keyed the other way round.
const PRODUCT_ID_BY_PLAN: Record<string, string> = Object.fromEntries(
  Object.entries(RECRUITER_SUBSCRIPTION_PRODUCTS).map(([productId, meta]) => [
    meta.planId,
    productId,
  ])
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
  const [isRestoring, setIsRestoring] = useState(false);
  const {
    prices: displayPrices,
    availableProductIds,
    isLoading: isLoadingProducts,
    error: productError,
    retry: retryProducts,
  } = useStoreProducts(RECRUITER_PRODUCT_IDS, "subscription");

  useIOSNativeHeader({
    backgroundColor: color.brand,
    tintColor: color.textOnBrand,
    title: "Recruiter Plan",
  });

  // Guideline 3.1.2(c): the price must be visible on the paywall itself
  // before purchase — pulled live from the store so it's real and
  // localized rather than a hardcoded USD estimate that could drift out
  // of sync with what's actually charged.
  const load = useCallback(async () => {
    if (!session?.user) return;
    const [{ data: recruiterProfile }, { count }] = await Promise.all([
      supabase
        .from("recruiter_profiles")
        .select("plan_id")
        .eq("user_id", session.user.id)
        .maybeSingle(),
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

  const handleUpgrade = useCallback(
    async (planName: string, targetPlanId: string) => {
      const productId = PRODUCT_ID_BY_PLAN[targetPlanId];
      if (!productId) {
        toast(`Upgrading to ${planName} is coming soon`);
        return;
      }
      if (
        !availableProductIds.includes(productId) ||
        !displayPrices[productId]
      ) {
        toast(
          `This subscription isn't available from ${
            Platform.OS === "ios" ? "the App Store" : "Google Play"
          }. Try reloading the price.`
        );
        return;
      }
      setPurchasingPlan(targetPlanId);
      try {
        const result = await purchaseProduct(productId);
        if (result.ok) {
          toast(`Upgraded to ${planName}`);
          load();
        } else if (result.code === "user-cancelled") {
          toast("Purchase cancelled");
        } else {
          toast(result.error);
        }
      } catch {
        toast("The purchase couldn't be completed. Please try again.");
      } finally {
        setPurchasingPlan(null);
      }
    },
    [availableProductIds, displayPrices, load]
  );

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
          const productId = PRODUCT_ID_BY_PLAN[id];
          const isAvailable = productId
            ? availableProductIds.includes(productId) &&
              Boolean(displayPrices[productId])
            : true;
          return (
            <View
              key={id}
              style={[styles.planCard, isCurrent && styles.planCardCurrent]}
            >
              <View style={styles.planHead}>
                <View style={styles.planNameRow}>
                  <Text style={styles.planName}>{plan.name}</Text>
                  {isCurrent ? (
                    <View style={styles.currentTag}>
                      <Text style={styles.currentTagText}>CURRENT</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.planPrice}>
                  {plan.price === 0
                    ? "Free"
                    : isLoadingProducts
                    ? "Loading price…"
                    : isAvailable && displayPrices[productId]
                    ? `${displayPrices[productId]} / month`
                    : "Unavailable"}
                </Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.featuresBlock}>
                <Feature
                  text={`${
                    plan.activeJobPosts < 0 ? "Unlimited" : plan.activeJobPosts
                  } active job posts`}
                  styles={styles}
                />
                <Feature
                  text={`${plan.candidateAccess} candidate access`}
                  styles={styles}
                />
                <Feature
                  text={`${plan.profileVisibility} profile visibility`}
                  styles={styles}
                />
              </View>
              {plan.price > 0 ? (
                <Text style={styles.renewalDisclosure}>
                  Billed monthly. Auto-renews until cancelled.
                </Text>
              ) : null}
              {plan.price > 0 && !isLoadingProducts && !isAvailable ? (
                <View style={styles.productErrorBox}>
                  <Text style={styles.productErrorText}>
                    {productError ||
                      "This subscription is not available from the store."}
                  </Text>
                  <Pressable onPress={retryProducts}>
                    <Text style={styles.retryText}>Retry</Text>
                  </Pressable>
                </View>
              ) : null}
              {!isCurrent && higher && plan.price > 0 ? (
                <Pressable
                  style={[
                    styles.upgradeButton,
                    (!isAvailable || isLoadingProducts) &&
                      styles.buttonDisabled,
                  ]}
                  disabled={
                    !!purchasingPlan || !isAvailable || isLoadingProducts
                  }
                  onPress={() => handleUpgrade(plan.name, id)}
                >
                  {purchasingPlan === id ? (
                    <ActivityIndicator color={color.textOnBrand} />
                  ) : (
                    <Text style={styles.upgradeButtonText}>
                      Upgrade to {plan.name}
                    </Text>
                  )}
                </Pressable>
              ) : null}
            </View>
          );
        })}

        <Pressable
          style={styles.restoreButton}
          disabled={isRestoring}
          onPress={async () => {
            setIsRestoring(true);
            try {
              const result = await restoreAllPurchases({
                family: "recruiterSubscriptions",
              });
              if (!result.ok) {
                toast(
                  result.errors[0] || "Couldn't restore purchases. Try again."
                );
              } else if (result.restoredCount > 0) {
                toast("Purchases restored");
                load();
              } else {
                toast("No previous purchases found to restore");
              }
            } catch {
              toast("Couldn't restore purchases. Try again.");
            } finally {
              setIsRestoring(false);
            }
          }}
        >
          {isRestoring ? (
            <ActivityIndicator color={color.brand} />
          ) : (
            <Text style={styles.restoreButtonText}>Restore Purchases</Text>
          )}
        </Pressable>

        <Pressable
          style={styles.manageButton}
          onPress={() => deepLinkToSubscriptions()}
        >
          <Text style={styles.manageButtonText}>Manage Subscription</Text>
        </Pressable>

        {/* Guideline 3.1.2(c): functional Terms of Use / Privacy Policy
            links must be present on the subscription screen itself. */}
        <Text style={styles.legalNote}>
          Subscriptions renew monthly until cancelled, billed through the App
          Store or Google Play. Manage or cancel any time from your device's
          subscription settings. By subscribing you agree to our{" "}
          <Text
            style={styles.legalLink}
            onPress={() => Linking.openURL(TERMS_URL)}
          >
            Terms of Use
          </Text>{" "}
          and{" "}
          <Text
            style={styles.legalLink}
            onPress={() => Linking.openURL(PRIVACY_URL)}
          >
            Privacy Policy
          </Text>
          .
        </Text>
      </ScrollView>
    </View>
  );
}

function Feature({ text, styles }: { text: string; styles: Styles }) {
  return (
    <View style={styles.featureRow}>
      <Svg
        width={13}
        height={13}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color.brand}
        strokeWidth={2}
      >
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
    hero: {
      backgroundColor: color.surface,
      borderRadius: 16,
      padding: 18,
      marginBottom: 20,
    },
    heroLabel: {
      fontSize: 11,
      fontWeight: "800",
      color: color.textMuted,
      letterSpacing: 0.6,
    },
    heroPlan: {
      fontSize: 22,
      fontWeight: "800",
      color: color.text,
      marginTop: 4,
    },
    heroMeta: { fontSize: 12.5, color: color.textSub, marginTop: 6 },
    sectionTitle: {
      fontSize: 14,
      fontWeight: "700",
      color: color.text,
      marginBottom: 10,
    },
    planCard: {
      backgroundColor: color.surface,
      borderRadius: 16,
      padding: 16,
      marginBottom: 14,
      borderWidth: 1.5,
      borderColor: color.border,
    },
    planCardCurrent: { borderColor: color.brand },
    planHead: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
    },
    planNameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    planName: { fontSize: 16, fontWeight: "800", color: color.text },
    planPrice: { fontSize: 15, fontWeight: "800", color: color.text },
    currentTag: {
      backgroundColor: color.brand,
      borderRadius: 6,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    currentTagText: {
      fontSize: 9.5,
      fontWeight: "800",
      color: color.textOnBrand,
    },
    divider: { height: 1, backgroundColor: color.divider, marginVertical: 12 },
    featuresBlock: { gap: 8 },
    renewalDisclosure: {
      fontSize: 11.5,
      fontWeight: "700",
      color: color.textMuted,
      marginTop: 12,
    },
    productErrorBox: { gap: 4, marginTop: 10 },
    productErrorText: {
      fontSize: 11.5,
      color: color.danger,
      lineHeight: 16,
    },
    retryText: { fontSize: 12, fontWeight: "800", color: color.brand },
    featureRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    featureText: { fontSize: 12.5, color: color.text },
    upgradeButton: {
      backgroundColor: color.brand,
      borderRadius: 12,
      paddingVertical: 12,
      alignItems: "center",
      marginTop: 14,
    },
    upgradeButtonText: {
      color: color.textOnBrand,
      fontSize: 13.5,
      fontWeight: "700",
    },
    buttonDisabled: { opacity: 0.5 },
    restoreButton: {
      paddingVertical: 12,
      borderRadius: 10,
      alignItems: "center",
      marginTop: 4,
    },
    restoreButtonText: { fontSize: 13, fontWeight: "700", color: color.brand },
    manageButton: { paddingVertical: 10, alignItems: "center" },
    manageButtonText: {
      fontSize: 13,
      fontWeight: "700",
      color: color.brand,
    },
    legalNote: {
      fontSize: 11.5,
      color: color.textMuted,
      lineHeight: 17,
      marginTop: 20,
      paddingHorizontal: 4,
    },
    legalLink: { color: color.brand, fontWeight: "700" },
  });
}
