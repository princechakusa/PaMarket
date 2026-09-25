import { useCallback, useEffect, useMemo, useState } from "react";
import { openExternalUrl, openPhone } from "../../../lib/open-url";
import { getCvSignedUrl, openCvUrl } from "../../../lib/cv";
import { ActivityIndicator, Alert, FlatList, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../../lib/auth";
import { color, font, radius, shadow, space, type ColorPalette } from "../../../lib/theme";
import { useThemedStyles } from "../../../lib/theme-provider";
import { Avatar, Badge, Button, Card, Chip, EmptyState, SelectField, toast, VerifiedBadge } from "../../../components/ui";
import { useIOSNativeHeader } from "../../../lib/useIOSNativeHeader";
import {
  addApplicationNote,
  APPLICATION_STATUS_LABEL,
  APPLICATION_TERMINAL_STATUSES,
  cancelInterview,
  closeJobListing,
  declineRemainingApplicants,
  formatInterviewTime,
  INTERVIEW_MODE_LABEL,
  scheduleInterview,
  type ApplicationStatus,
  type InterviewMode,
} from "../../../lib/jobs";

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
  interview_at?: string | null;
  interview_mode?: InterviewMode | null;
  interview_location?: string | null;
  interview_link?: string | null;
  interview_notes?: string | null;
  interview_status?: "scheduled" | "rescheduled" | "cancelled" | null;
};

type PipelineFilter = "all" | ApplicationStatus;

const PIPELINE_TABS: Array<[PipelineFilter, string]> = [
  ["all", "All"],
  ["pending", "New"],
  ["reviewing", "Under Review"],
  ["shortlisted", "Shortlisted"],
  ["interview", "Interview"],
  ["offered", "Offer"],
  ["hired", "Hired"],
  ["declined", "Not Selected"],
];

// Interview slots: next 30 days, 07:00 to 19:30 in 30-minute steps. Plain
// dropdowns keep this dependency-free (no native date picker module).
function interviewDateOptions(): Array<{ label: string; date: Date }> {
  const out: Array<{ label: string; date: Date }> = [];
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  for (let i = 0; i < 30; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    const label =
      (i === 0 ? "Today, " : i === 1 ? "Tomorrow, " : "") +
      d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
    out.push({ label, date: d });
  }
  return out;
}

const INTERVIEW_TIMES: string[] = Array.from({ length: 26 }, (_, i) => {
  const minutes = 7 * 60 + i * 30;
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
});

const MODE_OPTIONS: Array<[InterviewMode, string]> = [
  ["video", INTERVIEW_MODE_LABEL.video],
  ["in_person", INTERVIEW_MODE_LABEL.in_person],
  ["phone", INTERVIEW_MODE_LABEL.phone],
];

type InterviewDraft = { dateLabel: string; time: string; mode: InterviewMode; location: string; link: string; notes: string };

function confirmAction(title: string, body: string, confirmLabel: string, onConfirm: () => void, destructive = false) {
  if (Platform.OS === "web") {
    if (typeof window !== "undefined" && window.confirm(`${title}\n\n${body}`)) onConfirm();
    return;
  }
  Alert.alert(title, body, [
    { text: "Cancel", style: "cancel" },
    { text: confirmLabel, style: destructive ? "destructive" : "default", onPress: onConfirm },
  ]);
}

type ApplicantProfile = {
  id: string;
  name: string | null;
  avatar: string | null;
  verified: boolean | null;
  job_title: string | null;
};

type BadgeTone = "brand" | "gold" | "success" | "warning" | "danger" | "info" | "neutral";

