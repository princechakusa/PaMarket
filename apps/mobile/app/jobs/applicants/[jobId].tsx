import { useCallback, useEffect, useMemo, useState } from "react";
import { openExternalUrl, openPhone } from "../../../lib/open-url";
import { getCvSignedUrl, openCvUrl } from "../../../lib/cv";
import { ActivityIndicator, FlatList, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../../lib/auth";
import { color, font, radius, shadow, space, type ColorPalette } from "../../../lib/theme";
import { useThemedStyles } from "../../../lib/theme-provider";
import { Avatar, Badge, Button, Card, EmptyState, GlassBackButton, toast, VerifiedBadge } from "../../../components/ui";
import { useIOSNativeHeader } from "../../../lib/useIOSNativeHeader";

type ApplicationStatus = "pending" | "shortlisted" | "declined";

type JobLite = {
  id: string;
  seller_id: string;
  seller_name: string | null;
  title: string;
};

type JobApplicant = {
  id: string;
  job_id: string;
  job_title: string;
  company: string;
  applicant_id: string;
  applicant_name: string;
  applicant_phone: string;
  applicant_email: string;
  message: string;
  status: ApplicationStatus;
  employer_id: string;
  applied_at: string;
  answers?: unknown;
};

type ApplicantProfile = {
  id: string;
  name: string | null;
  avatar: string | null;
  verified: boolean | null;
  job_title: string | null;
};

const STATUS_META: Record<ApplicationStatus, { label: string; tone: "gold" | "success" | "danger" }> = {
  pending: { label: "Pending", tone: "gold" },
  shortlisted: { label: "Shortlisted", tone: "success" },
  declined: { label: "Not selected", tone: "danger" },
};

function MailIcon({ c }: { c: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2}>
      <Path d="M4 4h16v16H4z" />
      <Path d="m22 6-10 7L2 6" />
    </Svg>
  );
}

function PhoneIcon({ c }: { c: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2}>
      <Path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 2.1.74 3.26a2 2 0 0 1-.45 2.11l-1.27 1.27a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c1.16.38 2.3.61 3.26.74a2 2 0 0 1 1.72 2.03Z" />
    </Svg>
  );
}

function timeAgo(dateString: string): string {
  const days = Math.floor((Date.now() - new Date(dateString).getTime()) / 86400000);
  if (days < 1) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function normalizeAnswers(value: unknown): Array<{ question: string; answer: string }> {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === "string") return { question: "Answer", answer: item };
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const question = String(row.question || row.q || row.label || "Question");
      const answer = String(row.answer || row.a || row.value || "");
      return answer.trim() ? { question, answer } : null;
    })
    .filter((item): item is { question: string; answer: string } => !!item);
}

