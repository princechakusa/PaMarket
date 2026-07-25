import { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Line, Polyline } from "react-native-svg";
import { supabase } from "../../lib/supabase";
import { color, font, radius, shadow, space, type ColorPalette } from "../../lib/theme";
import { useThemedStyles } from "../../lib/theme-provider";
import {
  EXP_LEVEL_LABEL,
  JOB_CATEGORIES,
  candidateSkillsList,
  type CandidateProfileRow,
} from "../../lib/jobs";
import {
  Avatar,
  Badge,
  Card,
  Chip,
  EmptyState,
  ErrorState,
  Skeleton,
  VerifiedBadge,
} from "../../components/ui";

function BackIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={color.textOnBrand} strokeWidth={2.4}>
      <Polyline points="15 18 9 12 15 6" />
    </Svg>
  );
}

function SearchIcon() {
  return (
    <Svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke={color.textOnBrandSub} strokeWidth={2.4}>
      <Circle cx={11} cy={11} r={8} />
      <Line x1={21} y1={21} x2={16.65} y2={16.65} />
    </Svg>
  );
}

const CANDIDATE_COLUMNS = "id,name,avatar,verified,job_title,skills,sector,exp,city,open_to_work,cv";

const EXP_FILTERS: Array<[string, string]> = [
  ["entry", "Entry"],
  ["mid", "3-5 yrs"],
  ["senior", "5-10 yrs"],
  ["expert", "10+ yrs"],
];

type FilterTab = "sector" | "experience" | "location";

