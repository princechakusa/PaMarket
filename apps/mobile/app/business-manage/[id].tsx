import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import { toast } from "../../components/ui/Toast";
import { BRAND_BLUE, BRAND_GOLD, CATEGORIES } from "../../lib/constants";
import type { Business } from "../../lib/businesses";
import { businessInitials } from "../../lib/businesses";

// Owner-facing "Seller Center" dashboard — the management counterpart to the
// read-only public shop view at app/business/[id].tsx. Mirrors
// www/js/business-onboarding.js pages.BusinessView (the active-business
// branch) plus the store/customer/business menu groups.
export default function BusinessManageScreen() {
  const { id, submitted } = useLocalSearchParams<{ id: string; submitted?: string }>();
  const router = useRouter();
  const { session } = useAuth();

  const [business, setBusiness] = useState<Business | null>(null);
  const [activeListings, setActiveListings] = useState(0);
  const [totalViews, setTotalViews] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase
      .from("businesses")
      .select(
        "id,owner_user_id,name,logo,cover,description,biz_type,category,phone,whatsapp,email,province,city,suburb,status,verification_level,updated_at"
      )
      .eq("id", id)
      .maybeSingle();
    if (data) setBusiness(data as Business);

    const { data: listings } = await supabase
      .from("listings")
      .select("id,status,views")
      .eq("business_id", id);
    const rows = listings ?? [];
    setActiveListings(rows.filter((l: any) => l.status === "active").length);
    setTotalViews(rows.reduce((n: number, l: any) => n + (l.views || 0), 0));
  }, [id]);

  useEffect(() => {
    setIsLoading(true);
    load().finally(() => setIsLoading(false));
  }, [load]);

  function confirmDelete() {
    if (!business) return;
    Alert.alert(
      "Delete Your Shop",
      `Permanently delete ${business.name || "your shop"}? All your shop data will be removed. This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete Shop",
          style: "destructive",
          onPress: async () => {
            const { error } = await supabase.from("businesses").delete().eq("id", business.id);
            if (error) { toast("Could not delete shop", 4000, true); return; }
            toast("Your shop has been deleted");
            router.replace("/(tabs)/profile");
          },
        },
      ]
    );
  }

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={BRAND_BLUE} />
      </View>
    );
  }

  if (!business) {
    return (
      <View style={styles.centered}>
        <Text style={styles.notFoundTitle}>Business not found</Text>
      </View>
    );
  }

  const isOwner = session?.user?.id === business.owner_user_id;
  if (!isOwner) {
    return (
      <View style={styles.centered}>
        <Text style={styles.notFoundTitle}>Owner only</Text>
        <Text style={styles.notFoundSub}>Only the business owner can access this dashboard.</Text>
      </View>
    );
  }

  if (business.status === "pending_activation" || submitted === "1") {
    return (
      <View style={styles.centered}>
        <View style={styles.pendingIcon}>
          <Text style={{ fontSize: 30 }}>⏱</Text>
        </View>
        <Text style={styles.notFoundTitle}>{business.name || "Your business"}</Text>
        <Text style={styles.notFoundSub}>Submitted for review. We will notify you once it is approved and live.</Text>
        <Pressable style={styles.secondaryButton} onPress={() => router.replace("/(tabs)/profile")}>
          <Text style={styles.secondaryButtonText}>Go to Account</Text>
        </Pressable>
      </View>
    );
  }

  if (business.status === "suspended") {
    return (
      <View style={styles.centered}>
        <Text style={styles.notFoundTitle}>{business.name || "Your business"}</Text>
        <Text style={styles.notFoundSub}>This business has been suspended. Please contact support if you believe this was a mistake.</Text>
        <Pressable style={styles.secondaryButton} onPress={() => router.replace("/(tabs)/profile")}>
          <Text style={styles.secondaryButtonText}>Go to Account</Text>
        </Pressable>
      </View>
    );
  }

  if (business.status === "draft") {
    return (
      <View style={styles.centered}>
        <Text style={styles.notFoundTitle}>{business.name || "Your business"}</Text>
        <Text style={styles.notFoundSub}>Setup isn't finished yet. Continue where you left off to submit it for review.</Text>
        <Pressable style={styles.primaryButton} onPress={() => router.push("/business-onboarding")}>
          <Text style={styles.primaryButtonText}>Continue Setup</Text>
        </Pressable>
      </View>
    );
  }

  const catLabel = (business.category ?? "")
    .split("|")
    .filter(Boolean)
    .map((cid) => CATEGORIES.find((c) => c.id === cid)?.name ?? cid)
    .join(" / ");
  const typeLabel = { individual: "Individual", company: "Registered Company", agency: "Agency" }[business.biz_type ?? ""] ?? business.biz_type;
  const verified = (business.verification_level ?? 0) >= 2;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <View style={styles.logoWrap}>
            {business.logo ? (
              <Image source={{ uri: business.logo }} style={styles.logoImage} />
            ) : (
              <Text style={styles.logoInitial}>{businessInitials(business.name)}</Text>
            )}
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.heroName} numberOfLines={1}>{business.name}</Text>
            <Text style={styles.heroSub}>{typeLabel}{catLabel ? ` · ${catLabel}` : ""}</Text>
            <View style={styles.pillRow}>
              {verified ? (
                <View style={[styles.pill, styles.pillGreen]}><Text style={styles.pillGreenText}>Verified</Text></View>
              ) : null}
              <View style={[styles.pill, styles.pillGold]}><Text style={styles.pillGoldText}>FREE</Text></View>
              <View style={[styles.pill, styles.pillLight]}><Text style={styles.pillLightText}>Active</Text></View>
            </View>
          </View>
        </View>

        <View style={styles.statsGrid}>
          <StatBox value={String(activeListings)} label="Listings" />
          <StatBox value={String(totalViews >= 1000 ? `${(totalViews / 1000).toFixed(1).replace(/\.0$/, "")}k` : totalViews)} label="Views" />
          <StatBox value="0" label="New leads" />
          <StatBox value="0" label="Boosts" />
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.quickActionsRow}>
          <Pressable style={styles.quickActionGold} onPress={() => router.push({ pathname: "/business-listings/add/[id]", params: { id: business.id } })}>
            <Text style={styles.quickActionGoldText}>+ Add Listing</Text>
          </Pressable>
          <Pressable style={styles.quickActionLight} onPress={() => router.push(`/business-featured/${business.id}`)}>
            <Text style={styles.quickActionLightText}>Boost</Text>
          </Pressable>
          <Pressable style={styles.quickActionLight} onPress={() => router.push(`/business-analytics/${business.id}`)}>
            <Text style={styles.quickActionLightText}>Analytics</Text>
          </Pressable>
        </View>

        <MenuGroup title="Store">
          <MenuRow label="Listings" value={`${activeListings} active`} onPress={() => router.push({ pathname: "/business-listings/[id]", params: { id: business.id } })} />
          <MenuRow label="Featured & Boost" value="Boost" onPress={() => router.push(`/business-featured/${business.id}`)} />
          <MenuRow label="Quick Replies" value="0 saved" onPress={() => router.push(`/business-messaging/${business.id}`)} />
        </MenuGroup>

        <MenuGroup title="Customers">
          <MenuRow label="Leads" value="View" onPress={() => router.push({ pathname: "/business-leads/[id]", params: { id: business.id } })} />
          <MenuRow label="Analytics" value="View" onPress={() => router.push(`/business-analytics/${business.id}`)} />
        </MenuGroup>

        <MenuGroup title="Business">
          <MenuRow label="Get Verified" value={verified ? "Verified" : "Start"} onPress={() => router.push(`/business-verify/${business.id}`)} />
          <MenuRow label="Subscription & Plan" value="Free" onPress={() => router.push(`/business-subscription/${business.id}`)} />
          <MenuRow label="Billing & Invoices" value="Invoices" onPress={() => router.push(`/business-billing/${business.id}`)} />
        </MenuGroup>

        <MenuGroup title="Profile">
          <MenuRow label="Edit Business Profile" onPress={() => router.push(`/business-edit/${business.id}`)} />
          <MenuRow label="Manage Staff" onPress={() => router.push(`/business-staff/${business.id}`)} />
          <MenuRow label="View Public Page" onPress={() => router.push(`/business/${business.id}`)} />
        </MenuGroup>

        <Pressable style={styles.deleteButton} onPress={confirmDelete}>
          <Text style={styles.deleteButtonText}>Delete Shop</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function StatBox({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function MenuGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.menuSection}>
      <Text style={styles.menuSectionTitle}>{title}</Text>
      <View style={styles.menuGroup}>{children}</View>
    </View>
  );
}

function MenuRow({ label, value, onPress }: { label: string; value?: string; onPress: () => void }) {
  return (
    <Pressable style={styles.menuRow} onPress={onPress}>
      <Text style={styles.menuRowLabel}>{label}</Text>
      <View style={styles.menuRowRight}>
        {value ? <Text style={styles.menuRowValue}>{value}</Text> : null}
        <Text style={styles.menuChevron}>›</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F6F9" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  notFoundTitle: { fontSize: 18, fontWeight: "800", color: "#111827", marginBottom: 8, textAlign: "center" },
  notFoundSub: { fontSize: 13, color: "#8A93A6", lineHeight: 20, textAlign: "center", marginBottom: 20 },
  pendingIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: "#FEF6E7", alignItems: "center", justifyContent: "center", marginBottom: 14 },
  primaryButton: { backgroundColor: BRAND_BLUE, borderRadius: 10, paddingVertical: 14, paddingHorizontal: 28, alignItems: "center" },
  primaryButtonText: { color: "#ffffff", fontSize: 14, fontWeight: "700" },
  secondaryButton: { backgroundColor: "#F5F6F9", borderRadius: 10, paddingVertical: 14, paddingHorizontal: 28, alignItems: "center" },
  secondaryButtonText: { color: "#111827", fontSize: 14, fontWeight: "700" },
  hero: { backgroundColor: BRAND_BLUE, padding: 20, paddingTop: 26 },
  heroTop: { flexDirection: "row", alignItems: "center", gap: 14 },
  logoWrap: { width: 62, height: 62, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.16)", alignItems: "center", justifyContent: "center", overflow: "hidden" },
  logoImage: { width: "100%", height: "100%" },
  logoInitial: { fontSize: 24, fontWeight: "800", color: "#ffffff" },
  heroName: { fontSize: 19, fontWeight: "800", color: "#ffffff" },
  heroSub: { fontSize: 12.5, color: "rgba(255,255,255,0.8)", marginTop: 2 },
  pillRow: { flexDirection: "row", gap: 6, marginTop: 8, flexWrap: "wrap" },
  pill: { borderRadius: 20, paddingHorizontal: 9, paddingVertical: 3 },
  pillGreen: { backgroundColor: "#EAF7EF" },
  pillGreenText: { fontSize: 10, fontWeight: "800", color: "#0f7a3d" },
  pillGold: { backgroundColor: "#FFE9C7" },
  pillGoldText: { fontSize: 10, fontWeight: "800", color: "#92670A" },
  pillLight: { backgroundColor: "rgba(255,255,255,0.2)" },
  pillLightText: { fontSize: 10, fontWeight: "800", color: "#cfe9d6" },
  statsGrid: { flexDirection: "row", gap: 8, marginTop: 14 },
  statBox: { flex: 1, backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 12, paddingVertical: 9, alignItems: "center" },
  statValue: { fontSize: 18, fontWeight: "900", color: "#ffffff" },
  statLabel: { fontSize: 9.5, color: "#cfe0ff", marginTop: 3, fontWeight: "600" },
  content: { padding: 16 },
  quickActionsRow: { flexDirection: "row", gap: 9, marginBottom: 4 },
  quickActionGold: { flex: 1, backgroundColor: BRAND_GOLD, borderRadius: 13, paddingVertical: 13, alignItems: "center" },
  quickActionGoldText: { color: "#ffffff", fontSize: 12, fontWeight: "800" },
  quickActionLight: { flex: 1, backgroundColor: "#ffffff", borderWidth: 1, borderColor: "#E8ECF4", borderRadius: 13, paddingVertical: 13, alignItems: "center" },
  quickActionLightText: { color: BRAND_BLUE, fontSize: 12, fontWeight: "800" },
  menuSection: { marginTop: 16 },
  menuSectionTitle: { fontSize: 11, fontWeight: "800", color: "#8A93A6", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 7, marginLeft: 4 },
  menuGroup: { backgroundColor: "#ffffff", borderWidth: 1, borderColor: "#E8ECF4", borderRadius: 14, overflow: "hidden" },
  menuRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 15, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: "#F0F2F6" },
  menuRowLabel: { fontSize: 14, fontWeight: "700", color: "#111827" },
  menuRowRight: { flexDirection: "row", alignItems: "center", gap: 6 },
  menuRowValue: { fontSize: 12, fontWeight: "700", color: "#98A2B3" },
  menuChevron: { color: "#CBD2E0", fontSize: 17 },
  deleteButton: { marginTop: 20, backgroundColor: "#FFF1F0", borderWidth: 1.5, borderColor: "#FECACA", borderRadius: 10, paddingVertical: 13, alignItems: "center" },
  deleteButtonText: { color: "#dc2626", fontSize: 13, fontWeight: "800" },
});
