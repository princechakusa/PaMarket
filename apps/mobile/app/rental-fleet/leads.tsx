import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import { toast } from "../../components/ui/Toast";
import type { RentalLead } from "../../lib/rentals";
import { fleetVehicleLabel } from "../../lib/rentals";
import { EmptyState } from "../../components/ui/EmptyState";
import type { ColorPalette } from "../../lib/theme";
import { useThemedStyles } from "../../lib/theme-provider";

const SOURCE_LABEL: Record<string, string> = {
  chat: "Chat",
  whatsapp_click: "WhatsApp",
  call_click: "Call",
  favorite: "Saved",
  share: "Share",
  view_detail: "Viewed",
  booking_request: "Booking Request",
};

const STATUS_LABEL: Record<RentalLead["status"], string> = {
  new: "New",
  contacted: "Contacted",
  converted: "Converted",
  lost: "Lost",
};

const STATUS_FILTERS: Array<RentalLead["status"] | "all"> = ["all", "new", "contacted", "converted", "lost"];

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// Rental owner inbox. Leads come from booking requests, chat, WhatsApp, and
// call taps. The screen resolves an inquiry back to a rental conversation when
// one exists, and lets the business manage the inquiry funnel.
export default function RentalLeadsScreen() {
  const styles = useThemedStyles(buildStyles);
  const tones = useThemedStyles(buildTones);
  const { bizId } = useLocalSearchParams<{ bizId: string }>();
  const router = useRouter();
  const { session } = useAuth();

  const [leads, setLeads] = useState<RentalLead[]>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<RentalLead["status"] | "all">("all");
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    if (!bizId) return;
    const { data: rc } = await supabase.from("rental_companies").select("id").eq("business_id", bizId).maybeSingle();
    if (!rc) return;
    setCompanyId(rc.id);

    const { data: leadRows } = await supabase
      .from("rental_vehicle_leads")
      .select("id,listing_id,company_id,lead_source,status,created_at,user_id,requested_start_date,requested_end_date")
      .eq("company_id", rc.id)
      .order("created_at", { ascending: false })
      .limit(100);
    const rows = (leadRows as any[]) ?? [];

    const userIds = Array.from(new Set(rows.map((l) => l.user_id).filter(Boolean)));
    const nameMap: Record<string, string> = {};
    if (userIds.length) {
      const { data: names } = await supabase.from("profiles_public").select("id,name").in("id", userIds);
      (names ?? []).forEach((p: any) => {
        nameMap[p.id] = p.name || "Customer";
      });
    }

    const listingIds = Array.from(new Set(rows.map((l) => l.listing_id).filter(Boolean)));
    const vehicleMap: Record<string, string> = {};
    if (listingIds.length) {
      const { data: listings } = await supabase.from("rental_vehicle_listings").select("id,model,brand_id").in("id", listingIds);
      const brandIds = Array.from(new Set((listings ?? []).map((l: any) => l.brand_id).filter(Boolean)));
      const brandMap: Record<string, string> = {};
      if (brandIds.length) {
        const { data: brands } = await supabase.from("rental_brands").select("id,label").in("id", brandIds);
        (brands ?? []).forEach((b: any) => {
          brandMap[b.id] = b.label;
        });
      }
      (listings ?? []).forEach((l: any) => {
        vehicleMap[l.id] = fleetVehicleLabel({ brand_label: brandMap[l.brand_id], model: l.model });
      });
    }

    setLeads(
      rows.map((l) => ({
        ...l,
        user_name: nameMap[l.user_id] ?? null,
        vehicle_name: vehicleMap[l.listing_id] ?? null,
      }))
    );
  }, [bizId]);

  useEffect(() => {
    setIsLoading(true);
    load().finally(() => setIsLoading(false));
  }, [load]);

  const summary = useMemo(
    () => ({
      new: leads.filter((l) => l.status === "new").length,
      contacted: leads.filter((l) => l.status === "contacted").length,
      converted: leads.filter((l) => l.status === "converted").length,
    }),
    [leads]
  );

  const visibleLeads = useMemo(
    () => (statusFilter === "all" ? leads : leads.filter((l) => l.status === statusFilter)),
    [leads, statusFilter]
  );

  async function findConversationForLead(lead: RentalLead) {
    if (!lead.user_id || !session?.user) return null;

    const { data: ctx } = await supabase
      .from("rental_conversation_context")
      .select("conversation_id")
      .eq("user_id", lead.user_id)
      .eq("listing_id", lead.listing_id)
      .maybeSingle();
    if (ctx?.conversation_id) return ctx.conversation_id as string;

    if (companyId) {
      const { data: fallback } = await supabase
        .from("rental_conversation_context")
        .select("conversation_id")
        .eq("user_id", lead.user_id)
        .eq("company_id", companyId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (fallback?.conversation_id) return fallback.conversation_id as string;
    }

    const { data: convRows } = await supabase
      .from("conversations")
      .select("id,members,created_at")
      .contains("members", [session.user.id, lead.user_id])
      .order("created_at", { ascending: false })
      .limit(20);
    const match = (convRows ?? []).find(
      (r: any) =>
        typeof r.id === "string" &&
        (r.id.startsWith("biz_") || r.id.startsWith("rental_")) &&
        Array.isArray(r.members) &&
        r.members.length === 2
    );
    return match?.id ?? null;
  }

  async function updateLeadStatus(lead: RentalLead, status: RentalLead["status"]) {
    const patch: Record<string, string | null> = { status };
    if (status === "contacted") patch.contacted_at = new Date().toISOString();
    if (status === "converted") patch.converted_at = new Date().toISOString();
    if (status === "new") {
      patch.contacted_at = null;
      patch.converted_at = null;
    }

    const { error } = await supabase.from("rental_vehicle_leads").update(patch).eq("id", lead.id);
    if (error) {
      console.warn("rental lead status:", error);
      toast("Could not update this inquiry.", 4000, true);
      return;
    }
    setLeads((prev) => prev.map((l) => (l.id === lead.id ? { ...l, status } : l)));
    toast(`Inquiry marked ${STATUS_LABEL[status].toLowerCase()}.`);
  }

  async function openInquiryChat(lead: RentalLead) {
    if (!lead.user_id || !session?.user) {
      toast(`This customer contacted you via ${SOURCE_LABEL[lead.lead_source] || lead.lead_source}.`);
      return;
    }
    try {
      const convId = await findConversationForLead(lead);
      if (!convId) {
        toast(`This customer has not opened chat yet. Source: ${SOURCE_LABEL[lead.lead_source] || lead.lead_source}.`);
        return;
      }
      if (lead.status === "new") {
        supabase.from("rental_vehicle_leads").update({ status: "contacted", contacted_at: new Date().toISOString() }).eq("id", lead.id).then(
          () => {},
          () => {}
        );
        setLeads((prev) => prev.map((l) => (l.id === lead.id ? { ...l, status: "contacted" } : l)));
      }
      router.push(`/chat/${convId}`);
    } catch (e) {
      console.warn("open inquiry:", e);
      toast("Could not open this inquiry.", 4000, true);
    }
  }

  function showInquiryActions(lead: RentalLead) {
    const bookingText =
      lead.requested_start_date && lead.requested_end_date
        ? `\n\nRequested dates: ${lead.requested_start_date} -> ${lead.requested_end_date}`
        : "";
    Alert.alert(
      lead.user_name || "Customer inquiry",
      `${lead.vehicle_name || "Rental vehicle"}\nSource: ${SOURCE_LABEL[lead.lead_source] || lead.lead_source}\nStatus: ${STATUS_LABEL[lead.status]}${bookingText}`,
      [
        { text: "Open Chat", onPress: () => openInquiryChat(lead) },
        { text: "Mark Contacted", onPress: () => updateLeadStatus(lead, "contacted") },
        { text: "Mark Converted", onPress: () => updateLeadStatus(lead, "converted") },
        { text: "Mark Lost", style: "destructive", onPress: () => updateLeadStatus(lead, "lost") },
        { text: "Cancel", style: "cancel" },
      ]
    );
  }

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={tones.brand} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingBottom: 30 }}>
      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Rental Inquiries</Text>
        <Text style={styles.summaryBody}>Track booking requests, chat leads, WhatsApp taps, and calls from renters.</Text>
        <View style={styles.metricRow}>
          <View style={styles.metricCell}>
            <Text style={styles.metricValue}>{summary.new}</Text>
            <Text style={styles.metricLabel}>New</Text>
          </View>
          <View style={styles.metricCell}>
            <Text style={styles.metricValue}>{summary.contacted}</Text>
            <Text style={styles.metricLabel}>Contacted</Text>
          </View>
          <View style={styles.metricCell}>
            <Text style={styles.metricValue}>{summary.converted}</Text>
            <Text style={styles.metricLabel}>Converted</Text>
          </View>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {STATUS_FILTERS.map((status) => (
          <Pressable key={status} style={[styles.filterPill, statusFilter === status && styles.filterPillActive]} onPress={() => setStatusFilter(status)}>
            <Text style={[styles.filterText, statusFilter === status && styles.filterTextActive]}>
              {status === "all" ? "All" : STATUS_LABEL[status]}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {visibleLeads.length ? (
        visibleLeads.map((l) => (
          <Pressable key={l.id} style={styles.card} onPress={() => showInquiryActions(l)}>
            <View style={styles.cardTop}>
              <Text style={styles.userName}>{l.user_name || "Customer"}</Text>
              <View style={styles.sourcePill}>
                <Text style={styles.sourcePillText}>{SOURCE_LABEL[l.lead_source] || l.lead_source}</Text>
              </View>
            </View>
            <Text style={styles.meta} numberOfLines={1}>
              {l.vehicle_name || "Rental inquiry"} - {timeAgo(l.created_at)}
            </Text>
            {l.requested_start_date && l.requested_end_date ? (
              <Text style={styles.meta} numberOfLines={1}>
                Requested: {l.requested_start_date} {"->"} {l.requested_end_date}
              </Text>
            ) : null}
            <View style={styles.statusRow}>
              <Text style={[styles.statusText, l.status === "new" && styles.statusNew]}>{STATUS_LABEL[l.status]}</Text>
              <Text style={styles.actionHint}>Tap to manage</Text>
            </View>
          </Pressable>
        ))
      ) : (
        <EmptyState
          title={leads.length ? "No inquiries in this status" : "No inquiries yet"}
          subtitle="Leads from booking requests, chat, WhatsApp, and calls will appear here."
        />
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
    summaryCard: { backgroundColor: color.surface, borderRadius: 18, padding: 16, marginBottom: 12 },
    summaryTitle: { fontSize: 18, fontWeight: "800", color: color.text },
    summaryBody: { fontSize: 12.5, color: color.textMuted, lineHeight: 18, marginTop: 4 },
    metricRow: { flexDirection: "row", gap: 10, marginTop: 14 },
    metricCell: { flex: 1, backgroundColor: color.surfaceAlt, borderRadius: 14, padding: 10, alignItems: "center" },
    metricValue: { fontSize: 18, fontWeight: "900", color: color.brand },
    metricLabel: { fontSize: 10.5, fontWeight: "700", color: color.textMuted, marginTop: 2 },
    filterRow: { gap: 8, paddingBottom: 12 },
    filterPill: {
      borderWidth: 1.5,
      borderColor: color.border,
      borderRadius: 999,
      paddingHorizontal: 13,
      paddingVertical: 7,
      backgroundColor: color.surface,
    },
    filterPillActive: { borderColor: color.brand, backgroundColor: color.brandTint },
    filterText: { fontSize: 12, fontWeight: "700", color: color.textMuted },
    filterTextActive: { color: color.brand },
    card: { backgroundColor: color.surface, borderRadius: 14, padding: 14, marginBottom: 10 },
    cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    userName: { fontSize: 14, fontWeight: "700", color: color.text },
    sourcePill: { backgroundColor: color.brandTint, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
    sourcePillText: { fontSize: 10.5, fontWeight: "800", color: color.brand },
    meta: { fontSize: 12.5, color: color.textMuted, marginTop: 4 },
    statusRow: { marginTop: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    statusText: { fontSize: 11.5, fontWeight: "700", color: color.textMuted },
    statusNew: { color: color.brand },
    actionHint: { fontSize: 11, fontWeight: "700", color: color.textMuted },
  });
}
