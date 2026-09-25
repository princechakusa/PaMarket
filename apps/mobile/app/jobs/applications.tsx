import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import {
  APPLICATION_STATUS_LABEL,
  APPLICATION_TERMINAL_STATUSES,
  formatInterviewTime,
  INTERVIEW_MODE_LABEL,
  withdrawApplication,
  type ApplicationStatus,
  type JobApplication,
} from "../../lib/jobs";
import { color, type ColorPalette } from "../../lib/theme";
import { useThemedStyles } from "../../lib/theme-provider";
import { useIOSNativeHeader } from "../../lib/useIOSNativeHeader";
import { toast } from "../../components/ui/Toast";
import { openExternalUrl } from "../../lib/open-url";

// Candidate-facing wording (LinkedIn style): the employer's "Under Review"
// is what the candidate sees as "Viewed".
const CANDIDATE_LABEL: Partial<Record<ApplicationStatus, string>> = {
  pending: "Applied",
  reviewing: "Viewed",
  declined: "Not selected",
};

const TRACK: Array<[ApplicationStatus, string]> = [
  ["pending", "Applied"],
  ["reviewing", "Viewed"],
  ["shortlisted", "Shortlisted"],
  ["interview", "Interview"],
  ["offered", "Offer"],
  ["hired", "Hired"],
];

const STATUS_NOTE: Partial<Record<ApplicationStatus, string>> = {
  pending: "Your application was sent. You'll be notified when the employer views it.",
  reviewing: "The employer viewed your application.",
  shortlisted: "You're on the shortlist. The employer may invite you to an interview.",
  offered: "You have an offer. The employer will contact you with the details.",
  hired: "Congratulations, you got the job!",
  declined: "The employer decided not to move forward. Keep applying, the right role is out there.",
  withdrawn: "You withdrew this application.",
};

