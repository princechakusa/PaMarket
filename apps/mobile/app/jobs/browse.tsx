import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Line } from "react-native-svg";
import { supabase } from "../../lib/supabase";
import { color, font, radius, shadow, space, type ColorPalette } from "../../lib/theme";
import { useThemedStyles } from "../../lib/theme-provider";
import { jobCompany, jobSalary, jobType, JOB_TYPES, fetchRecommendedJobs, type RecommendedJob } from "../../lib/jobs";
import { useAuth } from "../../lib/auth";

const REMOTE_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "Any location" },
  { value: "on_site", label: "On-site" },
  { value: "hybrid", label: "Hybrid" },
  { value: "remote", label: "Remote" },
];
import { businessInitials } from "../../lib/businesses";
import { Badge, Chip, EmptyState, ErrorState, ListingRowSkeleton } from "../../components/ui";
import { loadCache, saveCache } from "../../lib/offlineCache";
import { useIOSNativeHeader } from "../../lib/useIOSNativeHeader";

const JOBS_CACHE_KEY = "jobs-browse";

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
  expires_at: string | null;
  // Present only once the Jobs Reconstruction search RPC is live; null on
  // any row without a job_postings entry (legacy row, or migration not
  // yet applied) — the renderer below falls back to legacy description
  // parsing for any of these that come back null.
  job_type_label?: string | null;
  industry_label?: string | null;
  salary_min?: number | null;
  salary_max?: number | null;
  salary_currency?: string | null;
  salary_negotiable?: boolean | null;
  remote_type?: string | null;
};

const PAGE_SIZE = 30;

