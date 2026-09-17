import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Image, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "../../lib/supabase";
import { color, font, radius, space, type ColorPalette } from "../../lib/theme";
import { useThemedStyles } from "../../lib/theme-provider";
import {
  institutionInitials,
  INSTITUTION_TYPE_LABEL,
  INSTITUTION_VISIBILITY_LABEL,
  type Institution,
  type InstitutionVisibility,
} from "../../lib/institutions";
import { INSTITUTION_CATEGORIES, type InstitutionCategoryTile } from "../../lib/institution-categories";
import { Button, ErrorState, GlassBackButton } from "../../components/ui";
import { useIOSNativeHeader } from "../../lib/useIOSNativeHeader";

// Institution Post Setup -- step 1 of posting into an institution hub.
// Sits between app/institutions/[id].tsx's "Post here" button and the
// existing generic posting wizard (app/(tabs)/post.tsx): it collects the
// two institution-specific decisions (visibility + institution-appropriate
// category) up front, then forwards into the *same* existing post flow via
// its existing institutionId param plus two new ones (category,
// institutionVisibility) that post.tsx consumes to skip re-asking for
// either. No new backend/table/RPC -- reuses institutions, the existing
// categories taxonomy, and listings.institution_id /
// attributes.institution_visibility exactly as already wired up.
const VISIBILITY_OPTIONS: { value: InstitutionVisibility; title: string; description: (name: string) => string; recommended?: boolean }[] = [
  {
    value: "public",
    title: INSTITUTION_VISIBILITY_LABEL.public,
    recommended: true,
    description: (name) => `Appears across all of PaMarket and inside the ${name} hub for maximum reach.`,
  },
  {
    value: "institution_only",
    title: INSTITUTION_VISIBILITY_LABEL.institution_only,
    description: (name) => `Only appears inside the ${name} hub. Hidden from the general PaMarket browse feed.`,
  },
];

