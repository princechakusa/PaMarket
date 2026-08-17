import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import {
  color,
  font,
  radius,
  shadow,
  space,
  type ColorPalette,
} from "../../lib/theme";
import { useThemedStyles } from "../../lib/theme-provider";
import { useIOSNativeHeader } from "../../lib/useIOSNativeHeader";
import { businessInitials } from "../../lib/businesses";
import {
  hasStructuredJobSections,
  jobCompany,
  jobSalary,
  jobType,
  parseJobBlock,
  parseJobField,
  parseJobList,
  stripJobMetadataLines,
} from "../../lib/jobs";
import { isFeatured } from "../../lib/listings";
import { JOB_BOOST_PRODUCTS } from "../../lib/billing-products";
import { purchaseProduct } from "../../lib/iap";
import { useStoreProducts } from "../../lib/use-store-products";
import { StoreProductOption } from "../../components/StoreProductOption";
import { isListingSaved, toggleSave } from "../../lib/saves";
import { toast } from "../../components/ui/Toast";
import {
  Badge,
  BriefcaseIcon,
  BuildingIcon,
  Button,
  CalendarIcon,
  Card,
  CheckCircleIcon,
  ClockIcon,
  DollarIcon,
  EmptyState,
  GlassBackButton,
  PinIcon,
  UsersIcon,
} from "../../components/ui";

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
  featured_until: string | null;
};

const JOB_BOOST_PRODUCT_IDS = Object.keys(JOB_BOOST_PRODUCTS);

const JOB_COLUMNS =
  "id,seller_id,seller_name,title,description,city,province,photos,created_at,featured_until";

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <Svg
      width={19}
      height={19}
      viewBox="0 0 24 24"
      fill={filled ? color.gold : "none"}
      stroke={color.textOnBrand}
      strokeWidth={2}
    >
      <Path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </Svg>
  );
}

function StarIcon({ c }: { c: string }) {
  return (
    <Svg width={17} height={17} viewBox="0 0 24 24" fill={c}>
      <Path d="M12 2.5l2.9 6.06 6.6.83-4.86 4.63 1.28 6.55L12 17.35l-5.92 3.22 1.28-6.55L2.5 9.39l6.6-.83L12 2.5z" />
    </Svg>
  );
}

type Styles = ReturnType<typeof buildStyles>;

function DetailSection({
  title,
  body,
  styles,
}: {
  title: string;
  body: string;
  styles: Styles;
}) {
  if (!body.trim()) return null;
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionBody}>{body.trim()}</Text>
    </View>
  );
}

// Summary is clipped to a few lines with a Show more toggle, but only when
// there is enough text for clipping to matter.
const SUMMARY_COLLAPSED_LINES = 5;
const SUMMARY_TOGGLE_THRESHOLD = 260;

