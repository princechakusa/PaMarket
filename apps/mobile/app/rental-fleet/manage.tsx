import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import Svg, { Rect, Path } from "react-native-svg";
import { supabase } from "../../lib/supabase";
import { BRAND_BLUE } from "../../lib/constants";
import type { RentalFleetVehicle } from "../../lib/rentals";
import { fleetVehicleLabel } from "../../lib/rentals";
import { toast } from "../../components/ui/Toast";
import { EmptyState } from "../../components/ui/EmptyState";

type Tab = "all" | "active" | "paused" | "draft";

const STATUS_STYLES: Record<string, { fg: string; bg: string; label: string }> = {
  active: { fg: "#12B76A", bg: "#ECFDF5", label: "Active" },
  paused: { fg: "#92400E", bg: "#FEF3C7", label: "Paused" },
  draft: { fg: "#A1A1AA", bg: "#F4F4F5", label: "Draft" },
  archived: { fg: "#A1A1AA", bg: "#F4F4F5", label: "Archived" },
};

function StatusPill({ status }: { status: string }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES.draft;
  return (
    <View style={[styles.pill, { backgroundColor: s.bg }]}>
      <Text style={[styles.pillText, { color: s.fg }]}>{s.label}</Text>
    </View>
  );
}

function CarPlaceholderIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth={1.5}>
      <Rect x="1" y="3" width="22" height="13" rx="2" />
      <Path d="M8 21h8M12 17v4" />
    </Svg>
  );
}

