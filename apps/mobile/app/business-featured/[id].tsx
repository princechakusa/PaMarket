import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import { useLocalSearchParams } from "expo-router";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import { isFeatured, type Listing } from "../../lib/listings";
import { planEntitlements } from "../../lib/plan-entitlements";
import { SLOT_PACK_PRODUCTS } from "../../lib/billing-products";
import { purchaseProduct } from "../../lib/iap";
import { useStoreProducts } from "../../lib/use-store-products";
import { StoreProductOption } from "../../components/StoreProductOption";
import { toast } from "../../components/ui/Toast";
import { EmptyState } from "../../components/ui/EmptyState";
import type { ColorPalette } from "../../lib/theme";
import { useThemedStyles } from "../../lib/theme-provider";

const DAY = 86400000;
const SLOT_PACK_PRODUCT_IDS = Object.keys(SLOT_PACK_PRODUCTS);

// How long a listing stays featured once a slot is applied. The server caps
// this at 31 days (FEATURE_DURATION_LIMIT in enforce_listing_feature_
// entitlement), so 30 is the longest safe value.
//
// This screen used to offer 7/14/30-day buttons, which was misleading: a slot
// is a *concurrency* limit, not a duration currency. The server counts how
// many listings currently have featured_until > now() and compares that to
// the plan allowance plus purchased packs — duration never enters the check,
// so every duration cost exactly the same (nothing) and a rational user would
// always pick 30. The choice was strictly worse value for no price
// difference, so it's gone; a slot now always runs the full term and is
// released the moment it expires or the owner frees it.
const FEATURE_DAYS = 30;

