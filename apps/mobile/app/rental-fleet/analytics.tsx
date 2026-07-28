import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { supabase } from "../../lib/supabase";
import type { RentalFleetVehicle } from "../../lib/rentals";
import { fleetVehicleLabel } from "../../lib/rentals";
import type { ColorPalette } from "../../lib/theme";
import { useThemedStyles } from "../../lib/theme-provider";

type Analytics = { views_30d: number; chats_30d: number; whatsapp_30d: number; calls_30d: number };

function KpiCard({ num, label, styles }: { num: string | number; label: string; styles: ReturnType<typeof buildStyles> }) {
  return (
    <View style={styles.kpiCard}>
      <Text style={styles.kpiNum}>{num}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </View>
  );
}

function SourceBar({
  label,
  pct,
  barColor,
  styles,
}: {
  label: string;
  pct: number;
  barColor: string;
  styles: ReturnType<typeof buildStyles>;
}) {
  return (
    <View style={{ marginBottom: 10 }}>
      <View style={styles.sourceBarHeader}>
        <Text style={styles.sourceBarLabel}>{label}</Text>
        <Text style={styles.sourceBarPct}>{pct}%</Text>
      </View>
      <View style={styles.sourceBarTrack}>
        <View style={[styles.sourceBarFill, { width: `${pct}%`, backgroundColor: barColor }]} />
      </View>
    </View>
  );
}

