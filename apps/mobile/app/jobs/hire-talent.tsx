import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Line } from "react-native-svg";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import { color, font, radius, shadow, space, type ColorPalette } from "../../lib/theme";
import { useThemedStyles } from "../../lib/theme-provider";
import { useIOSNativeHeader } from "../../lib/useIOSNativeHeader";
import {
  EXP_LEVEL_LABEL,
  JOB_CATEGORIES,
  candidateSkillsList,
  type CandidateProfileRow,
} from "../../lib/jobs";
import { CITIES_BY_PROVINCE } from "../../lib/constants";
import {
  Avatar,
  Badge,
  Card,
  Chip,
  EmptyState,
  ErrorState,
  GlassBackButton,
  Skeleton,
  VerifiedBadge,
} from "../../components/ui";

function SearchIcon() {
  return (
    <Svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke={color.textOnBrandSub} strokeWidth={2.4}>
      <Circle cx={11} cy={11} r={8} />
      <Line x1={21} y1={21} x2={16.65} y2={16.65} />
    </Svg>
  );
}

const PAGE_SIZE = 40;

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
  const { session } = useAuth();
  const insets = useSafeAreaInsets();
  const styles = useThemedStyles(buildStyles);
  const [candidates, setCandidates] = useState<CandidateProfileRow[]>([]);
  // Candidate ids this employer has an APPROVED contact_requests row for —
  // the same "reveal" rule jobs/candidate/[id].tsx already enforces on the
  // detail screen. Cards must use the identical rule; showing the real name
  // here regardless of approval (the previous behavior, despite this file's
  // own comment claiming otherwise) leaked identity the detail screen was
  // built specifically to protect.
  const [unlockedIds, setUnlockedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [query, setQuery] = useState("");
  const [sectorFilter, setSectorFilter] = useState<string>("all");
  const [expFilter, setExpFilter] = useState<string>("all");
  const [cityFilter, setCityFilter] = useState<string>("all");
  const [tab, setTab] = useState<FilterTab>("sector");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const pageRef = useRef(0);

  // Debounced so search runs server-side across name/job_title/sector/
  // skills/city instead of only ever matching whatever page had already
  // loaded — see the identical fix in jobs/browse.tsx.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  useIOSNativeHeader({
    backgroundColor: color.brand,
    tintColor: color.textOnBrand,
    title: "Find candidates",
    headerRight: () => (
      <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
        <Pressable onPress={() => router.push("/jobs/messages")} hitSlop={10}>
          <Text style={styles.headerLink}>Messages</Text>
        </Pressable>
        <Pressable onPress={() => router.push("/jobs/contact-requests")} hitSlop={10}>
          <Text style={styles.headerLink}>Requests</Text>
        </Pressable>
      </View>
    ),
  });

  const buildQuery = useCallback(
    (from: number, to: number) => {
      return supabase.rpc("browse_recruitment_candidates", {
        p_query: debouncedQuery || null,
        p_sector: sectorFilter === "all" ? null : sectorFilter,
        p_experience: expFilter === "all" ? null : expFilter,
        p_city: cityFilter === "all" ? null : cityFilter,
        p_limit: to - from + 1,
        p_offset: from,
      });
    },
    [cityFilter, debouncedQuery, expFilter, sectorFilter]
  );

  // Batched, not per-card — one query for the whole page's candidate ids.
  const loadUnlocked = useCallback(
    async (page: CandidateProfileRow[]) => {
      if (!session?.user || !page.length) return;
      // contact_requests itself is admin-only to SELECT directly — this RPC
      // is the safe read path. Only candidate_id/status are used here, so
      // the redacted candidate_name it also returns is irrelevant.
      const { data } = await supabase.rpc("list_my_contact_requests");
      const pageIds = new Set(page.map((c) => c.id));
      const ids = ((data as { candidate_id: string; status: string }[] | null) ?? [])
        .filter((r) => r.status === "approved" && pageIds.has(r.candidate_id))
        .map((r) => r.candidate_id);
      if (ids.length) setUnlockedIds((prev) => new Set([...prev, ...ids]));
    },
    [session?.user]
  );

  const load = useCallback(async () => {
    setHasError(false);
    pageRef.current = 0;
    const { data, error } = await buildQuery(0, PAGE_SIZE - 1);
    if (error) {
      setHasError(true);
      return;
    }
    const page = (data as unknown as CandidateProfileRow[]) ?? [];
    setCandidates(page);
    setHasMore(page.length === PAGE_SIZE);
    loadUnlocked(page);
  }, [buildQuery, loadUnlocked]);

  useEffect(() => {
    setIsLoading(true);
    load().finally(() => setIsLoading(false));
  }, [load]);

  const loadMore = useCallback(async () => {
    if (isLoadingMore || isLoading || !hasMore || hasError) return;
    setIsLoadingMore(true);
    const nextPage = pageRef.current + 1;
    const from = nextPage * PAGE_SIZE;
    const { data, error } = await buildQuery(from, from + PAGE_SIZE - 1);
    if (!error) {
      const page = (data as unknown as CandidateProfileRow[]) ?? [];
      pageRef.current = nextPage;
      // Same offset-pagination-under-concurrent-inserts guard as
      // app/(tabs)/search.tsx's loadMore — see that file for the full
      // explanation. Duplicate ids in the FlatList's data (its
      // keyExtractor) crash Fabric's view mounting on Android.
      setCandidates((prev) => {
        const existingIds = new Set(prev.map((c) => c.id));
        return [...prev, ...page.filter((c) => !existingIds.has(c.id))];
      });
      setHasMore(page.length === PAGE_SIZE);
      loadUnlocked(page);
    }
    setIsLoadingMore(false);
  }, [buildQuery, hasMore, isLoading, isLoadingMore, hasError, loadUnlocked]);

  const cityOptions = useMemo(() => {
    return Array.from(new Set(Object.values(CITIES_BY_PROVINCE).flat())).sort();
  }, []);

  const activeFilterCount =
    (sectorFilter !== "all" ? 1 : 0) +
    (expFilter !== "all" ? 1 : 0) +
    (cityFilter !== "all" ? 1 : 0);

  function clearFilters() {
    setSectorFilter("all");
    setExpFilter("all");
    setCityFilter("all");
    setQuery("");
  }

  const retry = () => {
    setIsLoading(true);
    load().finally(() => setIsLoading(false));
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: Platform.OS === "ios" ? space.md : insets.top + 10 }]}>
        {Platform.OS !== "ios" ? (
          <View style={styles.headerRow}>
            <GlassBackButton onPress={() => router.back()} tone="light" flat />
            <Text style={styles.headerTitle}>Find candidates</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
              <Pressable onPress={() => router.push("/jobs/messages")} hitSlop={10}>
                <Text style={styles.headerLink}>Messages</Text>
              </Pressable>
              <Pressable onPress={() => router.push("/jobs/contact-requests")} hitSlop={10}>
                <Text style={styles.headerLink}>Requests</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
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
          <Text style={styles.openOnlyLabel}>Open to Work candidates only</Text>
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
          data={candidates}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + space.huge }]}
          ItemSeparatorComponent={() => <View style={{ height: space.md }} />}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            candidates.length ? (
              <Text style={styles.countText}>
                {candidates.length} {candidates.length === 1 ? "candidate" : "candidates"} match your search
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
              reveal={unlockedIds.has(item.id)}
              onPress={() => router.push({ pathname: "/jobs/candidate/[id]", params: { id: item.id } })}
              styles={styles}
            />
          )}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            isLoadingMore ? (
              <View style={styles.footer}>
                <ActivityIndicator color={color.brand} />
              </View>
            ) : null
          }
        />
      )}
    </View>
  );
}

