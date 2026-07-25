import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Line, Polyline, Rect, Path, Circle } from "react-native-svg";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import { BRAND_BLUE } from "../../lib/constants";
import type { Business } from "../../lib/businesses";
import { businessInitials } from "../../lib/businesses";
import type { RentalAccess, RentalCompanyRecord, RentalFleetVehicle, RentalLead } from "../../lib/rentals";
import { fleetVehicleLabel } from "../../lib/rentals";
import { EmptyState } from "../../components/ui/EmptyState";

// Mirrors www/js/rentals-business.js H.pages.RentalDashboard — the fleet
// owner's landing screen. Access state machine (verified against
// get_user_rental_access() in supabase/migrations/fix_rental_access_multi_business.sql):
//   no business owned      -> prompt to open a business
//   has_rental_company:false -> route to company setup
//   company_status rejected  -> blocked screen
//   pending                  -> read-only dashboard + pending banner
//   active                   -> full dashboard

function BackIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth={2.5}>
      <Polyline points="15 18 9 12 15 6" />
    </Svg>
  );
}
function PlusIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={BRAND_BLUE} strokeWidth={2}>
      <Line x1="12" y1="5" x2="12" y2="19" />
      <Line x1="5" y1="12" x2="19" y2="12" />
    </Svg>
  );
}
function FleetIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={BRAND_BLUE} strokeWidth={2}>
      <Rect x="1" y="3" width="22" height="13" rx="2" />
      <Path d="M8 21h8M12 17v4" />
    </Svg>
  );
}
function AnalyticsIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={BRAND_BLUE} strokeWidth={2}>
      <Line x1="18" y1="20" x2="18" y2="10" />
      <Line x1="12" y1="20" x2="12" y2="4" />
      <Line x1="6" y1="20" x2="6" y2="14" />
    </Svg>
  );
}
function ProfileIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={BRAND_BLUE} strokeWidth={2}>
      <Path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <Circle cx="12" cy="7" r="4" />
    </Svg>
  );
}

function StatCard({ num, label }: { num: string | number; label: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statNum}>{num}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function QuickAction({
  title,
  sub,
  icon,
  disabled,
  onPress,
}: {
  title: string;
  sub: string;
  icon: React.ReactNode;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.actionCard, disabled && styles.actionCardDisabled]}
      onPress={disabled ? undefined : onPress}
    >
      <View style={styles.actionIconWrap}>{icon}</View>
      <Text style={styles.actionTitle}>{title}</Text>
      <Text style={styles.actionSub}>{sub}</Text>
    </Pressable>
  );
}

