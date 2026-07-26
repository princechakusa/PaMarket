import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import type { JobApplication } from "../../lib/jobs";
import { color, type ColorPalette } from "../../lib/theme";
import { useThemedStyles } from "../../lib/theme-provider";
import { GlassBackButton } from "../../components/ui";

function buildStatusTones(color: ColorPalette): Record<string, string> {
  return {
    pending: color.gold,
    shortlisted: color.success,
    declined: color.danger,
  };
}
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
  const styles = useThemedStyles(buildStyles);
  const statusTones = useThemedStyles(buildStatusTones);
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
        <GlassBackButton onPress={() => router.back()} tone="light" />
        <Text style={styles.headerTitle}>My Applications</Text>
        <View style={{ width: 20 }} />
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={color.brand} />
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
            const statusColor = statusTones[item.status] || color.textMuted;
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
                  <View style={[styles.statusPill, { backgroundColor: `${statusColor}20` }]}>
                    <Text style={[styles.statusPillText, { color: statusColor }]}>{label}</Text>
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

function buildStyles(color: ColorPalette) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: color.bg },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 80, gap: 4 },
  emptyText: { fontSize: 14, fontWeight: "700", color: color.text },
  emptySubtext: { fontSize: 12.5, color: color.textMuted },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: color.brand,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerTitle: { fontSize: 17, fontWeight: "700", color: color.textOnBrand },
  listContent: { padding: 16 },
  card: { backgroundColor: color.surface, borderRadius: 14, padding: 16 },
  cardTopRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: 6 },
  jobTitle: { flex: 1, fontSize: 15, fontWeight: "700", color: color.text },
  statusPill: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3, flexShrink: 0 },
  statusPillText: { fontSize: 11, fontWeight: "700" },
  company: { fontSize: 13, color: color.textSub, marginBottom: 4 },
  appliedAt: { fontSize: 12, color: color.textMuted },
  });
}