function buildStatusTones(color: ColorPalette): Record<ApplicationStatus, string> {
  return {
    pending: color.gold,
    reviewing: color.gold,
    shortlisted: color.success,
    interview: color.success,
    offered: color.success,
    hired: color.success,
    declined: color.danger,
    withdrawn: color.textMuted,
  };
}
const STATUS_LABELS = APPLICATION_STATUS_LABEL;

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

  useIOSNativeHeader({
    backgroundColor: color.brand,
    tintColor: color.textOnBrand,
    androidNative: true,
    title: "My Applications",
    headerRight: () => (
      <Pressable onPress={() => router.push("/jobs/messages")} hitSlop={10}>
        <Text style={styles.headerLink}>Messages</Text>
      </Pressable>
    ),
  });

  const load = useCallback(async () => {
    if (!session?.user) return;
    const { data } = await supabase
      .from("applications")
      .select("id,job_id,job_title,company,applicant_id,applicant_name,applicant_phone,applicant_email,message,status,employer_id,applied_at,interview_at,interview_mode,interview_location,interview_link,interview_notes,interview_status")
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
            const label = CANDIDATE_LABEL[item.status] || STATUS_LABELS[item.status] || item.status;
            const stepIndex = TRACK.findIndex(([s]) => s === item.status);
            const showTrack = stepIndex >= 0;
            const showInterview =
              !!item.interview_at && (item.status === "interview" || item.status === "offered" || item.status === "hired");
            const cancelled = item.interview_status === "cancelled";
            const canWithdraw = !APPLICATION_TERMINAL_STATUSES.includes(item.status);
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

                {showTrack ? (
                  <View style={styles.track}>
                    {TRACK.map(([s, l], i) => (
                      <View key={s} style={styles.trackStep}>
                        <View style={[styles.trackBar, i <= stepIndex && { backgroundColor: statusColor }]} />
                        <Text style={[styles.trackLabel, i === stepIndex && { color: statusColor, fontWeight: "700" }]} numberOfLines={1}>
                          {l}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : null}

                {showInterview && item.interview_at ? (
                  <View style={[styles.interviewBox, cancelled && styles.interviewBoxCancelled]}>
                    <Text style={styles.interviewTitle}>
                      {cancelled ? "Interview cancelled" : item.interview_status === "rescheduled" ? "Interview rescheduled" : "Interview scheduled"}
                    </Text>
                    <Text style={[styles.interviewWhen, cancelled && styles.strike]}>{formatInterviewTime(item.interview_at)}</Text>
                    {item.interview_mode ? <Text style={styles.interviewMeta}>{INTERVIEW_MODE_LABEL[item.interview_mode]}</Text> : null}
                    {item.interview_location && !cancelled ? <Text style={styles.interviewMeta}>{item.interview_location}</Text> : null}
                    {item.interview_link && !cancelled ? (
                      <Pressable onPress={() => openExternalUrl(item.interview_link as string, "Could not open the meeting link.")} hitSlop={6}>
                        <Text style={styles.interviewLink}>Join meeting</Text>
                      </Pressable>
                    ) : null}
                    {item.interview_notes ? <Text style={styles.interviewNotes}>{item.interview_notes}</Text> : null}
                    {cancelled ? <Text style={styles.interviewNotes}>The employer may send you a new time.</Text> : null}
                  </View>
                ) : STATUS_NOTE[item.status] ? (
                  <Text style={styles.statusNote}>{STATUS_NOTE[item.status]}</Text>
                ) : null}
                {canWithdraw ? (
                  <Pressable
                    style={styles.withdrawBtn}
                    onPress={() =>
                      Alert.alert(
                        "Withdraw application?",
                        "You can't undo this once withdrawn.",
                        [
                          { text: "Cancel", style: "cancel" },
                          {
                            text: "Withdraw",
                            style: "destructive",
                            onPress: async () => {
                              const result = await withdrawApplication(item.id);
                              if (result.ok) {
                                toast("Application withdrawn");
                                load();
                              } else {
                                toast(result.error || "Could not withdraw application");
                              }
                            },
                          },
                        ]
                      )
                    }
                  >
                    <Text style={styles.withdrawBtnText}>Withdraw</Text>
                  </Pressable>
                ) : null}
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
  headerLink: { fontSize: 13, fontWeight: "700", color: color.textOnBrand },
  listContent: { padding: 16 },
  card: { backgroundColor: color.surface, borderRadius: 14, padding: 16 },
  cardTopRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: 6 },
  jobTitle: { flex: 1, fontSize: 15, fontWeight: "700", color: color.text },
  statusPill: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3, flexShrink: 0 },
  statusPillText: { fontSize: 11, fontWeight: "700" },
  company: { fontSize: 13, color: color.textSub, marginBottom: 4 },
  appliedAt: { fontSize: 12, color: color.textMuted },
  withdrawBtn: { alignSelf: "flex-start", marginTop: 10 },
  track: { flexDirection: "row", gap: 4, marginTop: 12 },
  trackStep: { flex: 1, gap: 5 },
  trackBar: { height: 4, borderRadius: 2, backgroundColor: color.border },
  trackLabel: { fontSize: 9.5, color: color.textMuted, textAlign: "center" },
  statusNote: { fontSize: 12.5, lineHeight: 18, color: color.textSub, marginTop: 10 },
  interviewBox: {
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: color.brand,
    backgroundColor: color.brandTint,
    padding: 12,
    gap: 3,
  },
  interviewBoxCancelled: { borderColor: color.border, backgroundColor: color.bg },
  interviewTitle: { fontSize: 11, fontWeight: "700", color: color.brand, textTransform: "uppercase", letterSpacing: 0.5 },
  interviewWhen: { fontSize: 14.5, fontWeight: "700", color: color.text },
  strike: { textDecorationLine: "line-through", color: color.textMuted },
  interviewMeta: { fontSize: 12.5, color: color.textSub },
  interviewLink: { fontSize: 13, fontWeight: "700", color: color.brand, marginTop: 4 },
  interviewNotes: { fontSize: 12, lineHeight: 17, color: color.textSub, marginTop: 4 },
  withdrawBtnText: { fontSize: 12.5, fontWeight: "700", color: color.danger },
  });
}
