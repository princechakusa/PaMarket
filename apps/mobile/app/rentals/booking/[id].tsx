// Booking detail for BOTH the customer and (read-only, via the same RLS
// policy) the provider — vehicle, provider, dates/times, pickup/return
// info, price breakdown, status, contact/chat, cancel where permitted.
// The provider's own actions (accept/decline/pickup/return/complete) live
// in rental-fleet/bookings.tsx, not here — this screen never mutates
// status for a provider viewer, only for the customer's own cancel.
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Image } from "expo-image";
import Svg, { Path } from "react-native-svg";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../../lib/auth";
import {
  brandLabel,
  cancelRentalBooking,
  RENTAL_BOOKING_STATUS_LABEL,
  RENTAL_BOOKING_STATUS_TONE,
  type RentalBookingStatus,
} from "../../../lib/rentals";
import { Badge, ConfirmModal, EmptyState } from "../../../components/ui";
import { color, radius, space, font, type ColorPalette } from "../../../lib/theme";
import { useThemedStyles } from "../../../lib/theme-provider";
import { useIOSNativeHeader } from "../../../lib/useIOSNativeHeader";
import { toast } from "../../../components/ui/Toast";

type BookingDetail = {
  id: string;
  listing_id: string;
  company_id: string;
  customer_id: string;
  status: RentalBookingStatus;
  pickup_at: string;
  return_at: string;
  fulfillment: "pickup" | "delivery";
  delivery_address: string | null;
  with_driver: boolean;
  daily_rate: number;
  rental_days: number;
  rate_subtotal: number;
  driver_fee: number;
  extras_fee: number;
  deposit: number;
  total_amount: number;
  currency: string;
  customer_note: string | null;
  decline_reason: string | null;
  cancellation_reason: string | null;
  cancelled_by: string | null;
  created_at: string;
};

type VehicleInfo = { model: string; year: number | null; cover_url: string | null; brand_slug: string | null; pickup_suburb: string | null };
type ProviderInfo = { name: string; phone: string | null; whatsapp: string | null; owner_user_id: string };

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

const CUSTOMER_CANCELLABLE: RentalBookingStatus[] = ["requested", "confirmed"];

function BackIcon({ stroke }: { stroke: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={2}>
      <Path d="M15 18l-6-6 6-6" />
    </Svg>
  );
}