// Mirrors www/js/jobs.js H.pages.HireTalent — employer-side candidate
// browse/search. profiles columns confirmed against supabase/schema/profiles.sql
// (name, avatar, verified, job_title, skills, sector, exp, city, open_to_work,
// cv jsonb) — no invented columns.
export default function HireTalentScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const styles = useThemedStyles(buildStyles);
  const [candidates, setCandidates] = useState<CandidateProfileRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [query, setQuery] = useState("");
  const [sectorFilter, setSectorFilter] = useState<string>("all");
  const [expFilter, setExpFilter] = useState<string>("all");
  const [cityFilter, setCityFilter] = useState<string>("all");
  const [openOnly, setOpenOnly] = useState(false);
  const [tab, setTab] = useState<FilterTab>("sector");

  const load = useCallback(async () => {
    setHasError(false);
    const { data, error } = await supabase
      .from("profiles")
      .select(CANDIDATE_COLUMNS)
      .or("open_to_work.eq.true,cv->>visible.eq.true")
      .limit(60);
    if (error) {
      setHasError(true);
      return;
    }
    setCandidates((data as unknown as CandidateProfileRow[]) ?? []);
  }, []);

  useEffect(() => {
    setIsLoading(true);
    load().finally(() => setIsLoading(false));
  }, [load]);

  // Only surface profiles that are genuinely searchable — open to work, or a
  // visible CV with real content behind it.
  const pool = useMemo(
    () =>
      candidates.filter(
        (c) =>
          c.open_to_work ||
          (c.cv && c.cv.visible !== false && (c.cv.headline || c.cv.summary || c.cv.experience?.length))
      ),
    [candidates]
  );

  const cityOptions = useMemo(() => {
    const set = new Set<string>();
    pool.forEach((c) => {
      const city = (c.cv?.location || c.city || "").trim();
      if (city) set.add(city);
    });
    return Array.from(set).sort();
  }, [pool]);

  const filtered = useMemo(() => {
    let list = pool;
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter((c) => {
        const cv = c.cv || {};
        return [
          c.name || "",
          c.job_title || "",
          c.sector || "",
          cv.headline || "",
          cv.summary || "",
          candidateSkillsList(c).join(" "),
          c.city || "",
        ]
          .join(" ")
          .toLowerCase()
          .includes(q);
      });
    }
    if (sectorFilter !== "all") list = list.filter((c) => (c.sector || "") === sectorFilter);
    if (expFilter !== "all") list = list.filter((c) => (c.exp || "") === expFilter);
    if (cityFilter !== "all") {
      list = list.filter((c) => (c.cv?.location || c.city || "").trim() === cityFilter);
    }
    if (openOnly) list = list.filter((c) => !!c.open_to_work);
    return list;
  }, [pool, query, sectorFilter, expFilter, cityFilter, openOnly]);

  const activeFilterCount =
    (sectorFilter !== "all" ? 1 : 0) +
    (expFilter !== "all" ? 1 : 0) +
    (cityFilter !== "all" ? 1 : 0) +
    (openOnly ? 1 : 0);

  function clearFilters() {
    setSectorFilter("all");
    setExpFilter("all");
    setCityFilter("all");
    setOpenOnly(false);
    setQuery("");
  }

  const retry = () => {
    setIsLoading(true);
    load().finally(() => setIsLoading(false));
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <BackIcon />
          </Pressable>
          <Text style={styles.headerTitle}>Find candidates</Text>
          <Pressable onPress={() => router.push("/jobs/contact-requests")} hitSlop={10}>
            <Text style={styles.headerLink}>Requests</Text>
          </Pressable>
        </View>
        <View style={styles.searchBar}>
          <SearchIcon />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Search by skill, title or name…"
            placeholderTextColor={color.textOnBrandSub}
            returnKeyType="search"
          />
        </View>
      </View>

      <View style={styles.filterPanel}>
        <View style={styles.tabRow}>
          <TabButton label="Industry" active={tab === "sector"} onPress={() => setTab("sector")} styles={styles} />
          <TabButton label="Experience" active={tab === "experience"} onPress={() => setTab("experience")} styles={styles} />
          <TabButton label="Location" active={tab === "location"} onPress={() => setTab("location")} styles={styles} />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterContent}
          keyboardShouldPersistTaps="handled"
        >
          {tab === "sector"
            ? ["all", ...JOB_CATEGORIES].map((c) => (
                <Chip
                  key={c}
                  label={c === "all" ? "All industries" : c}
                  active={sectorFilter === c}
                  onPress={() => setSectorFilter(c)}
                />
              ))
            : null}
          {tab === "experience" ? (
            <>
              <Chip label="Any experience" active={expFilter === "all"} onPress={() => setExpFilter("all")} />
              {EXP_FILTERS.map(([key, label]) => (
                <Chip key={key} label={label} active={expFilter === key} onPress={() => setExpFilter(key)} />
              ))}
            </>
          ) : null}
          {tab === "location" ? (
            <>
              <Chip label="Anywhere" active={cityFilter === "all"} onPress={() => setCityFilter("all")} />
              {cityOptions.length ? (
                cityOptions.map((c) => (
                  <Chip key={c} label={c} active={cityFilter === c} onPress={() => setCityFilter(c)} />
                ))
              ) : (
                <Text style={styles.noCities}>No locations on the current candidates</Text>
              )}
            </>
          ) : null}
        </ScrollView>

        <View style={styles.summaryRow}>
          <Chip
            label="Open to work only"
            active={openOnly}
            onPress={() => setOpenOnly((v) => !v)}
          />
          {activeFilterCount ? (
            <Pressable onPress={clearFilters} hitSlop={8}>
              <Text style={styles.clearLink}>Clear ({activeFilterCount})</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      {isLoading ? (
        <View style={styles.listContent}>
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} style={styles.skeletonCard}>
              <View style={styles.skeletonRow}>
                <Skeleton width={52} height={52} radius={26} />
                <View style={{ flex: 1, gap: space.sm }}>
                  <Skeleton width="60%" height={14} />
                  <Skeleton width="80%" height={12} />
                  <Skeleton width="40%" height={12} />
                </View>
              </View>
            </Card>
          ))}
        </View>
      ) : hasError ? (
        <ErrorState
          title="Couldn't load candidates"
          subtitle="Check your connection and try the search again."
          onRetry={retry}
        />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + space.huge }]}
          ItemSeparatorComponent={() => <View style={{ height: space.md }} />}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            filtered.length ? (
              <Text style={styles.countText}>
                {filtered.length} {filtered.length === 1 ? "candidate" : "candidates"} match your search
              </Text>
            ) : null
          }
          ListEmptyComponent={
            <EmptyState
              title={activeFilterCount || query ? "No candidates match" : "No candidates listed yet"}
              subtitle={
                activeFilterCount || query
                  ? "Broaden your industry, experience or location filters to see more talent."
                  : "As job seekers publish their CVs they'll appear here, ready to contact."
              }
              buttonLabel={activeFilterCount || query ? "Clear filters" : undefined}
              onPressButton={activeFilterCount || query ? clearFilters : undefined}
            />
          }
          renderItem={({ item }) => (
            <CandidateCard
              candidate={item}
              onPress={() => router.push({ pathname: "/jobs/candidate/[id]", params: { id: item.id } })}
              styles={styles}
            />
          )}
        />
      )}
    </View>
  );
}

type Styles = ReturnType<typeof buildStyles>;