// Mirrors www/js/rentals-business.js H.pages.RentalManageFleet — owner's
// vehicle list with status tabs, search, and per-vehicle actions.
export default function RentalManageFleetScreen() {
  const { bizId } = useLocalSearchParams<{ bizId: string }>();
  const router = useRouter();

  const [fleet, setFleet] = useState<RentalFleetVehicle[]>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [canWrite, setCanWrite] = useState(false);
  const [tab, setTab] = useState<Tab>("all");
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    if (!bizId) return;
    const { data: accessData } = await supabase.rpc("get_user_rental_access");
    setCanWrite(!!accessData?.can_create_fleet);

    const { data: rcRows } = await supabase
      .from("rental_companies")
      .select("id")
      .eq("business_id", bizId)
      .maybeSingle();
    if (!rcRows) return;
    setCompanyId(rcRows.id);

    const { data: fleetRows } = await supabase
      .from("rental_vehicle_listings")
      .select(
        "id,model,year,daily_rate,weekly_rate,monthly_rate,status,is_available,view_count,save_count,inquiry_count,brand_id,category_id"
      )
      .eq("company_id", rcRows.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(50);

    const rows = (fleetRows as any[]) ?? [];
    const brandIds = Array.from(new Set(rows.map((v) => v.brand_id).filter(Boolean)));
    let brandMap: Record<string, { slug: string; label: string }> = {};
    if (brandIds.length) {
      const { data: brandRows } = await supabase.from("rental_brands").select("id,slug,label").in("id", brandIds);
      (brandRows ?? []).forEach((b: any) => {
        brandMap[b.id] = { slug: b.slug, label: b.label };
      });
    }
    let coverMap: Record<string, string> = {};
    if (rows.length) {
      const { data: mediaRows } = await supabase
        .from("rental_vehicle_media")
        .select("listing_id,url")
        .eq("is_cover", true)
        .in(
          "listing_id",
          rows.map((v) => v.id)
        );
      (mediaRows ?? []).forEach((m: any) => {
        coverMap[m.listing_id] = m.url;
      });
    }
    setFleet(
      rows.map((v) => ({
        ...v,
        brand_slug: brandMap[v.brand_id]?.slug ?? null,
        brand_label: brandMap[v.brand_id]?.label ?? null,
        cover_url: coverMap[v.id] ?? null,
      }))
    );
  }, [bizId]);

  useEffect(() => {
    setIsLoading(true);
    load().finally(() => setIsLoading(false));
  }, [load]);

  const counts = useMemo(
    () => ({
      all: fleet.length,
      active: fleet.filter((v) => v.status === "active").length,
      paused: fleet.filter((v) => v.status === "paused").length,
      draft: fleet.filter((v) => v.status === "draft").length,
    }),
    [fleet]
  );

  const filtered = useMemo(() => {
    let rows = tab === "all" ? fleet : fleet.filter((v) => v.status === tab);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      rows = rows.filter((v) => fleetVehicleLabel(v).toLowerCase().includes(q));
    }
    return rows;
  }, [fleet, tab, query]);

  async function toggleStatus(vehicleId: string, newStatus: string) {
    const { data, error } = await supabase
      .from("rental_vehicle_listings")
      .update({ status: newStatus })
      .eq("id", vehicleId)
      .select("id");
    if (error || !data?.length) {
      toast("Access denied. Your company account is not active.", 4000, true);
      return;
    }
    setFleet((prev) => prev.map((v) => (v.id === vehicleId ? { ...v, status: newStatus as any } : v)));
    toast(newStatus === "active" ? "Vehicle activated." : "Vehicle paused.");
  }

  function confirmRemove(vehicleId: string) {
    Alert.alert(
      "Remove this vehicle?",
      "This will archive the vehicle and hide it from the marketplace. Your listing history and analytics are preserved.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            const { data, error } = await supabase
              .from("rental_vehicle_listings")
              .update({ status: "archived", deleted_at: new Date().toISOString() })
              .eq("id", vehicleId)
              .select("id");
            if (error || !data?.length) {
              toast("Access denied. Your company account is not active.", 4000, true);
              return;
            }
            setFleet((prev) => prev.filter((v) => v.id !== vehicleId));
            toast("Vehicle removed.");
          },
        },
      ]
    );
  }

  function showActions(v: RentalFleetVehicle) {
    Alert.alert(fleetVehicleLabel(v), undefined, [
      { text: "Edit Vehicle", onPress: () => router.push(`/rental-fleet/edit-vehicle?id=${v.id}&bizId=${bizId}`) },
      {
        text: v.status === "active" ? "Pause Listing" : "Activate Listing",
        onPress: () => toggleStatus(v.id, v.status === "active" ? "paused" : "active"),
      },
      { text: "Manage Availability", onPress: () => router.push(`/rental-fleet/availability?id=${v.id}`) },
      { text: "Remove Vehicle", style: "destructive", onPress: () => confirmRemove(v.id) },
      { text: "Cancel", style: "cancel" },
    ]);
  }

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={BRAND_BLUE} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {!canWrite ? (
        <View style={styles.blockedBox}>
          <Text style={styles.blockedTitle}>Vehicle management locked</Text>
          <Text style={styles.blockedBody}>Your company must be approved before you can add or edit vehicles.</Text>
        </View>
      ) : null}

      <View style={styles.tabRow}>
        {(["all", "active", "paused", "draft"] as Tab[]).map((t) => (
          <Pressable key={t} style={styles.tabButton} onPress={() => setTab(t)}>
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t[0].toUpperCase() + t.slice(1)} ({counts[t]})
            </Text>
            {tab === t ? <View style={styles.tabUnderline} /> : null}
          </Pressable>
        ))}
      </View>

      <View style={styles.searchWrap}>
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="Search fleet..."
          placeholderTextColor="#A1A1AA"
        />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        {filtered.length ? (
          filtered.map((v) => (
            <Pressable
              key={v.id}
              style={styles.vehicleRow}
              onPress={() => (canWrite ? showActions(v) : undefined)}
            >
              <View style={styles.thumbWrap}>
                {v.cover_url ? <Image source={{ uri: v.cover_url }} style={styles.thumb} /> : <CarPlaceholderIcon />}
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.vehicleTitle} numberOfLines={1}>
                  {fleetVehicleLabel(v)} {v.year ? <Text style={styles.vehicleYear}>{v.year}</Text> : null}
                </Text>
                <View style={styles.vehicleMetaRow}>
                  <Text style={styles.vehiclePrice}>${(v.daily_rate ?? 0).toLocaleString()}/day</Text>
                  <StatusPill status={v.status} />
                </View>
              </View>
            </Pressable>
          ))
        ) : (
          <View style={{ paddingTop: 40 }}>
            <EmptyState
              title="No vehicles in this category"
              buttonLabel={canWrite ? "Add Vehicle" : undefined}
              onPressButton={canWrite ? () => router.push(`/rental-fleet/add-vehicle?bizId=${bizId}`) : undefined}
            />
          </View>
        )}
      </ScrollView>

      {canWrite ? (
        <Pressable style={styles.fab} onPress={() => router.push(`/rental-fleet/add-vehicle?bizId=${bizId}`)}>
          <Text style={styles.fabText}>+ Add</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F6F9" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  blockedBox: {
    margin: 16,
    backgroundColor: "#F9F9FB",
    borderWidth: 1.5,
    borderColor: "#E4E4E7",
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
  },
  blockedTitle: { fontSize: 14, fontWeight: "700", color: "#52525B", marginBottom: 4 },
  blockedBody: { fontSize: 12, color: "#A1A1AA", textAlign: "center", lineHeight: 17 },
  tabRow: { flexDirection: "row", backgroundColor: "#ffffff", borderBottomWidth: 1, borderBottomColor: "#E4E4E7" },
  tabButton: { flex: 1, alignItems: "center", paddingVertical: 12 },
  tabText: { fontSize: 12.5, fontWeight: "600", color: "#A1A1AA" },
  tabTextActive: { fontWeight: "800", color: BRAND_BLUE },
  tabUnderline: { height: 2.5, backgroundColor: BRAND_BLUE, width: "60%", borderRadius: 2, marginTop: 6 },
  searchWrap: { padding: 10, paddingHorizontal: 16, backgroundColor: "#ffffff", borderBottomWidth: 1, borderBottomColor: "#E4E4E7" },
  searchInput: {
    height: 38,
    borderWidth: 1.5,
    borderColor: "#E4E4E7",
    borderRadius: 999,
    paddingHorizontal: 14,
    fontSize: 13,
    color: "#18181B",
  },
  vehicleRow: {
    flexDirection: "row",
    gap: 12,
    padding: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E4E4E7",
    alignItems: "center",
    backgroundColor: "#ffffff",
  },
  thumbWrap: {
    width: 72,
    height: 52,
    borderRadius: 10,
    backgroundColor: "#E8ECF4",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  thumb: { width: "100%", height: "100%" },
  vehicleTitle: { fontSize: 14, fontWeight: "700", color: "#18181B" },
  vehicleYear: { fontWeight: "500", color: "#A1A1AA" },
  vehicleMetaRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  vehiclePrice: { fontSize: 14, fontWeight: "800", color: BRAND_BLUE },
  pill: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  pillText: { fontSize: 11, fontWeight: "700" },
  fab: {
    position: "absolute",
    right: 16,
    bottom: 20,
    backgroundColor: BRAND_BLUE,
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  fabText: { color: "#ffffff", fontSize: 14, fontWeight: "700" },
});
