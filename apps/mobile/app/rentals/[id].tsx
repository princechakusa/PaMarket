import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { openPhone, openWhatsApp } from "../../lib/open-url";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import { brandLabel, type RentalSpecs, type RentalVehicleDetail } from "../../lib/rentals";
import { businessInitials } from "../../lib/businesses";
import { hitSlop, space, type ColorPalette } from "../../lib/theme";
import { useThemedStyles } from "../../lib/theme-provider";
import { GlassBackButton } from "../../components/ui";
import { useIOSNativeHeader } from "../../lib/useIOSNativeHeader";

function PhoneIcon({ stroke }: { stroke: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={2}>
      <Path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 2.1.74 3.26a2 2 0 0 1-.45 2.11l-1.27 1.27a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c1.16.38 2.3.61 3.26.74a2 2 0 0 1 1.72 2.03z" />
    </Svg>
  );
}

function WhatsAppIcon({ fill }: { fill: string }) {
  // Single path with fillRule="evenodd", not two overlapping solid-fill
  // paths — see app/listing/[id].tsx's WhatsAppIcon for why: two separate
  // paths in the same color render as a plain speech-bubble blob with the
  // handset glyph fully painted over, not the real WhatsApp logo.
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24">
      <Path
        fillRule="evenodd"
        fill={fill}
        d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z M11.99 0C5.364 0 0 5.372 0 11.994c0 2.116.554 4.1 1.524 5.822L.057 24l6.304-1.654A11.978 11.978 0 0 0 11.99 24C18.626 24 24 18.628 24 12.006 24 5.372 18.626 0 11.99 0z"
      />
    </Svg>
  );
}

function MessageIcon({ stroke }: { stroke: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={2}>
      <Path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </Svg>
  );
}

type RentalCompany = {
  id: string;
  business_id: string | null;
  avg_rating: number | null;
  review_count: number | null;
};

type BusinessInfo = {
  name: string;
  phone: string | null;
  whatsapp: string | null;
  owner_user_id: string;
};

type AvailabilityBlock = { starts_on: string; ends_on: string };

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function isBlocked(dateIso: string, blocks: AvailabilityBlock[]): boolean {
  return blocks.some((b) => dateIso >= b.starts_on && dateIso <= b.ends_on);
}

