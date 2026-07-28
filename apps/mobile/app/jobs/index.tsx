import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path, Polyline } from "react-native-svg";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import { color, font, radius, shadow, space, type ColorPalette } from "../../lib/theme";
import { useThemedStyles } from "../../lib/theme-provider";
import { Badge, GlassBackButton } from "../../components/ui";

function ChevronIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={color.textMuted} strokeWidth={2.4}>
      <Polyline points="9 18 15 12 9 6" />
    </Svg>
  );
}

function PersonIcon({ tone }: { tone: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={tone} strokeWidth={2}>
      <Path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
      <Path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" />
    </Svg>
  );
}

function BriefcaseIcon({ tone }: { tone: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={tone} strokeWidth={2}>
      <Path d="M3 7.5h18v11a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5v-11Z" />
      <Path d="M8 7.5V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v1.5" />
      <Path d="M3 12h18" />
    </Svg>
  );
}

type Styles = ReturnType<typeof buildStyles>;

function PillLink({
  icon,
  label,
  onPress,
  tone,
  styles,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  tone: "green" | "brand";
  styles: Styles;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.pill,
        tone === "green" ? styles.pillGreen : styles.pillBrand,
        pressed && { opacity: 0.7 },
      ]}
      onPress={onPress}
    >
      {icon}
      <Text style={[styles.pillText, tone === "green" ? styles.pillTextGreen : styles.pillTextBrand]}>{label}</Text>
    </Pressable>
  );
}

// Entry hub: mirrors the "What brings you here?" pattern the user supplied
// (screenshot reference) — two clear paths (seek work / hire) each with an
// icon-in-circle header and quick-action pills, rather than a flat menu.
// Sub-screens (browse jobs, applications, cv, hire flows) are unchanged.
export default function JobsHubScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const styles = useThemedStyles(buildStyles);
  const [applicationsCount, setApplicationsCount] = useState(0);
  const [companyVerified, setCompanyVerified] = useState(false);

  useEffect(() => {
    if (!session?.user) return;
    const myId = session.user.id;
    supabase
      .from("applications")
      .select("id", { count: "exact", head: true })
      .eq("applicant_id", myId)
      .then(({ count }) => setApplicationsCount(count ?? 0));
    supabase
      .from("profiles")
      .select("company_verified")
      .eq("id", myId)
      .maybeSingle()
      .then(({ data }) => setCompanyVerified(!!(data as any)?.company_verified));
  }, [session?.user?.id]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: space.huge }}>
      <View style={[styles.header, { paddingTop: insets.top + space.md }]}>
        <GlassBackButton onPress={() => router.back()} tone="dark" />
        <Text style={styles.headerTitle}>Jobs</Text>
      </View>

      <View style={styles.intro}>
        <Text style={styles.introTitle}>What brings you here?</Text>
        <Text style={styles.introSub}>Choose how you want to use PaMarket Jobs.</Text>
      </View>

      <View style={styles.body}>
        <View style={[styles.card, shadow.sm]}>
          <View style={styles.cardHeader}>
            <View style={[styles.iconCircle, styles.iconCircleGreen]}>
              <PersonIcon tone={color.success} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Get Hired</Text>
              <Text style={styles.cardSub}>Browse jobs across Zimbabwe and apply in seconds.</Text>
            </View>
            <ChevronIcon />
          </View>
          <Pressable onPress={() => router.push("/jobs/browse")}>
            <View style={styles.divider} />
          </Pressable>
          <View style={styles.pillRow}>
            <PillLink
              tone="green"
              icon={<BriefcaseIcon tone={color.success} />}
              label="Browse Jobs"
              onPress={() => router.push("/jobs/browse")}
              styles={styles}
            />
            <PillLink
              tone="green"
              icon={<PersonIcon tone={color.success} />}
              label="My Applications"
              onPress={() => router.push("/jobs/applications")}
              styles={styles}
            />
          </View>
          <View style={styles.pillRow}>
            <PillLink
              tone="green"
              icon={<PersonIcon tone={color.success} />}
              label="My Profile"
              onPress={() => router.push("/jobs/cv-profile")}
              styles={styles}
            />
            {applicationsCount ? <Badge label={`${applicationsCount} sent`} tone="success" /> : null}
          </View>
        </View>

        <View style={[styles.card, shadow.sm]}>
          <View style={styles.cardHeader}>
            <View style={[styles.iconCircle, styles.iconCircleBrand]}>
              <BriefcaseIcon tone={color.brand} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>I&apos;m Hiring</Text>
              <Text style={styles.cardSub}>Browse available candidates and find the right person.</Text>
            </View>
            <ChevronIcon />
          </View>
          <View style={styles.divider} />
          <View style={styles.pillRow}>
            <PillLink
              tone="brand"
              icon={<PersonIcon tone={color.brand} />}
              label="Browse Candidates"
              onPress={() => router.push("/jobs/hire-talent")}
              styles={styles}
            />
          </View>
          <View style={styles.pillRow}>
            <PillLink
              tone="brand"
              icon={<PersonIcon tone={color.brand} />}
              label="My Requests"
              onPress={() => router.push("/jobs/contact-requests")}
              styles={styles}
            />
            <PillLink
              tone="brand"
              icon={<BriefcaseIcon tone={color.brand} />}
              label="Post a Job"
              onPress={() => router.push(companyVerified ? "/jobs/post" : "/company-verify")}
              styles={styles}
            />
          </View>
          <View style={styles.pillRow}>
            <PillLink
              tone="brand"
              icon={<BriefcaseIcon tone={color.brand} />}
              label="Recruiter Plan"
              onPress={() => router.push("/jobs/recruiter-subscription")}
              styles={styles}
            />
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

function buildStyles(color: ColorPalette) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: color.bg },
  header: {
    backgroundColor: color.gold,
    paddingHorizontal: space.lg,
    paddingBottom: space.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
  },
  headerTitle: { ...font.h3, color: color.text },
  intro: { paddingHorizontal: space.lg, paddingTop: space.xl, paddingBottom: space.sm },
  introTitle: { ...font.h2, color: color.text },
  introSub: { ...font.body, color: color.textSub, marginTop: space.xs },
  body: { paddingHorizontal: space.lg, paddingTop: space.md, gap: space.lg },
  card: {
    backgroundColor: color.surface,
    borderRadius: radius.xl,
    padding: space.lg,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: space.md },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  iconCircleGreen: { backgroundColor: color.successTint },
  iconCircleBrand: { backgroundColor: color.brandTint },
  cardTitle: { ...font.title, color: color.text },
  cardSub: { ...font.sub, color: color.textSub, marginTop: 2 },
  divider: { height: 1, backgroundColor: color.divider, marginVertical: space.md },
  pillRow: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginBottom: space.sm, alignItems: "center" },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  pillGreen: { borderColor: color.success, backgroundColor: color.successTint },
  pillBrand: { borderColor: color.brand, backgroundColor: color.brandTint },
  pillText: { ...font.caption, fontWeight: "700" },
  pillTextGreen: { color: color.success },
  pillTextBrand: { color: color.brand },
  });
}
