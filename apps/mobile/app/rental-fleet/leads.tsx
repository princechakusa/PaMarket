import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
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

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// Mirrors www/js/rentals-business.js RB.openInquiry + the recent-inquiries
// list — leads from rental_vehicle_leads, resolved to a conversation via
// rental_conversation_context, falling back to a same-customer/company
// lookup, then to a "biz_" conversations.members-contains lookup, matching
// the web app's three-tier fallback so a chat still opens whenever one exists.
export default function RentalLeadsScreen() {
  const styles = useThemedStyles(buildStyles);
  const tones = useThemedStyles(buildTones);
  const { bizId } = useLocalSearchParams<{ bizId: string }>();
  const router = useRouter();
  const { session } = useAuth();

  const [leads, setLeads] = useState<RentalLead[]>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);
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
      .limit(50);
    const rows = (leadRows as any[]) ?? [];

    const userIds = Array.from(new Set(rows.map((l) => l.user_id).filter(Boolean)));
    let nameMap: Record<string, string> = {};
    if (userIds.length) {
      const { data: names } = await supabase.from("profiles_public").select("id,name").in("id", userIds);
      (names ?? []).forEach((p: any) => {
        nameMap[p.id] = p.name || "Customer";
      });
    }
    const listingIds = Array.from(new Set(rows.map((l) => l.listing_id).filter(Boolean)));
    let vehicleMap: Record<string, string> = {};
    if (listingIds.length) {
      const { data: listings } = await supabase.from("rental_vehicle_listings").select("id,model,brand_id").in("id", listingIds);
      const brandIds = Array.from(new Set((listings ?? []).map((l: any) => l.brand_id).filter(Boolean)));
      let brandMap: Record<string, string> = {};
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

  async function openInquiry(lead: RentalLead) {
    if (!lead.user_id || !session?.user) {
      toast(`This customer contacted you via ${SOURCE_LABEL[lead.lead_source] || lead.lead_source}.`);
      return;
    }
    try {
      let convId: string | null = null;
      const { data: ctx } = await supabase
        .from("rental_conversation_context")
        .select("conversation_id")
        .eq("user_id", lead.user_id)
        .eq("listing_id", lead.listing_id)
        .maybeSingle();
      convId = ctx?.conversation_id ?? null;

      if (!convId && companyId) {
        const { data: fallback } = await supabase
          .from("rental_conversation_context")
          .select("conversation_id")
          .eq("user_id", lead.user_id)
          .eq("company_id", companyId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        convId = fallback?.conversation_id ?? null;
      }

      if (!convId) {
        const { data: convRows } = await supabase
          .from("conversations")
          .select("id,members,created_at")
          .contains("members", [session.user.id, lead.user_id])
          .order("created_at", { ascending: false })
          .limit(20);
        const match = (convRows ?? []).find(
          (r: any) => typeof r.id === "string" && r.id.startsWith("biz_") && Array.isArray(r.members) && r.members.length === 2
        );
        if (match) convId = match.id;
      }

      if (convId) {
        supabase.from("rental_vehicle_leads").update({ status: "contacted" }).eq("id", lead.id).then(
          () => {},
          () => {}
        );
        router.push(`/chat/${convId}`);
      } else {
        toast(`This customer has not opened chat yet — they contacted you via ${SOURCE_LABEL[lead.lead_source] || lead.lead_source}.`);
      }
    } catch (e) {
      console.warn("open inquiry:", e);
      toast("Could not open this inquiry.", 4000, true);
    }
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
      {leads.length ? (
        leads.map((l) => (
          <Pressable key={l.id} style={styles.card} onPress={() => openInquiry(l)}>
            <View style={styles.cardTop}>
              <Text style={styles.userName}>{l.user_name || "Customer"}</Text>
              <View style={styles.sourcePill}>
                <Text style={styles.sourcePillText}>{SOURCE_LABEL[l.lead_source] || l.lead_source}</Text>
              </View>
            </View>
            <Text style={styles.meta} numberOfLines={1}>
              {l.vehicle_name || "Rental inquiry"} · {timeAgo(l.created_at)}
            </Text>
            {l.requested_start_date && l.requested_end_date ? (
              <Text style={styles.meta} numberOfLines={1}>
                Requested: {l.requested_start_date} → {l.requested_end_date}
              </Text>
            ) : null}
            <View style={styles.statusRow}>
              <Text style={[styles.statusText, l.status === "new" && styles.statusNew]}>
                {l.status[0].toUpperCase() + l.status.slice(1)}
              </Text>
            </View>
          </Pressable>
        ))
      ) : (
        <EmptyState title="No inquiries yet" subtitle="Leads from chat, WhatsApp, and calls will appear here." />
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
    card: { backgroundColor: color.surface, borderRadius: 14, padding: 14, marginBottom: 10 },
    cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    userName: { fontSize: 14, fontWeight: "700", color: color.text },
    sourcePill: { backgroundColor: color.brandTint, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
    sourcePillText: { fontSize: 10.5, fontWeight: "800", color: color.brand },
    meta: { fontSize: 12.5, color: color.textMuted, marginTop: 4 },
    statusRow: { marginTop: 8 },
    statusText: { fontSize: 11.5, fontWeight: "700", color: color.textMuted },
    statusNew: { color: color.brand },
  });
}