// Featured slots = the plan's allowance (biz_plan_featured_slots: pro 1,
// premium 3, else 0) plus any extra slots bought as a consumable
// (featured_slot_packs rows with status='consumed'). Both halves are summed
// the same way by the server trigger, so this render-time sum mirrors what
// the database will actually allow.
export default function BusinessFeaturedScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const styles = useThemedStyles(buildStyles);
  const tones = useThemedStyles(buildTones);

  const [isOwner, setIsOwner] = useState<boolean | null>(null);
  const [slots, setSlots] = useState(0);
  const [listings, setListings] = useState<Listing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [slotPickerOpen, setSlotPickerOpen] = useState(false);
  const [busyListingId, setBusyListingId] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const [purchasingSlotPack, setPurchasingSlotPack] = useState<string | null>(
    null
  );
  const {
    prices: slotPackPrices,
    availableProductIds: availableSlotPackIds,
    isLoading: isLoadingSlotPacks,
    error: slotPackError,
    retry: retrySlotPacks,
  } = useStoreProducts(SLOT_PACK_PRODUCT_IDS, "consumable");

  const load = useCallback(async () => {
    if (!id || !session?.user) return;
    const { data: biz } = await supabase
      .from("businesses")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (!biz || biz.owner_user_id !== session.user.id) {
      setIsOwner(false);
      return;
    }
    setIsOwner(true);
    const baseline = planEntitlements((biz as any).plan_id).featuredSlots;
    const [{ data: rows }, { data: packs }] = await Promise.all([
      supabase
        .from("listings")
        .select("id,title,photos,boost,featured_until")
        .eq("business_id", id)
        .order("created_at", { ascending: false })
        .limit(500),
      supabase
        .from("featured_slot_packs")
        .select("extra_slots")
        .eq("business_id", id)
        .eq("status", "consumed")
        .limit(500),
    ]);
    const extra =
      (packs as { extra_slots: number }[] | null)?.reduce(
        (sum, p) => sum + p.extra_slots,
        0
      ) ?? 0;
    setSlots(baseline + extra);
    setListings((rows as any[]) ?? []);
  }, [id, session]);

  async function buySlotPack(productId: string) {
    if (!id) return;
    if (!availableSlotPackIds.includes(productId)) {
      toast(
        "This slot pack is unavailable from the store. Retry loading prices."
      );
      return;
    }
    setPurchasingSlotPack(productId);
    try {
      const result = await purchaseProduct(productId, { businessId: id });
      if (result.ok) {
        setSlotPickerOpen(false);
        toast("Featured slots added!");
        load();
      } else if (result.code === "user-cancelled") {
        toast("Purchase cancelled");
      } else {
        toast(result.error);
      }
    } finally {
      setPurchasingSlotPack(null);
    }
  }

  useEffect(() => {
    setIsLoading(true);
    load().finally(() => setIsLoading(false));
  }, [load]);

  // "BEST VALUE" is derived from the real StoreKit prices rather than
  // hardcoded to the 3-pack, so the badge always reflects the price the store
  // actually charges and can never claim a saving that doesn't exist. If the
  // two packs are ever priced identically per slot, no badge is shown at all.
  const bestValueProductId = useMemo(() => {
    const perSlot = Object.entries(SLOT_PACK_PRODUCTS)
      .map(([productId, p]) => {
        const amount = parseStorePrice(slotPackPrices[productId]);
        return amount === null
          ? null
          : { productId, unit: amount / p.extraSlots };
      })
      .filter((x): x is { productId: string; unit: number } => x !== null);
    if (perSlot.length < 2) return null;
    const sorted = [...perSlot].sort((a, b) => a.unit - b.unit);
    // Require a real margin — equal prices must not earn the badge.
    return sorted[0].unit < sorted[1].unit ? sorted[0].productId : null;
  }, [slotPackPrices]);

  const used = useMemo(
    () => listings.filter((l) => isFeatured(l as any)).length,
    [listings]
  );
  const slotLabel = slots === Infinity ? "∞" : String(slots);
  const noSlots = slots === 0;
  const atCapacity = slots !== Infinity && used >= slots;
  const available =
    slots === Infinity ? "∞" : String(Math.max(0, slots - used));

  // The purchase options live in the hero at the top, so opening them from a
  // listing card further down would leave the user staring at an unchanged
  // screen. Scroll back up so the packs are actually visible.
  function openSlotPurchase() {
    setSlotPickerOpen(true);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }

  async function featureListing(listingId: string) {
    if (atCapacity) {
      toast(
        slots === 0
          ? "You have no featured slots. Buy a slot pack or upgrade your plan."
          : `All ${slots} of your featured slots are in use. Free one up or buy more.`,
        3500,
        true
      );
      return;
    }
    const until = new Date(Date.now() + FEATURE_DAYS * DAY).toISOString();
    setBusyListingId(listingId);
    try {
      // The server re-checks the slot allowance in a trigger, so this can
      // legitimately fail (NO_FEATURED_SLOTS) even when the local count looks
      // fine — e.g. a slot was taken on another device. Surface it instead of
      // silently leaving the row unchanged, which is what this screen used to
      // do by ignoring the error entirely.
      const { error } = await supabase
        .from("listings")
        .update({ boost: true, featured_until: until })
        .eq("id", listingId);
      if (error) {
        toast(featureErrorMessage(error.message), 3500, true);
        load();
        return;
      }
      setListings((prev) =>
        prev.map((l) =>
          l.id === listingId
            ? ({ ...l, boost: true, featured_until: until } as any)
            : l
        )
      );
      toast(`Featured for ${FEATURE_DAYS} days`);
    } finally {
      setBusyListingId(null);
    }
  }

  async function unfeatureListing(listingId: string) {
    setBusyListingId(listingId);
    try {
      const { error } = await supabase
        .from("listings")
        .update({ boost: false, featured_until: null })
        .eq("id", listingId);
      if (error) {
        toast("Could not free that slot. Try again.", 3000, true);
        return;
      }
      setListings((prev) =>
        prev.map((l) =>
          l.id === listingId
            ? ({ ...l, boost: false, featured_until: null } as any)
            : l
        )
      );
      toast("Slot freed — you can feature another listing");
    } finally {
      setBusyListingId(null);
    }
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
        <EmptyState
          title="Owner only"
          subtitle="Only the business owner can feature listings."
        />
      </View>
    );
  }

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.container}
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
    >
      <View style={styles.intro}>
        <Text style={styles.introTitle}>Featured listings</Text>
        <Text style={styles.introBody}>
          A featured listing appears in the Featured row on the PaMarket home
          screen and carries a Featured badge wherever it&rsquo;s shown.
        </Text>
      </View>

      <View style={styles.hero}>
        <Text style={styles.heroLabel}>AVAILABLE FEATURED SLOTS</Text>
        <Text style={styles.heroCount}>
          {available}{" "}
          <Text style={styles.heroCountSub}>
            {available === "1" ? "slot" : "slots"} available
          </Text>
        </Text>
        <Text style={styles.heroMeta}>
          {used} of {slotLabel} in use
        </Text>
        <Text style={styles.heroSub}>
          {noSlots
            ? "Your plan includes no featured slots. Buy a slot pack below, or upgrade to Pro or Premium."
            : "Each slot keeps one listing featured for 30 days. When it expires the slot comes back and you can use it on another listing."}
        </Text>
        <Pressable
          style={styles.buySlotsButton}
          onPress={() => setSlotPickerOpen((v) => !v)}
        >
          <Text style={styles.buySlotsButtonText}>
            {slotPickerOpen ? "Hide purchase options" : "Buy featured slots"}
          </Text>
        </Pressable>
        {slotPickerOpen ? (
          <View style={styles.slotOptions}>
            {Object.entries(SLOT_PACK_PRODUCTS).map(([productId, p]) => (
              <StoreProductOption
                key={productId}
                title={`${p.extraSlots} Featured Slot${
                  p.extraSlots === 1 ? "" : "s"
                }`}
                price={slotPackPrices[productId]}
                description={`Keeps ${p.extraSlots} more listing${
                  p.extraSlots === 1 ? "" : "s"
                } featured at a time. One-time purchase. Purchased slots do not expire and do not renew.`}
                buttonLabel={`Buy ${p.extraSlots} Slot${
                  p.extraSlots === 1 ? "" : "s"
                }`}
                isLoading={isLoadingSlotPacks}
                isAvailable={availableSlotPackIds.includes(productId)}
                isPurchasing={purchasingSlotPack === productId}
                purchaseBlocked={!!purchasingSlotPack}
                error={slotPackError}
                recommended={bestValueProductId === productId}
                onPurchase={() => buySlotPack(productId)}
                onRetry={retrySlotPacks}
              />
            ))}
          </View>
        ) : null}
      </View>

      <View style={styles.howBox}>
        <Text style={styles.howTitle}>HOW IT WORKS</Text>
        {[
          "Buy featured slots, or get them with a Pro or Premium plan.",
          `Pick a listing below and feature it for ${FEATURE_DAYS} days.`,
          "It shows in the Featured row on the home screen with a Featured badge.",
          "When it expires the slot returns, ready for another listing.",
        ].map((line, i) => (
          <View key={line} style={styles.howRow}>
            <Text style={styles.howNum}>{i + 1}</Text>
            <Text style={styles.howText}>{line}</Text>
          </View>
        ))}
      </View>

      {listings.length ? (
        <>
          <Text style={styles.sectionTitle}>Your listings</Text>
          {listings.map((l) => {
            const feat = isFeatured(l as any);
            const featuredUntil = (l as any).featured_until as string | null;
            const daysLeft =
              feat && featuredUntil
                ? Math.max(
                    1,
                    Math.ceil(
                      (new Date(featuredUntil).getTime() - Date.now()) / DAY
                    )
                  )
                : 0;
            return (
              <View
                key={l.id}
                style={[styles.card, feat && styles.cardFeatured]}
              >
                <View style={styles.cardTop}>
                  <View style={styles.thumbWrap}>
                    {l.photos?.[0] ? (
                      <Image
                        source={{ uri: l.photos[0] }}
                        style={styles.thumb}
                        contentFit="cover"
                        cachePolicy="memory-disk"
                      />
                    ) : (
                      <View style={styles.thumb} />
                    )}
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.title} numberOfLines={1}>
                      {l.title || "Untitled"}
                    </Text>
                    <Text
                      style={
                        feat ? styles.featuredText : styles.notFeaturedText
                      }
                    >
                      {feat
                        ? `Featured · ${daysLeft} day${
                            daysLeft === 1 ? "" : "s"
                          } left`
                        : "Not featured"}
                    </Text>
                    {feat && featuredUntil ? (
                      <Text style={styles.untilText}>
                        Featured until{" "}
                        {new Date(featuredUntil).toLocaleDateString()}
                      </Text>
                    ) : null}
                  </View>
                </View>
                {feat ? (
                  <Pressable
                    style={[
                      styles.removeButton,
                      busyListingId === l.id && styles.buttonDisabled,
                    ]}
                    onPress={() => unfeatureListing(l.id)}
                    disabled={busyListingId === l.id}
                  >
                    <Text style={styles.removeButtonText}>
                      Remove from featured
                    </Text>
                  </Pressable>
                ) : (
                  <>
                    <Pressable
                      style={[
                        styles.featureButton,
                        (atCapacity || busyListingId === l.id) &&
                          styles.buttonDisabled,
                      ]}
                      onPress={() => featureListing(l.id)}
                      disabled={atCapacity || busyListingId === l.id}
                    >
                      <Text style={styles.featureButtonText}>
                        {busyListingId === l.id
                          ? "Featuring…"
                          : `Feature for ${FEATURE_DAYS} days · 1 slot`}
                      </Text>
                    </Pressable>
                    {atCapacity ? (
                      <View style={styles.capacityBlock}>
                        <Text style={styles.capacityNote}>
                          {slots === 0
                            ? "You have no featured slots yet."
                            : `All ${slotLabel} of your slots are in use. Remove one below, or buy more.`}
                        </Text>
                        <Pressable
                          style={styles.capacityCta}
                          onPress={openSlotPurchase}
                        >
                          <Text style={styles.capacityCtaText}>
                            Buy featured slots
                          </Text>
                        </Pressable>
                      </View>
                    ) : null}
                  </>
                )}
              </View>
            );
          })}
        </>
      ) : (
        <Text style={styles.emptyText}>
          Add a listing to this business to start featuring it.
        </Text>
      )}
    </ScrollView>
  );
}