const STATUS_META: Record<ApplicationStatus, { label: string; tone: BadgeTone }> = {
  pending: { label: APPLICATION_STATUS_LABEL.pending, tone: "gold" },
  reviewing: { label: APPLICATION_STATUS_LABEL.reviewing, tone: "info" },
  shortlisted: { label: APPLICATION_STATUS_LABEL.shortlisted, tone: "brand" },
  interview: { label: APPLICATION_STATUS_LABEL.interview, tone: "warning" },
  offered: { label: APPLICATION_STATUS_LABEL.offered, tone: "success" },
  hired: { label: APPLICATION_STATUS_LABEL.hired, tone: "success" },
  declined: { label: APPLICATION_STATUS_LABEL.declined, tone: "danger" },
  withdrawn: { label: APPLICATION_STATUS_LABEL.withdrawn, tone: "neutral" },
};

// Mirrors the exact forward path the validate_application_status_transition
// trigger allows for an employer — one legal "advance" per stage, so the UI
// never offers a move the database would reject.
const ADVANCE_STATUS: Partial<Record<ApplicationStatus, ApplicationStatus>> = {
  pending: "reviewing",
  reviewing: "shortlisted",
  shortlisted: "interview",
  interview: "offered",
  offered: "hired",
};
const ADVANCE_LABEL: Partial<Record<ApplicationStatus, string>> = {
  pending: "Move to review",
  reviewing: "Shortlist",
  shortlisted: "Schedule interview",
  interview: "Extend offer",
  offered: "Mark hired",
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
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [noteBusyId, setNoteBusyId] = useState<string | null>(null);
  const [closingJob, setClosingJob] = useState(false);
  const [filter, setFilter] = useState<PipelineFilter>("all");
  const [scheduleForId, setScheduleForId] = useState<string | null>(null);
  const [draft, setDraft] = useState<InterviewDraft | null>(null);
  const [scheduling, setScheduling] = useState(false);
  const dateOptions = useMemo(() => interviewDateOptions(), [scheduleForId]);

  useIOSNativeHeader({ backgroundColor: color.brand, tintColor: color.textOnBrand, title: "Applicants", androidNative: true });

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
      .select("id,job_id,job_title,company,applicant_id,applicant_name,applicant_phone,applicant_email,message,status,employer_id,applied_at,answers,interview_at,interview_mode,interview_location,interview_link,interview_notes,interview_status")
      .eq("job_id", jobId)
      .eq("employer_id", session.user.id)
      .order("applied_at", { ascending: false })
      .limit(500);

    let nextApps = ((applicationRows as JobApplicant[]) ?? []).filter((row) => row.employer_id === session.user.id);
    // Opening the list counts as viewing: new applications move to Under
    // Review, and the candidate gets an "Application viewed" notification.
    const unseen = nextApps.filter((row) => row.status === "pending").map((row) => row.id);
    if (unseen.length) {
      const { error: viewErr } = await supabase
        .from("applications")
        .update({ status: "reviewing" })
        .in("id", unseen)
        .eq("status", "pending");
      if (!viewErr) {
        nextApps = nextApps.map((row) => (unseen.includes(row.id) ? { ...row, status: "reviewing" as ApplicationStatus } : row));
      }
    }
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

  const counts = useMemo(() => {
    const byStatus: Record<string, number> = { all: apps.length };
    apps.forEach((app) => {
      byStatus[app.status] = (byStatus[app.status] || 0) + 1;
    });
    return byStatus;
  }, [apps]);

  const visibleApps = useMemo(
    () => (filter === "all" ? apps : apps.filter((app) => app.status === filter)),
    [apps, filter]
  );

  function openScheduler(app: JobApplicant) {
    const existing = app.interview_at ? new Date(app.interview_at) : null;
    const opts = interviewDateOptions();
    const dateLabel =
      (existing && opts.find((o) => o.date.toDateString() === existing.toDateString())?.label) || opts[1].label;
    const time = existing
      ? `${String(existing.getHours()).padStart(2, "0")}:${String(existing.getMinutes() >= 30 ? 30 : 0).padStart(2, "0")}`
      : "10:00";
    setDraft({
      dateLabel,
      time: INTERVIEW_TIMES.includes(time) ? time : "10:00",
      mode: app.interview_mode ?? "video",
      location: app.interview_location ?? "",
      link: app.interview_link ?? "",
      notes: app.interview_status === "cancelled" ? "" : app.interview_notes ?? "",
    });
    setScheduleForId(app.id);
  }

  async function submitInterview(app: JobApplicant) {
    if (!draft || scheduling) return;
    const day = dateOptions.find((o) => o.label === draft.dateLabel);
    if (!day) {
      toast("Choose an interview date", 3500, true);
      return;
    }
    const [h, m] = draft.time.split(":").map((n) => parseInt(n, 10));
    const at = new Date(day.date);
    at.setHours(h, m, 0, 0);
    if (at.getTime() <= Date.now()) {
      toast("Pick a time later than now", 3500, true);
      return;
    }
    if (draft.mode === "in_person" && !draft.location.trim()) {
      toast("Add the interview address", 3500, true);
      return;
    }
    if (draft.mode === "video" && draft.link.trim() && !/^https?:\/\/\S+$/i.test(draft.link.trim())) {
      toast("The meeting link must start with https://", 3500, true);
      return;
    }
    setScheduling(true);
    const result = await scheduleInterview(app.id, {
      at,
      mode: draft.mode,
      location: draft.mode === "in_person" ? draft.location.trim() : undefined,
      link: draft.mode === "video" ? draft.link.trim() : undefined,
      notes: draft.notes.trim(),
    });
    setScheduling(false);
    if (!result.ok) {
      toast(result.error || "Could not schedule the interview", 3500, true);
      return;
    }
    toast(app.interview_at ? "Interview rescheduled. The candidate has been notified." : "Interview scheduled. The candidate has been notified.");
    setScheduleForId(null);
    setDraft(null);
    load();
  }

  function askCancelInterview(app: JobApplicant) {
    confirmAction(
      "Cancel this interview?",
      `${app.applicant_name || "The candidate"} will be notified. You can reschedule later.`,
      "Cancel interview",
      async () => {
        const result = await cancelInterview(app.id);
        if (!result.ok) {
          toast(result.error || "Could not cancel the interview", 3500, true);
          return;
        }
        toast("Interview cancelled. The candidate has been notified.");
        load();
      },
      true
    );
  }

  function askDecline(app: JobApplicant) {
    confirmAction(
      "Decline this candidate?",
      `${app.applicant_name || "The candidate"} will be told you are not moving forward. This can't be undone.`,
      "Decline",
      () => updateStatus(app, "declined"),
      true
    );
  }

  async function afterHire(app: JobApplicant) {
    const others = apps.filter(
      (row) => row.id !== app.id && !APPLICATION_TERMINAL_STATUSES.includes(row.status)
    ).length;
    confirmAction(
      "Close this job as filled?",
      others
        ? `${app.applicant_name || "The candidate"} is hired. Close the job and notify the other ${others} candidate${others === 1 ? "" : "s"} that the position is filled?`
        : `${app.applicant_name || "The candidate"} is hired. Close the job so it stops receiving applications?`,
      "Close job",
      async () => {
        if (!job) return;
        setClosingJob(true);
        if (others) {
          const declined = await declineRemainingApplicants(job.id);
          if (!declined.ok) {
            setClosingJob(false);
            toast(declined.error || "Could not update the other candidates", 3500, true);
            return;
          }
        }
        const closed = await closeJobListing(job.id, "filled");
        if (!closed.ok) {
          setClosingJob(false);
          toast(closed.error || "Could not close the job", 3500, true);
          load();
          return;
        }
        // No setClosingJob(false) here: router.back() unmounts this screen,
        // and a state update in the same tick crashes Fabric on Android.
        toast("Position filled. The job is closed.");
        router.back();
      }
    );
  }

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
    toast(`${app.applicant_name || "Candidate"} moved to ${APPLICATION_STATUS_LABEL[status]}`);
    if (status === "hired") afterHire({ ...app, status });
  }

  async function submitNote(app: JobApplicant) {
    const note = (noteDrafts[app.id] || "").trim();
    if (!note || noteBusyId) return;
    setNoteBusyId(app.id);
    const result = await addApplicationNote(app.id, note);
    setNoteBusyId(null);
    if (result.ok) {
      setNoteDrafts((d) => ({ ...d, [app.id]: "" }));
      toast("Note saved");
    } else {
      toast(result.error || "Could not save note", 3500, true);
    }
  }

  function handleCloseJob() {
    if (!job || closingJob) return;
    Alert.alert("Close this job?", "Choose how to close hiring for this listing.", [
      { text: "Cancel", style: "cancel" },
      { text: "Mark as filled", onPress: () => runCloseJob("filled") },
      { text: "Pause listing", onPress: () => runCloseJob("paused") },
      { text: "Remove listing", style: "destructive", onPress: () => runCloseJob("removed") },
    ]);
  }

  async function runCloseJob(reason: "filled" | "paused" | "removed") {
    if (!job) return;
    setClosingJob(true);
    const result = await closeJobListing(job.id, reason);
    if (result.ok) {
      // No setClosingJob(false): router.back() unmounts this screen, and a
      // state update in the same tick crashes Fabric on Android.
      toast(reason === "filled" ? "Job marked as filled" : reason === "paused" ? "Job paused" : "Job removed");
      router.back();
    } else {
      setClosingJob(false);
      toast(result.error || "Could not update the job", 3500, true);
    }
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
      toast("Could not open chat, please try again", 3500, true);
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
        <View style={styles.centered}>
          <ActivityIndicator color={color.brand} />
        </View>
      </View>
    );
  }

  if (notAllowed) {
    return (
      <View style={styles.container}>
        <View style={styles.centered}>
          <EmptyState title="Applicants unavailable" subtitle="Only the employer who posted this job can review applications." />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={visibleApps}
        keyExtractor={(item) => item.id}
        extraData={[scheduleForId, draft, scheduling, busyId, noteDrafts, messagingId, cvOpeningId]}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + space.huge }]}
        ItemSeparatorComponent={() => <View style={{ height: space.md }} />}
        ListHeaderComponent={
          <View>
            <Card style={styles.summaryCard}>
              <Text style={styles.jobLabel}>HIRING FOR</Text>
              <Text style={styles.jobTitle}>{job?.title || "Job"}</Text>
              <View style={styles.statsRow}>
                <Stat label="Applicants" value={counts.all || 0} styles={styles} />
                <Stat label="New" value={counts.pending || 0} styles={styles} />
                <Stat label="Interview" value={counts.interview || 0} styles={styles} />
                <Stat label="Hired" value={counts.hired || 0} styles={styles} />
              </View>
              <Button
                label={closingJob ? "Closing…" : "Close hiring"}
                variant="secondary"
                size="sm"
                loading={closingJob}
                onPress={handleCloseJob}
                style={{ marginTop: space.md }}
              />
            </Card>
            {apps.length ? (
              <View style={styles.tabsWrap}>
                {PIPELINE_TABS.map(([key, label]) => (
                  <Chip
                    key={key}
                    label={`${label} ${counts[key] || 0}`}
                    active={filter === key}
                    onPress={() => setFilter(key)}
                  />
                ))}
              </View>
            ) : null}
            {apps.length && !visibleApps.length ? (
              <Text style={styles.countText}>No candidates at this stage yet.</Text>
            ) : null}
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
          const isTerminal = APPLICATION_TERMINAL_STATUSES.includes(item.status);
          const nextStatus = ADVANCE_STATUS[item.status];
          const canSchedule = ["pending", "reviewing", "shortlisted", "interview"].includes(item.status);
          const isScheduling = scheduleForId === item.id && !!draft;
          const interviewCancelled = item.interview_status === "cancelled";

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

              {item.interview_at && item.status !== "declined" && item.status !== "withdrawn" ? (
                <View style={[styles.interviewBox, interviewCancelled && styles.interviewBoxCancelled]}>
                  <View style={styles.interviewHead}>
                    <Text style={styles.messageLabel}>
                      {interviewCancelled ? "Interview cancelled" : item.interview_status === "rescheduled" ? "Interview (rescheduled)" : "Interview"}
                    </Text>
                  </View>
                  <Text style={[styles.interviewWhen, interviewCancelled && styles.strike]}>{formatInterviewTime(item.interview_at)}</Text>
                  {item.interview_mode ? (
                    <Text style={styles.interviewMeta}>{INTERVIEW_MODE_LABEL[item.interview_mode]}</Text>
                  ) : null}
                  {item.interview_location ? <Text style={styles.interviewMeta}>{item.interview_location}</Text> : null}
                  {item.interview_link ? (
                    <Pressable onPress={() => openExternalUrl(item.interview_link as string, "Could not open the meeting link.")}>
                      <Text style={styles.interviewLink} numberOfLines={1}>{item.interview_link}</Text>
                    </Pressable>
                  ) : null}
                  {item.interview_notes ? <Text style={styles.interviewNotes}>{item.interview_notes}</Text> : null}
                  {item.status === "interview" && !isScheduling ? (
                    <View style={styles.actionGrid}>
                      <Button label={interviewCancelled ? "Reschedule" : "Reschedule"} variant="secondary" size="sm" onPress={() => openScheduler(item)} />
                      {!interviewCancelled ? (
                        <Button label="Cancel interview" variant="danger" size="sm" onPress={() => askCancelInterview(item)} />
                      ) : null}
                    </View>
                  ) : null}
                </View>
              ) : null}

              {isScheduling && draft ? (
                <View style={styles.scheduleBox}>
                  <Text style={styles.scheduleTitle}>{item.interview_at ? "Reschedule interview" : "Schedule interview"}</Text>
                  <SelectField
                    label="Date"
                    value={draft.dateLabel}
                    placeholder="Choose a date"
                    options={dateOptions.map((o) => o.label)}
                    onSelect={(v) => setDraft((d) => (d ? { ...d, dateLabel: v } : d))}
                  />
                  <SelectField
                    label="Time"
                    value={draft.time}
                    placeholder="Choose a time"
                    options={INTERVIEW_TIMES}
                    onSelect={(v) => setDraft((d) => (d ? { ...d, time: v } : d))}
                  />
                  <SelectField
                    label="Interview type"
                    value={INTERVIEW_MODE_LABEL[draft.mode]}
                    placeholder="Choose a type"
                    options={MODE_OPTIONS.map(([, l]) => l)}
                    onSelect={(v) => setDraft((d) => (d ? { ...d, mode: MODE_OPTIONS.find(([, l]) => l === v)?.[0] ?? d.mode } : d))}
                  />
                  {draft.mode === "in_person" ? (
                    <TextInput
                      style={styles.noteInput}
                      placeholder="Address, e.g. 12 Samora Machel Ave, Harare"
                      placeholderTextColor={themeColor.textMuted}
                      value={draft.location}
                      onChangeText={(t) => setDraft((d) => (d ? { ...d, location: t } : d))}
                    />
                  ) : null}
                  {draft.mode === "video" ? (
                    <TextInput
                      style={styles.noteInput}
                      placeholder="Meeting link (Google Meet, Zoom, Teams), optional"
                      placeholderTextColor={themeColor.textMuted}
                      value={draft.link}
                      autoCapitalize="none"
                      keyboardType="url"
                      onChangeText={(t) => setDraft((d) => (d ? { ...d, link: t } : d))}
                    />
                  ) : null}
                  <TextInput
                    style={[styles.noteInput, { minHeight: 64 }]}
                    placeholder="Instructions for the candidate (what to bring, who to ask for), optional"
                    placeholderTextColor={themeColor.textMuted}
                    value={draft.notes}
                    multiline
                    onChangeText={(t) => setDraft((d) => (d ? { ...d, notes: t } : d))}
                  />
                  <Text style={styles.scheduleHint}>Times use this device's time zone. The candidate is notified straight away.</Text>
                  <View style={styles.actionGrid}>
                    <Button
                      label={scheduling ? "Sending…" : item.interview_at ? "Send new time" : "Send invitation"}
                      variant="primary"
                      size="sm"
                      loading={scheduling}
                      onPress={() => submitInterview(item)}
                    />
                    <Button
                      label="Close"
                      variant="secondary"
                      size="sm"
                      disabled={scheduling}
                      onPress={() => {
                        setScheduleForId(null);
                        setDraft(null);
                      }}
                    />
                  </View>
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
                {nextStatus && nextStatus !== "interview" ? (
                  <Button
                    label={ADVANCE_LABEL[item.status] || "Advance"}
                    variant="primary"
                    size="sm"
                    loading={isBusy}
                    onPress={() =>
                      nextStatus === "hired"
                        ? confirmAction(
                            "Hire this candidate?",
                            `${item.applicant_name || "The candidate"} will be notified that they got the job.`,
                            "Mark hired",
                            () => updateStatus(item, "hired")
                          )
                        : updateStatus(item, nextStatus)
                    }
                  />
                ) : null}
                {canSchedule && !item.interview_at && !isScheduling ? (
                  <Button
                    label="Schedule interview"
                    variant={item.status === "shortlisted" ? "primary" : "secondary"}
                    size="sm"
                    onPress={() => openScheduler(item)}
                  />
                ) : null}
                {!isTerminal ? (
                  <Button
                    label="Decline"
                    variant="danger"
                    size="sm"
                    loading={isBusy}
                    onPress={() => askDecline(item)}
                  />
                ) : null}
              </View>

              <View style={styles.noteBox}>
                <Text style={styles.messageLabel}>Private note (only you can see this)</Text>
                <TextInput
                  style={styles.noteInput}
                  placeholder="Add a note about this candidate…"
                  placeholderTextColor={themeColor.textMuted}
                  value={noteDrafts[item.id] || ""}
                  onChangeText={(text) => setNoteDrafts((d) => ({ ...d, [item.id]: text }))}
                  multiline
                />
                <Button
                  label={noteBusyId === item.id ? "Saving…" : "Save note"}
                  variant="secondary"
                  size="sm"
                  loading={noteBusyId === item.id}
                  disabled={!(noteDrafts[item.id] || "").trim()}
                  onPress={() => submitNote(item)}
                  style={{ alignSelf: "flex-start" }}
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
    tabsWrap: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginBottom: space.md },
    interviewBox: {
      backgroundColor: color.brandTint,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: color.brand,
      padding: space.md,
      gap: 4,
    },
    interviewBoxCancelled: { backgroundColor: color.surfaceAlt, borderColor: color.border },
    interviewHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    interviewWhen: { ...font.bodyStrong, color: color.text },
    strike: { textDecorationLine: "line-through", color: color.textMuted },
    interviewMeta: { ...font.sub, color: color.textSub },
    interviewLink: { ...font.sub, color: color.brand, fontWeight: "700" },
    interviewNotes: { ...font.caption, color: color.textSub, marginTop: 4, marginBottom: 4 },
    scheduleBox: {
      backgroundColor: color.surfaceAlt,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: color.brand,
      padding: space.md,
      gap: space.sm,
    },
    scheduleTitle: { ...font.bodyStrong, color: color.text },
    scheduleHint: { ...font.caption, color: color.textMuted },
    noteBox: {
      backgroundColor: color.surfaceAlt,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: color.border,
      padding: space.md,
      gap: space.sm,
    },
    noteInput: {
      ...font.sub,
      color: color.text,
      minHeight: 44,
      textAlignVertical: "top",
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: color.border,
      backgroundColor: color.surface,
      padding: space.sm,
    },
  });
}