function CandidateCard({
  candidate,
  onPress,
  styles,
}: {
  candidate: CandidateProfileRow;
  onPress: () => void;
  styles: Styles;
}) {
  const skills = candidateSkillsList(candidate).slice(0, 4);
  const expLabel = candidate.exp ? EXP_LEVEL_LABEL[candidate.exp] || candidate.exp : "";
  const headline = candidate.cv?.headline || candidate.job_title || "Professional";
  const location = candidate.cv?.location || candidate.city || "";
  // Identity stays hidden until an approved contact_requests row exists — the
  // candidate detail screen owns that unlock, so the list never leaks a name.
  const displayName = candidate.open_to_work ? candidate.name || "Candidate" : "Candidate";

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [pressed && styles.cardPressed]}>
      <Card>
        <View style={styles.cardRow}>
          <Avatar uri={candidate.avatar} name={displayName} size={52} />
          <View style={styles.cardBody}>
            <View style={styles.nameRow}>
              <Text style={styles.candName} numberOfLines={1}>
                {displayName}
              </Text>
              {candidate.verified ? <VerifiedBadge compact /> : null}
            </View>
            <Text style={styles.candHeadline} numberOfLines={1}>
              {headline}
            </Text>
            <View style={styles.metaRow}>
              {location ? <Text style={styles.metaText}>{location}</Text> : null}
              {location && expLabel ? <Text style={styles.metaDot}>·</Text> : null}
              {expLabel ? <Text style={styles.metaText}>{expLabel}</Text> : null}
            </View>
          </View>
          {candidate.open_to_work ? <Badge label="OPEN TO WORK" tone="success" /> : null}
        </View>

        {skills.length ? (
          <View style={styles.skillsRow}>
            {skills.map((s) => (
              <View key={s} style={styles.skillPill}>
                <Text style={styles.skillPillText} numberOfLines={1}>
                  {s}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {candidate.sector ? (
          <View style={styles.footerRow}>
            <Text style={styles.sectorText}>{candidate.sector}</Text>
            <Text style={styles.viewLink}>View profile</Text>
          </View>
        ) : null}
      </Card>
    </Pressable>
  );
}

function TabButton({
  label,
  active,
  onPress,
  styles,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  styles: Styles;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.tab, active && styles.tabActive]} hitSlop={6}>
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
    </Pressable>
  );
}

function buildStyles(color: ColorPalette) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: color.bg },
  header: {
    backgroundColor: color.brand,
    paddingHorizontal: space.lg,
    paddingBottom: space.md,
    gap: space.md,
  },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.md },
  headerTitle: { ...font.title, color: color.textOnBrand },
  headerLink: { ...font.caption, color: color.textOnBrand },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    backgroundColor: "rgba(255,255,255,0.14)",
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    height: 44,
  },
  searchInput: { flex: 1, ...font.body, color: color.textOnBrand, paddingVertical: 0 },

  filterPanel: {
    backgroundColor: color.surface,
    borderBottomWidth: 1,
    borderBottomColor: color.border,
    paddingTop: space.md,
  },
  tabRow: { flexDirection: "row", gap: space.xl, paddingHorizontal: space.lg },
  tab: { paddingBottom: space.sm, borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabActive: { borderBottomColor: color.brand },
  tabText: { ...font.caption, color: color.textMuted },
  tabTextActive: { color: color.brand },
  filterContent: { paddingHorizontal: space.lg, paddingVertical: space.md, gap: space.sm, alignItems: "center" },
  noCities: { ...font.sub, color: color.textMuted },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: space.lg,
    paddingBottom: space.md,
  },
  clearLink: { ...font.caption, color: color.brand },

  listContent: { padding: space.lg },
  countText: { ...font.caption, color: color.textMuted, marginBottom: space.md },
  cardPressed: { opacity: 0.9, transform: [{ scale: 0.995 }] },
  cardRow: { flexDirection: "row", gap: space.md, alignItems: "flex-start" },
  cardBody: { flex: 1, minWidth: 0, gap: 2 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  candName: { ...font.title, color: color.text, flexShrink: 1 },
  candHeadline: { ...font.sub, color: color.textSub },
  metaRow: { flexDirection: "row", alignItems: "center", gap: space.xs, marginTop: space.xxs, flexWrap: "wrap" },
  metaText: { ...font.caption, color: color.textMuted },
  metaDot: { ...font.caption, color: color.textMuted },

  skillsRow: { flexDirection: "row", flexWrap: "wrap", gap: space.xs, marginTop: space.md },
  skillPill: {
    backgroundColor: color.brandTint,
    borderRadius: radius.sm,
    paddingHorizontal: space.sm,
    paddingVertical: 4,
    maxWidth: 160,
  },
  skillPillText: { ...font.micro, color: color.brand },

  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: space.md,
    paddingTop: space.md,
    borderTopWidth: 1,
    borderTopColor: color.divider,
  },
  sectorText: { ...font.caption, color: color.textMuted },
  viewLink: { ...font.caption, color: color.brand },

  skeletonCard: { marginBottom: space.md, ...shadow.sm },
  skeletonRow: { flexDirection: "row", gap: space.md, alignItems: "center" },
  });
}