type Styles = ReturnType<typeof buildStyles>;

function CandidateCard({
  candidate,
  reveal,
  onPress,
  styles,
}: {
  candidate: CandidateProfileRow;
  reveal: boolean;
  onPress: () => void;
  styles: Styles;
}) {
  const skills = candidateSkillsList(candidate).slice(0, 4);
  const expLabel = candidate.exp ? EXP_LEVEL_LABEL[candidate.exp] || candidate.exp : "";
  const headline = candidate.cv?.headline || candidate.job_title || "Professional";
  const location = candidate.cv?.location || candidate.city || "";
  // Identity stays hidden until an approved contact_requests row exists —
  // same rule as jobs/candidate/[id].tsx's `reveal`, passed in from the
  // batched contact_requests lookup in HireTalentScreen so every card here
  // is consistent with what the detail screen actually enforces.
  const displayName = reveal ? candidate.name || "Candidate" : "Candidate";

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [pressed && styles.cardPressed]}>
      <Card>
        <View style={styles.cardRow}>
          <Avatar uri={reveal ? candidate.avatar : undefined} name={displayName} size={52} />
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
  openOnlyLabel: { ...font.caption, color: color.success },

  listContent: { padding: space.lg },
  footer: { paddingVertical: space.lg, alignItems: "center" },
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
