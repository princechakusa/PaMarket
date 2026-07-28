import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import { fetchBusinessLeads, type BusinessLead, type LeadStatus } from "../../lib/business-leads";
import { EmptyState } from "../../components/ui/EmptyState";
import type { ColorPalette } from "../../lib/theme";
import { useThemedStyles } from "../../lib/theme-provider";

const TYPE_LABEL: Record<string, string> = { whatsapp: "WhatsApp", call: "Call", chat: "Chat" };
const STATUS_LABEL: Record<LeadStatus, string> = { new: "New", active: "Active", closed: "Closed" };

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// Owner inbox for verified/business shops. Leads are captured from shop-level
// and product-level contact actions, then managed through a simple funnel.
export default function BusinessLeadsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const router = useRouter();
  const styles = useThemedStyles(buildStyles);
  const tones = useThemedStyles(buildTones);

  const [leads, setLeads] = useState<BusinessLead[]>([]);
  const [listingTitles, setListingTitles] = useState<Record<string, string>>({});
  const [isOwner, setIsOwner] = useState<boolean | null>(null);
  const [tab, setTab] = useState<LeadStatus>("new");
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id || !session?.user) return;
    const { data: biz } = await supabase.from("businesses").select("owner_user_id").eq("id", id).maybeSingle();
    if (!biz || biz.owner_user_id !== session.user.id) {
      setIsOwner(false);
      return;
    }
    setIsOwner(true);
    const rows = await fetchBusinessLeads(id);
    setLeads(rows);

    const listingIds = Array.from(new Set(rows.map((r) => r.listing_id).filter(Boolean))) as string[];
    if (listingIds.length) {
      const { data: listings } = await supabase.from("listings").select("id,title").in("id", listingIds);
      const map: Record<string, string> = {};
      (listings ?? []).forEach((l: any) => {
        map[l.id] = l.title;
      });
      setListingTitles(map);
    } else {
      setListingTitles({});
    }
  }, [id, session?.user]);

  useEffect(() => {
    setIsLoading(true);
    load().finally(() => setIsLoading(false));
  }, [load]);

  const counts = useMemo(
    () => ({
      new: leads.filter((l) => l.status === "new").length,
      active: leads.filter((l) => l.status === "active").length,
      closed: leads.filter((l) => l.status === "closed").length,
    }),
    [leads]
  );
  const rows = leads.filter((l) => l.status === tab);

  async function setStatus(leadId: string, status: LeadStatus) {
    const { error } = await supabase.from("business_leads").update({ status }).eq("id", leadId);
    if (error) {
      Alert.alert("Could not update lead", "Please try again.");
      return;
    }
    setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, status } : l)));
  }

  async function openChat(lead: BusinessLead) {
    if (!id || !session?.user || !lead.user_id) return false;
    const { data } = await supabase
      .from("conversations")
      .select("id,members,created_at")
      .eq("business_id", id)
      .contains("members", [session.user.id, lead.user_id])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!data?.id) return false;
    if (lead.status === "new") setStatus(lead.id, "active");
    router.push({ pathname: "/chat/[id]", params: { id: data.id } });
    return true;
  }

  function showLeadActions(lead: BusinessLead) {
    const source = TYPE_LABEL[lead.type] || lead.type;
    const target = lead.listing_id ? listingTitles[lead.listing_id] || "Listing" : "Shop profile";
    Alert.alert(
      lead.user_name || "Customer lead",
      `${target}\nSource: ${source}\nStatus: ${STATUS_LABEL[lead.status]}\nReceived: ${timeAgo(lead.created_at)}`,
      [
        {
          text: "Open Chat",
          onPress: async () => {
            const ok = await openChat(lead);
            if (!ok) Alert.alert("No chat found", `This customer contacted you through ${source}.`);
          },
        },
        { text: "Mark Active", onPress: () => setStatus(lead.id, "active") },
        { text: "Close Lead", style: "destructive", onPress: () => setStatus(lead.id, "closed") },
        { text: "Cancel", style: "cancel" },
      ]
    );
  }

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
        <EmptyState title="Owner only" subtitle="Only the owner can view leads." />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Shop Leads</Text>
        <Text style={styles.summaryBody}>Track customers who contact your shop or products through chat, calls, and WhatsApp.</Text>
        <View style={styles.metricRow}>
          <View style={styles.metricCell}>
            <Text style={styles.metricValue}>{counts.new}</Text>
            <Text style={styles.metricLabel}>New</Text>
          </View>
          <View style={styles.metricCell}>
            <Text style={styles.metricValue}>{counts.active}</Text>
            <Text style={styles.metricLabel}>Active</Text>
          </View>
          <View style={styles.metricCell}>
            <Text style={styles.metricValue}>{counts.closed}</Text>
            <Text style={styles.metricLabel}>Closed</Text>
          </View>
        </View>
      </View>

      <View style={styles.tabRow}>
        {(["new", "active", "closed"] as LeadStatus[]).map((t) => (
          <Pressable key={t} style={styles.tabButton} onPress={() => setTab(t)}>
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {STATUS_LABEL[t]} {counts[t] ? `(${counts[t]})` : ""}
            </Text>
            {tab === t ? <View style={styles.tabUnderline} /> : null}
          </Pressable>
        ))}
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {rows.length ? (
          rows.map((lead) => (
            <Pressable key={lead.id} style={styles.card} onPress={() => showLeadActions(lead)}>
              <View style={styles.cardTop}>
                <Text style={styles.userName}>{lead.user_name || "Customer"}</Text>
                <View style={styles.typePill}>
                  <Text style={styles.typePillText}>{TYPE_LABEL[lead.type] || lead.type}</Text>
                </View>
              </View>
              <Text style={styles.meta}>
                On: {lead.listing_id ? listingTitles[lead.listing_id] || "Listing" : "Shop"} - {timeAgo(lead.created_at)}
              </Text>
              <View style={styles.actionsRow}>
                {lead.type === "chat" ? (
                  <Pressable style={styles.primaryAction} onPress={() => openChat(lead)}>
                    <Text style={styles.primaryActionText}>Open chat</Text>
                  </Pressable>
                ) : null}
                {lead.status === "new" ? (
                  <Pressable style={styles.primaryAction} onPress={() => setStatus(lead.id, "active")}>
                    <Text style={styles.primaryActionText}>Mark active</Text>
                  </Pressable>
                ) : null}
                {lead.status !== "closed" ? (
                  <Pressable style={styles.secondaryAction} onPress={() => setStatus(lead.id, "closed")}>
                    <Text style={styles.secondaryActionText}>Close</Text>
                  </Pressable>
                ) : (
                  <Pressable style={styles.secondaryAction} onPress={() => setStatus(lead.id, "active")}>
                    <Text style={styles.secondaryActionText}>Reopen</Text>
                  </Pressable>
                )}
              </View>
            </Pressable>
          ))
        ) : (
          <Text style={styles.emptyText}>No {tab} leads.</Text>
        )}
      </ScrollView>
    </View>
  );
}