// Mirrors www/js/rentals-business.js H.pages.RentalBusinessAnalytics — KPI
// cards, top vehicles by views, and inquiry source breakdown, sourced from
// the rental_business_analytics() RPC with a client-side fleet-derived
// fallback when the RPC is unavailable (matches the web app's behaviour).
export default function RentalAnalyticsScreen() {
  const styles = useThemedStyles(buildStyles);
  const tones = useThemedStyles(buildTones);
  const { bizId } = useLocalSearchParams<{ bizId: string }>();

  const [isLoading, setIsLoading] = useState(true);
  const [fleet, setFleet] = useState<RentalFleetVehicle[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [rating, setRating] = useState<{ avg: number | null; count: number }>({ avg: null, count: 0 });

  const load = useCallback(async () => {
    if (!bizId) return;
    const { data: rc } = await supabase
      .from("rental_companies")
      .select("id,avg_rating,review_count")
      .eq("business_id", bizId)
      .maybeSingle();
    if (!rc) return;
    setRating({ avg: rc.avg_rating, count: rc.review_count ?? 0 });

    const { data: fleetRows } = await supabase
      .from("rental_vehicle_listings")
      .select("id,model,year,status,daily_rate,view_count,inquiry_count,brand_id")
      .eq("company_id", rc.id)
      .is("deleted_at", null);
    const rows = (fleetRows as any[]) ?? [];
    const brandIds = Array.from(new Set(rows.map((v) => v.brand_id).filter(Boolean)));
    let brandMap: Record<string, string> = {};
    if (brandIds.length) {
      const { data: brandRows } = await supabase.from("rental_brands").select("id,label").in("id", brandIds);
      (brandRows ?? []).forEach((b: any) => {
        brandMap[b.id] = b.label;
      });
    }
    setFleet(rows.map((v) => ({ ...v, brand_label: brandMap[v.brand_id] ?? null })));

    const { data: analyticsData, error } = await supabase.rpc("rental_business_analytics", { p_company_id: rc.id });
    if (!error && analyticsData) setAnalytics(analyticsData as Analytics);
  }, [bizId]);

  useEffect(() => {
    setIsLoading(true);
    load().finally(() => setIsLoading(false));
  }, [load]);

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={tones.brand} />
      </View>
    );
  }

  const totalViews = analytics ? analytics.views_30d : fleet.reduce((n, v) => n + (v.view_count || 0), 0);
  const totalInquiries = analytics
    ? analytics.chats_30d + analytics.whatsapp_30d + analytics.calls_30d
    : fleet.reduce((n, v) => n + (v.inquiry_count || 0), 0);
  const convRate = totalViews ? Math.round((totalInquiries / totalViews) * 100) : 0;
  const activeCount = fleet.filter((v) => v.status === "active").length;
  const topByViews = [...fleet].sort((a, b) => (b.view_count || 0) - (a.view_count || 0)).slice(0, 5);

  const totalLeadCh = (analytics ? analytics.chats_30d + analytics.whatsapp_30d + analytics.calls_30d : 0) || 1;
  const chatPct = analytics ? Math.round((analytics.chats_30d / totalLeadCh) * 100) : 0;
  const waPct = analytics ? Math.round((analytics.whatsapp_30d / totalLeadCh) * 100) : 0;
  const callPct = analytics ? Math.round((analytics.calls_30d / totalLeadCh) * 100) : 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 30 }}>
      <View style={styles.kpiGrid}>
        <KpiCard num={totalViews.toLocaleString()} label="Total Views" styles={styles} />
        <KpiCard num={totalInquiries.toLocaleString()} label="Inquiries" styles={styles} />
        <KpiCard num={`${convRate}%`} label="Inquiry Rate" styles={styles} />
        <KpiCard num={activeCount} label="Active Listings" styles={styles} />
      </View>

      {topByViews.length ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Top Performing Vehicles</Text>
          {topByViews.map((v) => (
            <View key={v.id} style={styles.topRow}>
              <View>
                <Text style={styles.topVehicleName}>{fleetVehicleLabel(v)}</Text>
                <Text style={styles.topVehiclePrice}>${(v.daily_rate ?? 0).toLocaleString()}/day</Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={styles.topViews}>{(v.view_count ?? 0).toLocaleString()} views</Text>
                <Text style={styles.topInquiries}>{(v.inquiry_count ?? 0).toLocaleString()} inquiries</Text>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Inquiry Sources</Text>
        <SourceBar label="In-app Chat" pct={chatPct} barColor={tones.brand} styles={styles} />
        <SourceBar label="WhatsApp" pct={waPct} barColor="#25D366" styles={styles} />
        <SourceBar label="Direct Call" pct={callPct} barColor={tones.success} styles={styles} />
      </View>

      {rating.avg ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Rating</Text>
          <Text style={styles.ratingNum}>{Number(rating.avg).toFixed(1)}</Text>
          <Text style={styles.ratingSub}>
            from {rating.count} review{rating.count === 1 ? "" : "s"}
          </Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

function buildTones(color: ColorPalette) {
  return { brand: color.brand, success: color.success };
}

function buildStyles(color: ColorPalette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: color.bg },
    centered: { flex: 1, alignItems: "center", justifyContent: "center" },
    kpiGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, padding: 16, backgroundColor: color.surface },
    kpiCard: { width: "47%", backgroundColor: color.surfaceAlt, borderWidth: 1, borderColor: color.border, borderRadius: 14, padding: 12 },
    kpiNum: { fontSize: 20, fontWeight: "800", color: color.text },
    kpiLabel: { fontSize: 11, color: color.textMuted, fontWeight: "600", marginTop: 2 },
    section: { padding: 16, backgroundColor: color.surface, marginTop: 8 },
    sectionTitle: { fontSize: 14, fontWeight: "700", color: color.text, marginBottom: 10 },
    topRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: color.border,
    },
    topVehicleName: { fontSize: 13, fontWeight: "700", color: color.text },
    topVehiclePrice: { fontSize: 12, color: color.textMuted, marginTop: 2 },
    topViews: { fontSize: 13, fontWeight: "800", color: color.brand },
    topInquiries: { fontSize: 12, color: color.textMuted, marginTop: 2 },
    sourceBarHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
    sourceBarLabel: { fontSize: 13, fontWeight: "600", color: color.text },
    sourceBarPct: { fontSize: 13, fontWeight: "800", color: color.text },
    sourceBarTrack: { height: 8, backgroundColor: color.border, borderRadius: 999, overflow: "hidden" },
    sourceBarFill: { height: "100%", borderRadius: 999 },
    ratingNum: { fontSize: 32, fontWeight: "800", color: color.brand },
    ratingSub: { fontSize: 13, color: color.textMuted },
  });
}