// Pulls a comparable number out of a StoreKit localized price string ("$4.99",
// "US$11,99", "￥800"). Used only to decide which pack is cheaper per slot —
// never to display a price, which always stays the store's own localized
// string. Returns null when no digits are present so the caller can skip the
// comparison rather than guess.
function parseStorePrice(price?: string): number | null {
  if (!price) return null;
  const digits = price.replace(/[^0-9.,]/g, "");
  if (!digits) return null;
  // Whichever separator comes last is the decimal one (1.234,56 vs 1,234.56).
  const lastDot = digits.lastIndexOf(".");
  const lastComma = digits.lastIndexOf(",");
  let normalized: string;
  if (lastDot === -1 && lastComma === -1) {
    normalized = digits;
  } else if (lastComma > lastDot) {
    normalized = digits.replace(/\./g, "").replace(",", ".");
  } else {
    normalized = digits.replace(/,/g, "");
  }
  const value = Number.parseFloat(normalized);
  return Number.isFinite(value) && value > 0 ? value : null;
}

// Turns the raise-exception strings from enforce_listing_feature_entitlement
// into something a seller can act on. Anything unrecognised falls back to a
// generic line rather than leaking raw SQL at the user.
function featureErrorMessage(raw: string): string {
  if (raw.includes("NO_FEATURED_SLOTS"))
    return "All your featured slots are in use. Free one up or buy more.";
  if (raw.includes("FEATURE_NOT_OWNER"))
    return "Only the business owner can feature listings.";
  if (raw.includes("FEATURE_DURATION_LIMIT"))
    return "Featured placement cannot exceed 31 days.";
  if (raw.includes("BOOST_REQUIRES_PURCHASE"))
    return "This listing must belong to a business to be featured.";
  return "Could not feature that listing. Try again.";
}

