import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { useLocalSearchParams } from "expo-router";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import { isFeatured, type Listing } from "../../lib/listings";
import { planEntitlements } from "../../lib/plan-entitlements";
import { toast } from "../../components/ui/Toast";
import { EmptyState } from "../../components/ui/EmptyState";
import type { ColorPalette } from "../../lib/theme";
import { useThemedStyles } from "../../lib/theme-provider";

const DAY = 86400000;
const DURATIONS: [number, string][] = [
  [7, "7 days"],
  [14, "14 days"],
  [30, "30 days"],
];

// Mirrors www/js/business-featured.js pages.BusinessFeatured — time-based
// boosts drawn from the plan's free featured-slot allowance. Buying extra
// slot packs is a Google Play Billing consumable purchase, out of scope
// (deferred alongside billing.js) — this screen only manages the plan's
// included slots.
export default function BusinessFeaturedScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const styles = useThemedStyles(buildStyles);
  const tones = useThemedStyles(buildTones);

  const [isOwner, setIsOwner] = useState<boolean | null>(null);
  const [slots, setSlots] = useState(0);
  const [listings, setListings] = useState<Listing[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id || !session?.user) return;
    const { data: biz } = await supabase.from("businesses").select("*").eq("id", id).maybeSingle();
    if (!biz || biz.owner_user_id !== session.user.id) {
      setIsOwner(false);
      return;
    }
    setIsOwner(true);
    setSlots(planEntitlements((biz as any).plan_id).featuredSlots);
    const { data: rows } = await supabase
      .from("listings")
      .select("id,title,photos,boost,featured_until")
      .eq("business_id", id);
    setListings((rows as any[]) ?? []);
  }, [id, session]);

  useEffect(() => {
    setIsLoading(true);
    load().finally(() => setIsLoading(false));
  }, [load]);

  const used = useMemo(() => listings.filter((l) => isFeatured(l as any)).length, [listings]);
  const slotLabel = slots === Infinity ? "∞" : String(slots);
  const noSlots = slots === 0;
  const atCapacity = slots !== Infinity && used >= slots;

  async function boost(listingId: string, days: number) {
    if (atCapacity) {
      toast("No featured slots left — upgrade your plan for more", 3000, true);
      return;
    }
    const until = new Date(Date.now() + days * DAY).toISOString();
    await supabase.from("listings").update({ boost: true, featured_until: until }).eq("id", listingId);
    setListings((prev) => prev.map((l) => (l.id === listingId ? { ...l, boost: true, featured_until: until } as any : l)));
    toast(`Boosted for ${days} days`);
  }

  async function unboost(listingId: string) {
    await supabase.from("listings").update({ boost: false, featured_until: null }).eq("id", listingId);
    setListings((prev) => prev.map((l) => (l.id === listingId ? { ...l, boost: false, featured_until: null } as any : l)));
    toast("Boost removed");
  }

  if (isLoading || isOwner === null) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={tones.brand} />
      </View>
    );
  }

  if (!isOwner) {
    return (
      <View style={styles.centered}>
        <EmptyState title="Owner only" subtitle="Only the owner can boost listings." />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <View style={styles.hero}>
        <Text style={styles.heroLabel}>FEATURED SLOTS</Text>
        <Text style={styles.heroCount}>
          {used} <Text style={styles.heroCountSub}>/ {slotLabel} used</Text>
        </Text>
        {noSlots ? <Text style={styles.heroSub}>Your plan has no featured slots. Upgrade to Pro or Premium for boosts.</Text> : null}
      </View>

      {listings.length ? (
        <>
          <Text style={styles.sectionTitle}>Your listings</Text>
          {listings.map((l) => {
            const feat = isFeatured(l as any);
            const featuredUntil = (l as any).featured_until as string | null;
            const daysLeft = feat && featuredUntil ? Math.max(1, Math.ceil((new Date(featuredUntil).getTime() - Date.now()) / DAY)) : 0;
            return (
              <View key={l.id} style={[styles.card, feat && styles.cardFeatured]}>
                <View style={styles.cardTop}>
                  <View style={styles.thumbWrap}>
                    {l.photos?.[0] ? (
                      <Image source={{ uri: l.photos[0] }} style={styles.thumb} contentFit="cover" cachePolicy="memory-disk" />
                    ) : (
                      <View style={styles.thumb} />
                    )}
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.title} numberOfLines={1}>
                      {l.title || "Untitled"}
                    </Text>
                    <Text style={feat ? styles.featuredText : styles.notFeaturedText}>
                      {feat ? `Featured · ${daysLeft}d left` : "Not featured"}
                    </Text>
                  </View>
                </View>
                {feat ? (
                  <Pressable style={styles.removeButton} onPress={() => unboost(l.id)}>
                    <Text style={styles.removeButtonText}>Remove boost</Text>
                  </Pressable>
                ) : (
                  <View style={styles.durationRow}>
                    {DURATIONS.map(([days, label]) => (
                      <Pressable
                        key={days}
                        style={[styles.durationButton, atCapacity && styles.buttonDisabled]}
                        onPress={() => boost(l.id, days)}
                        disabled={atCapacity}
                      >
                        <Text style={styles.durationButtonText}>{label}</Text>
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>
            );
          })}
        </>
      ) : (
        <Text style={styles.emptyText}>Add a listing to this business to start featuring it.</Text>
      )}
    </ScrollView>
  );
}

function buildTones(color: ColorPalette) {
  return { brand: color.brand };
}

function buildStyles(color: ColorPalette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: color.bg },
    centered: { flex: 1, alignItems: "center", justifyContent: "center" },
    hero: { backgroundColor: color.surface, borderRadius: 16, padding: 18, marginBottom: 16 },
    heroLabel: { fontSize: 11, fontWeight: "800", color: color.textMuted, letterSpacing: 0.5 },
    heroCount: { fontSize: 26, fontWeight: "900", color: color.text, marginTop: 6 },
    heroCountSub: { fontSize: 14, fontWeight: "500", color: color.textMuted },
    heroSub: { fontSize: 12.5, color: color.textMuted, marginTop: 8, lineHeight: 18 },
    sectionTitle: { fontSize: 12, fontWeight: "800", color: color.textMuted, marginBottom: 10, textTransform: "uppercase" },
    card: { backgroundColor: color.surface, borderWidth: 1, borderColor: color.border, borderRadius: 14, padding: 12, marginBottom: 10 },
    cardFeatured: { borderColor: color.brand },
    cardTop: { flexDirection: "row", gap: 12, alignItems: "center" },
    thumbWrap: { width: 50, height: 50, borderRadius: 10, overflow: "hidden", backgroundColor: color.brandTint },
    thumb: { width: "100%", height: "100%" },
    title: { fontSize: 14, fontWeight: "700", color: color.text },
    featuredText: { fontSize: 11.5, fontWeight: "700", color: color.brand, marginTop: 3 },
    notFeaturedText: { fontSize: 11.5, color: color.textMuted, marginTop: 3 },
    removeButton: { marginTop: 10, paddingVertical: 9, borderRadius: 10, borderWidth: 1, borderColor: color.border, alignItems: "center" },
    removeButtonText: { fontSize: 12.5, fontWeight: "700", color: color.textMuted },
    durationRow: { flexDirection: "row", gap: 8, marginTop: 10 },
    durationButton: { flex: 1, paddingVertical: 9, borderRadius: 10, backgroundColor: color.brand, alignItems: "center" },
    buttonDisabled: { opacity: 0.5 },
    durationButtonText: { fontSize: 12, fontWeight: "700", color: color.textOnBrand },
    emptyText: { textAlign: "center", color: color.textMuted, fontSize: 12.5, padding: 22 },
  });
}
