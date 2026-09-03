import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Line } from "react-native-svg";
import { supabase } from "../../lib/supabase";
import { color, font, radius, shadow, space, type ColorPalette } from "../../lib/theme";
import { useThemedStyles } from "../../lib/theme-provider";
import { jobCompany, jobSalary, jobType, JOB_TYPES } from "../../lib/jobs";
import { businessInitials } from "../../lib/businesses";
import { Badge, Chip, EmptyState, ErrorState, GlassBackButton, ListingRowSkeleton } from "../../components/ui";
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
  const [jobs, setJobs] = useState<JobListing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [showingCached, setShowingCached] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const pageRef = useRef(0);

  useIOSNativeHeader({ backgroundColor: color.brand, tintColor: color.textOnBrand, title: "Jobs" });

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
      return supabase.rpc("search_active_jobs", {
        p_query: debouncedQuery || null,
        p_job_type: typeFilter === "all" ? null : typeFilter,
        p_limit: to - from + 1,
        p_offset: from,
      });
    },
    [debouncedQuery, typeFilter]
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

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: Platform.OS === "ios" ? space.md : insets.top + 10 }]}>
        {Platform.OS !== "ios" ? (
          <View style={styles.headerRow}>
            <GlassBackButton onPress={() => router.back()} tone="light" flat />
            <Text style={styles.headerTitle}>Jobs</Text>
            <View style={{ width: 20 }} />
          </View>
        ) : null}
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
          renderItem={({ item }) => {
            const company = jobCompany(item.description, item.seller_name);
            const type = jobType(item.description);
            const salary = jobSalary(item.description);
            const location = [item.city, item.province].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(", ");
            return (
              <Pressable
                style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
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
                    {location ? <Badge label={location} tone="neutral" /> : null}
                  </View>
                  <View style={styles.metaRow}>
                    <Text style={styles.salary}>{salary}</Text>
                    <Text style={styles.time}>{timeAgo(item.created_at)}</Text>
                  </View>
                </View>
              </Pressable>
            );
          }}
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
