import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import { BRAND_BLUE } from "../../lib/constants";
import { fetchBusinessLeads, type BusinessLead, type LeadStatus } from "../../lib/business-leads";
import { EmptyState } from "../../components/ui/EmptyState";

const TYPE_LABEL: Record<string, string> = { whatsapp: "WhatsApp", call: "Call", chat: "Chat" };

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// Mirrors www/js/business-leads.js pages.BusinessLeads — New/Active/Closed
// tabs of leads captured from WhatsApp/Call/Chat contact actions.
export default function BusinessLeadsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();

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
      (listings ?? []).forEach((l: any) => (map[l.id] = l.title));
      setListingTitles(map);
    }
  }, [id, session]);

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
    await supabase.from("business_leads").update({ status }).eq("id", leadId);
    setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, status } : l)));
  }

  if (isLoading || isOwner === null) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={BRAND_BLUE} />
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
      <View style={styles.tabRow}>
        {(["new", "active", "closed"] as LeadStatus[]).map((t) => (
          <Pressable key={t} style={styles.tabButton} onPress={() => setTab(t)}>
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t[0].toUpperCase() + t.slice(1)} {counts[t] ? `(${counts[t]})` : ""}
            </Text>
            {tab === t ? <View style={styles.tabUnderline} /> : null}
          </Pressable>
        ))}
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {rows.length ? (
          rows.map((lead) => (
            <View key={lead.id} style={styles.card}>
              <View style={styles.cardTop}>
                <Text style={styles.userName}>{lead.user_name || "User"}</Text>
                <View style={styles.typePill}>
                  <Text style={styles.typePillText}>{TYPE_LABEL[lead.type] || lead.type}</Text>
                </View>
              </View>
              <Text style={styles.meta}>
                On: {lead.listing_id ? listingTitles[lead.listing_id] || "Listing" : "Shop"} · {timeAgo(lead.created_at)}
              </Text>
              <View style={styles.actionsRow}>
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
            </View>
          ))
        ) : (
          <Text style={styles.emptyText}>No {tab} leads.</Text>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F6F9" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  tabRow: { flexDirection: "row", backgroundColor: "#ffffff", borderBottomWidth: 1, borderBottomColor: "#E8ECF4" },
  tabButton: { flex: 1, alignItems: "center", paddingVertical: 12 },
  tabText: { fontSize: 13, fontWeight: "600", color: "#8A93A6" },
  tabTextActive: { fontWeight: "800", color: BRAND_BLUE },
  tabUnderline: { height: 2.5, backgroundColor: BRAND_BLUE, width: "60%", borderRadius: 2, marginTop: 6 },
  card: { backgroundColor: "#ffffff", borderRadius: 14, padding: 14, marginBottom: 10 },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  userName: { fontSize: 14, fontWeight: "700", color: "#111827" },
  typePill: { backgroundColor: "#1A3A8F1A", borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 },
  typePillText: { fontSize: 10.5, fontWeight: "800", color: BRAND_BLUE },
  meta: { fontSize: 12.5, color: "#8A93A6", marginTop: 4 },
  actionsRow: { flexDirection: "row", gap: 8, marginTop: 10 },
  primaryAction: { flex: 1, paddingVertical: 8, borderRadius: 9, backgroundColor: BRAND_BLUE, alignItems: "center" },
  primaryActionText: { fontSize: 12, fontWeight: "700", color: "#ffffff" },
  secondaryAction: { flex: 1, paddingVertical: 8, borderRadius: 9, borderWidth: 1, borderColor: "#E8ECF4", alignItems: "center" },
  secondaryActionText: { fontSize: 12, fontWeight: "700", color: "#111827" },
  emptyText: { textAlign: "center", color: "#8A93A6", fontSize: 13, paddingVertical: 30 },
});