export default function RentalFleetDashboard() {
  const { session } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [access, setAccess] = useState<RentalAccess | null>(null);
  const [company, setCompany] = useState<RentalCompanyRecord | null>(null);
  const [fleet, setFleet] = useState<RentalFleetVehicle[]>([]);
  const [leads, setLeads] = useState<RentalLead[]>([]);

  const load = useCallback(async () => {
    if (!session?.user) return;
    const { data: bizRows } = await supabase.from("businesses").select("*").eq("owner_user_id", session.user.id);
    const biz = (bizRows as Business[] | null) ?? [];
    setBusinesses(biz);
    if (!biz.length) {
      setAccess(null);
      setCompany(null);
      return;
    }

    const { data: accessData } = await supabase.rpc("get_user_rental_access");
    const acc = (accessData as RentalAccess | null) ?? null;
    setAccess(acc);

    if (!acc || !acc.has_rental_company) {
      setCompany(null);
      return;
    }

    const ownedIds = biz.map((b) => b.id);
    const { data: rcRows } = await supabase
      .from("rental_companies")
      .select("id,status,avg_rating,review_count,fleet_count,business_id")
      .in("business_id", ownedIds)
      .limit(1);
    const rc = (rcRows as any[] | null)?.[0] ?? null;
    if (!rc) {
      setCompany(null);
      return;
    }

    const { data: bizRow } = await supabase.from("businesses").select("name").eq("id", rc.business_id).maybeSingle();
    setCompany({
      id: rc.id,
      business_id: rc.business_id,
      status: rc.status,
      avg_rating: rc.avg_rating,
      review_count: rc.review_count,
      fleet_count: rc.fleet_count,
      company_name: bizRow?.name,
    });

    const [fleetRes, leadsRes] = await Promise.all([
      supabase
        .from("rental_vehicle_listings")
        .select(
          "id,model,year,daily_rate,weekly_rate,monthly_rate,status,is_available,view_count,save_count,inquiry_count,brand_id,category_id"
        )
        .eq("company_id", rc.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("rental_vehicle_leads")
        .select("id,listing_id,company_id,lead_source,status,created_at,user_id")
        .eq("company_id", rc.id)
        .order("created_at", { ascending: false })
        .limit(30),
    ]);

    const fleetRows = (fleetRes.data as any[]) ?? [];
    const brandIds = Array.from(new Set(fleetRows.map((v) => v.brand_id).filter(Boolean)));
    let brandMap: Record<string, { slug: string; label: string }> = {};
    if (brandIds.length) {
      const { data: brandRows } = await supabase.from("rental_brands").select("id,slug,label").in("id", brandIds);
      (brandRows ?? []).forEach((b: any) => {
        brandMap[b.id] = { slug: b.slug, label: b.label };
      });
    }
    let coverMap: Record<string, string> = {};
    if (fleetRows.length) {
      const { data: mediaRows } = await supabase
        .from("rental_vehicle_media")
        .select("listing_id,url")
        .eq("is_cover", true)
        .in(
          "listing_id",
          fleetRows.map((v) => v.id)
        );
      (mediaRows ?? []).forEach((m: any) => {
        coverMap[m.listing_id] = m.url;
      });
    }
    const fleetMapped: RentalFleetVehicle[] = fleetRows.map((v) => ({
      ...v,
      brand_slug: brandMap[v.brand_id]?.slug ?? null,
      brand_label: brandMap[v.brand_id]?.label ?? null,
      cover_url: coverMap[v.id] ?? null,
    }));
    setFleet(fleetMapped);

    const leadRows = (leadsRes.data as any[]) ?? [];
    const userIds = Array.from(new Set(leadRows.map((l) => l.user_id).filter(Boolean)));
    let nameMap: Record<string, string> = {};
    if (userIds.length) {
      const { data: nameRows } = await supabase.from("profiles_public").select("id,name").in("id", userIds);
      (nameRows ?? []).forEach((p: any) => {
        nameMap[p.id] = p.name || "Customer";
      });
    }
    const vehicleNameMap: Record<string, string> = {};
    fleetMapped.forEach((v) => {
      vehicleNameMap[v.id] = fleetVehicleLabel(v);
    });
    setLeads(
      leadRows.map((l) => ({
        ...l,
        user_name: nameMap[l.user_id] ?? null,
        vehicle_name: vehicleNameMap[l.listing_id] ?? null,
      }))
    );
  }, [session]);

  useEffect(() => {
    setIsLoading(true);
    load().finally(() => setIsLoading(false));
  }, [load]);

  async function onRefresh() {
    setIsRefreshing(true);
    await load();
    setIsRefreshing(false);
  }

  if (!session?.user) {
    return (
      <View style={styles.centered}>
        <EmptyState title="Sign in required" subtitle="Sign in to manage your rental fleet." buttonLabel="Sign In" onPressButton={() => router.push("/(auth)/sign-in")} />
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={BRAND_BLUE} />
      </View>
    );
  }

  if (!businesses.length) {
    return (
      <View style={styles.centered}>
        <EmptyState
          title="Business account required"
          subtitle="Register a business to manage rental vehicles."
          buttonLabel="Register Business"
          onPressButton={() => router.push("/business-onboarding")}
        />
      </View>
    );
  }

  const biz = businesses[0];

  if (!access || (access.has_rental_company === false && !company)) {
    router.replace(`/rental-fleet/setup?bizId=${biz.id}`);
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={BRAND_BLUE} />
      </View>
    );
  }

  if (access.company_status === "rejected") {
    return (
      <View style={styles.container}>
        <View style={[styles.headerBar, { paddingTop: insets.top + 12 }]}>
          <Pressable onPress={() => router.back()} hitSlop={10} style={styles.backBtn}>
            <BackIcon />
          </Pressable>
          <Text style={styles.headerTitle}>Rental Dashboard</Text>
          <View style={{ width: 36 }} />
        </View>
        <View style={styles.rejectedBox}>
          <Text style={styles.rejectedTitle}>Application Not Approved</Text>
          <Text style={styles.rejectedBody}>
            Your rental company application was not approved. This may be due to incomplete documentation or
            verification requirements.
          </Text>
          <Pressable style={styles.rejectedBtn} onPress={() => router.push(`/rental-fleet/setup?bizId=${biz.id}`)}>
            <Text style={styles.rejectedBtnText}>Update Application</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (!company) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={BRAND_BLUE} />
      </View>
    );
  }

  const isPending = access.company_status === "pending";
  const bizName = company.company_name || biz.name;
  const initial = businessInitials(bizName);
  const activeCount = fleet.filter((v) => v.status === "active").length;
  const totalViews = fleet.reduce((n, v) => n + (v.view_count || 0), 0);
  const newLeads = leads.filter((l) => l.status === "new").length;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 32 }}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
    >
      <View style={[styles.headerBar, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.backBtn}>
          <BackIcon />
        </Pressable>
        <View style={styles.headerLogo}>
          <Text style={styles.headerLogoText}>{initial}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {bizName}
          </Text>
          <Text style={styles.headerSub}>Rentals Dashboard</Text>
        </View>
        <Pressable
          onPress={() => router.push("/rental-fleet/profile")}
          hitSlop={8}
          style={styles.headerIconBtn}
        >
          <ProfileIcon />
        </Pressable>
      </View>

      <View style={styles.statsRow}>
        <StatCard num={fleet.length} label="Total Vehicles" />
        <StatCard num={activeCount} label="Active Listings" />
        <StatCard num={totalViews.toLocaleString()} label="Total Views" />
        <StatCard num={newLeads} label="New Inquiries" />
      </View>

      {isPending ? (
        <View style={styles.pendingBanner}>
          <Text style={styles.pendingTitle}>Pending Approval</Text>
          <Text style={styles.pendingBody}>
            Your rental company application is under review. Our team will activate your account within 24 to 48
            hours.
          </Text>
        </View>
      ) : null}

      <Text style={styles.sectionTitle}>Quick Actions</Text>
      <View style={styles.actionsGrid}>
        <QuickAction
          title="Add Vehicle"
          sub="List a new rental"
          icon={<PlusIcon />}
          disabled={isPending}
          onPress={() => router.push(`/rental-fleet/add-vehicle?bizId=${biz.id}`)}
        />
        <QuickAction
          title="Manage Fleet"
          sub="Edit or archive vehicles"
          icon={<FleetIcon />}
          disabled={isPending}
          onPress={() => router.push(`/rental-fleet/manage?bizId=${biz.id}`)}
        />
        <QuickAction
          title="Analytics"
          sub="Views, leads, trends"
          icon={<AnalyticsIcon />}
          disabled={isPending}
          onPress={() => router.push(`/rental-fleet/analytics?bizId=${biz.id}`)}
        />
        <QuickAction
          title="Company Profile"
          sub="Update info and logo"
          icon={<ProfileIcon />}
          onPress={() => router.push("/rental-fleet/profile")}
        />
      </View>

      {leads.length ? (
        <>
          <Text style={styles.sectionTitle}>Recent Inquiries</Text>
          <View style={styles.leadsCard}>
            {leads.slice(0, 5).map((l) => (
              <Pressable
                key={l.id}
                style={styles.leadRow}
                onPress={() => router.push(`/rental-fleet/leads?bizId=${biz.id}`)}
              >
                <View style={styles.leadAvatar}>
                  <Text style={styles.leadAvatarText}>{(l.user_name || "C").charAt(0).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.leadName}>{l.user_name || "Customer"}</Text>
                  <Text style={styles.leadMeta} numberOfLines={1}>
                    {l.vehicle_name || "Rental inquiry"}
                  </Text>
                </View>
                {l.status === "new" ? <View style={styles.leadNewDot} /> : null}
              </Pressable>
            ))}
          </View>
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F6F9" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  headerBar: {
    backgroundColor: BRAND_BLUE,
    paddingHorizontal: 16,
    paddingBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerIconBtn: { width: 28, height: 28, alignItems: "center", justifyContent: "center" },
  headerLogo: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerLogoText: { fontSize: 16, fontWeight: "800", color: "#ffffff" },
  headerTitle: { fontSize: 16, fontWeight: "800", color: "#ffffff" },
  headerSub: { fontSize: 12, color: "rgba(255,255,255,0.7)", marginTop: 1 },
  statsRow: { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingVertical: 12 },
  statCard: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#E4E4E7",
    borderRadius: 14,
    padding: 12,
  },
  statNum: { fontSize: 20, fontWeight: "800", color: "#18181B" },
  statLabel: { fontSize: 10.5, color: "#A1A1AA", fontWeight: "600", marginTop: 2 },
  pendingBanner: {
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: "#FEF3C7",
    borderWidth: 1,
    borderColor: "#FDE68A",
    borderRadius: 16,
    padding: 16,
  },
  pendingTitle: { fontSize: 14, fontWeight: "800", color: "#92400E", marginBottom: 4 },
  pendingBody: { fontSize: 13, color: "#92400E", lineHeight: 19 },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#18181B",
    marginTop: 16,
    marginBottom: 10,
    marginHorizontal: 16,
  },
  actionsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, paddingHorizontal: 16 },
  actionCard: {
    width: "47%",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#E4E4E7",
    borderRadius: 18,
    padding: 16,
  },
  actionCardDisabled: { opacity: 0.5 },
  actionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "#EEF2FF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  actionTitle: { fontSize: 14, fontWeight: "700", color: "#18181B" },
  actionSub: { fontSize: 12, color: "#A1A1AA", marginTop: 2 },
  leadsCard: { backgroundColor: "#ffffff", marginHorizontal: 16, borderRadius: 14, overflow: "hidden" },
  leadRow: {
    flexDirection: "row",
    gap: 12,
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F1F5",
    alignItems: "center",
  },
  leadAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#DBEAFE",
    alignItems: "center",
    justifyContent: "center",
  },
  leadAvatarText: { fontSize: 13, fontWeight: "700", color: BRAND_BLUE },
  leadName: { fontSize: 14, fontWeight: "700", color: "#18181B" },
  leadMeta: { fontSize: 12.5, color: "#A1A1AA", marginTop: 2 },
  leadNewDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: BRAND_BLUE },
  rejectedBox: {
    margin: 16,
    backgroundColor: "#FFF1F0",
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
  },
  rejectedTitle: { fontSize: 16, fontWeight: "800", color: "#D92D20", marginBottom: 8 },
  rejectedBody: { fontSize: 13, color: "#991B1B", lineHeight: 19, textAlign: "center" },
  rejectedBtn: { marginTop: 20, backgroundColor: "#D92D20", borderRadius: 12, paddingHorizontal: 28, paddingVertical: 12 },
  rejectedBtnText: { color: "#ffffff", fontSize: 14, fontWeight: "700" },
});
