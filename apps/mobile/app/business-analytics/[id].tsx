import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import type { Listing } from "../../lib/listings";
import { fetchBusinessLeads, type BusinessLead } from "../../lib/business-leads";
import { planEntitlements } from "../../lib/plan-entitlements";
import { EmptyState } from "../../components/ui/EmptyState";
import type { ColorPalette } from "../../lib/theme";
import { useThemedStyles } from "../../lib/theme-provider";

type Styles = ReturnType<typeof buildStyles>;

function StatCard({ value, label, styles }: { value: string | number; label: string; styles: Styles }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// Mirrors www/js/business-analytics.js pages.BusinessAnalytics — client-side
// aggregation of listing performance + lead conversion, gated by plan tier.
export default function BusinessAnalyticsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const router = useRouter();
  const styles = useThemedStyles(buildStyles);
  const tones = useThemedStyles(buildTones);

  const [isOwner, setIsOwner] = useState<boolean | null>(null);
  const [tier, setTier] = useState<"none" | "basic" | "full">("none");
  const [listings, setListings] = useState<Listing[]>([]);
  const [leads, setLeads] = useState<BusinessLead[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id || !session?.user) return;
    const { data: biz } = await supabase.from("businesses").select("*").eq("id", id).maybeSingle();
    if (!biz || biz.owner_user_id !== session.user.id) {
      setIsOwner(false);
      return;
    }
    setIsOwner(true);
    setTier(planEntitlements((biz as any).plan_id).analytics);
    const [listingsRes, leadRows] = await Promise.all([
      supabase.from("listings").select("id,title,views,clicks,price,currency").eq("business_id", id),
      fetchBusinessLeads(id),
    ]);
    setListings((listingsRes.data as unknown as Listing[]) ?? []);
    setLeads(leadRows);
  }, [id, session]);

  useEffect(() => {
    setIsLoading(true);
    load().finally(() => setIsLoading(false));
  }, [load]);

  const views = useMemo(() => listings.reduce((n, l) => n + ((l as any).views || 0), 0), [listings]);
  const clicks = useMemo(() => listings.reduce((n, l) => n + ((l as any).clicks || 0), 0), [listings]);
  const conversion = views ? Math.round((leads.length / views) * 100) : 0;
  const topListings = useMemo(
    () =>
      listings
        .slice()
        .sort((a, b) => ((b as any).views || 0) - ((a as any).views || 0))
        .slice(0, 5),
    [listings]
  );
  const maxViews = Math.max(1, ...topListings.map((l) => (l as any).views || 0));
  const byType = useMemo(() => {
    const counts: Record<string, number> = { whatsapp: 0, call: 0, chat: 0 };
    leads.forEach((l) => {
      counts[l.type] = (counts[l.type] || 0) + 1;
    });
    return counts;
  }, [leads]);

  if (isLoading || isOwner === null) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={tones.brand} />
      </View>
    );
  }

  if (!isOwner) {
    return (
      <View style={styles.centered}>
        <EmptyState title="Owner only" subtitle="Only the owner can view analytics." />
      </View>
    );
  }

  if (tier === "none") {
    return (
      <View style={styles.gateWrap}>
        <Text style={styles.gateTitle}>Analytics not included</Text>
        <Text style={styles.gateSub}>Upgrade to Starter or higher to unlock performance insights.</Text>
        <Pressable style={styles.gateButton} onPress={() => router.push(`/business-manage/${id}`)}>
          <Text style={styles.gateButtonText}>View plans</Text>
        </Pressable>
      </View>
    );
  }

  const full = tier === "full";

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <View style={styles.statsRow}>
        <StatCard value={views} label="Views" styles={styles} />
        <StatCard value={clicks} label="Clicks" styles={styles} />
        <StatCard value={leads.length} label="Leads" styles={styles} />
      </View>
      <View style={styles.statsRow}>
        <StatCard value={`${conversion}%`} label="Conversion" styles={styles} />
        <StatCard value={listings.length} label="Listings" styles={styles} />
        <View style={styles.statCard} />
      </View>

      <View style={styles.box}>
        <Text style={styles.boxTitle}>Top listings by views</Text>
        {topListings.length ? (
          topListings.map((l) => {
            const v = (l as any).views || 0;
            return (
              <View key={l.id} style={{ marginBottom: 10 }}>
                <View style={styles.barRow}>
                  <Text style={styles.barLabel} numberOfLines={1}>
                    {l.title || "Untitled"}
                  </Text>
                  <Text style={styles.barValue}>{v}</Text>
                </View>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: `${Math.round((v / maxViews) * 100)}%` }]} />
                </View>
              </View>
            );
          })
        ) : (
          <Text style={styles.emptyText}>No listings yet.</Text>
        )}
      </View>

      {full ? (
        <>
          <View style={styles.box}>
            <Text style={styles.boxTitle}>Leads by channel</Text>
            {[
              ["WhatsApp", byType.whatsapp],
              ["Call", byType.call],
              ["Chat", byType.chat],
            ].map(([label, n]) => (
              <View key={label as string} style={styles.typeRow}>
                <Text style={styles.typeLabel}>{label}</Text>
                <Text style={styles.typeValue}>{n}</Text>
              </View>
            ))}
          </View>
          <View style={styles.tipBox}>
            <Text style={styles.tipText}>
              Conversion rate is leads divided by listing views. Boost top listings (Featured) to lift views and leads.
            </Text>
          </View>
        </>
      ) : (
        <View style={[styles.tipBox, styles.tipBoxWarn]}>
          <Text style={styles.tipText}>Upgrade to Pro for full analytics — lead channel breakdown and conversion insights.</Text>
        </View>
      )}
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
    gateWrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
    gateTitle: { fontSize: 18, fontWeight: "800", color: color.text, marginBottom: 6 },
    gateSub: { fontSize: 13, color: color.textSub, textAlign: "center", lineHeight: 19, marginBottom: 22 },
    gateButton: { backgroundColor: color.brand, borderRadius: 10, paddingHorizontal: 28, paddingVertical: 13 },
    gateButtonText: { color: color.textOnBrand, fontSize: 14, fontWeight: "700" },
    statsRow: { flexDirection: "row", gap: 10, marginBottom: 10 },
    statCard: { flex: 1, backgroundColor: color.surface, borderRadius: 14, padding: 16, alignItems: "center" },
    statValue: { fontSize: 20, fontWeight: "800", color: color.brand },
    statLabel: { fontSize: 11, color: color.textMuted, fontWeight: "600", marginTop: 2 },
    box: { backgroundColor: color.surface, borderRadius: 16, padding: 16, marginTop: 6, marginBottom: 16 },
    boxTitle: { fontSize: 13, fontWeight: "800", color: color.text, marginBottom: 12 },
    barRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
    barLabel: { fontSize: 12.5, color: color.text, maxWidth: "70%" },
    barValue: { fontSize: 12.5, fontWeight: "700", color: color.textMuted },
    barTrack: { height: 7, backgroundColor: color.border, borderRadius: 5, overflow: "hidden" },
    barFill: { height: "100%", backgroundColor: color.brand },
    typeRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingVertical: 9,
      borderBottomWidth: 1,
      borderBottomColor: color.border,
    },
    typeLabel: { fontSize: 13, color: color.textMuted },
    typeValue: { fontSize: 13, fontWeight: "700", color: color.text },
    tipBox: { backgroundColor: color.brandTint, borderRadius: 14, padding: 14 },
    tipBoxWarn: { backgroundColor: color.goldTint },
    tipText: { fontSize: 12.5, color: color.textSub, lineHeight: 19 },
    emptyText: { textAlign: "center", color: color.textMuted, fontSize: 13, paddingVertical: 14 },
  });
}
