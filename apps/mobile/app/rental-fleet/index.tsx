import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Line, Rect, Path, Circle } from "react-native-svg";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import type { Business } from "../../lib/businesses";
import { businessInitials } from "../../lib/businesses";
import type { RentalAccess, RentalCompanyRecord, RentalFleetVehicle, RentalLead } from "../../lib/rentals";
import { fleetVehicleLabel } from "../../lib/rentals";
import { EmptyState } from "../../components/ui/EmptyState";
import { GlassBackButton } from "../../components/ui";
import type { ColorPalette } from "../../lib/theme";
import { useThemedStyles } from "../../lib/theme-provider";

// Mirrors www/js/rentals-business.js H.pages.RentalDashboard — the fleet
// owner's landing screen. Access state machine (verified against
// get_user_rental_access() in supabase/migrations/fix_rental_access_multi_business.sql):
//   no business owned      -> prompt to open a business
//   has_rental_company:false -> route to company setup
//   company_status rejected  -> blocked screen
//   pending                  -> read-only dashboard + pending banner
//   active                   -> full dashboard

function PlusIcon({ stroke }: { stroke: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={2}>
      <Line x1="12" y1="5" x2="12" y2="19" />
      <Line x1="5" y1="12" x2="19" y2="12" />
    </Svg>
  );
}
function FleetIcon({ stroke }: { stroke: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={2}>
      <Rect x="1" y="3" width="22" height="13" rx="2" />
      <Path d="M8 21h8M12 17v4" />
    </Svg>
  );
}
function AnalyticsIcon({ stroke }: { stroke: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={2}>
      <Line x1="18" y1="20" x2="18" y2="10" />
      <Line x1="12" y1="20" x2="12" y2="4" />
      <Line x1="6" y1="20" x2="6" y2="14" />
    </Svg>
  );
}
function ProfileIcon({ stroke }: { stroke: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={2}>
      <Path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <Circle cx="12" cy="7" r="4" />
    </Svg>
  );
}