export default function RentalBookingDetailScreen() {
  const styles = useThemedStyles(buildStyles);
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session } = useAuth();

  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [vehicle, setVehicle] = useState<VehicleInfo | null>(null);
  const [provider, setProvider] = useState<ProviderInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  useIOSNativeHeader({
    backgroundColor: color.brand,
    tintColor: color.textOnBrand,
    androidNative: true,
    title: "Booking Details",
    headerLeft: () => (
      <Pressable onPress={() => router.back()} hitSlop={10}>
        <BackIcon stroke={color.textOnBrand} />
      </Pressable>
    ),
  });

  const load = useCallback(async () => {
    if (!id) return;
    // RLS scopes this to the caller (customer_id = auth.uid() OR they own
    // the company OR admin) — no separate authorization check needed here.
    const { data: b } = await supabase
      .from("rental_bookings")
      .select(
        "id,listing_id,company_id,customer_id,status,pickup_at,return_at,fulfillment,delivery_address,with_driver,daily_rate,rental_days,rate_subtotal,driver_fee,extras_fee,deposit,total_amount,currency,customer_note,decline_reason,cancellation_reason,cancelled_by,created_at"
      )
      .eq("id", id)
      .maybeSingle();
    if (!b) {
      setNotFound(true);
      return;
    }
    setBooking(b as BookingDetail);

    const [{ data: v }, { data: media }, { data: brand }] = await Promise.all([
      supabase.from("rental_vehicle_listings").select("model,year,pickup_suburb,brand_id").eq("id", b.listing_id).maybeSingle(),
      supabase.from("rental_vehicle_media").select("url").eq("listing_id", b.listing_id).eq("is_cover", true).maybeSingle(),
      supabase
        .from("rental_vehicle_listings")
        .select("brand_id")
        .eq("id", b.listing_id)
        .maybeSingle()
        .then(async (r) => {
          if (!r.data?.brand_id) return { data: null };
          return supabase.from("rental_brands").select("slug").eq("id", r.data.brand_id).maybeSingle();
        }),
    ]);
    if (v) setVehicle({ model: v.model, year: v.year, pickup_suburb: v.pickup_suburb, cover_url: (media as { url: string } | null)?.url ?? null, brand_slug: (brand as { slug: string } | null)?.slug ?? null });

    const { data: rc } = await supabase.from("rental_companies").select("business_id").eq("id", b.company_id).maybeSingle();
    if (rc?.business_id) {
      const { data: biz } = await supabase.from("businesses").select("name,phone,whatsapp,owner_user_id").eq("id", rc.business_id).maybeSingle();
      if (biz) setProvider(biz as ProviderInfo);
    }
  }, [id]);

  useEffect(() => {
    setIsLoading(true);
    load().finally(() => setIsLoading(false));
  }, [load]);

  const isCustomer = session?.user?.id === booking?.customer_id;
  const canCancel = isCustomer && booking && CUSTOMER_CANCELLABLE.includes(booking.status);

  async function handleCancel() {
    if (!booking) return;
    setCancelling(true);
    const result = await cancelRentalBooking(booking.id);
    setCancelling(false);
    setCancelOpen(false);
    if (!result.ok) {
      toast(result.message || "Could not cancel this booking", 3500, true);
      return;
    }
    toast("Booking cancelled");
    load();
  }

  async function openChat() {
    if (!provider?.owner_user_id || !session?.user) return;
    const { data: convId } = await supabase.rpc("get_or_create_rental_conversation", {
      p_listing_id: booking?.listing_id,
      p_company_id: booking?.company_id,
      p_user_id: session.user.id,
    });
    if (typeof convId === "string") {
      router.push({ pathname: "/chat/[id]", params: { id: convId } });
    }
  }

  function callProvider() {
    if (provider?.phone) Linking.openURL(`tel:${provider.phone}`);
  }

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={color.brand} />
      </View>
    );
  }
  if (notFound || !booking) {
    return (
      <View style={styles.container}>
        <EmptyState title="Booking not found" subtitle="This booking may have been removed." />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {vehicle?.cover_url ? (
          <Image source={{ uri: vehicle.cover_url }} style={styles.coverImage} contentFit="cover" />
        ) : null}

        <View style={styles.section}>
          <View style={styles.titleRow}>
            <Text style={styles.vehicleTitle}>
              {brandLabel(vehicle?.brand_slug ?? null)} {vehicle?.model} {vehicle?.year ?? ""}
            </Text>
            <Badge label={RENTAL_BOOKING_STATUS_LABEL[booking.status]} tone={RENTAL_BOOKING_STATUS_TONE[booking.status]} />
          </View>
          {provider ? <Text style={styles.providerName}>{provider.name}</Text> : null}
        </View>

        {booking.status === "declined" && booking.decline_reason ? (
          <View style={[styles.section, styles.noteCard, styles.noteCardDanger]}>
            <Text style={styles.noteLabel}>Declined</Text>
            <Text style={styles.noteText}>{booking.decline_reason}</Text>
          </View>
        ) : null}
        {booking.status === "cancelled" && booking.cancellation_reason ? (
          <View style={[styles.section, styles.noteCard]}>
            <Text style={styles.noteLabel}>Cancellation note</Text>
            <Text style={styles.noteText}>{booking.cancellation_reason}</Text>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Rental Period</Text>
          <InfoRow label="Pick-up" value={formatDateTime(booking.pickup_at)} styles={styles} />
          <InfoRow label="Return" value={formatDateTime(booking.return_at)} styles={styles} />
          <InfoRow label="Duration" value={`${booking.rental_days} day${booking.rental_days === 1 ? "" : "s"}`} styles={styles} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{booking.fulfillment === "delivery" ? "Delivery" : "Pick-up"} Information</Text>
          {booking.fulfillment === "delivery" ? (
            <InfoRow label="Address" value={booking.delivery_address || "-"} styles={styles} />
          ) : (
            <InfoRow label="Location" value={vehicle?.pickup_suburb || "Arranged with provider"} styles={styles} />
          )}
          {booking.with_driver ? <InfoRow label="Driver" value="Included" styles={styles} /> : null}
          {booking.customer_note ? <InfoRow label="Your note" value={booking.customer_note} styles={styles} /> : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Price Breakdown</Text>
          <BreakdownRow label={`$${booking.daily_rate}/day × ${booking.rental_days} days`} value={booking.rate_subtotal} styles={styles} />
          {booking.driver_fee > 0 ? <BreakdownRow label="Driver" value={booking.driver_fee} styles={styles} /> : null}
          {booking.extras_fee > 0 ? <BreakdownRow label="Extras" value={booking.extras_fee} styles={styles} /> : null}
          {booking.deposit > 0 ? <BreakdownRow label="Security deposit" value={booking.deposit} styles={styles} /> : null}
          <View style={styles.divider} />
          <BreakdownRow label="Total" value={booking.total_amount} bold styles={styles} />
        </View>

        {isCustomer ? (
          <View style={styles.actionsRow}>
            {provider?.phone ? (
              <Pressable style={styles.secondaryButton} onPress={callProvider}>
                <Text style={styles.secondaryButtonText}>Call</Text>
              </Pressable>
            ) : null}
            <Pressable style={styles.secondaryButton} onPress={openChat}>
              <Text style={styles.secondaryButtonText}>Chat</Text>
            </Pressable>
            {canCancel ? (
              <Pressable style={styles.dangerButton} onPress={() => setCancelOpen(true)}>
                <Text style={styles.dangerButtonText}>Cancel Booking</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </ScrollView>

      <ConfirmModal
        visible={cancelOpen}
        title="Cancel this booking?"
        body="The provider will be notified. This cannot be undone."
        confirmText={cancelling ? "Cancelling…" : "Cancel Booking"}
        cancelText="Keep Booking"
        danger
        onConfirm={handleCancel}
        onCancel={() => setCancelOpen(false)}
      />
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

function BreakdownRow({ label, value, bold, styles }: { label: string; value: number; bold?: boolean; styles: ReturnType<typeof buildStyles> }) {
  return (
    <View style={styles.infoRow}>
      <Text style={[styles.infoLabel, bold && styles.infoLabelBold]}>{label}</Text>
      <Text style={[styles.infoValue, bold && styles.infoValueBold]}>${value.toLocaleString()}</Text>
    </View>
  );
}

function buildStyles(color: ColorPalette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: color.bg },
    centered: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: color.bg },
    content: { paddingBottom: space.xxxl },
    coverImage: { width: "100%", aspectRatio: 16 / 9, backgroundColor: color.surfaceAlt },
    section: {
      backgroundColor: color.surface,
      marginHorizontal: space.lg,
      marginTop: space.md,
      borderRadius: radius.md,
      padding: space.md,
    },
    titleRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: space.sm },
    vehicleTitle: { ...font.h3, color: color.text, flex: 1 },
    providerName: { ...font.sub, color: color.textMuted, marginTop: 2 },
    noteCard: { backgroundColor: color.warningTint },
    noteCardDanger: { backgroundColor: color.dangerTint },
    noteLabel: { ...font.caption, color: color.textMuted, marginBottom: 2 },
    noteText: { ...font.body, color: color.text },
    sectionTitle: { ...font.caption, color: color.textMuted, textTransform: "uppercase", marginBottom: space.sm },
    infoRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 5, gap: space.md },
    infoLabel: { ...font.sub, color: color.textMuted, flexShrink: 0 },
    infoLabelBold: { ...font.bodyStrong, color: color.text },
    infoValue: { ...font.sub, color: color.text, flex: 1, textAlign: "right" },
    infoValueBold: { ...font.price, color: color.brand },
    divider: { height: 1, backgroundColor: color.border, marginVertical: space.xs },
    actionsRow: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginHorizontal: space.lg, marginTop: space.lg },
    secondaryButton: {
      flexGrow: 1,
      paddingVertical: space.md,
      borderRadius: radius.md,
      alignItems: "center",
      backgroundColor: color.surfaceAlt,
      borderWidth: 1,
      borderColor: color.border,
    },
    secondaryButtonText: { ...font.bodyStrong, color: color.text },
    dangerButton: {
      flexBasis: "100%",
      paddingVertical: space.md,
      borderRadius: radius.md,
      alignItems: "center",
      backgroundColor: color.dangerTint,
    },
    dangerButtonText: { ...font.bodyStrong, color: color.danger },
  });
}
