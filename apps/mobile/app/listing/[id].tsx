import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { openPhone, openWhatsApp } from "../../lib/open-url";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  useWindowDimensions,
} from "react-native";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Path, Polyline } from "react-native-svg";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import { CATEGORIES } from "../../lib/constants";
import { formatPrice, isFeatured, type Listing } from "../../lib/listings";
import { BOOST_PRODUCTS } from "../../lib/billing-products";
import { purchaseProduct } from "../../lib/iap";
import { useStoreProducts } from "../../lib/use-store-products";
import { StoreProductOption } from "../../components/StoreProductOption";
import { recordLead, type LeadType } from "../../lib/business-leads";
import {
  fetchSellerRatingSummary,
  sellerInitials,
  type PublicProfile,
} from "../../lib/sellers";
import {
  conversationIdFor,
  isPersonalConversationFor,
  type ConversationRow,
} from "../../lib/messages";
import { attrSchema } from "../../lib/attributes";
import { isListingSaved, toggleSave } from "../../lib/saves";
import { REPORT_REASONS, friendlyError } from "../../lib/safety";
import { StarRow } from "../../components/StarRow";
import { ListingCard } from "../../components/ListingCard";
import {
  Button,
  Card,
  ErrorState,
  FeatureIcon,
  GlassBackButton,
  ListSkeleton,
  SectionHeader,
  Skeleton,
  VerifiedBadge,
  toast,
} from "../../components/ui";
import {
  DARK_COLORS,
  LIGHT_COLORS,
  font,
  hitSlop,
  radius,
  shadow,
  space,
  type ColorPalette,
} from "../../lib/theme";
import { useThemedStyles, useThemePreference } from "../../lib/theme-provider";
import { useIOSNativeHeader } from "../../lib/useIOSNativeHeader";

const LISTING_COLUMNS =
  "id,seller_id,seller_name,seller_phone,title,description,price,currency,category,province,city,suburb,photos,status,boost,featured_until,views,business_id,created_at,updated_at,attributes";

// On iOS this screen shows a transparent *native* header (see
// headerShown: Platform.OS === "ios" in app/_layout.tsx). A native header sits
// above the JS view tree and swallows touches inside its band, so buttons
// placed at insets.top + 10 were visible but not tappable — dragging the page
// down moved them clear of that band, which is exactly the reported symptom.
// Clearing the header height fixes it; Android has no native header here and
// keeps the original spacing.
const TOP_ACTION_OFFSET = Platform.OS === "ios" ? 54 : 10;

const CONDITION_LABELS: Record<string, string> = {
  new: "New",
  "like-new": "Like New",
  used: "Used",
  refurbished: "Refurbished",
};

const SIMILAR_CARD_WIDTH = 170;
const BOOST_PRODUCT_IDS = Object.keys(BOOST_PRODUCTS);

