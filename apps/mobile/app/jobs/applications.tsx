import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Polyline } from "react-native-svg";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import { BRAND_BLUE } from "../../lib/constants";
import type { JobApplication } from "../../lib/jobs";

function BackIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth={2.4}>
      <Polyline points="15 18 9 12 15 6" />
    </Svg>
  );
}

const STATUS_COLORS: Record<string, string> = {
  pending: "#F5A623",
  shortlisted: "#22c55e",
  declined: "#ef4444",
};
const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  shortlisted: "Shortlisted",
  declined: "Not selected",
};

function timeAgo(dateString: string): string {
  const days = Math.floor((Date.now() - new Date(dateString).getTime()) / 86400000);
  if (days < 1) return "Today";
  if (days === 1) return "1d ago";
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

// Mirrors www/js/jobs.js H.pages.AppliedJobs — "My Applications" for the
// signed-in job seeker, reading directly from public.applications.
export default function MyApplicationsScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const insets = useSafeAreaInsets();
  const [apps, setApps] = useState<JobApplication[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    if (!session?.user) return;
    const { data } = await supabase
      .from("applications")
      .select("id,job_id,job_title,company,applicant_id,applicant_name,applicant_phone,applicant_email,message,status,employer_id,applied_at")
      .eq("applicant_id", session.user.id)
      .order("applied_at", { ascending: false });
    setApps((data as JobApplication[]) ?? []);
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
        <Text style={styles.headerTitle}>My Applications</Text>
        <View style={{ width: 20 }} />
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={BRAND_BLUE} />
        </View>
      ) : (
        <FlatList
          data={apps}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          ListEmptyComponent={
            <View style={styles.centered}>
              <Text style={styles.emptyText}>No applications yet.</Text>
              <Text style={styles.emptySubtext}>Browse jobs and apply directly in the app.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const color = STATUS_COLORS[item.status] || "#9CA3AF";
            const label = STATUS_LABELS[item.status] || item.status;
            return (
              <Pressable
                style={styles.card}
                onPress={() => router.push({ pathname: "/jobs/[id]", params: { id: item.job_id } })}
              >
                <View style={styles.cardTopRow}>
                  <Text style={styles.jobTitle} numberOfLines={1}>
                    {item.job_title || "Job"}
                  </Text>
                  <View style={[styles.statusPill, { backgroundColor: `${color}20` }]}>
                    <Text style={[styles.statusPillText, { color }]}>{label}</Text>
                  </View>
                </View>
                <Text style={styles.company}>{item.company}</Text>
                <Text style={styles.appliedAt}>Applied {timeAgo(item.applied_at)}</Text>
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
  centered: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 80, gap: 4 },
  emptyText: { fontSize: 14, fontWeight: "700", color: "#111827" },
  emptySubtext: { fontSize: 12.5, color: "#8A93A6" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: BRAND_BLUE,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerTitle: { fontSize: 17, fontWeight: "700", color: "#ffffff" },
  listContent: { padding: 16 },
  card: { backgroundColor: "#ffffff", borderRadius: 14, padding: 16 },
  cardTopRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: 6 },
  jobTitle: { flex: 1, fontSize: 15, fontWeight: "700", color: "#111827" },
  statusPill: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3, flexShrink: 0 },
  statusPillText: { fontSize: 11, fontWeight: "700" },
  company: { fontSize: 13, color: "#5A6478", marginBottom: 4 },
  appliedAt: { fontSize: 12, color: "#8A93A6" },
});
