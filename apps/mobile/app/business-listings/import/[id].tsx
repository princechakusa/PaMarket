import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAuth } from "../../../lib/auth";
import { supabase } from "../../../lib/supabase";
import { formatPrice, type Listing } from "../../../lib/listings";
import { planEntitlements } from "../../../lib/plan-entitlements";
import { toast } from "../../../components/ui/Toast";
import { EmptyState } from "../../../components/ui/EmptyState";
import type { ColorPalette } from "../../../lib/theme";
import { useThemedStyles } from "../../../lib/theme-provider";

const LISTING_COLUMNS =
  "id,seller_id,seller_name,title,description,price,currency,category,province,city,suburb,photos,status,attributes";

// Mirrors www/js/business-listings.js pages.BusinessAssignListing — multi
// select personal listings to Copy (duplicate into the business) or Move
// (reassign business_id) into the business catalog.
export default function BusinessImportListingsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const router = useRouter();
  const styles = useThemedStyles(buildStyles);
  const tones = useThemedStyles(buildTones);

  const [available, setAvailable] = useState<Listing[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isApplying, setIsApplying] = useState(false);

  useEffect(() => {
    if (!session?.user) return;
    supabase
      .from("listings")
      .select(LISTING_COLUMNS)
      .eq("seller_id", session.user.id)
      .is("business_id", null)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setAvailable((data as Listing[]) ?? []);
        setIsLoading(false);
      });
  }, [session]);

  const selectedIds = Object.keys(selected).filter((k) => selected[k]);

  function toggle(listingId: string) {
    setSelected((prev) => ({ ...prev, [listingId]: !prev[listingId] }));
  }

  async function apply(mode: "copy" | "move") {
    if (!id || !selectedIds.length) {
      toast("Select at least one product", 3000, true);
      return;
    }
    setIsApplying(true);
    const { data: bizData } = await supabase.from("businesses").select("*").eq("id", id).maybeSingle();
    const limit = planEntitlements((bizData as any)?.plan_id).listingLimit;
    const { count: currentCount } = await supabase
      .from("listings")
      .select("id", { count: "exact", head: true })
      .eq("business_id", id);
    if (limit >= 0 && (currentCount ?? 0) + selectedIds.length > limit) {
      setIsApplying(false);
      toast("That exceeds your plan listing limit", 3000, true);
      return;
    }

    for (const listingId of selectedIds) {
      const listing = available.find((l) => l.id === listingId);
      if (!listing) continue;
      if (mode === "copy") {
        const { id: _omit, created_at: _omit2, ...rest } = listing as any;
        await supabase.from("listings").insert({ ...rest, business_id: id, views: 0 });
      } else {
        await supabase.from("listings").update({ business_id: id }).eq("id", listingId);
      }
    }
    setIsApplying(false);
    toast(mode === "copy" ? `${selectedIds.length} product(s) copied` : `${selectedIds.length} product(s) moved`);
    router.replace({ pathname: "/business-listings/[id]", params: { id: id! } });
  }

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={tones.brand} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        <Text style={styles.intro}>Select products from your personal marketplace to add to this business.</Text>
        {available.length ? (
          available.map((l) => {
            const isSelected = !!selected[l.id];
            return (
              <Pressable
                key={l.id}
                style={[styles.row, isSelected && styles.rowSelected]}
                onPress={() => toggle(l.id)}
              >
                <View style={[styles.checkbox, isSelected && styles.checkboxOn]}>
                  {isSelected ? <Text style={styles.checkmark}>✓</Text> : null}
                </View>
                <View style={styles.thumbWrap}>
                  {l.photos?.[0] ? (
                    <Image source={{ uri: l.photos[0] }} style={styles.thumb} contentFit="cover" transition={150} cachePolicy="memory-disk" />
                  ) : (
                    <View style={styles.thumb} />
                  )}
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.title} numberOfLines={1}>
                    {l.title || "Untitled"}
                  </Text>
                  <Text style={styles.price}>{formatPrice(l)}</Text>
                </View>
              </Pressable>
            );
          })
        ) : (
          <EmptyState title="Nothing to import" subtitle="You have no personal listings available. Use Create new business product instead." />
        )}
      </ScrollView>

      {available.length ? (
        <View style={styles.footer}>
          <Pressable style={[styles.footerButton, styles.copyButton]} onPress={() => apply("copy")} disabled={isApplying}>
            <Text style={styles.copyButtonText}>Copy {selectedIds.length}</Text>
          </Pressable>
          <Pressable style={[styles.footerButton, styles.moveButton]} onPress={() => apply("move")} disabled={isApplying}>
            <Text style={styles.moveButtonText}>Move {selectedIds.length}</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function buildTones(color: ColorPalette) {
  return { brand: color.brand };
}

function buildStyles(color: ColorPalette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: color.bg },
    centered: { flex: 1, alignItems: "center", justifyContent: "center" },
    intro: { fontSize: 13, color: color.textSub, marginBottom: 14 },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 11,
      backgroundColor: color.surface,
      borderWidth: 1.5,
      borderColor: color.border,
      borderRadius: 13,
      padding: 11,
      marginBottom: 9,
    },
    rowSelected: { backgroundColor: color.brandTint, borderColor: color.brand },
    checkbox: {
      width: 22,
      height: 22,
      borderRadius: 7,
      borderWidth: 2,
      borderColor: color.borderStrong,
      alignItems: "center",
      justifyContent: "center",
    },
    checkboxOn: { backgroundColor: color.brand, borderColor: color.brand },
    checkmark: { color: color.textOnBrand, fontSize: 13, fontWeight: "800" },
    thumbWrap: { width: 46, height: 46, borderRadius: 9, overflow: "hidden", backgroundColor: color.brandTint },
    thumb: { width: "100%", height: "100%" },
    title: { fontSize: 13.5, fontWeight: "700", color: color.text },
    price: { fontSize: 12.5, fontWeight: "800", color: color.brand, marginTop: 2 },
    footer: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      flexDirection: "row",
      gap: 9,
      backgroundColor: color.surface,
      borderTopWidth: 1,
      borderTopColor: color.border,
      padding: 12,
    },
    footerButton: { flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: "center" },
    copyButton: { backgroundColor: color.brandTint },
    copyButtonText: { color: color.brand, fontSize: 13.5, fontWeight: "800" },
    moveButton: { backgroundColor: color.brand },
    moveButtonText: { color: color.textOnBrand, fontSize: 13.5, fontWeight: "800" },
  });
}
