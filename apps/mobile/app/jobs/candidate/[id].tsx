import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path, Polyline } from "react-native-svg";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../../lib/auth";
import { color, font, radius, shadow, space, type ColorPalette } from "../../../lib/theme";
import { useThemedStyles } from "../../../lib/theme-provider";
import {
  EXP_LEVEL_LABEL,
  candidateSkillsList,
  type CandidateProfileRow,
  type ContactRequest,
} from "../../../lib/jobs";
import { toast } from "../../../components/ui/Toast";
import { Avatar, Badge, Button, Card, EmptyState, VerifiedBadge } from "../../../components/ui";

function BackIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={color.textOnBrand} strokeWidth={2.4}>
      <Polyline points="15 18 9 12 15 6" />
    </Svg>
  );
}

function LockIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={color.brand} strokeWidth={2}>
      <Path d="M5 11h14v10H5z" />
      <Path d="M8 11V7a4 4 0 018 0v4" />
    </Svg>
  );
}

// Mirrors www/js/jobs.js H.pages.ViewCandidateCV — full candidate CV, with
// name + contact hidden until an approved public.contact_requests row
// exists for (requester=me, candidate=this user). See
// supabase/migrations/add_contact_requests.sql: an admin approves/declines,
// no money is stored or shown — payment is handled off-platform.
export default function CandidateCvScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const insets = useSafeAreaInsets();
  const styles = useThemedStyles(buildStyles);

  const [candidate, setCandidate] = useState<CandidateProfileRow | null>(null);
  const [request, setRequest] = useState<ContactRequest | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRequesting, setIsRequesting] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const { data: candidateData } = await supabase
      .from("profiles")
      .select("id,name,avatar,verified,job_title,skills,sector,exp,city,open_to_work,cv")
      .eq("id", id)
      .maybeSingle();
    setCandidate((candidateData as unknown as CandidateProfileRow) ?? null);

    if (session?.user) {
      const { data: reqData } = await supabase
        .from("contact_requests")
        .select("id,requester_id,candidate_id,requester_name,candidate_name,company,role,note,status,created_at,decided_at")
        .eq("requester_id", session.user.id)
        .eq("candidate_id", id)
        .maybeSingle();
      setRequest((reqData as ContactRequest) ?? null);
    }
  }, [id, session]);

  useEffect(() => {
    setIsLoading(true);
    load().finally(() => setIsLoading(false));
  }, [load]);

  async function requestContact() {
    if (!session?.user || !candidate) return;
    setIsRequesting(true);
    const { data: myProfile } = await supabase.from("profiles").select("name,company").eq("id", session.user.id).maybeSingle();
    const { data, error } = await supabase
      .from("contact_requests")
      .upsert(
        {
          requester_id: session.user.id,
          candidate_id: candidate.id,
          requester_name: (myProfile as any)?.name || "",
          candidate_name: candidate.name || "",
          company: (myProfile as any)?.company || "",
          status: "pending",
        },
        { onConflict: "requester_id,candidate_id" }
      )
      .select("id,requester_id,candidate_id,requester_name,candidate_name,company,role,note,status,created_at,decided_at")
      .single();
    setIsRequesting(false);
    if (error || !data) {
      toast("Could not send request — please try again");
      return;
    }
    setRequest(data as ContactRequest);
    toast("Request sent — we'll notify you once approved.");
  }

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={color.brand} />
      </View>
    );
  }

  if (!candidate) {
    return (
      <View style={styles.centered}>
        <EmptyState
          title="Profile unavailable"
          subtitle="This candidate may have hidden their CV or closed their account."
        />
      </View>
    );
  }

  const isMine = session?.user?.id === candidate.id;
  const unlocked = request?.status === "approved";
  const pending = request?.status === "pending";
  const declined = request?.status === "declined";
  const reveal = isMine || unlocked;

  const cv = candidate.cv || {};
  const skills = candidateSkillsList(candidate);
  const exp = cv.experience || [];
  const edu = cv.education || [];
  const certs = cv.certifications || [];
  const langs = cv.languages || [];
  const portfolio = cv.portfolio || [];
  const headline = cv.headline || candidate.job_title || "Professional";
  const location = cv.location || candidate.city || "";
  const expLabel = candidate.exp ? EXP_LEVEL_LABEL[candidate.exp] || candidate.exp : "";
  const expectedSalary = cv.expectedSalary ? `${cv.currency || "USD"} ${cv.expectedSalary}/mo` : "";
  const displayName = reveal ? candidate.name || "Candidate" : "Confidential candidate";

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <BackIcon />
        </Pressable>
        <Text style={styles.headerTitle}>Candidate profile</Text>
        <View style={{ width: 20 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 110 }}>
        {/* ── Hero ────────────────────────────────────────── */}
        <View style={styles.hero}>
          <View style={styles.heroRow}>
            <Avatar uri={reveal ? candidate.avatar : cv.photoUrl || candidate.avatar} name={displayName} size={68} ring />
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={styles.nameRow}>
                <Text style={styles.name} numberOfLines={1}>
                  {displayName}
                </Text>
                {candidate.verified ? <VerifiedBadge compact /> : null}
              </View>
              <Text style={styles.headline} numberOfLines={2}>
                {headline}
              </Text>
              <View style={styles.heroMeta}>
                {location ? <Text style={styles.heroMetaText}>{location}</Text> : null}
                {location && expLabel ? <Text style={styles.heroMetaText}>·</Text> : null}
                {expLabel ? <Text style={styles.heroMetaText}>{expLabel}</Text> : null}
              </View>
            </View>
          </View>

          <View style={styles.heroBadges}>
            {candidate.open_to_work ? <Badge label="OPEN TO WORK" tone="success" /> : null}
            {candidate.sector ? <Badge label={candidate.sector.toUpperCase()} tone="brand" /> : null}
            {cv.availability ? <Badge label={cv.availability.toUpperCase()} tone="gold" /> : null}
          </View>
        </View>

        <View style={styles.body}>
          {/* ── Snapshot ──────────────────────────────────── */}
          {expectedSalary || cv.availability || expLabel ? (
            <Card style={styles.card}>
              <View style={styles.statGrid}>
                <Stat label="Experience" value={expLabel || "Not stated"}  styles={styles} />
                <Stat label="Expected pay" value={expectedSalary || "Negotiable"}  styles={styles} />
                <Stat label="Availability" value={cv.availability || "Not stated"}  styles={styles} />
              </View>
            </Card>
          ) : null}

          {/* ── Contact gate ──────────────────────────────── */}
          {!isMine ? (
            <Card style={[styles.card, unlocked ? styles.unlockedCard : styles.lockCard]}>
              <View style={styles.lockHead}>
                <LockIcon />
                <Text style={styles.lockTitle}>
                  {unlocked ? "Contact details unlocked" : "Contact details protected"}
                </Text>
              </View>
              <Text style={styles.lockText}>
                {unlocked
                  ? "You've been approved for this candidate. Message them directly to arrange an interview."
                  : pending
                    ? "Your request is with our team. The candidate's full name and contact details appear here as soon as it's approved."
                    : declined
                      ? "This request wasn't approved. You can submit a new request if your role has changed."
                      : "We hide a candidate's name and contact details until they've agreed to hear from employers. Request access and our team will unlock this profile for you."}
              </Text>
            </Card>
          ) : null}

          {/* ── Summary ───────────────────────────────────── */}
          {cv.summary ? (
            <Section title="About" styles={styles}>
              <Text style={styles.bodyText}>{cv.summary}</Text>
            </Section>
          ) : null}

          {/* ── Experience ────────────────────────────────── */}
          {exp.length ? (
            <Section title="Work experience" styles={styles}>
              {exp.map((e, i) => (
                <View key={i} style={[styles.timelineRow, i === exp.length - 1 && styles.timelineLast]}>
                  <View style={styles.timelineMark}>
                    <View style={styles.timelineDot} />
                    {i < exp.length - 1 ? <View style={styles.timelineLine} /> : null}
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={styles.entryTopRow}>
                      <Text style={styles.entryTitle}>{e.title || "Role"}</Text>
                      {e.current ? <Badge label="CURRENT" tone="success" /> : null}
                    </View>
                    {e.company ? <Text style={styles.entryOrg}>{e.company}</Text> : null}
                    {e.duration ? <Text style={styles.entryMeta}>{e.duration}</Text> : null}
                    {e.desc ? <Text style={styles.entryDesc}>{e.desc}</Text> : null}
                  </View>
                </View>
              ))}
            </Section>
          ) : null}

          {/* ── Education ─────────────────────────────────── */}
          {edu.length ? (
            <Section title="Education" styles={styles}>
              {edu.map((e, i) => (
                <View key={i} style={[styles.plainRow, i === edu.length - 1 && styles.plainRowLast]}>
                  <Text style={styles.entryTitle}>{e.degree || "Qualification"}</Text>
                  {e.school ? <Text style={styles.entryOrg}>{e.school}</Text> : null}
                  {e.year ? <Text style={styles.entryMeta}>{e.year}</Text> : null}
                </View>
              ))}
            </Section>
          ) : null}

          {/* ── Skills ────────────────────────────────────── */}
          {skills.length ? (
            <Section title="Skills" styles={styles}>
              <View style={styles.pillWrap}>
                {skills.map((s) => (
                  <View key={s} style={styles.skillPill}>
                    <Text style={styles.skillPillText}>{s}</Text>
                  </View>
                ))}
              </View>
            </Section>
          ) : null}

          {/* ── Languages ─────────────────────────────────── */}
          {langs.length ? (
            <Section title="Languages" styles={styles}>
              {langs.map((l, i) => (
                <View key={i} style={styles.langRow}>
                  <Text style={styles.langName}>{l.language}</Text>
                  {l.proficiency ? <Text style={styles.langLevel}>{l.proficiency}</Text> : null}
                </View>
              ))}
            </Section>
          ) : null}

          {/* ── Certifications ────────────────────────────── */}
          {certs.length ? (
            <Section title="Certifications" styles={styles}>
              {certs.map((c, i) => (
                <View key={i} style={[styles.plainRow, i === certs.length - 1 && styles.plainRowLast]}>
                  <Text style={styles.entryTitle}>{c.name}</Text>
                  {c.issuer ? <Text style={styles.entryOrg}>{c.issuer}</Text> : null}
                  {c.year ? <Text style={styles.entryMeta}>{c.year}</Text> : null}
                </View>
              ))}
            </Section>
          ) : null}

          {/* ── Portfolio ─────────────────────────────────── */}
          {portfolio.length ? (
            <Section title="Portfolio & links" styles={styles}>
              {portfolio.map((p, i) =>
                p.url ? (
                  <Pressable key={i} style={styles.linkRow} onPress={() => Linking.openURL(p.url as string)}>
                    <Text style={styles.linkLabel}>{p.label || "Link"}</Text>
                    <Text style={styles.linkUrl} numberOfLines={1}>
                      {p.url}
                    </Text>
                  </Pressable>
                ) : null
              )}
            </Section>
          ) : null}

          {!cv.summary && !exp.length && !edu.length && !skills.length ? (
            <Card style={styles.card}>
              <Text style={styles.bodyText}>
                This candidate hasn&apos;t completed their CV yet. Only their headline and location are available.
              </Text>
            </Card>
          ) : null}
        </View>
      </ScrollView>

      <View style={[styles.ctaBar, { paddingBottom: insets.bottom + space.md }]}>
        {isMine ? (
          <Button label="Edit my CV" onPress={() => router.push("/jobs/cv-profile")} />
        ) : reveal ? (
          <Button
            label="Message candidate"
            variant="gold"
            size="lg"
            onPress={() => router.push({ pathname: "/chat/[id]", params: { id: candidate.id } })}
          />
        ) : pending ? (
          <Button label="Request under review" variant="secondary" disabled onPress={() => {}} />
        ) : (
          <Button
            label={isRequesting ? "Sending…" : declined ? "Request access again" : "Request contact details"}
            size="lg"
            loading={isRequesting}
            onPress={requestContact}
          />
        )}
      </View>
    </View>
  );
}