function SearchIcon() {
  return (
    <Svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke={color.textOnBrandSub} strokeWidth={2.4}>
      <Circle cx={11} cy={11} r={8} />
      <Line x1={21} y1={21} x2={16.65} y2={16.65} />
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

export default function JobsListScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const styles = useThemedStyles(buildStyles);
  const { session } = useAuth();
  const [jobs, setJobs] = useState<JobListing[]>([]);
  const [recommendations, setRecommendations] = useState<JobListing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [showingCached, setShowingCached] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [remoteFilter, setRemoteFilter] = useState<string>("all");
  const pageRef = useRef(0);

  useIOSNativeHeader({
    backgroundColor: color.brand,
    tintColor: color.textOnBrand,
    title: "Jobs",
    androidNative: true,
    headerRight: () => (
      <Pressable onPress={() => router.push("/jobs/alerts")} hitSlop={10}>
        <Text style={styles.headerLink}>Alerts</Text>
      </Pressable>
    ),
  });

  // Debounced so search runs server-side (title + description) instead of
  // firing a request per keystroke or, worse, only ever filtering whatever
  // page of jobs happened to already be loaded client-side — the previous
  // behavior meant a real match on page 3 was invisible to a search typed
  // while only page 1 had loaded.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const buildQuery = useCallback(
    (from: number, to: number) => {
      const base = {
        p_query: debouncedQuery || null,
        p_job_type: typeFilter === "all" ? null : typeFilter,
        p_limit: to - from + 1,
        p_offset: from,
      };
      // search_active_jobs still has only these 4 params live until
      // migration 3 is applied — sending p_remote_type today makes
      // PostgREST fail to match the function signature at all (not just
      // ignore the extra param), breaking every job search. Try the
      // extended call first; on a "no matching function" error, retry with
      // exactly the original signature so browse keeps working right now
      // and upgrades automatically once the migration lands.
      return supabase
        .rpc("search_active_jobs", {
          ...base,
          p_remote_type: remoteFilter === "all" ? null : remoteFilter,
        })
        .then((result) => {
          if (result.error && /PGRST202|Could not find the function/i.test(result.error.message || "")) {
            return supabase.rpc("search_active_jobs", base);
          }
          return result;
        });
    },
    [debouncedQuery, typeFilter, remoteFilter]
  );

  const load = useCallback(async () => {
    setHasError(false);
    pageRef.current = 0;
    const { data, error } = await buildQuery(0, PAGE_SIZE - 1);
    if (error) {
      setHasError(true);
      return;
    }
    const page = (data as JobListing[]) ?? [];
    setJobs(page);
    setShowingCached(false);
    setHasMore(page.length === PAGE_SIZE);
    saveCache<JobListing[]>(JOBS_CACHE_KEY, page);
  }, [buildQuery]);

  useEffect(() => {
    let cancelled = false;
    loadCache<JobListing[]>(JOBS_CACHE_KEY).then((cached) => {
      if (cancelled || !cached || !cached.length) return;
      const now = Date.now();
      const eligible = cached.filter((job) =>
        !!job.expires_at && new Date(job.expires_at).getTime() > now
      );
      setJobs((current) => (current.length ? current : eligible));
      setShowingCached(true);
      setIsLoading(false);
    });
    setIsLoading(true);
    load().finally(() => setIsLoading(false));
    return () => {
      cancelled = true;
    };
  }, [load]);

  // "Recommended for you" — thin fetch over recommend_jobs_for_me() (see
  // lib/jobs.ts), not a second recommendation engine; all the scoring
  // happens in that RPC against the seeker's own preferred_* profile
  // fields. Only fetched when signed in (matches the RPC's own
  // "return nothing for an anonymous caller" behavior, just without the
  // wasted round trip); fails/empties silently — this is an enhancement
  // to the browse screen, not a state it should ever block or error on.
  useEffect(() => {
    if (!session?.user) {
      setRecommendations([]);
      return;
    }
    let cancelled = false;
    fetchRecommendedJobs(10).then((rows) => {
      if (cancelled) return;
      setRecommendations(
        rows.map((r: RecommendedJob) => ({
          id: r.id,
          seller_id: "",
          seller_name: r.seller_name,
          title: r.title,
          description: null,
          city: r.city,
          province: r.province,
          photos: null,
          created_at: "",
          expires_at: null,
          job_type_label: r.job_type_label,
          industry_label: r.industry_label,
          salary_min: r.salary_min,
          salary_max: r.salary_max,
          salary_currency: r.salary_currency,
          salary_negotiable: false,
          remote_type: r.remote_type,
        }))
      );
    });
    return () => {
      cancelled = true;
    };
  }, [session?.user?.id]);

  const loadMore = useCallback(async () => {
    if (isLoadingMore || isLoading || !hasMore || hasError) return;
    setIsLoadingMore(true);
    const nextPage = pageRef.current + 1;
    const from = nextPage * PAGE_SIZE;
    const { data, error } = await buildQuery(from, from + PAGE_SIZE - 1);
    if (!error) {
      const page = (data as JobListing[]) ?? [];
      pageRef.current = nextPage;
      // Same offset-pagination-under-concurrent-inserts guard as
      // app/(tabs)/search.tsx's loadMore — see that file for the full
      // explanation. Duplicate ids in the FlatList's data (its
      // keyExtractor) crash Fabric's view mounting on Android.
      setJobs((prev) => {
        const existingIds = new Set(prev.map((j) => j.id));
        return [...prev, ...page.filter((j) => !existingIds.has(j.id))];
      });
      setHasMore(page.length === PAGE_SIZE);
    }
    setIsLoadingMore(false);
  }, [buildQuery, hasMore, isLoading, isLoadingMore, hasError]);

  // Shared by the main list and the "Recommended for you" row below — one
  // card renderer, not a duplicate copy, so a recommended job navigates and
  // looks identical to the same job found any other way.
  function renderJobCard(item: JobListing, cardStyle?: object) {
    const company = jobCompany(item.description, item.seller_name);
    const type = item.job_type_label ?? jobType(item.description);
    const salary = item.salary_negotiable
      ? "Negotiable"
      : item.salary_min != null
        ? `${item.salary_currency ?? ""} ${item.salary_min}${item.salary_max && item.salary_max !== item.salary_min ? ` - ${item.salary_max}` : ""}`.trim()
        : jobSalary(item.description);
    const location = [item.city, item.province].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(", ");
    return (
      <Pressable
        style={({ pressed }) => [styles.card, cardStyle, pressed && styles.cardPressed]}
        onPress={() => router.push({ pathname: "/jobs/[id]", params: { id: item.id } })}
      >
        <View style={styles.logoWrap}>
          {item.photos?.[0] ? (
            <Image source={{ uri: item.photos[0] }} style={styles.logo} contentFit="cover" cachePolicy="memory-disk" />
          ) : (
            <Text style={styles.logoInitial}>{businessInitials(company)}</Text>
          )}
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.title} numberOfLines={2}>
            {item.title}
          </Text>
          <Text style={styles.company} numberOfLines={1}>
            {company}
          </Text>
          <View style={styles.chipRow}>
            {type ? <Badge label={type} tone="brand" /> : null}
            {item.industry_label ? <Badge label={item.industry_label} tone="neutral" /> : null}
            {item.remote_type ? (
              <Badge label={item.remote_type === "on_site" ? "On-site" : item.remote_type === "hybrid" ? "Hybrid" : "Remote"} tone="neutral" />
            ) : null}
            {location ? <Badge label={location} tone="neutral" /> : null}
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.salary}>{salary}</Text>
            {item.created_at ? <Text style={styles.time}>{timeAgo(item.created_at)}</Text> : null}
          </View>
        </View>
      </Pressable>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: Platform.OS === "ios" ? space.md : insets.top + 10 }]}>
        <View style={styles.searchBar}>
          <SearchIcon />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Search jobs, companies, locations…"
            placeholderTextColor={color.textOnBrandSub}
            returnKeyType="search"
          />
        </View>
      </View>

      <View style={styles.filterRow}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={["all", ...JOB_TYPES]}
          keyExtractor={(item) => item}
          contentContainerStyle={styles.filterContent}
          renderItem={({ item }) => (
            <Chip
              label={item === "all" ? "All jobs" : item}
              active={typeFilter === item}
              onPress={() => setTypeFilter(item)}
            />
          )}
        />
      </View>

      <View style={styles.filterRow}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={REMOTE_FILTER_OPTIONS}
          keyExtractor={(item) => item.value}
          contentContainerStyle={styles.filterContent}
          renderItem={({ item }) => (
            <Chip label={item.label} active={remoteFilter === item.value} onPress={() => setRemoteFilter(item.value)} />
          )}
        />
      </View>

      {isLoading ? (
        <View style={styles.listContent}>
          {Array.from({ length: 6 }).map((_, i) => (
            <View key={i} style={{ marginBottom: space.md }}>
              <ListingRowSkeleton />
            </View>
          ))}
        </View>
      ) : hasError && !jobs.length ? (
        <ErrorState onRetry={() => { setIsLoading(true); load().finally(() => setIsLoading(false)); }} />
      ) : (
        <FlatList
          data={jobs}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={{ height: space.md }} />}
          ListHeaderComponent={
            <>
              {recommendations.length ? (
                <View style={styles.recommendedSection}>
                  <Text style={styles.recommendedTitle}>Recommended for you</Text>
                  <FlatList
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    data={recommendations}
                    keyExtractor={(item) => `rec-${item.id}`}
                    contentContainerStyle={styles.recommendedContent}
                    renderItem={({ item }) => renderJobCard(item, styles.recommendedCard)}
                  />
                </View>
              ) : null}
              {hasError ? (
                <View style={styles.offlineBanner}>
                  <Text style={styles.offlineBannerText}>
                    {showingCached ? "You're offline — showing your last saved jobs." : "Couldn't refresh — showing what we last loaded."}
                  </Text>
                </View>
              ) : null}
              {jobs.length ? (
                <Text style={styles.countText}>
                  {jobs.length} open {jobs.length === 1 ? "role" : "roles"}
                </Text>
              ) : null}
            </>
          }
          ListEmptyComponent={
            <EmptyState
              title={query || typeFilter !== "all" ? "No matching jobs" : "No jobs posted yet"}
              subtitle={
                query || typeFilter !== "all"
                  ? "Try a different search or clear your filters."
                  : "New roles are posted every day — check back soon."
              }
            />
          }
          renderItem={({ item }) => renderJobCard(item)}
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

function buildStyles(color: ColorPalette) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: color.bg },
  header: {
    backgroundColor: color.brand,
    paddingHorizontal: space.lg,
    paddingBottom: space.md,
    gap: space.md,
  },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerTitle: { ...font.title, color: color.textOnBrand },
  headerLink: { fontSize: 13, fontWeight: "700", color: color.textOnBrand },
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
  filterRow: {
    backgroundColor: color.surface,
    borderBottomWidth: 1,
    borderBottomColor: color.border,
    paddingVertical: space.md,
  },
  filterContent: { paddingHorizontal: space.lg, gap: space.sm },
  recommendedSection: { marginBottom: space.lg },
  recommendedTitle: { ...font.title, color: color.text, marginBottom: space.sm },
  recommendedContent: { gap: space.md, paddingRight: space.lg },
  recommendedCard: { width: 280 },
  countText: { ...font.caption, color: color.textMuted, marginBottom: space.md },
  offlineBanner: {
    marginBottom: space.md,
    backgroundColor: color.goldTint,
    borderRadius: radius.md,
    padding: space.md,
  },
  offlineBannerText: { ...font.sub, color: color.text, fontWeight: "600" },
  listContent: { padding: space.lg, paddingBottom: space.huge },
  footer: { paddingVertical: space.lg, alignItems: "center" },
  card: {
    flexDirection: "row",
    gap: space.md,
    backgroundColor: color.surface,
    borderRadius: radius.lg,
    padding: space.lg,
    borderWidth: 1,
    borderColor: color.border,
    ...shadow.sm,
  },
  cardPressed: { opacity: 0.9, transform: [{ scale: 0.995 }] },
  logoWrap: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    backgroundColor: color.brandTint,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    flexShrink: 0,
  },
  logo: { width: "100%", height: "100%" },
  logoInitial: { ...font.h3, color: color.brand },
  cardBody: { flex: 1, gap: space.xs, minWidth: 0 },
  title: { ...font.title, color: color.text },
  company: { ...font.sub, color: color.textSub },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: space.xs, marginTop: space.xxs },
  metaRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: space.xs },
  salary: { ...font.bodyStrong, color: color.success },
  time: { ...font.caption, color: color.textMuted },
  });
}