function buildTones(color: ColorPalette) {
  return { brand: color.brand };
}

function buildStyles(color: ColorPalette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: color.bg },
    centered: { flex: 1, alignItems: "center", justifyContent: "center" },
    hero: {
      backgroundColor: color.surface,
      borderRadius: 16,
      padding: 18,
      marginBottom: 16,
    },
    heroLabel: {
      fontSize: 11,
      fontWeight: "800",
      color: color.textMuted,
      letterSpacing: 0.5,
    },
    heroCount: {
      fontSize: 26,
      fontWeight: "900",
      color: color.text,
      marginTop: 6,
    },
    heroCountSub: { fontSize: 14, fontWeight: "500", color: color.textMuted },
    heroSub: {
      fontSize: 12.5,
      color: color.textMuted,
      marginTop: 8,
      lineHeight: 18,
    },
    buySlotsButton: {
      marginTop: 12,
      paddingVertical: 10,
      borderRadius: 10,
      backgroundColor: color.brand,
      alignItems: "center",
    },
    buySlotsButtonText: {
      fontSize: 13,
      fontWeight: "800",
      color: color.textOnBrand,
    },
    slotOptions: { gap: 8, marginTop: 10 },
    sectionTitle: {
      fontSize: 12,
      fontWeight: "800",
      color: color.textMuted,
      marginBottom: 10,
      textTransform: "uppercase",
    },
    card: {
      backgroundColor: color.surface,
      borderWidth: 1,
      borderColor: color.border,
      borderRadius: 14,
      padding: 12,
      marginBottom: 10,
    },
    cardFeatured: { borderColor: color.brand },
    cardTop: { flexDirection: "row", gap: 12, alignItems: "center" },
    thumbWrap: {
      width: 50,
      height: 50,
      borderRadius: 10,
      overflow: "hidden",
      backgroundColor: color.brandTint,
    },
    thumb: { width: "100%", height: "100%" },
    title: { fontSize: 14, fontWeight: "700", color: color.text },
    featuredText: {
      fontSize: 11.5,
      fontWeight: "700",
      color: color.brand,
      marginTop: 3,
    },
    notFeaturedText: { fontSize: 11.5, color: color.textMuted, marginTop: 3 },
    removeButton: {
      marginTop: 10,
      paddingVertical: 9,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: color.border,
      alignItems: "center",
    },
    removeButtonText: {
      fontSize: 12.5,
      fontWeight: "700",
      color: color.textMuted,
    },
    featureButton: {
      marginTop: 10,
      paddingVertical: 11,
      borderRadius: 10,
      backgroundColor: color.brand,
      alignItems: "center",
    },
    buttonDisabled: { opacity: 0.5 },
    featureButtonText: {
      fontSize: 12.5,
      fontWeight: "800",
      color: color.textOnBrand,
    },
    capacityBlock: { marginTop: 8, alignItems: "center", gap: 8 },
    capacityNote: {
      fontSize: 11.5,
      color: color.textMuted,
      textAlign: "center",
      lineHeight: 17,
    },
    capacityCta: {
      paddingVertical: 8,
      paddingHorizontal: 16,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: color.brand,
    },
    capacityCtaText: { fontSize: 12, fontWeight: "800", color: color.brand },
    untilText: { fontSize: 11, color: color.textMuted, marginTop: 2 },
    intro: { marginBottom: 14 },
    introTitle: {
      fontSize: 19,
      fontWeight: "900",
      color: color.text,
      marginBottom: 6,
    },
    introBody: { fontSize: 13, color: color.textMuted, lineHeight: 19 },
    heroMeta: { fontSize: 12, color: color.textMuted, marginTop: 2 },
    howBox: {
      backgroundColor: color.surface,
      borderRadius: 14,
      padding: 16,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: color.border,
    },
    howTitle: {
      fontSize: 11,
      fontWeight: "800",
      color: color.textMuted,
      letterSpacing: 0.5,
      marginBottom: 10,
    },
    howRow: { flexDirection: "row", gap: 10, marginBottom: 8 },
    howNum: {
      fontSize: 11.5,
      fontWeight: "800",
      color: color.brand,
      width: 16,
      lineHeight: 18,
    },
    howText: {
      flex: 1,
      fontSize: 12.5,
      color: color.text,
      lineHeight: 18,
    },
    emptyText: {
      textAlign: "center",
      color: color.textMuted,
      fontSize: 12.5,
      padding: 22,
    },
  });
}
