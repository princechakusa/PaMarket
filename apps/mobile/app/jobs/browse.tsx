import { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, Image, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Line, Polyline } from "react-native-svg";
import { supabase } from "../../lib/supabase";
import { color, font, radius, shadow, space, type ColorPalette } from "../../lib/theme";
import { useThemedStyles } from "../../lib/theme-provider";
import { jobCompany, jobSalary, jobType, JOB_TYPES } from "../../lib/jobs";
import { businessInitials } from "../../lib/businesses";
import { Badge, Chip, EmptyState, ErrorState, ListingRowSkeleton } from "../../components/ui";

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
  const [hasError, setHasError] = useState(false);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const load = useCallback(async () => {
    setHasError(false);
    const { data, error } = await supabase
      .from("listings")
      .select(JOB_COLUMNS)
      .eq("category", "jobs")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) {
      setHasError(true);
      return;
    }
    setJobs((data as JobListing[]) ?? []);
  }, []);

  useEffect(() => {
    setIsLoading(true);
    load().finally(() => setIsLoading(false));
  }, [load]);

  const filtered = useMemo(() => {
    let list = jobs;
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter((j) => {
        const company = jobCompany(j.description, j.seller_name);
        return [j.title, company, j.city || "", j.province || ""].join(" ").toLowerCase().includes(q);
      });
    }
    if (typeFilter !== "all") {
      list = list.filter((j) => jobType(j.description) === typeFilter);
    }
    return list;
  }, [jobs, query, typeFilter]);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <BackIcon />
          </Pressable>
          <Text style={styles.headerTitle}>Jobs</Text>
          <View style={{ width: 20 }} />
        </View>
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
      ) : hasError ? (
        <ErrorState onRetry={() => { setIsLoading(true); load().finally(() => setIsLoading(false)); }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={{ height: space.md }} />}
          ListHeaderComponent={
            filtered.length ? (
              <Text style={styles.countText}>
                {filtered.length} open {filtered.length === 1 ? "role" : "roles"}
              </Text>
            ) : null
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
                    <Image source={{ uri: item.photos[0] }} style={styles.logo} />
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
  listContent: { padding: space.lg, paddingBottom: space.huge },
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