function buildTones(color: ColorPalette) {
  return { brand: color.brand };
}

function buildStyles(color: ColorPalette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: color.bg },
    centered: { flex: 1, alignItems: "center", justifyContent: "center" },
    summaryCard: { backgroundColor: color.surface, borderBottomWidth: 1, borderBottomColor: color.border, padding: 16 },
    summaryTitle: { fontSize: 18, fontWeight: "800", color: color.text },
    summaryBody: { fontSize: 12.5, color: color.textMuted, lineHeight: 18, marginTop: 4 },
    metricRow: { flexDirection: "row", gap: 10, marginTop: 14 },
    metricCell: { flex: 1, backgroundColor: color.surfaceAlt, borderRadius: 14, padding: 10, alignItems: "center" },
    metricValue: { fontSize: 18, fontWeight: "900", color: color.brand },
    metricLabel: { fontSize: 10.5, fontWeight: "700", color: color.textMuted, marginTop: 2 },
    tabRow: { flexDirection: "row", backgroundColor: color.surface, borderBottomWidth: 1, borderBottomColor: color.border },
    tabButton: { flex: 1, alignItems: "center", paddingVertical: 12 },
    tabText: { fontSize: 13, fontWeight: "600", color: color.textMuted },
    tabTextActive: { fontWeight: "800", color: color.brand },
    tabUnderline: { height: 2.5, backgroundColor: color.brand, width: "60%", borderRadius: 2, marginTop: 6 },
    card: { backgroundColor: color.surface, borderRadius: 14, padding: 14, marginBottom: 10 },
    cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    userName: { fontSize: 14, fontWeight: "700", color: color.text },
    typePill: { backgroundColor: color.brandTint, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 },
    typePillText: { fontSize: 10.5, fontWeight: "800", color: color.brand },
    meta: { fontSize: 12.5, color: color.textMuted, marginTop: 4 },
    actionsRow: { flexDirection: "row", gap: 8, marginTop: 10 },
    primaryAction: { flex: 1, paddingVertical: 8, borderRadius: 9, backgroundColor: color.brand, alignItems: "center" },
    primaryActionText: { fontSize: 12, fontWeight: "700", color: color.textOnBrand },
    secondaryAction: { flex: 1, paddingVertical: 8, borderRadius: 9, borderWidth: 1, borderColor: color.border, alignItems: "center" },
    secondaryActionText: { fontSize: 12, fontWeight: "700", color: color.text },
    emptyText: { textAlign: "center", color: color.textMuted, fontSize: 13, paddingVertical: 30 },
  });
}