export default function JobApplicantsScreen() {
  const { jobId } = useLocalSearchParams<{ jobId: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const insets = useSafeAreaInsets();
  const styles = useThemedStyles(buildStyles);
  const themeColor = useThemedStyles((c) => c);

  const [job, setJob] = useState<JobLite | null>(null);
  const [apps, setApps] = useState<JobApplicant[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ApplicantProfile>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [notAllowed, setNotAllowed] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [cvOpeningId, setCvOpeningId] = useState<string | null>(null);
  const [messagingId, setMessagingId] = useState<string | null>(null);

  useIOSNativeHeader({ backgroundColor: color.brand, tintColor: color.textOnBrand, title: "Applicants" });

  const load = useCallback(async () => {
    if (!jobId || !session?.user) return;
    setNotAllowed(false);

    const { data: jobData } = await supabase
      .from("listings")
      .select("id,seller_id,seller_name,title")
      .eq("id", jobId)
      .eq("category", "jobs")
      .maybeSingle();

    const foundJob = (jobData as JobLite | null) ?? null;
    if (!foundJob || foundJob.seller_id !== session.user.id) {
      setJob(foundJob);
      setNotAllowed(true);
      setApps([]);
      setProfiles({});
      return;
    }
    setJob(foundJob);

    const { data: applicationRows } = await supabase
      .from("applications")
      .select("id,job_id,job_title,company,applicant_id,applicant_name,applicant_phone,applicant_email,message,status,employer_id,applied_at,answers")
      .eq("job_id", jobId)
      .eq("employer_id", session.user.id)
      .order("applied_at", { ascending: false })
      .limit(500);

    const nextApps = ((applicationRows as JobApplicant[]) ?? []).filter((row) => row.employer_id === session.user.id);
    setApps(nextApps);

    const applicantIds = Array.from(new Set(nextApps.map((row) => row.applicant_id).filter(Boolean)));
    if (!applicantIds.length) {
      setProfiles({});
      return;
    }

    const { data: profileRows } = await supabase
      .from("profiles")
      .select("id,name,avatar,verified,job_title")
      .in("id", applicantIds);

    const byId: Record<string, ApplicantProfile> = {};
    ((profileRows as ApplicantProfile[]) ?? []).forEach((profile) => {
      byId[profile.id] = profile;
    });
    setProfiles(byId);
  }, [jobId, session?.user]);

  useEffect(() => {
    setIsLoading(true);
    load().finally(() => setIsLoading(false));
  }, [load]);

  const counts = useMemo(
    () => ({
      total: apps.length,
      pending: apps.filter((app) => app.status === "pending").length,
      shortlisted: apps.filter((app) => app.status === "shortlisted").length,
      declined: apps.filter((app) => app.status === "declined").length,
    }),
    [apps]
  );

  async function updateStatus(app: JobApplicant, status: ApplicationStatus) {
    if (!session?.user || busyId) return;
    setBusyId(app.id);
    const previous = apps;
    setApps((rows) => rows.map((row) => (row.id === app.id ? { ...row, status } : row)));
    const { error } = await supabase
      .from("applications")
      .update({ status })
      .eq("id", app.id)
      .eq("employer_id", session.user.id);
    setBusyId(null);
    if (error) {
      setApps(previous);
      toast("Could not update application status", 3500, true);
      return;
    }
    toast(status === "shortlisted" ? "Applicant shortlisted" : status === "declined" ? "Applicant marked not selected" : "Application moved to pending");
  }

  async function openChat(app: JobApplicant) {
    if (!session?.user) {
      router.push("/(auth)/sign-in");
      return;
    }
    const otherId = app.applicant_id;
    if (!otherId || session.user.id === otherId || messagingId) return;

    // Recruitment threads must go through the server-authoritative RPC, not
    // the generic personal-conversation upsert — this is a real applicant
    // relationship, but the candidate is also possibly a buyer/seller/
    // business owner elsewhere, and this thread must carry recruitment
    // context (job/application), not land as an indistinguishable personal
    // chat. See get_or_create_recruitment_conversation.
    setMessagingId(app.id);
    const { data, error } = await supabase.rpc("get_or_create_recruitment_conversation", {
      p_candidate_id: otherId,
      p_job_id: app.job_id,
    });
    setMessagingId(null);
    const result = data as { ok?: boolean; conversation_id?: string; code?: string } | null;
    if (error || !result?.ok || !result.conversation_id) {
      toast("Could not open chat — please try again", 3500, true);
      return;
    }
    router.push({
      pathname: "/chat/[id]",
      params: { id: result.conversation_id, name: app.applicant_name || "", avatar: profiles[otherId]?.avatar ?? "" },
    });
  }

  // CVs are never fetched via the profiles table — get-cv-url verifies this
  // employer actually has a real application from this candidate for this
  // exact job before it will sign anything, then returns a short-lived URL.
  async function viewApplicantCv(app: JobApplicant) {
    if (cvOpeningId) return;
    setCvOpeningId(app.id);
    try {
      const result = await getCvSignedUrl({ candidateId: app.applicant_id, jobId: app.job_id });
      if (!result.ok) {
        if (result.reason === "no_cv") toast("No CV uploaded.");
        else if (result.reason === "forbidden") toast("You're not authorized to view this CV.", 3500, true);
        else toast("Could not open this CV. Please try again.", 3500, true);
        return;
      }
      const opened = await openCvUrl(result.url);
      if (!opened) toast("Could not open this CV. Please try again.", 3500, true);
    } finally {
      setCvOpeningId(null);
    }
  }

  if (isLoading) {
    return (
      <View style={{ flex: 1 }}>
        {Platform.OS !== "ios" ? (
          <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
            <GlassBackButton onPress={() => router.back()} tone="light" flat />
          </View>
        ) : null}
        <View style={styles.centered}>
          <ActivityIndicator color={color.brand} />
        </View>
      </View>
    );
  }

  if (notAllowed) {
    return (
      <View style={styles.container}>
        {Platform.OS !== "ios" ? (
          <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
            <GlassBackButton onPress={() => router.back()} tone="light" flat />
            <Text style={styles.headerTitle}>Applicants</Text>
            <View style={{ width: 20 }} />
          </View>
        ) : null}
        <View style={styles.centered}>
          <EmptyState title="Applicants unavailable" subtitle="Only the employer who posted this job can review applications." />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {Platform.OS !== "ios" ? (
        <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
          <GlassBackButton onPress={() => router.back()} tone="light" flat />
          <Text style={styles.headerTitle}>Applicants</Text>
          <View style={{ width: 20 }} />
        </View>
      ) : null}

      <FlatList
        data={apps}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + space.huge }]}
        ItemSeparatorComponent={() => <View style={{ height: space.md }} />}
        ListHeaderComponent={
          <View>
            <Card style={styles.summaryCard}>
              <Text style={styles.jobLabel}>HIRING FOR</Text>
              <Text style={styles.jobTitle}>{job?.title || "Job"}</Text>
              <View style={styles.statsRow}>
                <Stat label="Total" value={counts.total} styles={styles} />
                <Stat label="Pending" value={counts.pending} styles={styles} />
                <Stat label="Shortlisted" value={counts.shortlisted} styles={styles} />
              </View>
            </Card>
            {apps.length ? <Text style={styles.countText}>{apps.length} candidate{apps.length === 1 ? "" : "s"} applied</Text> : null}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <EmptyState
              title="No applicants yet"
              subtitle="When candidates apply, you’ll see their contact details, cover message and CV profile here."
              buttonLabel="View job"
              onPressButton={() => jobId && router.push({ pathname: "/jobs/[id]", params: { id: jobId } })}
            />
          </View>
        }
        renderItem={({ item }) => {
          const profile = profiles[item.applicant_id];
          const displayName = item.applicant_name || profile?.name || "Applicant";
          const displayTitle = profile?.job_title || "Candidate";
          const meta = STATUS_META[item.status] || STATUS_META.pending;
          const answers = normalizeAnswers(item.answers);
          const isBusy = busyId === item.id;

          return (
            <Card style={styles.appCard}>
              <View style={styles.appHead}>
                <Avatar uri={profile?.avatar ?? null} name={displayName} size={54} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={styles.nameRow}>
                    <Text style={styles.appName} numberOfLines={1}>{displayName}</Text>
                    {profile?.verified ? <VerifiedBadge compact /> : null}
                  </View>
                  <Text style={styles.appTitle} numberOfLines={1}>{displayTitle}</Text>
                  <Text style={styles.appMeta}>Applied {timeAgo(item.applied_at)}</Text>
                </View>
                <Badge label={meta.label.toUpperCase()} tone={meta.tone} />
              </View>

              {item.message ? (
                <View style={styles.messageBox}>
                  <Text style={styles.messageLabel}>Cover message</Text>
                  <Text style={styles.messageText}>{item.message}</Text>
                </View>
              ) : null}

              {answers.length ? (
                <View style={styles.answersBox}>
                  <Text style={styles.messageLabel}>Screening answers</Text>
                  {answers.map((answer, index) => (
                    <View key={`${item.id}-${index}`} style={styles.answerRow}>
                      <Text style={styles.answerQuestion}>{answer.question}</Text>
                      <Text style={styles.answerText}>{answer.answer}</Text>
                    </View>
                  ))}
                </View>
              ) : null}

              <View style={styles.contactRow}>
                {item.applicant_phone ? (
                  <Pressable style={styles.contactPill} onPress={() => openPhone(item.applicant_phone)}>
                    <PhoneIcon c={themeColor.brand} />
                    <Text style={styles.contactText} numberOfLines={1}>{item.applicant_phone}</Text>
                  </Pressable>
                ) : null}
                {item.applicant_email ? (
                  <Pressable style={styles.contactPill} onPress={() => openExternalUrl(`mailto:${item.applicant_email}`, "No mail app is set up on this device.")}>
                    <MailIcon c={themeColor.brand} />
                    <Text style={styles.contactText} numberOfLines={1}>{item.applicant_email}</Text>
                  </Pressable>
                ) : null}
              </View>

              <View style={styles.actionGrid}>
                <Button
                  label="Profile"
                  variant="secondary"
                  size="sm"
                  onPress={() => router.push({ pathname: "/jobs/candidate/[id]", params: { id: item.applicant_id } })}
                />
                <Button
                  label={messagingId === item.id ? "Opening…" : "Message"}
                  variant="secondary"
                  size="sm"
                  loading={messagingId === item.id}
                  disabled={messagingId === item.id}
                  onPress={() => openChat(item)}
                />
                <Button
                  label="View CV"
                  variant="secondary"
                  size="sm"
                  loading={cvOpeningId === item.id}
                  onPress={() => viewApplicantCv(item)}
                />
                <Button
                  label="Shortlist"
                  variant={item.status === "shortlisted" ? "primary" : "secondary"}
                  size="sm"
                  loading={isBusy}
                  disabled={item.status === "shortlisted"}
                  onPress={() => updateStatus(item, "shortlisted")}
                />
                <Button
                  label="Decline"
                  variant={item.status === "declined" ? "danger" : "secondary"}
                  size="sm"
                  loading={isBusy}
                  disabled={item.status === "declined"}
                  onPress={() => updateStatus(item, "declined")}
                />
              </View>
            </Card>
          );
        }}
      />
    </View>
  );
}