function StatCard({ num, label, styles }: { num: string | number; label: string; styles: ReturnType<typeof buildStyles> }) {
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
  styles,
}: {
  title: string;
  sub: string;
  icon: React.ReactNode;
  disabled?: boolean;
  onPress: () => void;
  styles: ReturnType<typeof buildStyles>;
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
  const styles = useThemedStyles(buildStyles);
  const tones = useThemedStyles(buildTones);
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
      <View style={styles.container}>
        <View style={[styles.headerBar, { paddingTop: insets.top + 12 }]}>
          <GlassBackButton onPress={() => router.back()} tone="light" flat />
          <Text style={styles.headerTitle}>Rental Dashboard</Text>
          <View style={{ width: 36 }} />
        </View>
        <View style={styles.centered}>
          <EmptyState title="Sign in required" subtitle="Sign in to manage your rental fleet." buttonLabel="Sign In" onPressButton={() => router.push("/(auth)/sign-in")} />
        </View>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={[styles.headerBar, { paddingTop: insets.top + 12 }]}>
          <GlassBackButton onPress={() => router.back()} tone="light" flat />
          <Text style={styles.headerTitle}>Rental Dashboard</Text>
          <View style={{ width: 36 }} />
        </View>
        <View style={styles.centered}>
          <ActivityIndicator color={tones.brand} />
        </View>
      </View>
    );
  }

  if (!businesses.length) {
    return (
      <View style={styles.container}>
        <View style={[styles.headerBar, { paddingTop: insets.top + 12 }]}>
          <GlassBackButton onPress={() => router.back()} tone="light" flat />
          <Text style={styles.headerTitle}>Rental Dashboard</Text>
          <View style={{ width: 36 }} />
        </View>
        <View style={styles.centered}>
          <EmptyState
            title="Business account required"
            subtitle="Register a business to manage rental vehicles."
            buttonLabel="Register Business"
            onPressButton={() => router.push("/business-onboarding")}
          />
        </View>
      </View>
    );
  }

  const biz = businesses[0];

  if (!access || (access.has_rental_company === false && !company)) {
    router.replace(`/rental-fleet/setup?bizId=${biz.id}`);
    return (
      <View style={styles.container}>
        <View style={[styles.headerBar, { paddingTop: insets.top + 12 }]}>
          <GlassBackButton onPress={() => router.back()} tone="light" flat />
          <Text style={styles.headerTitle}>Rental Dashboard</Text>
          <View style={{ width: 36 }} />
        </View>
        <View style={styles.centered}>
          <ActivityIndicator color={tones.brand} />
        </View>
      </View>
    );
  }

  if (access.company_status === "rejected") {
    return (
      <View style={styles.container}>
        <View style={[styles.headerBar, { paddingTop: insets.top + 12 }]}>
          <GlassBackButton onPress={() => router.back()} tone="light" flat />
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
      <View style={styles.container}>
        <View style={[styles.headerBar, { paddingTop: insets.top + 12 }]}>
          <GlassBackButton onPress={() => router.back()} tone="light" flat />
          <Text style={styles.headerTitle}>Rental Dashboard</Text>
          <View style={{ width: 36 }} />
        </View>
        <View style={styles.centered}>
          <ActivityIndicator color={tones.brand} />
        </View>
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
        <GlassBackButton onPress={() => router.back()} tone="light" flat />
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
          <ProfileIcon stroke={tones.textOnBrand} />
        </Pressable>
      </View>

      <View style={styles.statsRow}>
        <StatCard num={fleet.length} label="Total Vehicles" styles={styles} />
        <StatCard num={activeCount} label="Active Listings" styles={styles} />
        <StatCard num={totalViews.toLocaleString()} label="Total Views" styles={styles} />
        <StatCard num={newLeads} label="New Inquiries" styles={styles} />
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
          icon={<PlusIcon stroke={tones.brand} />}
          disabled={isPending}
          onPress={() => router.push(`/rental-fleet/add-vehicle?bizId=${biz.id}`)}
          styles={styles}
        />
        <QuickAction
          title="Manage Fleet"
          sub="Edit or archive vehicles"
          icon={<FleetIcon stroke={tones.brand} />}
          disabled={isPending}
          onPress={() => router.push(`/rental-fleet/manage?bizId=${biz.id}`)}
          styles={styles}
        />
        <QuickAction
          title="Analytics"
          sub="Views, leads, trends"
          icon={<AnalyticsIcon stroke={tones.brand} />}
          disabled={isPending}
          onPress={() => router.push(`/rental-fleet/analytics?bizId=${biz.id}`)}
          styles={styles}
        />
        <QuickAction
          title="Company Profile"
          sub="Update info and logo"
          icon={<ProfileIcon stroke={tones.brand} />}
          onPress={() => router.push("/rental-fleet/profile")}
          styles={styles}
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

function buildTones(color: ColorPalette) {
  return { brand: color.brand, textOnBrand: color.textOnBrand };
}

function buildStyles(color: ColorPalette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: color.bg },
    centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
    headerBar: {
      backgroundColor: color.brand,
      paddingHorizontal: 16,
      paddingBottom: 16,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
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
    headerLogoText: { fontSize: 16, fontWeight: "800", color: color.textOnBrand },
    headerTitle: { fontSize: 16, fontWeight: "800", color: color.textOnBrand },
    headerSub: { fontSize: 12, color: color.textOnBrandSub, marginTop: 1 },
    statsRow: { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingVertical: 12 },
    statCard: {
      flex: 1,
      backgroundColor: color.surface,
      borderWidth: 1,
      borderColor: color.border,
      borderRadius: 14,
      padding: 12,
    },
    statNum: { fontSize: 20, fontWeight: "800", color: color.text },
    statLabel: { fontSize: 10.5, color: color.textMuted, fontWeight: "600", marginTop: 2 },
    pendingBanner: {
      marginHorizontal: 16,
      marginBottom: 8,
      backgroundColor: color.warningTint,
      borderWidth: 1,
      borderColor: color.warning,
      borderRadius: 16,
      padding: 16,
    },
    pendingTitle: { fontSize: 14, fontWeight: "800", color: color.warning, marginBottom: 4 },
    pendingBody: { fontSize: 13, color: color.warning, lineHeight: 19 },
    sectionTitle: {
      fontSize: 14,
      fontWeight: "700",
      color: color.text,
      marginTop: 16,
      marginBottom: 10,
      marginHorizontal: 16,
    },
    actionsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, paddingHorizontal: 16 },
    actionCard: {
      width: "47%",
      backgroundColor: color.surface,
      borderWidth: 1,
      borderColor: color.border,
      borderRadius: 18,
      padding: 16,
    },
    actionCardDisabled: { opacity: 0.5 },
    actionIconWrap: {
      width: 40,
      height: 40,
      borderRadius: 10,
      backgroundColor: color.brandTint,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 10,
    },
    actionTitle: { fontSize: 14, fontWeight: "700", color: color.text },
    actionSub: { fontSize: 12, color: color.textMuted, marginTop: 2 },
    leadsCard: { backgroundColor: color.surface, marginHorizontal: 16, borderRadius: 14, overflow: "hidden" },
    leadRow: {
      flexDirection: "row",
      gap: 12,
      padding: 14,
      borderBottomWidth: 1,
      borderBottomColor: color.divider,
      alignItems: "center",
    },
    leadAvatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: color.brandTintStrong,
      alignItems: "center",
      justifyContent: "center",
    },
    leadAvatarText: { fontSize: 13, fontWeight: "700", color: color.brand },
    leadName: { fontSize: 14, fontWeight: "700", color: color.text },
    leadMeta: { fontSize: 12.5, color: color.textMuted, marginTop: 2 },
    leadNewDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: color.brand },
    rejectedBox: {
      margin: 16,
      backgroundColor: color.dangerTint,
      borderWidth: 1,
      borderColor: color.danger,
      borderRadius: 16,
      padding: 24,
      alignItems: "center",
    },
    rejectedTitle: { fontSize: 16, fontWeight: "800", color: color.danger, marginBottom: 8 },
    rejectedBody: { fontSize: 13, color: color.danger, lineHeight: 19, textAlign: "center" },
    rejectedBtn: { marginTop: 20, backgroundColor: color.danger, borderRadius: 12, paddingHorizontal: 28, paddingVertical: 12 },
    rejectedBtnText: { color: color.textOnBrand, fontSize: 14, fontWeight: "700" },
  });
}
