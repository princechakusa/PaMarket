import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Polyline } from "react-native-svg";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import { BRAND_BLUE } from "../../lib/constants";
import type { ContactRequest } from "../../lib/jobs";
import { EmptyState } from "../../components/ui/EmptyState";

function BackIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth={2.4}>
      <Polyline points="15 18 9 12 15 6" />
    </Svg>
  );
}

const STATUS_META: Record<string, { color: string; bg: string; label: string }> = {
  pending: { color: "#F5A623", bg: "#F5A62318", label: "Pending review" },
  approved: { color: "#15803d", bg: "#22c55e1a", label: "Approved" },
  declined: { color: "#ef4444", bg: "#ef444418", label: "Declined" },
};

function timeAgo(dateString: string): string {
  const days = Math.floor((Date.now() - new Date(dateString).getTime()) / 86400000);
  if (days < 1) return "Today";
  if (days === 1) return "1d ago";
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

// Mirrors www/js/jobs.js H.pages.MyContactRequests — the employer's list of
// candidate contact-unlock requests, reading directly from
// public.contact_requests (RLS: requester can read their own rows).
export default function MyContactRequestsScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const insets = useSafeAreaInsets();
  const [requests, setRequests] = useState<ContactRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    if (!session?.user) return;
    const { data } = await supabase
      .from("contact_requests")
      .select("id,requester_id,candidate_id,requester_name,candidate_name,company,role,note,status,created_at,decided_at")
      .eq("requester_id", session.user.id)
      .order("created_at", { ascending: false });
    setRequests((data as ContactRequest[]) ?? []);
  }, [session]);

  useEffect(() => {
    setIsLoading(true);
    load().finally(() => setIsLoading(false));
  }, [load]);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <BackIcon />
        </Pressable>
        <Text style={styles.headerTitle}>My Requests</Text>
        <View style={{ width: 20 }} />
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={BRAND_BLUE} />
        </View>
      ) : (
        <FlatList
          data={requests}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          ListEmptyComponent={
            <View style={styles.centered}>
              <EmptyState
                title="No requests yet"
                subtitle="When you request a candidate's contact in Hire Talent, it shows here with its status."
                buttonLabel="Browse Candidates"
                onPressButton={() => router.push("/jobs/hire-talent")}
              />
            </View>
          }
          renderItem={({ item }) => {
            const meta = STATUS_META[item.status] || STATUS_META.pending;
            const approved = item.status === "approved";
            const name = approved ? item.candidate_name || "Candidate" : "Candidate";
            return (
              <Pressable
                style={styles.card}
                onPress={() => router.push({ pathname: "/jobs/candidate/[id]", params: { id: item.candidate_id } })}
              >
                <View style={styles.cardTopRow}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.candName} numberOfLines={1}>
                      {name}
                    </Text>
                    {item.role || item.company ? (
                      <Text style={styles.roleText} numberOfLines={1}>
                        {[item.role, item.company].filter(Boolean).join(" · ")}
                      </Text>
                    ) : null}
                  </View>
                  <View style={[styles.statusPill, { backgroundColor: meta.bg }]}>
                    <Text style={[styles.statusPillText, { color: meta.color }]}>{meta.label}</Text>
                  </View>
                </View>
                <Text style={styles.statusBody}>
                  {approved
                    ? "Contact unlocked — tap to view this candidate's profile."
                    : item.status === "declined"
                      ? "This request was not approved. You can try another candidate."
                      : "We're reviewing your request. You'll be notified once it's approved."}
                </Text>
                <Text style={styles.requestedAt}>Requested {timeAgo(item.created_at)}</Text>
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F6F9" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 60 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: BRAND_BLUE,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerTitle: { fontSize: 17, fontWeight: "700", color: "#ffffff" },
  listContent: { padding: 14, paddingBottom: 40, flexGrow: 1 },
  card: { backgroundColor: "#ffffff", borderRadius: 14, padding: 16, borderWidth: 1, borderColor: "#E8ECF4" },
  cardTopRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: 8 },
  candName: { fontSize: 15, fontWeight: "800", color: "#111827" },
  roleText: { fontSize: 12, color: "#8A93A6", marginTop: 1 },
  statusPill: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, flexShrink: 0 },
  statusPillText: { fontSize: 11, fontWeight: "800" },
  statusBody: { fontSize: 12, color: "#5A6478", lineHeight: 18 },
  requestedAt: { fontSize: 11, color: "#9CA3AF", marginTop: 8 },
});