export default function InstitutionPostSetupScreen() {
  const { institutionId } = useLocalSearchParams<{ institutionId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const styles = useThemedStyles(buildStyles);

  const [institution, setInstitution] = useState<Institution | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [visibility, setVisibility] = useState<InstitutionVisibility>("public");
  // Tracked by tile index, not categoryId -- two tiles can legitimately
  // point at the same underlying category (e.g. "Textbooks" and
  // "Stationery & Lab" both pre-select "other", refined later by the
  // existing subcategory picker in the post form), so categoryId alone
  // can't tell which tile is selected.
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  useIOSNativeHeader({ backgroundColor: color.brand, tintColor: color.textOnBrand, title: "Create Institution Post" });

  const loadInstitution = useCallback(async () => {
    if (!institutionId) return;
    setIsLoading(true);
    setLoadError(false);
    // Never trust the route param alone -- same defensive re-fetch pattern
    // as app/institutions/[id].tsx and app/(tabs)/post.tsx (RLS already
    // scopes this to is_active=true rows for a non-admin caller).
    const { data, error } = await supabase
      .from("institutions")
      .select("id,type,official_name,short_name,search_aliases,province_id,city_id,suburb,logo_url,description,is_active,sort_order")
      .eq("id", institutionId)
      .eq("is_active", true)
      .maybeSingle();
    if (error) {
      setLoadError(true);
      setIsLoading(false);
      return;
    }
    setInstitution((data as Institution) ?? null);
    setIsLoading(false);
  }, [institutionId]);

  useEffect(() => {
    void loadInstitution();
  }, [loadInstitution]);

  const categories: InstitutionCategoryTile[] = institution ? INSTITUTION_CATEGORIES[institution.type] : [];

  const selectedCategoryId = selectedIndex !== null ? categories[selectedIndex]?.categoryId ?? null : null;

  function handleContinue() {
    if (!institution || !selectedCategoryId) return;
    router.push({
      pathname: "/(tabs)/post",
      params: { institutionId: institution.id, category: selectedCategoryId, institutionVisibility: visibility },
    });
  }

  if (isLoading) {
    return (
      <View style={styles.container}>
        {Platform.OS !== "ios" ? (
          <View style={[styles.backRow, { paddingTop: insets.top + 10 }]}>
            <GlassBackButton onPress={() => router.back()} flat />
          </View>
        ) : null}
        <View style={styles.centered}>
          <ActivityIndicator color={color.brand} />
        </View>
      </View>
    );
  }

  if (loadError || !institution) {
    return (
      <View style={styles.container}>
        {Platform.OS !== "ios" ? (
          <View style={[styles.backRow, { paddingTop: insets.top + 10 }]}>
            <GlassBackButton onPress={() => router.back()} flat />
          </View>
        ) : null}
        <View style={styles.centered}>
          {loadError ? (
            <ErrorState onRetry={() => void loadInstitution()} />
          ) : (
            <Text style={styles.notFoundTitle}>Institution not found</Text>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + space.xxl }]}>
        {Platform.OS !== "ios" ? (
          <View style={[styles.backRow, { paddingTop: insets.top + 10 }]}>
            <GlassBackButton onPress={() => router.back()} flat />
          </View>
        ) : null}

        <View style={styles.institutionCard}>
          <View style={styles.logoWrap}>
            {institution.logo_url ? (
              <Image source={{ uri: institution.logo_url }} style={styles.logo} />
            ) : (
              <Text style={styles.logoInitial}>{institutionInitials(institution.official_name)}</Text>
            )}
          </View>
          <View style={styles.institutionText}>
            <Text style={styles.postingToLabel}>Posting to</Text>
            <Text style={styles.institutionName} numberOfLines={1}>
              {institution.official_name}
            </Text>
            <Text style={styles.institutionType}>{INSTITUTION_TYPE_LABEL[institution.type]}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Where should this post appear?</Text>
          <Text style={styles.sectionSubtitle}>Control your listing's reach across PaMarket and campus audiences.</Text>

          <View style={styles.visibilityList}>
            {VISIBILITY_OPTIONS.map((opt) => {
              const selected = visibility === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  style={[styles.visibilityCard, selected && styles.visibilityCardSelected]}
                  onPress={() => setVisibility(opt.value)}
                >
                  <View style={styles.visibilityHeaderRow}>
                    <View style={[styles.radioOuter, selected && styles.radioOuterSelected]}>
                      {selected ? <View style={styles.radioInner} /> : null}
                    </View>
                    <Text style={styles.visibilityTitle}>{opt.title}</Text>
                    {opt.recommended ? (
                      <View style={styles.recommendedBadge}>
                        <Text style={styles.recommendedBadgeText}>Recommended</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.visibilityDescription}>{opt.description(institution.official_name)}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>What are you posting?</Text>
          <Text style={styles.sectionSubtitle}>
            Select a {institution.type === "high_school" ? "school" : "university"} category to continue.
          </Text>

          <View style={styles.categoryGrid}>
            {categories.map((c, index) => {
              const isSelected = selectedIndex === index;
              return (
                <Pressable
                  key={`${c.categoryId}-${c.label}`}
                  style={[styles.categoryTile, isSelected && styles.categoryTileSelected]}
                  onPress={() => setSelectedIndex(index)}
                >
                  <View style={styles.categoryImageWrap}>
                    <Image source={c.icon} style={styles.categoryImage} />
                  </View>
                  <Text style={styles.categoryLabel} numberOfLines={2}>
                    {c.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + space.md }]}>
        <Button label="Continue" onPress={handleContinue} disabled={!selectedCategoryId} fullWidth />
      </View>
    </View>
  );
}

function buildStyles(color: ColorPalette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: color.bg },
    centered: { flex: 1, alignItems: "center", justifyContent: "center" },
    backRow: { paddingHorizontal: space.lg, paddingBottom: space.sm },
    notFoundTitle: { ...font.title, color: color.text },
    scrollContent: { paddingHorizontal: space.lg, paddingTop: space.md, gap: space.xl },

    institutionCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: space.md,
      backgroundColor: color.brandTint,
      borderRadius: radius.lg,
      padding: space.md,
      borderWidth: 1,
      borderColor: color.border,
    },
    logoWrap: {
      width: 44,
      height: 44,
      borderRadius: radius.md,
      backgroundColor: color.brand,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
    },
    logo: { width: "100%", height: "100%" },
    logoInitial: { ...font.title, color: color.textOnBrand },
    institutionText: { flex: 1, minWidth: 0 },
    postingToLabel: { ...font.micro, color: color.textMuted, textTransform: "uppercase" },
    institutionName: { ...font.title, color: color.text, marginTop: 1 },
    institutionType: { ...font.caption, color: color.textMuted, marginTop: 1 },

    section: { gap: space.sm },
    sectionTitle: { ...font.title, color: color.text },
    sectionSubtitle: { ...font.sub, color: color.textMuted, marginTop: -space.xs },

    visibilityList: { gap: space.sm, marginTop: space.xs },
    visibilityCard: {
      backgroundColor: color.surface,
      borderWidth: 1.5,
      borderColor: color.border,
      borderRadius: radius.lg,
      padding: space.md,
    },
    visibilityCardSelected: {
      borderColor: color.brand,
      backgroundColor: color.brandTint,
    },
    visibilityHeaderRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
    radioOuter: {
      width: 20,
      height: 20,
      borderRadius: radius.pill,
      borderWidth: 2,
      borderColor: color.borderStrong,
      alignItems: "center",
      justifyContent: "center",
    },
    radioOuterSelected: { borderColor: color.brand },
    radioInner: { width: 10, height: 10, borderRadius: radius.pill, backgroundColor: color.brand },
    visibilityTitle: { ...font.bodyStrong, color: color.text, flexShrink: 1 },
    recommendedBadge: {
      backgroundColor: color.goldTint,
      borderRadius: radius.pill,
      paddingHorizontal: space.sm,
      paddingVertical: 2,
      marginLeft: "auto",
    },
    recommendedBadgeText: { ...font.micro, color: color.goldDark },
    visibilityDescription: { ...font.sub, color: color.textMuted, marginTop: space.xs, marginLeft: 28 },

    categoryGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: space.sm,
      marginTop: space.xs,
    },
    categoryTile: {
      width: "47.5%",
      backgroundColor: color.surface,
      borderWidth: 1.5,
      borderColor: color.border,
      borderRadius: radius.lg,
      padding: space.sm,
    },
    categoryTileSelected: {
      borderColor: color.brand,
      backgroundColor: color.brandTint,
    },
    categoryImageWrap: {
      width: "100%",
      aspectRatio: 4 / 3,
      borderRadius: radius.md,
      overflow: "hidden",
      backgroundColor: "#FFFFFF",
      alignItems: "center",
      justifyContent: "center",
    },
    categoryImage: { width: "70%", height: "70%", resizeMode: "contain" },
    categoryLabel: { ...font.caption, color: color.text, marginTop: space.xs, textAlign: "left" },

    footer: {
      paddingHorizontal: space.lg,
      paddingTop: space.md,
      backgroundColor: color.surface,
      borderTopWidth: 1,
      borderTopColor: color.border,
    },
  });
}