function eachDateInRange(startIso: string, endIso: string): string[] {
  const dates: string[] = [];
  const cursor = new Date(`${startIso}T00:00:00`);
  const end = new Date(`${endIso}T00:00:00`);
  while (cursor <= end) {
    dates.push(isoDate(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

function rangeHasBlockedDate(startIso: string, endIso: string, blocks: AvailabilityBlock[]): boolean {
  return eachDateInRange(startIso, endIso).some((dateIso) => isBlocked(dateIso, blocks));
}

function dayChipLabel(d: Date): { top: string; bottom: string } {
  return {
    top: d.toLocaleDateString(undefined, { weekday: "short" }),
    bottom: d.toLocaleDateString(undefined, { day: "numeric", month: "short" }),
  };
}

const DETAIL_COLUMNS =
  "id,model,year,daily_rate,weekly_rate,monthly_rate,deposit,min_rental_days,driver_rate,description,is_available,company_id,brand_id,location_id";

export default function RentalVehicleDetailScreen() {
  const styles = useThemedStyles(buildStyles);
  const tones = useThemedStyles(buildTones);
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const galleryRef = useRef<FlatList<string>>(null);

  const [vehicle, setVehicle] = useState<RentalVehicleDetail | null>(null);
  const [specs, setSpecs] = useState<RentalSpecs | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  // Purely local UI state for the photo viewer — never touches load(), so
  // opening/closing/swiping through photos cannot re-trigger the view-count
  // increment (that only fires once, keyed on `id`, inside load()) or any
  // inquiry/chat/booking logic.
  const [photoIndex, setPhotoIndex] = useState(0);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [features, setFeatures] = useState<string[]>([]);
  const [brandSlug, setBrandSlug] = useState<string | null>(null);
  const [company, setCompany] = useState<RentalCompany | null>(null);
  const [business, setBusiness] = useState<BusinessInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [availability, setAvailability] = useState<AvailabilityBlock[]>([]);
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);

  useIOSNativeHeader({
    backgroundColor: tones.brand,
    tintColor: tones.textOnBrand,
    title: vehicle ? `${brandLabel(brandSlug)} ${vehicle.model}` : "Vehicle",
  });
  const [isBooking, setIsBooking] = useState(false);

  const upcomingDays = useMemo(() => {
    const days: Date[] = [];
    const today = new Date();
    for (let i = 0; i < 45; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      days.push(d);
    }
    return days;
  }, []);

  const minRentalDays = vehicle?.min_rental_days ?? 1;
  const minEndDate = useMemo(() => {
    if (!startDate) return null;
    const d = new Date(startDate);
    d.setDate(d.getDate() + Math.max(minRentalDays - 1, 0));
    return isoDate(d);
  }, [startDate, minRentalDays]);

  const rentalDayCount = useMemo(() => {
    if (!startDate || !endDate) return 0;
    const ms = new Date(endDate).getTime() - new Date(startDate).getTime();
    return Math.round(ms / 86400000) + 1;
  }, [startDate, endDate]);

  const estimatedTotal = useMemo(() => {
    if (!rentalDayCount || vehicle?.daily_rate == null) return null;
    return rentalDayCount * vehicle.daily_rate;
  }, [rentalDayCount, vehicle?.daily_rate]);

  const load = useCallback(async () => {
    if (!id) return;
    const { data: v } = await supabase.from("rental_vehicle_listings").select(DETAIL_COLUMNS).eq("id", id).maybeSingle();
    if (!v) return;
    setVehicle(v as RentalVehicleDetail);

    // Mirrors listing/[id].tsx's increment_listing_view — this call was
    // simply never ported here, so rental view counts stayed frozen at 0
    // no matter how many times a listing was actually viewed.
    supabase.rpc("rental_increment_view", { p_listing_id: id }).then(
      () => {},
      () => {}
    );

    const [mediaRes, specsRes, featuresRes, brandRes] = await Promise.all([
      supabase.from("rental_vehicle_media").select("url,sort_order,is_cover").eq("listing_id", id).order("sort_order"),
      supabase
        .from("rental_vehicle_specs")
        .select("transmission,fuel_type,drive_type,seats,doors,mileage_km")
        .eq("listing_id", id)
        .maybeSingle(),
      supabase.from("rental_vehicle_features").select("feature").eq("listing_id", id).limit(30),
      (v as RentalVehicleDetail).brand_id
        ? supabase.from("rental_brands").select("slug").eq("id", (v as RentalVehicleDetail).brand_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    setPhotos(((mediaRes.data as { url: string }[]) ?? []).map((m) => m.url));
    setSpecs((specsRes.data as RentalSpecs) ?? null);
    setFeatures(((featuresRes.data as { feature: string }[]) ?? []).map((f) => f.feature));
    setBrandSlug((brandRes.data as { slug: string } | null)?.slug ?? null);

    const { data: avail } = await supabase
      .from("rental_vehicle_availability")
      .select("starts_on,ends_on")
      .eq("listing_id", id);
    setAvailability((avail as AvailabilityBlock[]) ?? []);

    if ((v as RentalVehicleDetail).company_id) {
      const { data: companyData } = await supabase
        .from("rental_companies")
        .select("id,business_id,avg_rating,review_count")
        .eq("id", (v as RentalVehicleDetail).company_id)
        .maybeSingle();
      setCompany((companyData as RentalCompany) ?? null);

      if ((companyData as RentalCompany | null)?.business_id) {
        const { data: businessData } = await supabase
          .from("businesses")
          .select("name,phone,whatsapp,owner_user_id")
          .eq("id", (companyData as RentalCompany).business_id!)
          .maybeSingle();
        setBusiness((businessData as BusinessInfo) ?? null);
      }
    }
  }, [id]);

  useEffect(() => {
    setIsLoading(true);
    load().finally(() => setIsLoading(false));
  }, [load]);

  async function getOrCreateRentalConversation() {
    if (!session?.user || !business || !company || !id) return null;

    if (session.user.id === business.owner_user_id) {
      throw new Error("Cannot open a conversation with your own rental company.");
    }

    const { data: rpcConvId, error: rpcError } = await supabase.rpc("get_or_create_rental_conversation", {
      p_listing_id: id,
      p_company_id: company.id,
      p_user_id: session.user.id,
    });

    if (!rpcError && typeof rpcConvId === "string" && rpcConvId.length > 0) {
      const { data: existing } = await supabase.from("conversations").select("id").eq("id", rpcConvId).maybeSingle();
      if (existing) return rpcConvId;
    }

    // The hardened RPC owns the rental-context write, but a new context has
    // a foreign key to conversations and the RPC no longer creates that row.
    // Only recover from that exact missing-conversation failure here. Other
    // authorization or validation errors must remain visible to the caller.
    if (rpcError?.code !== "23503") throw rpcError ?? new Error("Rental conversation was not created.");

    const [firstMember, secondMember] = [session.user.id, business.owner_user_id].sort();
    const convId = `rental_${firstMember}_${secondMember}_${id.replace(/-/g, "")}`;
    const { error: convError } = await supabase.from("conversations").upsert(
      {
        id: convId,
        members: [session.user.id, business.owner_user_id],
        listing_id: null,
        business_id: company.business_id,
      },
      { onConflict: "id", ignoreDuplicates: true }
    );
    if (convError) throw convError;

    // Retry the authoritative RPC now that its FK target exists. It resolves
    // the owner from company -> business, binds the rental context under
    // auth.uid(), and safely reuses an existing user/listing context.
    const { data: retryConvId, error: retryError } = await supabase.rpc("get_or_create_rental_conversation", {
      p_listing_id: id,
      p_company_id: company.id,
      p_user_id: session.user.id,
    });
    if (retryError) throw retryError;
    if (typeof retryConvId !== "string" || retryConvId.length === 0) {
      throw new Error("Rental conversation was not created.");
    }

    const { data: created, error: verifyError } = await supabase
      .from("conversations")
      .select("id")
      .eq("id", retryConvId)
      .maybeSingle();
    if (verifyError) throw verifyError;
    if (!created) throw new Error("Rental conversation could not be verified.");
    return retryConvId;
  }

  async function captureLead(
    leadSource: "chat" | "whatsapp_click" | "call_click" | "booking_request",
    conversationId?: string | null,
    requestedStartDate?: string | null,
    requestedEndDate?: string | null
  ) {
    if (!session?.user || !company || !id) return null;
    const { data: rpcLeadId, error: rpcError } = await supabase.rpc("rental_capture_lead", {
      p_listing_id: id,
      p_lead_source: leadSource,
      p_conversation_id: conversationId ?? null,
      p_requested_start_date: requestedStartDate ?? null,
      p_requested_end_date: requestedEndDate ?? null,
    });
    if (!rpcError && typeof rpcLeadId === "string") return rpcLeadId;

    const payload = {
      listing_id: id,
      company_id: company.id,
      user_id: session.user.id,
      lead_source: leadSource,
      status: "new",
      conversation_id: conversationId ?? null,
      requested_start_date: requestedStartDate ?? null,
      requested_end_date: requestedEndDate ?? null,
    };
    const { data, error } = await supabase.from("rental_vehicle_leads").insert(payload).select("id").maybeSingle();
    if (!error) return data?.id ?? null;

    // A customer can tap Chat/Call/WhatsApp repeatedly. The database keeps one
    // lead per user/listing, so duplicate capture should not block the contact.
    if (error.code === "23505") {
      const { data: existing } = await supabase
        .from("rental_vehicle_leads")
        .select("id")
        .eq("listing_id", id)
        .eq("user_id", session.user.id)
        .maybeSingle();
      return existing?.id ?? null;
    }
    console.warn("rental lead capture:", error);
    return null;
  }

  async function contactViaChat() {
    if (!session?.user) {
      router.push("/(auth)/sign-in");
      return;
    }
    if (!business || !company) return;
    if (business.owner_user_id === session.user.id) {
      Alert.alert("Your rental listing", "You cannot start a chat with your own rental company.");
      return;
    }
    try {
      const convId = await getOrCreateRentalConversation();
      if (!convId) return;
      // Lead capture happens once the customer actually sends a message
      // (chat/[id].tsx, gated on rentalListingId) — not here, so merely
      // opening the chat screen doesn't record an inquiry that never happened.
      router.push({ pathname: "/chat/[id]", params: { id: convId, rentalListingId: id } });
    } catch (e) {
      console.warn("rental chat:", e);
      Alert.alert("Could not open chat", "Please try again in a moment.");
    }
  }

  async function requestBooking() {
    if (!session?.user) {
      router.push("/(auth)/sign-in");
      return;
    }
    if (!business || !company || !startDate || !endDate) return;
    if (business.owner_user_id === session.user.id) {
      Alert.alert("Your rental listing", "You cannot request a booking from your own rental company.");
      return;
    }
    if (rangeHasBlockedDate(startDate, endDate, availability)) {
      Alert.alert("Dates unavailable", "One or more days in this rental period are already blocked. Please pick different dates.");
      return;
    }
    setIsBooking(true);
    try {
      const convId = await getOrCreateRentalConversation();
      if (!convId) return;
      await captureLead("booking_request", convId, startDate, endDate);
      const { data: profile } = await supabase.from("profiles").select("name").eq("id", session.user.id).maybeSingle();
      const totalText = estimatedTotal != null ? ` (est. $${estimatedTotal} for ${rentalDayCount} day${rentalDayCount === 1 ? "" : "s"})` : "";
      await supabase.from("messages").insert({
        conversation_id: convId,
        sender_id: session.user.id,
        sender_name: profile?.name ?? "",
        text: `Hi! I'd like to book the ${brandLabel(brandSlug)} ${vehicle?.model} from ${startDate} to ${endDate}${totalText}. Is it available?`,
        read: false,
      });
      router.push({ pathname: "/chat/[id]", params: { id: convId } });
    } finally {
      setIsBooking(false);
    }
  }

  async function callCompany() {
    if (!session?.user) {
      router.push("/(auth)/sign-in");
      return;
    }
    if (business?.phone) {
      await captureLead("call_click");
      openPhone(business.phone);
    }
  }

  async function whatsappCompany() {
    if (!session?.user) {
      router.push("/(auth)/sign-in");
      return;
    }
    if (business?.whatsapp) {
      await captureLead("whatsapp_click");
      const digits = business.whatsapp.replace(/[^0-9]/g, "");
      // openWhatsApp encodes the message itself — pre-encoding here would
      // double-escape it and show %20 in the chat draft.
      openWhatsApp(
        digits,
        `Hi ${business.name}! I saw your ${brandLabel(brandSlug)} ${vehicle?.model} rental on PaMarket Zimbabwe. Is it available?`
      );
    }
  }

  if (isLoading) {
    return (
      <View style={{ flex: 1 }}>
        {Platform.OS !== "ios" ? (
          <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
            <GlassBackButton onPress={() => router.back()} tone="light" flat />
          </View>
        ) : null}
        <View style={styles.centered}>
          <ActivityIndicator color={tones.brand} />
        </View>
      </View>
    );
  }

  if (!vehicle) {
    return (
      <View style={{ flex: 1 }}>
        {Platform.OS !== "ios" ? (
          <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
            <GlassBackButton onPress={() => router.back()} tone="light" flat />
          </View>
        ) : null}
        <View style={styles.centered}>
          <Text style={styles.notFoundText}>Vehicle not found</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {Platform.OS !== "ios" ? (
        <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
          <GlassBackButton onPress={() => router.back()} tone="light" flat />
          <Text style={styles.headerTitle} numberOfLines={1}>
            {brandLabel(brandSlug)} {vehicle.model}
          </Text>
          <View style={{ width: 20 }} />
        </View>
      ) : null}

      <ScrollView contentContainerStyle={{ paddingBottom: 90 }}>
        <View style={styles.photoWrap}>
          {photos.length ? (
            <FlatList
              ref={galleryRef}
              data={photos}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              keyExtractor={(_, i) => String(i)}
              onScroll={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
                const idx = Math.round(e.nativeEvent.contentOffset.x / width);
                if (idx !== photoIndex) setPhotoIndex(idx);
              }}
              scrollEventThrottle={16}
              renderItem={({ item, index }) => (
                <Pressable onPress={() => { setPhotoIndex(index); setViewerOpen(true); }}>
                  <Image source={{ uri: item }} style={[styles.photo, { width }]} contentFit="cover" transition={150} cachePolicy="memory-disk" />
                </Pressable>
              )}
            />
          ) : (
            <View style={[styles.photo, styles.photoPlaceholder]} />
          )}

          {photos.length > 1 ? (
            <View style={styles.photoCounter}>
              <Text style={styles.photoCounterText}>{photoIndex + 1} / {photos.length}</Text>
            </View>
          ) : null}

          {photos.length > 1 ? (
            <View style={styles.dotsRow}>
              {photos.map((_, i) => (
                <View key={i} style={[styles.dot, i === photoIndex && styles.dotActive]} />
              ))}
            </View>
          ) : null}
        </View>

        <View style={styles.content}>
          <Text style={styles.title}>
            {brandLabel(brandSlug)} {vehicle.model}
          </Text>
          <Text style={styles.subMeta}>
            {[vehicle.year, specs?.seats ? `${specs.seats} seats` : null, specs?.doors ? `${specs.doors} doors` : null]
              .filter(Boolean)
              .join(" · ")}
          </Text>

          <View style={styles.priceRow}>
            {vehicle.daily_rate != null ? (
              <View style={styles.priceCell}>
                <Text style={styles.priceValue}>${vehicle.daily_rate}</Text>
                <Text style={styles.priceLabel}>per day</Text>
              </View>
            ) : null}
            {vehicle.weekly_rate != null ? (
              <View style={styles.priceCell}>
                <Text style={styles.priceValue}>${vehicle.weekly_rate}</Text>
                <Text style={styles.priceLabel}>per week</Text>
              </View>
            ) : null}
            {vehicle.monthly_rate != null ? (
              <View style={styles.priceCell}>
                <Text style={styles.priceValue}>${vehicle.monthly_rate}</Text>
                <Text style={styles.priceLabel}>per month</Text>
              </View>
            ) : null}
          </View>

          <View style={[styles.availabilityBanner, !vehicle.is_available && styles.availabilityBannerBusy]}>
            <Text style={styles.availabilityBannerText}>
              {vehicle.is_available ? "Available Now" : "Currently Unavailable"}
            </Text>
          </View>

          {vehicle.is_available ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Select Rental Dates</Text>
              <Text style={styles.dateSubLabel}>Pick-up date</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dateChipRow}>
                {upcomingDays.map((d) => {
                  const iso = isoDate(d);
                  const blocked = isBlocked(iso, availability);
                  const label = dayChipLabel(d);
                  const active = startDate === iso;
                  return (
                    <Pressable
                      key={iso}
                      disabled={blocked}
                      style={[styles.dateChip, active && styles.dateChipActive, blocked && styles.dateChipBlocked]}
                      onPress={() => {
                        setStartDate(iso);
                        if (endDate && endDate < iso) setEndDate(null);
                      }}
                    >
                      <Text style={[styles.dateChipTop, active && styles.dateChipTextActive]}>{label.top}</Text>
                      <Text style={[styles.dateChipBottom, active && styles.dateChipTextActive]}>{label.bottom}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              {startDate ? (
                <>
                  <Text style={styles.dateSubLabel}>Return date</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dateChipRow}>
                    {upcomingDays
                      .filter((d) => isoDate(d) >= (minEndDate ?? startDate))
                      .map((d) => {
                        const iso = isoDate(d);
                        const blocked = isBlocked(iso, availability);
                        const label = dayChipLabel(d);
                        const active = endDate === iso;
                        return (
                          <Pressable
                            key={iso}
                            disabled={blocked}
                            style={[styles.dateChip, active && styles.dateChipActive, blocked && styles.dateChipBlocked]}
                            onPress={() => setEndDate(iso)}
                          >
                            <Text style={[styles.dateChipTop, active && styles.dateChipTextActive]}>{label.top}</Text>
                            <Text style={[styles.dateChipBottom, active && styles.dateChipTextActive]}>{label.bottom}</Text>
                          </Pressable>
                        );
                      })}
                  </ScrollView>
                </>
              ) : null}

              {minRentalDays > 1 ? (
                <Text style={styles.dateHint}>Minimum rental: {minRentalDays} days</Text>
              ) : null}

              {startDate && endDate ? (
                <View style={styles.estimateRow}>
                  <Text style={styles.estimateLabel}>
                    {rentalDayCount} day{rentalDayCount === 1 ? "" : "s"}
                  </Text>
                  {estimatedTotal != null ? <Text style={styles.estimateValue}>Est. ${estimatedTotal}</Text> : null}
                </View>
              ) : null}
            </View>
          ) : null}

          {specs ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Car Overview</Text>
              {specs.transmission ? <InfoRow label="Transmission" value={specs.transmission} styles={styles} /> : null}
              {specs.fuel_type ? <InfoRow label="Fuel Type" value={specs.fuel_type} styles={styles} /> : null}
              {specs.drive_type ? <InfoRow label="Drive Type" value={specs.drive_type} styles={styles} /> : null}
              {specs.mileage_km != null ? <InfoRow label="Mileage" value={`${specs.mileage_km.toLocaleString()} km`} styles={styles} /> : null}
            </View>
          ) : null}

          {features.length ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Features & Extras</Text>
              <View style={styles.featureWrap}>
                {features.map((f) => (
                  <View key={f} style={styles.featureChip}>
                    <Text style={styles.featureChipText}>{f}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {vehicle.description ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Description</Text>
              <Text style={styles.description}>{vehicle.description}</Text>
            </View>
          ) : null}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Rental Terms</Text>
            <View style={styles.termsGrid}>
              {vehicle.deposit != null ? <InfoRow label="Security Deposit" value={`$${vehicle.deposit}`} styles={styles} /> : null}
              {vehicle.min_rental_days != null ? (
                <InfoRow label="Minimum Rental" value={`${vehicle.min_rental_days} days`} styles={styles} />
              ) : null}
              {vehicle.driver_rate != null ? <InfoRow label="Driver Rate" value={`$${vehicle.driver_rate}/day`} styles={styles} /> : null}
            </View>
          </View>

          {business ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Listed by</Text>
              <View style={styles.dealerCard}>
                <View style={styles.dealerLogo}>
                  <Text style={styles.dealerLogoText}>{businessInitials(business.name)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.dealerName}>{business.name}</Text>
                  <Text style={styles.dealerMeta}>
                    {company?.avg_rating ? `★ ${company.avg_rating.toFixed(1)}` : "No reviews yet"}
                    {company?.review_count ? ` (${company.review_count})` : ""}
                  </Text>
                </View>
              </View>
            </View>
          ) : null}
        </View>
      </ScrollView>

      {business ? (
        <View style={styles.ctaBar}>
          {business.phone ? (
            <Pressable style={styles.ctaIconButton} onPress={callCompany}>
              <PhoneIcon stroke={tones.textOnBrand} />
            </Pressable>
          ) : null}
          {business.whatsapp ? (
            <Pressable style={[styles.ctaIconButton, styles.ctaWhatsapp]} onPress={whatsappCompany}>
              <WhatsAppIcon fill={tones.textOnBrand} />
            </Pressable>
          ) : null}
          {vehicle.is_available && startDate && endDate ? (
            <Pressable style={styles.ctaMessageButton} onPress={requestBooking} disabled={isBooking}>
              {isBooking ? (
                <ActivityIndicator color={tones.textOnBrand} />
              ) : (
                <Text style={styles.ctaMessageText}>Request to Book</Text>
              )}
            </Pressable>
          ) : (
            <Pressable style={styles.ctaMessageButton} onPress={contactViaChat}>
              <MessageIcon stroke={tones.textOnBrand} />
              <Text style={styles.ctaMessageText}>Chat</Text>
            </Pressable>
          )}
        </View>
      ) : null}

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
            getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
            onScroll={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
              const idx = Math.max(0, Math.min(photos.length - 1, Math.round(e.nativeEvent.contentOffset.x / width)));
              if (idx !== photoIndex) setPhotoIndex(idx);
            }}
            scrollEventThrottle={16}
            renderItem={({ item }) => (
              <View style={{ width, justifyContent: "center" }}>
                <Image source={{ uri: item }} style={{ width, height: "100%" }} contentFit="contain" cachePolicy="memory-disk" />
              </View>
            )}
          />
          {photos.length > 1 ? (
            <View style={[styles.photoCounter, { bottom: insets.bottom + space.md }]}>
              <Text style={styles.photoCounterText}>{photoIndex + 1} / {photos.length}</Text>
            </View>
          ) : null}
          <Pressable
            style={[styles.viewerClose, { top: insets.top + 10 }]}
            onPress={() => setViewerOpen(false)}
            hitSlop={hitSlop}
          >
            <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.4}>
              <Path d="M18 6L6 18M6 6l12 12" />
            </Svg>
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}

function InfoRow({ label, value, styles }: { label: string; value: string; styles: ReturnType<typeof buildStyles> }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function buildTones(color: ColorPalette) {
  return { brand: color.brand, textOnBrand: color.textOnBrand };
}

function buildStyles(color: ColorPalette) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: color.bg,
    },
    centered: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    notFoundText: {
      fontSize: 15,
      fontWeight: "600",
      color: color.text,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
      backgroundColor: color.brand,
      paddingHorizontal: 16,
      paddingBottom: 12,
    },
    headerTitle: {
      flex: 1,
      fontSize: 15,
      fontWeight: "700",
      color: color.textOnBrand,
      textAlign: "center",
    },
    photoWrap: {
      width: "100%",
      aspectRatio: 1.6,
      position: "relative",
    },
    photo: {
      width: "100%",
      height: "100%",
    },
    photoPlaceholder: {
      backgroundColor: color.skeleton,
    },
    photoCounter: {
      position: "absolute",
      right: space.md,
      bottom: space.md,
      backgroundColor: "rgba(0,0,0,0.55)",
      borderRadius: 12,
      paddingHorizontal: space.sm,
      paddingVertical: 3,
    },
    photoCounterText: { fontSize: 11.5, fontWeight: "700", color: "#fff" },
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
      backgroundColor: "rgba(255,255,255,0.45)",
    },
    dotActive: { backgroundColor: "#fff", width: 16 },
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
    content: {
      padding: 16,
    },
    title: {
      fontSize: 19,
      fontWeight: "800",
      color: color.text,
    },
    subMeta: {
      fontSize: 13,
      color: color.textMuted,
      marginTop: 4,
    },
    priceRow: {
      flexDirection: "row",
      gap: 10,
      marginTop: 16,
    },
    priceCell: {
      flex: 1,
      backgroundColor: color.surface,
      borderRadius: 12,
      padding: 12,
      alignItems: "center",
    },
    priceValue: {
      fontSize: 17,
      fontWeight: "800",
      color: color.brand,
    },
    priceLabel: {
      fontSize: 11,
      color: color.textMuted,
      marginTop: 2,
    },
    availabilityBanner: {
      marginTop: 12,
      backgroundColor: color.successTint,
      borderRadius: 10,
      paddingVertical: 10,
      alignItems: "center",
    },
    availabilityBannerBusy: {
      backgroundColor: color.dangerTint,
    },
    availabilityBannerText: {
      fontSize: 13,
      fontWeight: "700",
      color: color.success,
    },
    section: {
      marginTop: 20,
    },
    sectionTitle: {
      fontSize: 13,
      fontWeight: "700",
      color: color.text,
      marginBottom: 10,
    },
    dateSubLabel: {
      fontSize: 11,
      fontWeight: "700",
      color: color.textMuted,
      textTransform: "uppercase",
      marginTop: 8,
      marginBottom: 8,
    },
    dateChipRow: {
      gap: 8,
      paddingBottom: 4,
    },
    dateChip: {
      width: 56,
      paddingVertical: 10,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: color.border,
      backgroundColor: color.surfaceAlt,
      alignItems: "center",
    },
    dateChipActive: {
      backgroundColor: color.brand,
      borderColor: color.brand,
    },
    dateChipBlocked: {
      opacity: 0.35,
    },
    dateChipTop: {
      fontSize: 10,
      fontWeight: "600",
      color: color.textMuted,
    },
    dateChipBottom: {
      fontSize: 13,
      fontWeight: "700",
      color: color.text,
      marginTop: 2,
    },
    dateChipTextActive: {
      color: color.textOnBrand,
    },
    dateHint: {
      fontSize: 12,
      color: color.textMuted,
      marginTop: 8,
    },
    estimateRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: 14,
      padding: 12,
      borderRadius: 12,
      backgroundColor: color.brandTint,
    },
    estimateLabel: {
      fontSize: 13,
      fontWeight: "600",
      color: color.text,
    },
    estimateValue: {
      fontSize: 16,
      fontWeight: "800",
      color: color.brand,
    },
    infoRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingVertical: 6,
      borderBottomWidth: 1,
      borderBottomColor: color.divider,
    },
    infoLabel: {
      fontSize: 13,
      color: color.textMuted,
    },
    infoValue: {
      fontSize: 13,
      fontWeight: "700",
      color: color.text,
    },
    termsGrid: {
      backgroundColor: color.surface,
      borderRadius: 12,
      padding: 12,
    },
    featureWrap: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    featureChip: {
      backgroundColor: color.surface,
      borderRadius: 20,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    featureChipText: {
      fontSize: 12,
      fontWeight: "600",
      color: color.text,
    },
    description: {
      fontSize: 14,
      lineHeight: 21,
      color: color.textSub,
    },
    dealerCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: color.surface,
      borderRadius: 14,
      padding: 12,
    },
    dealerLogo: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: color.surfaceAlt,
      alignItems: "center",
      justifyContent: "center",
    },
    dealerLogoText: {
      fontSize: 16,
      fontWeight: "700",
      color: color.brand,
    },
    dealerName: {
      fontSize: 14,
      fontWeight: "700",
      color: color.text,
    },
    dealerMeta: {
      fontSize: 12,
      color: color.textMuted,
      marginTop: 2,
    },
    ctaBar: {
      flexDirection: "row",
      gap: 10,
      padding: 12,
      borderTopWidth: 1,
      borderTopColor: color.divider,
      backgroundColor: color.surface,
    },
    ctaIconButton: {
      width: 48,
      height: 48,
      borderRadius: 12,
      backgroundColor: color.brand,
      alignItems: "center",
      justifyContent: "center",
    },
    ctaWhatsapp: {
      backgroundColor: "#25D366",
    },
    ctaMessageButton: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      backgroundColor: color.gold,
      borderRadius: 12,
    },
    ctaMessageText: {
      color: color.textOnBrand,
      fontSize: 15,
      fontWeight: "700",
    },
  });
}