// "17 Aug 2026" — same en-GB day-month-year shape as the approved design.
function formatPostedDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function Chevron({ c, up }: { c: string; up: boolean }) {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
      <Path
        d={up ? "M18 15l-6-6-6 6" : "M6 9l6 6 6-6"}
        stroke={c}
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// Renders a parsed section as scannable rows instead of one paragraph — the
// specific problem with the old screen, where responsibilities and
// requirements arrived as an unbroken block of text.
function DetailBullets({
  title,
  items,
  styles,
  tick,
}: {
  title: string;
  items: string[];
  styles: Styles;
  tick: string;
}) {
  if (!items.length) return null;
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {items.map((item, i) => {
        // Sellers commonly write "Heading: detail" per line. When that shape
        // is present, show the heading in bold with the detail beneath it,
        // as in the approved design. Plain lines stay as a single line rather
        // than inventing a heading that was never written.
        const split = item.match(/^([^:]{3,60}):\s*(.+)$/s);
        const heading = split ? split[1].trim() : null;
        const detail = split ? split[2].trim() : item;
        return (
          <View key={`${i}-${item.slice(0, 24)}`} style={styles.bulletRow}>
            <View style={styles.bulletTick}>
              <CheckCircleIcon c={tick} size={18} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              {heading ? (
                <Text style={styles.bulletHeading}>{heading}</Text>
              ) : null}
              <Text style={styles.bulletText}>{detail}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

export default function JobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const insets = useSafeAreaInsets();
  const styles = useThemedStyles(buildStyles);
  // Stroke-only icons need raw colours, not StyleSheet entries.
  const tones = useThemedStyles((c: ColorPalette) => ({
    brand: c.brand,
    muted: c.textMuted,
  }));
  const [job, setJob] = useState<JobListing | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaved, setIsSaved] = useState(false);
  const [savingBusy, setSavingBusy] = useState(false);
  const [boostPickerOpen, setBoostPickerOpen] = useState(false);
  const [summaryExpanded, setSummaryExpanded] = useState(false);
  const [purchasingBoost, setPurchasingBoost] = useState<string | null>(null);
  const {
    prices: boostPrices,
    availableProductIds: availableBoostIds,
    isLoading: isLoadingBoosts,
    error: boostProductError,
    retry: retryBoostProducts,
  } = useStoreProducts(JOB_BOOST_PRODUCT_IDS, "consumable");

  useIOSNativeHeader({
    backgroundColor: color.brand,
    tintColor: color.textOnBrand,
    title: job ? jobCompany(job.description, job.seller_name) : "Job",
    headerRight:
      job && session?.user?.id !== job.seller_id
        ? () => (
            <Pressable onPress={handleToggleSave} hitSlop={10}>
              <HeartIcon filled={isSaved} />
            </Pressable>
          )
        : undefined,
  });

  const load = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase
      .from("listings")
      .select(JOB_COLUMNS)
      .eq("id", id)
      .maybeSingle();
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

  if (!job) {
    return (
      <View style={{ flex: 1 }}>
        {Platform.OS !== "ios" ? (
          <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
            <GlassBackButton onPress={() => router.back()} tone="light" flat />
          </View>
        ) : null}
        <View style={styles.centered}>
          <EmptyState
            title="Job not found"
            subtitle="This posting may have been closed or removed."
          />
        </View>
      </View>
    );
  }

  const company = jobCompany(job.description, job.seller_name);
  const isOwner = session?.user?.id === job.seller_id;
  const location = [job.city, job.province]
    .filter(Boolean)
    .filter((v, i, a) => a.indexOf(v) === i)
    .join(", ");
  const type = jobType(job.description);
  const expLabel = parseJobField(job.description, "EXPERIENCE");
  const industry = parseJobField(job.description, "INDUSTRY");
  const about =
    parseJobBlock(job.description, "DESCRIPTION") ||
    // Fallback for posts with no DESCRIPTION: block. Metadata lines are
    // stripped first so storage markers never surface as visible prose.
    stripJobMetadataLines(job.description);
  const responsibilities = parseJobList(
    parseJobBlock(job.description, "RESPONSIBILITIES")
  );
  const requirements = parseJobList(
    parseJobBlock(job.description, "REQUIREMENTS")
  );
  const howToApply = parseJobBlock(job.description, "HOW TO APPLY");
  const skills = parseJobField(job.description, "SKILLS")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  // Legacy and hand-edited posts have no generated headings; for those `about`
  // already falls back to the whole description, so the bulleted sections stay
  // hidden and the page still reads cleanly instead of breaking.
  const structured = hasStructuredJobSections(job.description);

  // "About the role" rows are built from what the job actually stores, so a
  // posting without a salary or experience level shows fewer rows instead of
  // empty labels. There is deliberately no Department row: buildDescription
  // never writes one, and inventing it would mean displaying data the seller
  // was never asked for.
  const salaryText = jobSalary(job.description);
  const aboutRows: { label: string; value: string; icon: React.ReactNode }[] = [
    industry && {
      label: "Industry",
      value: industry,
      icon: <BuildingIcon c={tones.brand} size={16} />,
    },
    salaryText && {
      label: "Salary",
      value: salaryText,
      icon: <DollarIcon c={tones.brand} size={16} />,
    },
    expLabel && {
      label: "Experience",
      value: expLabel,
      icon: <UsersIcon c={tones.brand} size={16} />,
    },
    type && {
      label: "Employment type",
      value: type,
      icon: <ClockIcon c={tones.brand} size={16} />,
    },
    location && {
      label: "Location",
      value: location,
      icon: <PinIcon c={tones.brand} size={16} />,
    },
  ].filter(Boolean) as { label: string; value: string; icon: React.ReactNode }[];

  async function buyBoost(productId: string) {
    if (!job) return;
    if (!availableBoostIds.includes(productId)) {
      toast(
        "This job boost is unavailable from the store. Retry loading prices."
      );
      return;
    }
    setPurchasingBoost(productId);
    try {
      const result = await purchaseProduct(productId, { listingId: job.id });
      if (result.ok) {
        setBoostPickerOpen(false);
        toast("Job boosted!");
        load();
      } else if (result.code === "user-cancelled") {
        toast("Purchase cancelled");
      } else {
        toast(result.error);
      }
    } finally {
      setPurchasingBoost(null);
    }
  }

  function applyNow() {
    if (!session?.user) {
      router.push("/(auth)/sign-in");
      return;
    }
    router.push({ pathname: "/jobs/apply/[id]", params: { id: job!.id } });
  }

  return (
    <View style={styles.container}>
      {Platform.OS !== "ios" ? (
        <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
          <GlassBackButton onPress={() => router.back()} tone="light" flat />
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
      ) : null}

      <ScrollView
        contentContainerStyle={{ padding: space.lg, paddingBottom: 110 }}
      >
        <Card style={styles.headCard}>
          <View style={styles.headRow}>
            <View style={styles.logoWrap}>
              {job.photos?.[0] ? (
                <Image
                  source={{ uri: job.photos[0] }}
                  style={styles.logo}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                />
              ) : (
                <Text style={styles.logoInitial}>
                  {businessInitials(company)}
                </Text>
              )}
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.jobTitle}>{job.title}</Text>
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: "/business/[id]",
                    params: { id: job.seller_id },
                  })
                }
                hitSlop={6}
              >
                <Text style={styles.company}>{company}</Text>
              </Pressable>
              {location ? (
                <Text style={styles.location}>{location}</Text>
              ) : null}
            </View>
          </View>

          {/* Compact icon + text row under the title, matching the approved
              design. Posted date comes from created_at, which every listing
              has, so it never renders empty. */}
          <View style={styles.headMetaRow}>
            {type ? (
              <View style={styles.headMetaItem}>
                <BriefcaseIcon c={tones.muted} size={14} />
                <Text style={styles.headMetaText}>{type}</Text>
              </View>
            ) : null}
            {location ? (
              <View style={styles.headMetaItem}>
                <PinIcon c={tones.muted} size={14} />
                <Text style={styles.headMetaText} numberOfLines={1}>
                  {location}
                </Text>
              </View>
            ) : null}
            <View style={styles.headMetaItem}>
              <CalendarIcon c={tones.muted} size={14} />
              <Text style={styles.headMetaText}>
                Posted {formatPostedDate(job.created_at)}
              </Text>
            </View>
          </View>
        </Card>

        {/* About the role — one labelled row per stored value. Rows only
            render when the underlying field exists, so a job without a salary
            or industry simply shows fewer rows rather than empty labels. */}
        {aboutRows.length ? (
          <Card style={styles.detailsCard}>
            <Text style={styles.sectionTitle}>About the role</Text>
            {aboutRows.map((row, i) => (
              <View
                key={row.label}
                style={[
                  styles.aboutRow,
                  i === aboutRows.length - 1 && styles.aboutRowLast,
                ]}
              >
                <View style={styles.aboutIcon}>{row.icon}</View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.aboutLabel}>{row.label}</Text>
                  <Text style={styles.aboutValue}>{row.value}</Text>
                </View>
              </View>
            ))}
          </Card>
        ) : null}

        <Card style={styles.detailsCard}>
          {about.trim() ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                {structured ? "Job summary" : "About the role"}
              </Text>
              <Text
                style={styles.sectionBody}
                numberOfLines={summaryExpanded ? undefined : SUMMARY_COLLAPSED_LINES}
              >
                {about.trim()}
              </Text>
              {/* Only offer the toggle when the text is long enough to be
                  clipped — a three-line summary should not show "Show more". */}
              {about.trim().length > SUMMARY_TOGGLE_THRESHOLD ? (
                <Pressable
                  onPress={() => setSummaryExpanded((v) => !v)}
                  hitSlop={8}
                  style={styles.showMoreRow}
                >
                  <Text style={styles.showMoreText}>
                    {summaryExpanded ? "Show less" : "Show more"}
                  </Text>
                  <Chevron c={tones.brand} up={summaryExpanded} />
                </Pressable>
              ) : null}
            </View>
          ) : null}
          <DetailBullets
            title="Key responsibilities"
            items={responsibilities}
            styles={styles}
            tick={color.brand}
          />
          <DetailBullets
            title="Requirements & qualifications"
            items={requirements}
            styles={styles}
            tick={color.brand}
          />
          {skills.length ? (
            <View style={styles.detailBlock}>
              <Text style={styles.sectionTitle}>Skills</Text>
              <View style={styles.skillWrap}>
                {skills.map((s) => (
                  <View key={s} style={styles.skillChip}>
                    <Text style={styles.skillChipText}>{s}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}
          <DetailSection
            title="How to apply"
            body={howToApply}
            styles={styles}
          />
          {!about.trim() && !responsibilities.length && !requirements.length ? (
            <Text style={styles.sectionBody}>No description provided.</Text>
          ) : null}
        </Card>

        {isOwner ? (
          isFeatured(job) ? (
            <View style={styles.boostActiveRow}>
              <StarIcon c={color.gold} />
              <Text style={styles.boostActiveText}>
                Promoted until{" "}
                {new Date(job.featured_until as string).toLocaleDateString()}
              </Text>
            </View>
          ) : (
            <>
              <Pressable
                style={styles.boostBanner}
                onPress={() => setBoostPickerOpen((v) => !v)}
              >
                <View style={styles.boostBannerIcon}>
                  <StarIcon c={color.textOnBrand} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.boostBannerTitle}>Boost this job</Text>
                  <Text style={styles.boostBannerSub}>
                    Get more applicants with a featured listing
                  </Text>
                </View>
                <View style={styles.boostBannerBtn}>
                  <Text style={styles.boostBannerBtnText}>View options</Text>
                </View>
              </Pressable>

              {boostPickerOpen ? (
                <View style={styles.boostOptions}>
                  {Object.entries(JOB_BOOST_PRODUCTS).map(([productId, p]) => (
                    <StoreProductOption
                      key={productId}
                      title={`${p.days}-Day Job Boost`}
                      price={boostPrices[productId]}
                      description={`Promotes this job listing for ${p.days} days.`}
                      buttonLabel="Boost Job"
                      isLoading={isLoadingBoosts}
                      isAvailable={availableBoostIds.includes(productId)}
                      isPurchasing={purchasingBoost === productId}
                      purchaseBlocked={!!purchasingBoost}
                      error={boostProductError}
                      recommended={p.days === 30}
                      onPurchase={() => buyBoost(productId)}
                      onRetry={retryBoostProducts}
                    />
                  ))}
                </View>
              ) : null}
            </>
          )
        ) : null}
      </ScrollView>

      <View
        style={[styles.ctaBar, { paddingBottom: insets.bottom + space.md }]}
      >
        {isOwner ? (
          <View style={styles.ownerRow}>
            <View style={{ flex: 1 }}>
              <Button
                label="Edit"
                variant="secondary"
                onPress={() =>
                  router.push({
                    pathname: "/jobs/edit/[id]",
                    params: { id: job.id },
                  })
                }
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                label="View applicants"
                onPress={() =>
                  router.push({
                    pathname: "/jobs/applicants/[jobId]",
                    params: { jobId: job.id },
                  })
                }
              />
            </View>
          </View>
        ) : (
          // Candidate view: Save job sits beside Apply now, matching the
          // approved design. Saving already existed as a heart in the header;
          // this surfaces the same action where a candidate actually decides.
          <View style={styles.ownerRow}>
            <View style={{ flex: 1 }}>
              <Button
                label={isSaved ? "Saved" : "Save job"}
                variant="secondary"
                size="lg"
                onPress={handleToggleSave}
              />
            </View>
            <View style={{ flex: 1.3 }}>
              <Button label="Apply now" size="lg" onPress={applyNow} />
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

function buildStyles(color: ColorPalette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: color.bg },
    centered: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: color.bg,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: space.md,
      backgroundColor: color.brand,
      paddingHorizontal: space.lg,
      paddingBottom: space.md,
    },
    headerTitle: {
      flex: 1,
      ...font.title,
      color: color.textOnBrand,
      textAlign: "center",
    },
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
    detailsCard: { marginTop: space.lg, gap: 0 },
    section: { marginBottom: space.xl },
    sectionTitle: { ...font.title, color: color.text, marginBottom: space.sm },
    sectionBody: { ...font.body, color: color.textSub, lineHeight: 22 },
    detailBlock: { marginBottom: space.xl },
    bulletRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: space.sm,
      marginBottom: space.md,
    },
    bulletTick: { marginTop: 1, flexShrink: 0 },
    bulletHeading: {
      ...font.bodyStrong,
      color: color.text,
      marginBottom: 2,
    },
    headMetaRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "center",
      gap: space.md,
      marginTop: space.md,
    },
    headMetaItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      flexShrink: 1,
    },
    headMetaText: { ...font.caption, color: color.textMuted, flexShrink: 1 },
    aboutRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: space.md,
      paddingVertical: space.md,
      borderBottomWidth: 1,
      borderBottomColor: color.border,
    },
    aboutRowLast: { borderBottomWidth: 0, paddingBottom: 0 },
    aboutIcon: {
      width: 34,
      height: 34,
      borderRadius: radius.sm,
      backgroundColor: color.brandTint,
      alignItems: "center",
      justifyContent: "center",
    },
    aboutLabel: { ...font.bodyStrong, color: color.text },
    aboutValue: { ...font.sub, color: color.textSub, marginTop: 1 },
    showMoreRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      marginTop: space.sm,
    },
    showMoreText: { ...font.sub, color: color.brand, fontWeight: "700" },
    bulletText: {
      ...font.body,
      color: color.textSub,
      lineHeight: 22,
      flex: 1,
      minWidth: 0,
    },
    skillWrap: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
    skillChip: {
      backgroundColor: color.brandTint,
      borderRadius: radius.sm,
      paddingHorizontal: space.md,
      paddingVertical: 6,
    },
    skillChipText: { ...font.caption, color: color.brand, fontWeight: "700" },
    ctaBar: {
      padding: space.lg,
      paddingBottom: space.md,
      borderTopWidth: 1,
      borderTopColor: color.border,
      backgroundColor: color.surface,
      ...shadow.md,
    },
    ownerRow: { flexDirection: "row", gap: space.md },

    boostActiveRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: space.sm,
      backgroundColor: color.goldTint,
      borderRadius: radius.md,
      padding: space.md,
      marginTop: space.lg,
    },
    boostActiveText: { ...font.sub, color: color.text, fontWeight: "700" },

    boostBanner: {
      flexDirection: "row",
      alignItems: "center",
      gap: space.md,
      backgroundColor: color.brand,
      borderRadius: radius.lg,
      padding: space.md,
      marginTop: space.lg,
    },
    boostBannerIcon: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: "rgba(255,255,255,0.16)",
      alignItems: "center",
      justifyContent: "center",
    },
    boostBannerTitle: { ...font.title, color: "#fff" },
    boostBannerSub: {
      ...font.caption,
      color: "rgba(255,255,255,0.75)",
      marginTop: 2,
    },
    boostBannerBtn: {
      backgroundColor: color.gold,
      borderRadius: radius.pill,
      paddingHorizontal: 14,
      paddingVertical: 8,
    },
    boostBannerBtnText: { ...font.caption, color: "#fff", fontWeight: "800" },

    boostOptions: { gap: space.sm, marginTop: space.sm },
    boostOpt: {
      flex: 1,
      alignItems: "center",
      gap: 4,
      backgroundColor: color.surfaceAlt,
      borderRadius: radius.md,
      paddingVertical: space.md,
      borderWidth: 1.5,
      borderColor: "transparent",
      position: "relative",
    },
    boostOptReco: { borderColor: color.gold, backgroundColor: color.goldTint },
    boostOptTag: {
      position: "absolute",
      top: -9,
      alignSelf: "center",
      backgroundColor: color.gold,
      borderRadius: radius.pill,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    boostOptTagText: {
      fontSize: 9,
      fontWeight: "800",
      color: "#fff",
      letterSpacing: 0.3,
    },
    boostOptDays: { ...font.sub, color: color.text, fontWeight: "700" },
    boostOptCta: { ...font.caption, color: color.brand, fontWeight: "800" },
  });
}