type Styles = ReturnType<typeof buildStyles>;

function Stat({ label, value, styles }: { label: string; value: number; styles: Styles }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function buildStyles(color: ColorPalette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: color.bg },
    centered: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: color.bg, padding: space.lg },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: color.brand,
      paddingHorizontal: space.lg,
      paddingBottom: space.md,
    },
    headerTitle: { ...font.title, color: color.textOnBrand },
    listContent: { padding: space.lg },
    summaryCard: { marginBottom: space.lg, backgroundColor: color.brandTint },
    jobLabel: { ...font.micro, color: color.brand, letterSpacing: 0.8 },
    jobTitle: { ...font.h3, color: color.text, marginTop: space.xs },
    statsRow: { flexDirection: "row", gap: space.md, marginTop: space.lg },
    stat: {
      flex: 1,
      borderRadius: radius.md,
      backgroundColor: color.surface,
      borderWidth: 1,
      borderColor: color.border,
      padding: space.md,
      alignItems: "center",
    },
    statValue: { ...font.h3, color: color.brand },
    statLabel: { ...font.caption, color: color.textMuted, marginTop: 2 },
    countText: { ...font.caption, color: color.textMuted, marginBottom: space.md },
    emptyWrap: { paddingTop: space.xxl },
    appCard: { gap: space.md, ...shadow.sm },
    appHead: { flexDirection: "row", alignItems: "flex-start", gap: space.md },
    nameRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
    appName: { ...font.title, color: color.text, flexShrink: 1 },
    appTitle: { ...font.sub, color: color.textSub, marginTop: 2 },
    appMeta: { ...font.caption, color: color.textMuted, marginTop: 2 },
    messageBox: {
      backgroundColor: color.surfaceAlt,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: color.border,
      padding: space.md,
    },
    messageLabel: { ...font.caption, color: color.textMuted, marginBottom: space.xs, textTransform: "uppercase" },
    messageText: { ...font.body, color: color.textSub, lineHeight: 21 },
    answersBox: { gap: space.sm },
    answerRow: {
      backgroundColor: color.surfaceAlt,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: color.border,
      padding: space.md,
    },
    answerQuestion: { ...font.caption, color: color.text, fontWeight: "700" },
    answerText: { ...font.sub, color: color.textSub, marginTop: space.xs, lineHeight: 19 },
    contactRow: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
    contactPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: space.xs,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: color.border,
      backgroundColor: color.surfaceAlt,
      paddingHorizontal: space.md,
      paddingVertical: space.sm,
      maxWidth: "100%",
    },
    contactText: { ...font.caption, color: color.brand, flexShrink: 1 },
    actionGrid: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  });
}