type Styles = ReturnType<typeof buildStyles>;

function Section({ title, children, styles }: { title: string; children: React.ReactNode; styles: Styles }) {
  return (
    <Card style={styles.card}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </Card>
  );
}

function Stat({ label, value, styles }: { label: string; value: string; styles: Styles }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label.toUpperCase()}</Text>
      <Text style={styles.statValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

function buildStyles(color: ColorPalette) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: color.bg },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: color.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: color.brand,
    paddingHorizontal: space.lg,
    paddingBottom: space.md,
  },
  headerTitle: { ...font.title, color: color.textOnBrand },

  hero: { backgroundColor: color.brand, paddingHorizontal: space.lg, paddingBottom: space.xl, gap: space.lg },
  heroRow: { flexDirection: "row", gap: space.lg, alignItems: "center" },
  nameRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  name: { ...font.h2, color: color.textOnBrand, flexShrink: 1 },
  headline: { ...font.body, color: color.textOnBrandSub, marginTop: space.xxs },
  heroMeta: { flexDirection: "row", alignItems: "center", gap: space.xs, marginTop: space.sm, flexWrap: "wrap" },
  heroMetaText: { ...font.caption, color: color.textOnBrandSub },
  heroBadges: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },

  body: { padding: space.lg, gap: space.lg },
  card: {},
  lockCard: { backgroundColor: color.brandTint },
  unlockedCard: { backgroundColor: color.successTint },
  lockHead: { flexDirection: "row", alignItems: "center", gap: space.sm, marginBottom: space.sm },
  lockTitle: { ...font.bodyStrong, color: color.text },
  lockText: { ...font.sub, color: color.textSub, lineHeight: 19 },

  statGrid: { flexDirection: "row", gap: space.md },
  stat: { flex: 1, gap: space.xxs },
  statLabel: { ...font.micro, color: color.textMuted },
  statValue: { ...font.sub, color: color.text, fontWeight: "700" },

  sectionTitle: { ...font.h3, color: color.text, marginBottom: space.lg },
  bodyText: { ...font.body, color: color.textSub, lineHeight: 22 },

  timelineRow: { flexDirection: "row", gap: space.md, paddingBottom: space.lg },
  timelineLast: { paddingBottom: 0 },
  timelineMark: { width: 12, alignItems: "center" },
  timelineDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: color.brand, marginTop: 5 },
  timelineLine: { flex: 1, width: 2, backgroundColor: color.border, marginTop: space.xs },

  plainRow: { paddingBottom: space.lg, marginBottom: space.lg, borderBottomWidth: 1, borderBottomColor: color.divider },
  plainRowLast: { paddingBottom: 0, marginBottom: 0, borderBottomWidth: 0 },
  entryTopRow: { flexDirection: "row", alignItems: "center", gap: space.sm, flexWrap: "wrap" },
  entryTitle: { ...font.title, color: color.text },
  entryOrg: { ...font.sub, color: color.brand, marginTop: space.xxs, fontWeight: "700" },
  entryMeta: { ...font.caption, color: color.textMuted, marginTop: space.xxs },
  entryDesc: { ...font.sub, color: color.textSub, marginTop: space.sm, lineHeight: 19 },

  pillWrap: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  skillPill: {
    backgroundColor: color.brandTint,
    borderRadius: radius.sm,
    paddingHorizontal: space.md,
    paddingVertical: 6,
  },
  skillPillText: { ...font.caption, color: color.brand },

  langRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: space.sm,
  },
  langName: { ...font.body, color: color.text },
  langLevel: { ...font.caption, color: color.textMuted },

  linkRow: { paddingVertical: space.sm },
  linkLabel: { ...font.bodyStrong, color: color.text },
  linkUrl: { ...font.sub, color: color.brand, marginTop: 2 },

  ctaBar: {
    padding: space.lg,
    borderTopWidth: 1,
    borderTopColor: color.border,
    backgroundColor: color.surface,
    ...shadow.md,
  },
  });
}
