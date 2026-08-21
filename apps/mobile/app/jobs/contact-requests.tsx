import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import type { ContactRequest } from "../../lib/jobs";
import { EmptyState } from "../../components/ui/EmptyState";
import { color, type ColorPalette } from "../../lib/theme";
import { useThemedStyles } from "../../lib/theme-provider";
import { GlassBackButton } from "../../components/ui";
import { useIOSNativeHeader } from "../../lib/useIOSNativeHeader";

function buildStatusMeta(color: ColorPalette): Record<string, { color: string; bg: string; label: string }> {
  return {
    pending: { color: color.gold, bg: color.goldTint, label: "Pending review" },
    approved: { color: color.success, bg: color.successTint, label: "Approved" },
    declined: { color: color.danger, bg: color.dangerTint, label: "Declined" },
  };
}

function timeAgo(dateString: string): string {
  const days = Math.floor((Date.now() - new Date(dateString).getTime()) / 86400000);
  if (days < 1) return "Today";
  if (days === 1) return "1d ago";
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

// Mirrors www/js/jobs.js H.pages.MyContactRequests — the employer's list of
// candidate contact-unlock requests. contact_requests itself is admin-only
// to SELECT directly now; list_my_contact_requests() is the safe, redacted
// read path (candidate_name only included once a request is approved).
export default function MyContactRequestsScreen() {
  const styles = useThemedStyles(buildStyles);
  const statusMeta = useThemedStyles(buildStatusMeta);
  const router = useRouter();
  const { session } = useAuth();
  const insets = useSafeAreaInsets();
  const [requests, setRequests] = useState<ContactRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useIOSNativeHeader({ backgroundColor: color.brand, tintColor: color.textOnBrand, title: "My Requests" });

  const load = useCallback(async () => {
    if (!session?.user) return;
    const { data } = await supabase.rpc("list_my_contact_requests");
    const mine = ((data as ContactRequest[] | null) ?? [])
      .filter((r) => r.requester_id === session.user.id)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    setRequests(mine);
  }, [session]);

  useEffect(() => {
    setIsLoading(true);
    load().finally(() => setIsLoading(false));
  }, [load]);

  return (
    <View style={styles.container}>
      {Platform.OS !== "ios" ? (
        <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
          <GlassBackButton onPress={() => router.back()} tone="light" flat />
          <Text style={styles.headerTitle}>My Requests</Text>
          <View style={{ width: 20 }} />
        </View>
      ) : null}

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={color.brand} />
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
            const meta = statusMeta[item.status] || statusMeta.pending;
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

function buildStyles(color: ColorPalette) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: color.bg },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 60 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: color.brand,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerTitle: { fontSize: 17, fontWeight: "700", color: color.textOnBrand },
  listContent: { padding: 14, paddingBottom: 40, flexGrow: 1 },
  card: { backgroundColor: color.surface, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: color.border },
  cardTopRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: 8 },
  candName: { fontSize: 15, fontWeight: "800", color: color.text },
  roleText: { fontSize: 12, color: color.textMuted, marginTop: 1 },
  statusPill: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, flexShrink: 0 },
  statusPillText: { fontSize: 11, fontWeight: "800" },
  statusBody: { fontSize: 12, color: color.textSub, lineHeight: 18 },
  requestedAt: { fontSize: 11, color: color.textMuted, marginTop: 8 },
  });
}
