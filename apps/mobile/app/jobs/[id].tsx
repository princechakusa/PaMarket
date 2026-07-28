import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import { color, font, radius, shadow, space, type ColorPalette } from "../../lib/theme";
import { useThemedStyles } from "../../lib/theme-provider";
import { businessInitials } from "../../lib/businesses";
import { jobCompany, jobSalary, jobType, parseJobField } from "../../lib/jobs";
import { isListingSaved, toggleSave } from "../../lib/saves";
import { toast } from "../../components/ui/Toast";
import { Badge, Button, Card, EmptyState, GlassBackButton } from "../../components/ui";

type JobListing = {
  id: string;
  seller_id: string;
  seller_name: string | null;
  title: string;
  description: string | null;
  city: string | null;
  province: string | null;
  photos: string[] | null;
  created_at: string;
};

const JOB_COLUMNS = "id,seller_id,seller_name,title,description,city,province,photos,created_at";

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <Svg width={19} height={19} viewBox="0 0 24 24" fill={filled ? color.gold : "none"} stroke={color.textOnBrand} strokeWidth={2}>
      <Path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </Svg>
  );
}

type Styles = ReturnType<typeof buildStyles>;

function MetaChip({ label, value, styles }: { label: string; value: string; styles: Styles }) {
  if (!value) return null;
  return (
    <View style={styles.metaChip}>
      <Text style={styles.metaChipLabel}>{label}</Text>
      <Text style={styles.metaChipValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function DetailSection({ title, body, styles }: { title: string; body: string; styles: Styles }) {
  if (!body.trim()) return null;
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionBody}>{body.trim()}</Text>
    </View>
  );
}

export default function JobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const insets = useSafeAreaInsets();
  const styles = useThemedStyles(buildStyles);
  const [job, setJob] = useState<JobListing | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaved, setIsSaved] = useState(false);
  const [savingBusy, setSavingBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase.from("listings").select(JOB_COLUMNS).eq("id", id).maybeSingle();
    setJob((data as JobListing) ?? null);
  }, [id]);

  useEffect(() => {
    setIsLoading(true);
    load().finally(() => setIsLoading(false));
  }, [load]);

  useEffect(() => {
    if (!session?.user || !id) return;
    isListingSaved(session.user.id, id).then(setIsSaved);
  }, [session?.user?.id, id]);

  async function handleToggleSave() {
    if (!session?.user) {
      router.push("/(auth)/sign-in");
      return;
    }
    if (!id || savingBusy) return;
    const next = !isSaved;
    setIsSaved(next);
    setSavingBusy(true);
    try {
      await toggleSave(session.user.id, id, isSaved);
      toast(next ? "Saved job" : "Removed from saved jobs");
    } catch {
      setIsSaved(!next);
      toast("Couldn't update saved jobs", 3000, true);
    } finally {
      setSavingBusy(false);
    }
  }

  if (isLoading) {
    return (
      <View style={{ flex: 1 }}>
        <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
          <GlassBackButton onPress={() => router.back()} tone="light" />
        </View>
        <View style={styles.centered}>
          <ActivityIndicator color={color.brand} />
        </View>
      </View>
    );
  }

  if (!job) {
    return (
      <View style={{ flex: 1 }}>
        <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
          <GlassBackButton onPress={() => router.back()} tone="light" />
        </View>
        <View style={styles.centered}>
          <EmptyState title="Job not found" subtitle="This posting may have been closed or removed." />
        </View>
      </View>
    );
  }

  const company = jobCompany(job.description, job.seller_name);
  const isOwner = session?.user?.id === job.seller_id;
  const location = [job.city, job.province].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(", ");
  const type = jobType(job.description);
  const expLabel = parseJobField(job.description, "EXPERIENCE");
  const industry = parseJobField(job.description, "INDUSTRY");
  const about = parseJobField(job.description, "DESCRIPTION") || job.description || "";
  const responsibilities = parseJobField(job.description, "RESPONSIBILITIES");
  const requirements = parseJobField(job.description, "REQUIREMENTS");
  const howToApply = parseJobField(job.description, "HOW TO APPLY");

  function applyNow() {
    if (!session?.user) {
      router.push("/(auth)/sign-in");
      return;
    }
    router.push({ pathname: "/jobs/apply/[id]", params: { id: job!.id } });
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <GlassBackButton onPress={() => router.back()} tone="light" />
        <Text style={styles.headerTitle} numberOfLines={1}>
          {company}
        </Text>
        {isOwner ? (
          <View style={{ width: 20 }} />
        ) : (
          <Pressable onPress={handleToggleSave} hitSlop={10}>
            <HeartIcon filled={isSaved} />
          </Pressable>
        )}
      </View>

      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 110 }}>
        <Card style={styles.headCard}>
          <View style={styles.headRow}>
            <View style={styles.logoWrap}>
              {job.photos?.[0] ? (
                <Image source={{ uri: job.photos[0] }} style={styles.logo} contentFit="cover" cachePolicy="memory-disk" />
              ) : (
                <Text style={styles.logoInitial}>{businessInitials(company)}</Text>
              )}
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.jobTitle}>{job.title}</Text>
              <Pressable
                onPress={() => router.push({ pathname: "/business/[id]", params: { id: job.seller_id } })}
                hitSlop={6}
              >
                <Text style={styles.company}>{company}</Text>
              </Pressable>
              {location ? <Text style={styles.location}>{location}</Text> : null}
            </View>
          </View>

          <View style={styles.metaChips}>
            <MetaChip label="Type" value={type || "Not specified"} styles={styles} />
            <MetaChip label="Salary" value={jobSalary(job.description)} styles={styles} />
            {expLabel ? <MetaChip label="Experience" value={expLabel} styles={styles} /> : null}
            {industry ? <MetaChip label="Industry" value={industry} styles={styles} /> : null}
          </View>
        </Card>

        <Card style={styles.detailsCard}>
          <DetailSection title="About the role" body={about} styles={styles} />
          <DetailSection title="Responsibilities" body={responsibilities} styles={styles} />
          <DetailSection title="Requirements" body={requirements} styles={styles} />
          <DetailSection title="How to apply" body={howToApply} styles={styles} />
          {!about.trim() && !responsibilities && !requirements ? (
            <Text style={styles.sectionBody}>No description provided.</Text>
          ) : null}
        </Card>
      </ScrollView>

      <View style={[styles.ctaBar, { paddingBottom: insets.bottom + space.md }]}>
        {isOwner ? (
          <View style={styles.ownerRow}>
            <View style={{ flex: 1 }}>
              <Button
                label="Edit"
                variant="secondary"
                onPress={() => router.push({ pathname: "/jobs/edit/[id]", params: { id: job.id } })}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button label="View applicants" onPress={() => router.push("/jobs/applications")} />
            </View>
          </View>
        ) : (
          <Button label="Apply now" variant="gold" size="lg" onPress={applyNow} />
        )}
      </View>
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
    gap: space.md,
    backgroundColor: color.brand,
    paddingHorizontal: space.lg,
    paddingBottom: space.md,
  },
  headerTitle: { flex: 1, ...font.title, color: color.textOnBrand, textAlign: "center" },
  headCard: { gap: space.lg },
  headRow: { flexDirection: "row", gap: space.md, alignItems: "flex-start" },
  logoWrap: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    backgroundColor: color.brandTint,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    flexShrink: 0,
  },
  logo: { width: "100%", height: "100%" },
  logoInitial: { ...font.h3, color: color.brand },
  jobTitle: { ...font.h3, color: color.text },
  company: { ...font.bodyStrong, color: color.brand, marginTop: space.xxs },
  location: { ...font.sub, color: color.textMuted, marginTop: space.xxs },
  metaChips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  metaChip: {
    backgroundColor: color.surfaceAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.border,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    minWidth: 96,
  },
  metaChipLabel: { ...font.micro, color: color.textMuted, textTransform: "uppercase" },
  metaChipValue: { ...font.bodyStrong, color: color.text, marginTop: 2 },
  detailsCard: { marginTop: space.lg, gap: 0 },
  section: { marginBottom: space.xl },
  sectionTitle: { ...font.title, color: color.text, marginBottom: space.sm },
  sectionBody: { ...font.body, color: color.textSub, lineHeight: 22 },
  ctaBar: {
    padding: space.lg,
    paddingBottom: space.md,
    borderTopWidth: 1,
    borderTopColor: color.border,
    backgroundColor: color.surface,
    ...shadow.md,
  },
  ownerRow: { flexDirection: "row", gap: space.md },
  });
}