// "Aug 23, 2026" — matches the en-US short-month convention used elsewhere
// (see memberSince below and app/(tabs)/profile.tsx).
function formatPromotionEnd(dateString: string | null | undefined): string {
  if (!dateString) return "";
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function timeAgo(dateString: string): string {
  const seconds = Math.floor(
    (Date.now() - new Date(dateString).getTime()) / 1000
  );
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months === 1 ? "" : "s"} ago`;
  const years = Math.floor(months / 12);
  return `${years} year${years === 1 ? "" : "s"} ago`;
}

function memberSince(dateString: string | null | undefined): string {
  if (!dateString) return "";
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

// ── Icons ────────────────────────────────────────────────────────────────────
function LocationIcon({ c }: { c: string }) {
  return (
    <Svg
      width={14}
      height={14}
      viewBox="0 0 24 24"
      fill="none"
      stroke={c}
      strokeWidth={2}
    >
      <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <Circle cx={12} cy={10} r={3} />
    </Svg>
  );
}
function EyeIcon({ c }: { c: string }) {
  return (
    <Svg
      width={14}
      height={14}
      viewBox="0 0 24 24"
      fill="none"
      stroke={c}
      strokeWidth={2}
    >
      <Path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <Circle cx={12} cy={12} r={3} />
    </Svg>
  );
}
function ClockIcon({ c }: { c: string }) {
  return (
    <Svg
      width={14}
      height={14}
      viewBox="0 0 24 24"
      fill="none"
      stroke={c}
      strokeWidth={2}
    >
      <Circle cx={12} cy={12} r={9} />
      <Polyline points="12 7 12 12 15 14" />
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
function ShareIcon() {
  return (
    <Svg
      width={19}
      height={19}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#ffffff"
      strokeWidth={2}
    >
      <Circle cx={18} cy={5} r={3} />
      <Circle cx={6} cy={12} r={3} />
      <Circle cx={18} cy={19} r={3} />
      <Path d="M8.59 13.51l6.83 3.98" />
      <Path d="M15.41 6.51l-6.82 3.98" />
    </Svg>
  );
}
function HeartIcon({
  filled,
  dangerColor,
}: {
  filled: boolean;
  dangerColor: string;
}) {
  return (
    <Svg
      width={19}
      height={19}
      viewBox="0 0 24 24"
      fill={filled ? dangerColor : "none"}
      stroke="#ffffff"
      strokeWidth={2}
    >
      <Path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </Svg>
  );
}
function FlagIcon() {
  return (
    <Svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#ffffff"
      strokeWidth={2}
    >
      <Path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
      <Path d="M4 22v-7" />
    </Svg>
  );
}
function PhoneIcon({ c }: { c: string }) {
  return (
    <Svg
      width={20}
      height={20}
      viewBox="0 0 24 24"
      fill="none"
      stroke={c}
      strokeWidth={2}
    >
      <Path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 2.1.74 3.26a2 2 0 0 1-.45 2.11l-1.27 1.27a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c1.16.38 2.3.61 3.26.74a2 2 0 0 1 1.72 2.03z" />
    </Svg>
  );
}
function MessageIcon() {
  return (
    <Svg
      width={19}
      height={19}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#ffffff"
      strokeWidth={2}
    >
      <Path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </Svg>
  );
}
function WhatsAppIcon() {
  // Both sub-paths (the phone-handset glyph and the outer speech-bubble
  // silhouette) must be ONE path with fillRule="evenodd" — as two separate
  // solid-white <Path> elements, the bubble path (drawn second, on top)
  // fully painted over the tiny handset glyph, so this rendered as a plain
  // white chat-bubble blob with no visible WhatsApp glyph at all. evenodd
  // on the combined path cuts the handset shape out as a hole, letting the
  // green circle behind it show through — the actual recognizable logo.
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24">
      <Path
        fillRule="evenodd"
        fill="#ffffff"
        d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z M11.99 0C5.364 0 0 5.372 0 11.994c0 2.116.554 4.1 1.524 5.822L.057 24l6.304-1.654A11.978 11.978 0 0 0 11.99 24C18.626 24 24 18.628 24 12.006 24 5.372 18.626 0 11.99 0z"
      />
    </Svg>
  );
}

export default function ListingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const styles = useThemedStyles(buildStyles);
  const { resolvedScheme } = useThemePreference();
  const color = resolvedScheme === "dark" ? DARK_COLORS : LIGHT_COLORS;

  const [listing, setListing] = useState<Listing | null>(null);
  const [seller, setSeller] = useState<PublicProfile | null>(null);
  const [sellerCreatedAt, setSellerCreatedAt] = useState<string | null>(null);
  const [ratingSummary, setRatingSummary] = useState({ count: 0, average: 0 });
  const [similar, setSimilar] = useState<Listing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [isSaved, setIsSaved] = useState(false);
  const [savingBusy, setSavingBusy] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [boostPickerOpen, setBoostPickerOpen] = useState(false);
  const [purchasingBoost, setPurchasingBoost] = useState<string | null>(null);
  const {
    prices: boostPrices,
    availableProductIds: availableBoostIds,
    isLoading: isLoadingBoosts,
    error: boostProductError,
    retry: retryBoostProducts,
  } = useStoreProducts(BOOST_PRODUCT_IDS, "consumable");
  const galleryRef = useRef<FlatList<string>>(null);

  // headerRight deliberately omitted: a transparent native-stack header
  // combined with tappable headerRight buttons does not reliably hit-test
  // on iOS (confirmed — Android, which never used a native headerRight
  // here, worked fine while iOS's share/save/report buttons in the native
  // header silently ate every tap). Share/save/report are rendered as a
  // floating RN overlay on both platforms instead (below) — only the
  // transparent back button stays on the real native header.
  useIOSNativeHeader({
    transparent: true,
    backgroundColor: "transparent",
    tintColor: "#FFFFFF",
  });

  const load = useCallback(async () => {
    setError(null);
    const { data: listingData, error: listingError } = await supabase
      .from("listings")
      .select(LISTING_COLUMNS)
      .eq("id", id)
      .maybeSingle();

    if (listingError) {
      setError(listingError.message);
      return;
    }
    if (!listingData) {
      setError("not-found");
      return;
    }
    const found = listingData as Listing;
    setListing(found);

    const sellerId = found.seller_id;
    const [profileRes, ratingSummaryRes, similarRes] = await Promise.all([
      supabase
        .from("profiles_public")
        .select("id,name,avatar,verified,created_at")
        .eq("id", sellerId)
        .maybeSingle(),
      fetchSellerRatingSummary(sellerId),
      found.category
        ? supabase
            .from("listings")
            .select(LISTING_COLUMNS)
            .eq("category", found.category)
            .eq("status", "active")
            .neq("id", found.id)
            .order("created_at", { ascending: false })
            .limit(8)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (!profileRes.error && profileRes.data) {
      const prof = profileRes.data as PublicProfile & {
        created_at?: string | null;
      };
      setSeller(prof);
      setSellerCreatedAt(prof.created_at ?? null);
    }
    setRatingSummary(ratingSummaryRes);
    if (!similarRes.error && similarRes.data)
      setSimilar(similarRes.data as Listing[]);

    supabase.rpc("increment_listing_view", { listing_id: found.id }).then(
      () => {},
      () => {}
    );
  }, [id]);

  useEffect(() => {
    setIsLoading(true);
    load().finally(() => setIsLoading(false));
  }, [load]);

  // Sync saved state once we know the viewer + listing.
  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId || !listing) return;
    let alive = true;
    isListingSaved(userId, listing.id).then((v) => {
      if (alive) setIsSaved(v);
    });
    return () => {
      alive = false;
    };
  }, [session?.user?.id, listing]);

  const isOwner = session?.user?.id === listing?.seller_id;
  const avgRating = ratingSummary.average;
  const categoryName = useMemo(
    () =>
      CATEGORIES.find((c) => c.id === listing?.category)?.name ??
      listing?.category ??
      "Listing",
    [listing]
  );
  const location =
    [listing?.suburb, listing?.city].filter(Boolean).join(", ") ||
    listing?.province ||
    "";
  const conditionRaw = (listing?.attributes?.condition as string) ?? "";
  const conditionLabel = CONDITION_LABELS[conditionRaw] ?? "";
  // Round up so the final partial day still reads "1 day left" rather than 0.
  const promotionDaysLeft = listing?.featured_until
    ? Math.max(
        1,
        Math.ceil(
          (new Date(listing.featured_until).getTime() - Date.now()) / 86400000
        )
      )
    : 0;

  // Category attributes (excluding condition, which gets its own badge).
  // "chips" fields (property/vehicles/rooms/pets features) are split out
  // into their own checklist instead of one comma-joined details row.
  const { attrRows, featureItems, featureSectionLabel } = useMemo(() => {
    if (!listing?.attributes || !listing.category) {
      return {
        attrRows: [] as { label: string; value: string }[],
        featureItems: [] as string[],
        featureSectionLabel: "Features",
      };
    }
    const schema = attrSchema(listing.category);
    const attrs = listing.attributes;
    const rows: { label: string; value: string }[] = [];
    let features: string[] = [];
    let featureLabel = "Features";
    for (const field of schema) {
      if (field.key === "condition") continue;
      const raw = attrs[field.key];
      if (raw == null || raw === "") continue;
      if (field.type === "chips") {
        features = Array.isArray(raw) ? raw.map(String) : [String(raw)];
        featureLabel = field.label;
        continue;
      }
      const value = Array.isArray(raw) ? raw.join(", ") : String(raw);
      rows.push({
        label: field.label,
        value: field.suffix ? `${value} ${field.suffix}` : value,
      });
    }
    return {
      attrRows: rows,
      featureItems: features,
      featureSectionLabel: featureLabel,
    };
  }, [listing]);

  async function handleToggleSave() {
    if (!session?.user) {
      router.push("/(auth)/sign-in");
      return;
    }
    if (!listing || savingBusy) return;
    const next = !isSaved;
    setIsSaved(next);
    setSavingBusy(true);
    try {
      await toggleSave(session.user.id, listing.id, isSaved);
      toast(next ? "Saved to favourites" : "Removed from favourites");
    } catch {
      setIsSaved(!next); // revert
      toast("Couldn't update saved listings", 3000, true);
    } finally {
      setSavingBusy(false);
    }
  }

  async function shareListing() {
    if (!listing) return;
    const link = `https://pamarket.co.zw/listing/${listing.id}`;
    await Share.share({
      message: `${listing.title} — ${formatPrice(listing)}\n${link}`,
      url: link,
      title: listing.title,
    });
  }

  async function buyBoost(productId: string) {
    if (!listing) return;
    if (!availableBoostIds.includes(productId)) {
      toast("This boost is unavailable from the store. Retry loading prices.");
      return;
    }
    setPurchasingBoost(productId);
    try {
      const result = await purchaseProduct(productId, {
        listingId: listing.id,
      });
      if (result.ok) {
        setBoostPickerOpen(false);
        toast("Listing boosted!");
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

  async function submitReport(reason: string) {
    setReportOpen(false);
    if (!session?.user) {
      router.push("/(auth)/sign-in");
      return;
    }
    if (!listing) return;
    const { error: reportError } = await supabase.from("reports").insert({
      target_type: "listing",
      target_id: listing.id,
      reason,
      reporter_id: session.user.id,
    });
    if (reportError && !/duplicate|unique/i.test(reportError.message)) {
      console.warn("[report] listing report failed:", reportError.message);
      const friendly = friendlyError(reportError);
      toast(
        friendly.blocked
          ? friendly.message
          : "Couldn't submit report. Please try again.",
        3500,
        true
      );
      return;
    }
    toast("Thanks — this listing has been reported.");
  }

  async function captureListingLead(type: LeadType) {
    if (!listing?.business_id) return;
    const userName =
      (session?.user?.user_metadata?.name as string | undefined) ||
      (session?.user?.user_metadata?.full_name as string | undefined) ||
      session?.user?.email ||
      "Guest";
    try {
      await recordLead(listing.id, type, session?.user?.id ?? null, userName);
    } catch (e) {
      console.warn("business listing lead capture:", e);
    }
  }

  async function callSeller() {
    if (listing?.seller_phone) {
      await captureListingLead("call");
      openPhone(listing.seller_phone);
    }
  }
  async function whatsappSeller() {
    if (listing?.seller_phone) {
      await captureListingLead("whatsapp");
      const digits = listing.seller_phone.replace(/[^0-9]/g, "");
      openWhatsApp(digits);
    }
  }

  async function messageSeller() {
    if (!session?.user || !listing) {
      router.push("/(auth)/sign-in");
      return;
    }
    await captureListingLead("chat");
    const myId = session.user.id;
    const convId = conversationIdFor(myId, listing.seller_id);
    const { data: conversations } = await supabase
      .from("conversations")
      .select("id,members,listing_id,business_id,created_at,updated_at")
      .contains("members", [myId])
      .limit(100);
    const candidates = ((conversations as ConversationRow[]) ?? []).filter(
      (conversation) =>
        isPersonalConversationFor(conversation, myId, listing.seller_id)
    );
    const latestByConversation = new Map<string, string>();

    if (candidates.length) {
      const { data: latestMessages } = await supabase
        .from("messages")
        .select("conversation_id,created_at")
        .in(
          "conversation_id",
          candidates.map((conversation) => conversation.id)
        )
        .order("created_at", { ascending: false })
        .limit(Math.max(candidates.length * 3, 20));

      (
        (latestMessages as { conversation_id: string; created_at: string }[]) ??
        []
      ).forEach((message) => {
        if (!latestByConversation.has(message.conversation_id)) {
          latestByConversation.set(message.conversation_id, message.created_at);
        }
      });
    }

    candidates.sort((a, b) => {
      const aTime = new Date(
        latestByConversation.get(a.id) || a.updated_at || a.created_at || 0
      ).getTime();
      const bTime = new Date(
        latestByConversation.get(b.id) || b.updated_at || b.created_at || 0
      ).getTime();
      return bTime - aTime;
    });

    const existing = candidates[0];
    if (existing) {
      const members = Array.isArray(existing.members) ? existing.members : [];
      const patch: {
        members?: string[];
        listing_id?: string;
        business_id?: string;
      } = {};
      if (!members.includes(myId) || !members.includes(listing.seller_id)) {
        patch.members = [myId, listing.seller_id];
      }
      if (!existing.listing_id) {
        patch.listing_id = listing.id;
      }
      // A conversation started before this listing was assigned to a shop
      // (or one whose business_id never got set) needs backfilling here too
      // — otherwise it stays stuck in the Personal tab forever even though
      // it's really a business inquiry.
      if (listing.business_id && !existing.business_id) {
        patch.business_id = listing.business_id;
      }
      if (Object.keys(patch).length) {
        await supabase
          .from("conversations")
          .update(patch)
          .eq("id", existing.id);
      }
      router.push({
        pathname: "/chat/[id]",
        params: {
          id: existing.id,
          name: seller?.name || listing.seller_name || "",
          avatar: seller?.avatar ?? "",
        },
      });
      return;
    }

    {
      await supabase.from("conversations").upsert({
        id: convId,
        members: [myId, listing.seller_id],
        listing_id: listing.id,
        business_id: listing.business_id ?? null,
      });
    }
    router.push({
      pathname: "/chat/[id]",
      params: {
        id: convId,
        name: seller?.name || listing.seller_name || "",
        avatar: seller?.avatar ?? "",
      },
    });
  }

  function onGalleryScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const idx = Math.round(e.nativeEvent.contentOffset.x / width);
    if (idx !== photoIndex) setPhotoIndex(idx);
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <View style={styles.container}>
        <Skeleton width={width} height={330} radius={0} />
        {Platform.OS !== "ios" ? (
          <View style={[styles.topBar, { top: insets.top + TOP_ACTION_OFFSET }]}>
            <GlassBackButton onPress={() => router.back()} tone="light" />
          </View>
        ) : null}
        <View style={styles.content}>
          <Skeleton width={140} height={30} style={{ marginTop: space.md }} />
          <Skeleton width="80%" height={22} style={{ marginTop: space.sm }} />
          <Skeleton width="55%" height={16} style={{ marginTop: space.sm }} />
          <Skeleton
            width="100%"
            height={90}
            radius={radius.md}
            style={{ marginTop: space.xl }}
          />
          <ListSkeleton count={2} />
        </View>
      </View>
    );
  }

  // ── Error / not found ────────────────────────────────────────────────────────
  if (error === "not-found" || !listing) {
    return (
      <View style={[styles.container, styles.centered]}>
        {Platform.OS !== "ios" ? (
          <View style={[styles.topBar, { top: insets.top + 10 }]}>
            <GlassBackButton onPress={() => router.back()} tone="light" />
          </View>
        ) : null}
        <ErrorState
          title="Listing not found"
          subtitle="This listing may have been removed or is no longer available."
          onRetry={() => router.back()}
        />
      </View>
    );
  }
  if (error) {
    return (
      <View style={[styles.container, styles.centered]}>
        {Platform.OS !== "ios" ? (
          <View style={[styles.topBar, { top: insets.top + 10 }]}>
            <GlassBackButton onPress={() => router.back()} tone="light" />
          </View>
        ) : null}
        <ErrorState
          onRetry={() => {
            setIsLoading(true);
            load().finally(() => setIsLoading(false));
          }}
        />
      </View>
    );
  }

  const photos = listing.photos ?? [];

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Gallery ── */}
        <View style={styles.photoWrap}>
          {photos.length ? (
            <FlatList
              ref={galleryRef}
              data={photos}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              keyExtractor={(_, i) => String(i)}
              onScroll={onGalleryScroll}
              scrollEventThrottle={16}
              renderItem={({ item }) => (
                <Pressable onPress={() => setViewerOpen(true)}>
                  <Image
                    source={{ uri: item }}
                    style={[styles.photo, { width }]}
                    contentFit="cover"
                    transition={150}
                    cachePolicy="memory-disk"
                  />
                </Pressable>
              )}
            />
          ) : (
            <View style={[styles.photo, styles.photoPlaceholder, { width }]}>
              <Svg
                width={48}
                height={48}
                viewBox="0 0 24 24"
                fill="none"
                stroke={color.textMuted}
                strokeWidth={1.5}
              >
                <Path d="M21 15V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10" />
                <Circle cx={8.5} cy={8.5} r={1.5} />
                <Polyline points="21 15 16 10 5 21" />
              </Svg>
              <Text style={styles.photoPlaceholderText}>No photos</Text>
            </View>
          )}

          <View style={[styles.topBar, { top: insets.top + 10 }]}>
            {Platform.OS !== "ios" ? (
              <GlassBackButton onPress={() => router.back()} tone="light" />
            ) : null}
            <View style={{ flex: 1 }} />
            <Pressable
              style={styles.iconButton}
              onPress={shareListing}
              hitSlop={hitSlop}
            >
              <ShareIcon />
            </Pressable>
            {!isOwner ? (
              <Pressable
                style={styles.iconButton}
                onPress={handleToggleSave}
                hitSlop={hitSlop}
              >
                <HeartIcon filled={isSaved} dangerColor={color.danger} />
              </Pressable>
            ) : null}
            {!isOwner ? (
              <Pressable
                style={styles.iconButton}
                onPress={() => setReportOpen(true)}
                hitSlop={hitSlop}
              >
                <FlagIcon />
              </Pressable>
            ) : null}
          </View>

          {photos.length > 1 ? (
            <View style={styles.photoCounter}>
              <Text style={styles.photoCounterText}>
                {photoIndex + 1} / {photos.length}
              </Text>
            </View>
          ) : null}

          {photos.length > 1 ? (
            <View style={styles.dotsRow}>
              {photos.map((_, i) => (
                <View
                  key={i}
                  style={[styles.dot, i === photoIndex && styles.dotActive]}
                />
              ))}
            </View>
          ) : null}
        </View>

        <View style={styles.content}>
          {/* Chips */}
          <View style={styles.chipRow}>
            <View style={styles.categoryChip}>
              <Text style={styles.categoryChipText}>{categoryName}</Text>
            </View>
            {conditionLabel ? (
              <View style={styles.conditionChip}>
                <Text style={styles.conditionChipText}>{conditionLabel}</Text>
              </View>
            ) : null}
            {isFeatured(listing) ? (
              <View style={styles.featuredChip}>
                <Text style={styles.featuredChipText}>Promoted</Text>
              </View>
            ) : null}
          </View>

          <Text style={styles.price}>{formatPrice(listing)}</Text>
          <Text style={styles.title}>{listing.title}</Text>

          {/* Meta row: location · posted · views */}
          <View style={styles.metaRow}>
            {location ? (
              <View style={styles.metaItem}>
                <LocationIcon c={color.textSub} />
                <Text style={styles.metaText}>{location}</Text>
              </View>
            ) : null}
            <View style={styles.metaItem}>
              <ClockIcon c={color.textSub} />
              <Text style={styles.metaText}>{timeAgo(listing.created_at)}</Text>
            </View>
            <View style={styles.metaItem}>
              <EyeIcon c={color.textSub} />
              <Text style={styles.metaText}>
                {(listing.views ?? 0).toLocaleString()} views
              </Text>
            </View>
          </View>

          {/* Description */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Description</Text>
            <Text style={styles.description}>
              {listing.description || "No description provided."}
            </Text>
          </View>

          {/* Category attributes — Details + Features side by side; when a
              category has no "chips" (features) field, Details takes the
              full width instead of leaving an empty second column. */}
          {attrRows.length || featureItems.length ? (
            <View style={styles.twoCol}>
              {attrRows.length ? (
                <View style={styles.colCard}>
                  <Text style={styles.colTitle}>Details</Text>
                  {attrRows.map((row, i) => (
                    <View
                      key={row.label}
                      style={[styles.colRow, i > 0 && styles.colRowBorder]}
                    >
                      <Text style={styles.colRowLabel} numberOfLines={1}>
                        {row.label}
                      </Text>
                      <Text style={styles.colRowValue}>{row.value}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
              {featureItems.length ? (
                <View style={styles.colCard}>
                  <Text style={styles.colTitle}>{featureSectionLabel}</Text>
                  {featureItems.map((f, i) => (
                    <View
                      key={f}
                      style={[styles.featureRow, i > 0 && styles.colRowBorder]}
                    >
                      <View style={styles.featureRowLabel}>
                        <FeatureIcon name={f} color={color.brand} size={13} />
                        <Text style={styles.featureRowText} numberOfLines={1}>
                          {f}
                        </Text>
                      </View>
                      <View style={styles.featureCheck}>
                        <Svg
                          width={8}
                          height={8}
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke={color.success}
                          strokeWidth={4}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <Polyline points="20 6 9 17 4 12" />
                        </Svg>
                      </View>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          ) : null}

          {/* Seller card — two-box split: identity on the left, real trust
              signals (rating + verified) on the right. No invented
              transaction-count/response-time stats — those don't exist. */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Seller</Text>
            <Pressable
              style={({ pressed }) => [
                styles.sellerCard,
                shadow.sm,
                pressed && styles.pressed,
              ]}
              onPress={() =>
                router.push({
                  pathname: "/profile/[id]",
                  params: { id: listing.seller_id },
                })
              }
            >
              <View style={styles.sellerLeft}>
                <View style={styles.sellerAvatar}>
                  {seller?.avatar ? (
                    <Image
                      source={{ uri: seller.avatar }}
                      style={styles.sellerAvatarImage}
                      contentFit="cover"
                      cachePolicy="memory-disk"
                    />
                  ) : (
                    <Text style={styles.sellerAvatarInitial}>
                      {sellerInitials(seller?.name || listing.seller_name)}
                    </Text>
                  )}
                </View>
                <View style={styles.sellerNameRow}>
                  <Text style={styles.sellerName} numberOfLines={1}>
                    {seller?.name || listing.seller_name || "Seller"}
                  </Text>
                  {seller?.verified ? <VerifiedBadge compact /> : null}
                </View>
                {memberSince(sellerCreatedAt) ? (
                  <Text style={styles.sellerMeta}>
                    Member since {memberSince(sellerCreatedAt)}
                  </Text>
                ) : null}
              </View>
              <View style={styles.sellerRight}>
                <View style={styles.sellerRightRow}>
                  <StarRow rating={avgRating} />
                  <Text style={styles.sellerRatingText}>
                    {ratingSummary.count
                      ? `${avgRating.toFixed(1)} (${ratingSummary.count})`
                      : "No reviews yet"}
                  </Text>
                </View>
                {seller?.verified ? (
                  <View
                    style={[styles.sellerRightRow, styles.sellerRightRowBorder]}
                  >
                    <Text style={styles.sellerVerifiedText}>
                      Verified Seller
                    </Text>
                  </View>
                ) : null}
              </View>
            </Pressable>
          </View>

          {/* Safety tip (buyers) */}
          {!isOwner ? (
            <View style={styles.safetyTip}>
              <Text style={styles.safetyTipTitle}>Trade safely</Text>
              <Text style={styles.safetyTipText}>
                Meet in a public place, inspect before paying, and remember:
                PaMarket never handles payments.
              </Text>
            </View>
          ) : null}

          {/* Owner performance */}
          {isOwner ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Performance</Text>
              <Card style={styles.perfCard}>
                <View style={styles.perfItem}>
                  <Text style={styles.perfValue}>
                    {(listing.views ?? 0).toLocaleString()}
                  </Text>
                  <Text style={styles.perfLabel}>Views</Text>
                </View>
                <View style={styles.perfDivider} />
                <View style={styles.perfItem}>
                  <Text style={styles.perfValue}>
                    {timeAgo(listing.created_at)}
                  </Text>
                  <Text style={styles.perfLabel}>Posted</Text>
                </View>
              </Card>

              {isFeatured(listing) ? (
                <View>
                  <View style={styles.boostActiveRow}>
                    <StarIcon c={color.gold} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.boostActiveText}>
                        Promoted · {promotionDaysLeft} day
                        {promotionDaysLeft === 1 ? "" : "s"} left
                      </Text>
                      <Text style={styles.boostActiveMeta}>
                        Ends {formatPromotionEnd(listing.featured_until)}
                      </Text>
                    </View>
                  </View>
                  {/* Deliberately says nothing about what buying a second
                      boost does while one is active — that stacking behavior
                      has not been verified, so it must not be claimed here. */}
                  <Text style={styles.boostActiveNote}>
                    Promotion ends automatically. Your listing stays active and
                    there is no recurring charge.
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
                      <Text style={styles.boostBannerTitle}>Boost this ad</Text>
                      <Text style={styles.boostBannerSub}>
                        Choose a one-time boost to get more views
                      </Text>
                    </View>
                    <View style={styles.boostBannerBtn}>
                      <Text style={styles.boostBannerBtnText}>
                        View options
                      </Text>
                    </View>
                  </Pressable>

                  {boostPickerOpen ? (
                    <View style={styles.boostOptions}>
                      {Object.entries(BOOST_PRODUCTS).map(([productId, p]) => (
                        <StoreProductOption
                          key={productId}
                          title={`${p.days}-Day Listing Boost`}
                          price={boostPrices[productId]}
                          description={`Promotes this listing for ${
                            p.days
                          } day${p.days === 1 ? "" : "s"}.`}
                          buttonLabel="Boost Listing"
                          isLoading={isLoadingBoosts}
                          isAvailable={availableBoostIds.includes(productId)}
                          isPurchasing={purchasingBoost === productId}
                          purchaseBlocked={!!purchasingBoost}
                          error={boostProductError}
                          recommended={p.days === 7}
                          onPurchase={() => buyBoost(productId)}
                          onRetry={retryBoostProducts}
                        />
                      ))}
                    </View>
                  ) : null}
                </>
              )}
            </View>
          ) : null}
        </View>

        {/* Similar listings */}
        {similar.length ? (
          <View style={styles.similarSection}>
            <SectionHeader
              title="Similar listings"
              subtitle={`More in ${categoryName}`}
            />
            <FlatList
              data={similar}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.similarRail}
              renderItem={({ item }) => (
                <ListingCard
                  listing={item}
                  width={SIMILAR_CARD_WIDTH}
                  onPress={() =>
                    router.push({
                      pathname: "/listing/[id]",
                      params: { id: item.id },
                    })
                  }
                />
              )}
            />
          </View>
        ) : null}
      </ScrollView>

      {/* ── Sticky action bar ── */}
      <View
        style={[
          styles.actionBar,
          { paddingBottom: Math.max(insets.bottom, 12) },
        ]}
      >
        {isOwner ? (
          <Button
            label="Edit listing"
            variant="primary"
            onPress={() => router.push("/my-listings")}
          />
        ) : (
          <View style={styles.actionRow}>
            {listing.seller_phone ? (
              <Pressable style={styles.actionIconBtn} onPress={callSeller}>
                <PhoneIcon c={color.brand} />
              </Pressable>
            ) : null}
            {listing.seller_phone ? (
              <Pressable
                style={[styles.actionIconBtn, styles.actionWhatsapp]}
                onPress={whatsappSeller}
              >
                <WhatsAppIcon />
              </Pressable>
            ) : null}
            <Pressable style={styles.actionChat} onPress={messageSeller}>
              <MessageIcon />
              <Text style={styles.actionChatText}>Chat with seller</Text>
            </Pressable>
          </View>
        )}
      </View>

      {/* ── Report action sheet ── */}
      <Modal
        visible={reportOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setReportOpen(false)}
      >
        <Pressable
          style={styles.sheetBackdrop}
          onPress={() => setReportOpen(false)}
        >
          <Pressable
            style={[
              styles.sheet,
              { paddingBottom: Math.max(insets.bottom, 16) },
            ]}
            onPress={() => {}}
          >
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Report this listing</Text>
            <Text style={styles.sheetSub}>
              Tell us what's wrong. Our team will review it.
            </Text>
            {REPORT_REASONS.listing.map((reason) => (
              <Pressable
                key={reason}
                style={styles.reasonRow}
                onPress={() => submitReport(reason)}
              >
                <Text style={styles.reasonText}>{reason}</Text>
                <Svg
                  width={18}
                  height={18}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={color.textMuted}
                  strokeWidth={2}
                >
                  <Polyline points="9 18 15 12 9 6" />
                </Svg>
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Fullscreen image viewer ── */}
      <Modal
        visible={viewerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setViewerOpen(false)}
      >
        <View style={styles.viewerBackdrop}>
          <FlatList
            data={photos}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            keyExtractor={(_, i) => String(i)}
            initialScrollIndex={photoIndex}
            getItemLayout={(_, index) => ({
              length: width,
              offset: width * index,
              index,
            })}
            renderItem={({ item }) => (
              <View style={{ width, justifyContent: "center" }}>
                <Image
                  source={{ uri: item }}
                  style={{ width, height: "100%" }}
                  contentFit="contain"
                  cachePolicy="memory-disk"
                />
              </View>
            )}
          />
          <Pressable
            style={[styles.viewerClose, { top: insets.top + 10 }]}
            onPress={() => setViewerOpen(false)}
            hitSlop={hitSlop}
          >
            <Svg
              width={24}
              height={24}
              viewBox="0 0 24 24"
              fill="none"
              stroke="#fff"
              strokeWidth={2.4}
            >
              <Path d="M18 6L6 18M6 6l12 12" />
            </Svg>
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}

function buildStyles(color: ColorPalette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: color.bg },
    centered: { justifyContent: "center" },

    photoWrap: {
      height: 330,
      backgroundColor: "#0F1729",
      position: "relative",
    },
    photo: { height: 330 },
    photoPlaceholder: {
      backgroundColor: color.surfaceAlt,
      alignItems: "center",
      justifyContent: "center",
      gap: space.sm,
    },
    photoPlaceholderText: { ...font.caption, color: color.textMuted },

    topBar: {
      position: "absolute",
      left: space.md,
      right: space.md,
      flexDirection: "row",
      alignItems: "center",
      gap: space.sm,
      // Without these the group renders behind later siblings (the photo
      // counter, the gallery pager) and taps land on whatever is drawn on
      // top. elevation is the Android equivalent of zIndex for touch order.
      zIndex: 20,
      elevation: 20,
    },
    iconButton: {
      // 44x44 is Apple's minimum comfortable touch target; these were 38.
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: "rgba(16,24,40,0.42)",
      alignItems: "center",
      justifyContent: "center",
    },
    photoCounter: {
      position: "absolute",
      bottom: space.md,
      right: space.md,
      backgroundColor: "rgba(16,24,40,0.55)",
      borderRadius: radius.pill,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    photoCounterText: { color: "#fff", fontSize: 11, fontWeight: "700" },
    dotsRow: {
      position: "absolute",
      bottom: space.md,
      left: space.md,
      flexDirection: "row",
      gap: 5,
    },
    dot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: "rgba(255,255,255,0.5)",
    },
    dotActive: { backgroundColor: "#fff", width: 16 },

    content: {
      padding: space.lg,
      backgroundColor: color.surface,
      borderTopLeftRadius: radius.xl,
      borderTopRightRadius: radius.xl,
      marginTop: -16,
    },

    chipRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: space.sm,
      marginBottom: space.md,
    },
    categoryChip: {
      backgroundColor: color.brandTint,
      borderRadius: radius.sm,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    categoryChipText: { ...font.micro, color: color.brand },
    conditionChip: {
      backgroundColor: color.successTint,
      borderRadius: radius.sm,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    conditionChipText: { ...font.micro, color: color.success },
    featuredChip: {
      backgroundColor: color.gold,
      borderRadius: radius.sm,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    featuredChipText: { ...font.micro, color: "#fff" },

    price: { ...font.h1, color: color.brand },
    title: { ...font.h3, color: color.text, marginTop: space.xs },

    metaRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "center",
      gap: space.md,
      marginTop: space.md,
    },
    metaItem: { flexDirection: "row", alignItems: "center", gap: 5 },
    metaText: { ...font.sub, color: color.textSub },

    section: { marginTop: space.xl },
    sectionTitle: {
      ...font.micro,
      color: color.textMuted,
      textTransform: "uppercase",
      marginBottom: space.sm,
    },
    description: { ...font.body, color: color.textSub, lineHeight: 23 },

    twoCol: {
      flexDirection: "row",
      gap: space.sm,
      marginTop: space.xl,
      alignItems: "stretch",
    },
    colCard: {
      flex: 1,
      minWidth: 0,
      backgroundColor: color.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: color.border,
      padding: space.md,
    },
    colTitle: {
      ...font.micro,
      color: color.textMuted,
      textTransform: "uppercase",
      marginBottom: space.sm,
    },
    colRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: space.xs + 2,
      gap: space.sm,
    },
    colRowBorder: { borderTopWidth: 1, borderTopColor: color.divider },
    colRowLabel: {
      ...font.caption,
      color: color.textSub,
      fontWeight: "600",
      flexShrink: 1,
    },
    colRowValue: {
      ...font.caption,
      color: color.text,
      fontWeight: "800",
      flexShrink: 0,
      textAlign: "right",
    },
    featureRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: space.xs + 2,
      gap: space.sm,
    },
    featureRowLabel: {
      flexDirection: "row",
      alignItems: "center",
      gap: space.xs + 2,
      flexShrink: 1,
      minWidth: 0,
    },
    featureRowText: {
      ...font.caption,
      color: color.textSub,
      fontWeight: "600",
      flexShrink: 1,
    },
    featureCheck: {
      width: 15,
      height: 15,
      borderRadius: 8,
      backgroundColor: color.successTint,
      alignItems: "center",
      justifyContent: "center",
    },

    sellerCard: {
      flexDirection: "row",
      gap: space.sm,
      backgroundColor: color.surface,
      borderRadius: radius.lg,
      padding: space.md,
    },
    pressed: { opacity: 0.9 },
    sellerLeft: { flex: 1.3, minWidth: 0 },
    sellerAvatar: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: color.brandTint,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
    },
    sellerAvatarImage: { width: "100%", height: "100%" },
    sellerAvatarInitial: { ...font.h3, color: color.brand },
    sellerNameRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: space.sm,
      marginTop: space.sm,
    },
    sellerName: { ...font.title, color: color.text, flexShrink: 1 },
    sellerRatingText: { ...font.caption, color: color.textMuted },
    sellerMeta: { ...font.caption, color: color.textMuted, marginTop: 2 },
    sellerRight: {
      flex: 1,
      backgroundColor: color.surfaceAlt,
      borderRadius: radius.md,
      paddingHorizontal: space.md,
      paddingVertical: space.sm,
      justifyContent: "center",
      gap: space.xs,
    },
    sellerRightRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingVertical: 3,
    },
    sellerRightRowBorder: {
      borderTopWidth: 1,
      borderTopColor: color.divider,
      paddingTop: space.xs + 2,
    },
    sellerVerifiedText: {
      ...font.caption,
      color: color.goldDark,
      fontWeight: "800",
    },

    safetyTip: {
      backgroundColor: color.goldTint,
      borderRadius: radius.md,
      padding: space.md,
      marginTop: space.xl,
    },
    safetyTipTitle: { ...font.caption, color: color.text, marginBottom: 2 },
    safetyTipText: { ...font.sub, color: color.textSub, lineHeight: 18 },

    perfCard: { flexDirection: "row", alignItems: "center" },
    perfItem: { flex: 1, alignItems: "center", gap: 2 },
    perfDivider: {
      width: 1,
      alignSelf: "stretch",
      backgroundColor: color.divider,
    },
    perfValue: { ...font.h3, color: color.text },
    perfLabel: { ...font.caption, color: color.textMuted },

    boostActiveRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: space.sm,
      backgroundColor: color.goldTint,
      borderRadius: radius.md,
      padding: space.md,
      marginTop: space.md,
    },
    boostActiveText: { ...font.sub, color: color.text, fontWeight: "700" },
    boostActiveMeta: {
      ...font.caption,
      color: color.textMuted,
      fontWeight: "500",
      marginTop: 2,
    },
    boostActiveNote: {
      ...font.caption,
      color: color.textMuted,
      fontWeight: "500",
      marginTop: space.sm,
      lineHeight: 16,
    },

    boostBanner: {
      flexDirection: "row",
      alignItems: "center",
      gap: space.md,
      backgroundColor: color.brand,
      borderRadius: radius.lg,
      padding: space.md,
      marginTop: space.md,
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
    boostOptPrice: { ...font.h3, color: color.brand },

    similarSection: {
      marginTop: space.xxl,
      paddingTop: space.lg,
      backgroundColor: color.surface,
    },
    similarRail: {
      paddingHorizontal: space.lg,
      gap: space.md,
      paddingBottom: space.lg,
    },

    actionBar: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      paddingHorizontal: space.lg,
      paddingTop: space.md,
      backgroundColor: color.surface,
      borderTopWidth: 1,
      borderTopColor: color.border,
      ...shadow.lg,
    },
    actionRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
    actionIconBtn: {
      width: 50,
      height: 50,
      borderRadius: radius.md,
      backgroundColor: color.brandTint,
      borderWidth: 1,
      borderColor: color.brandTintStrong,
      alignItems: "center",
      justifyContent: "center",
    },
    actionWhatsapp: { backgroundColor: "#25D366", borderColor: "#25D366" },
    actionChat: {
      flex: 1,
      height: 50,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: space.sm,
      backgroundColor: color.brand,
      borderRadius: radius.md,
    },
    actionChatText: { ...font.bodyStrong, color: "#fff" },

    sheetBackdrop: {
      flex: 1,
      backgroundColor: color.overlay,
      justifyContent: "flex-end",
    },
    sheet: {
      backgroundColor: color.surface,
      borderTopLeftRadius: radius.xl,
      borderTopRightRadius: radius.xl,
      paddingHorizontal: space.lg,
      paddingTop: space.md,
    },
    sheetHandle: {
      alignSelf: "center",
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: color.borderStrong,
      marginBottom: space.md,
    },
    sheetTitle: { ...font.h3, color: color.text },
    sheetSub: {
      ...font.sub,
      color: color.textMuted,
      marginTop: 2,
      marginBottom: space.sm,
    },
    reasonRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: space.md,
      borderTopWidth: 1,
      borderTopColor: color.divider,
    },
    reasonText: { ...font.body, color: color.text },

    viewerBackdrop: { flex: 1, backgroundColor: "#000" },
    viewerClose: {
      position: "absolute",
      right: space.lg,
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: "rgba(255,255,255,0.15)",
      alignItems: "center",
      justifyContent: "center",
    },
  });
}
