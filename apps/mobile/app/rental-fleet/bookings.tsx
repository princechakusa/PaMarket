// Provider bookings inbox — new requests, confirmed, upcoming pickups,
// active rentals, completed, cancelled/declined. Deliberately separate
// from leads.tsx (rental_vehicle_leads stays the analytics/inquiry funnel;
// this screen is real booking records only, per the Phase 1 brief).
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { supabase } from "../../lib/supabase";
import {
  acceptRentalBooking,
  cancelRentalBooking,
  completeRentalBooking,
  declineRentalBooking,
  listCompanyRentalBookings,
  markRentalPickedUp,
  markRentalReturned,
  RENTAL_BOOKING_STATUS_LABEL,
  RENTAL_BOOKING_STATUS_TONE,
  type CompanyRentalBooking,
  type RentalBookingStatus,
} from "../../lib/rentals";
import { Badge, EmptyState } from "../../components/ui";
import { toast } from "../../components/ui/Toast";
import { radius, space, font, type ColorPalette } from "../../lib/theme";
import { useThemedStyles } from "../../lib/theme-provider";
import { useIOSNativeHeader } from "../../lib/useIOSNativeHeader";

type FilterKey = "requested" | "confirmed" | "active" | "completed" | "cancelled";

const FILTERS: { key: FilterKey; label: string; statuses: RentalBookingStatus[] }[] = [
  { key: "requested", label: "New Requests", statuses: ["requested"] },
  { key: "confirmed", label: "Upcoming", statuses: ["confirmed"] },
  { key: "active", label: "Active", statuses: ["picked_up", "active"] },
  { key: "completed", label: "Completed", statuses: ["returned", "completed"] },
  { key: "cancelled", label: "Declined/Cancelled", statuses: ["declined", "cancelled"] },
];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}
function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

export default function RentalBookingsInboxScreen() {
  const styles = useThemedStyles(buildStyles);
  const tones = useThemedStyles(buildTones);
  const router = useRouter();
  const { bizId } = useLocalSearchParams<{ bizId: string }>();

  const [bookings, setBookings] = useState<CompanyRentalBooking[]>([]);
  const [filter, setFilter] = useState<FilterKey>("requested");
  const [isLoading, setIsLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  useIOSNativeHeader({
    backgroundColor: tones.brand,
    tintColor: tones.textOnBrand,
    androidNative: true,
    title: "Bookings",
  });

  const load = useCallback(async () => {
    if (!bizId) return;
    const { data: rc } = await supabase.from("rental_companies").select("id").eq("business_id", bizId).maybeSingle();
    if (!rc) return;
    const rows = await listCompanyRentalBookings(rc.id, null);
    setBookings(rows);
  }, [bizId]);

  useEffect(() => {
    setIsLoading(true);
    load().finally(() => setIsLoading(false));
  }, [load]);

  const activeFilter = FILTERS.find((f) => f.key === filter)!;
  const filtered = useMemo(() => bookings.filter((b) => activeFilter.statuses.includes(b.status)), [bookings, activeFilter]);
  const pendingCount = useMemo(() => bookings.filter((b) => b.status === "requested").length, [bookings]);

  async function refreshAfter(action: () => Promise<{ ok: true } | { ok: false; message: string }>, successMessage: string, bookingId: string) {
    setBusyId(bookingId);
    const result = await action();
    setBusyId(null);
    if (!result.ok) {
      toast(result.message || "Something went wrong", 3500, true);
      return;
    }
    toast(successMessage);
    load();
  }

  function handleAccept(b: CompanyRentalBooking) {
    Alert.alert("Confirm this booking?", `${b.customer_name} · ${formatDate(b.pickup_at)} → ${formatDate(b.return_at)}`, [
      { text: "Cancel", style: "cancel" },
      { text: "Confirm", onPress: () => refreshAfter(() => acceptRentalBooking(b.id), "Booking confirmed", b.id) },
    ]);
  }

  function handleDecline(b: CompanyRentalBooking) {
    Alert.prompt
      ? Alert.prompt(
          "Decline this request?",
          "Let the customer know why (optional).",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Decline",
              style: "destructive",
              onPress: (reason?: string) => refreshAfter(() => declineRentalBooking(b.id, reason || null), "Request declined", b.id),
            },
          ],
          "plain-text"
        )
      : Alert.alert("Decline this request?", undefined, [
          { text: "Cancel", style: "cancel" },
          { text: "Decline", style: "destructive", onPress: () => refreshAfter(() => declineRentalBooking(b.id, null), "Request declined", b.id) },
        ]);
  }

  function handleCancelConfirmed(b: CompanyRentalBooking) {
    Alert.alert("Cancel this confirmed booking?", "The customer will be notified.", [
      { text: "Keep Booking", style: "cancel" },
      {
        text: "Cancel Booking",
        style: "destructive",
        onPress: () => refreshAfter(() => cancelRentalBooking(b.id, "Cancelled by provider"), "Booking cancelled", b.id),
      },
    ]);
  }

  function handlePickedUp(b: CompanyRentalBooking) {
    refreshAfter(() => markRentalPickedUp(b.id), "Marked as picked up", b.id);
  }
  function handleReturned(b: CompanyRentalBooking) {
    refreshAfter(() => markRentalReturned(b.id), "Marked as returned", b.id);
  }
  function handleComplete(b: CompanyRentalBooking) {
    refreshAfter(() => completeRentalBooking(b.id), "Rental completed", b.id);
  }

  function openChat(b: CompanyRentalBooking) {
    if (b.conversation_id) {
      router.push(`/chat/${b.conversation_id}`);
    } else {
      toast("No chat thread yet for this booking.");
    }
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
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabRow}>
        {FILTERS.map((f) => {
          const isActive = f.key === filter;
          const count = f.key === "requested" ? pendingCount : bookings.filter((b) => f.statuses.includes(b.status)).length;
          return (
            <Pressable key={f.key} style={[styles.tab, isActive && styles.tabActive]} onPress={() => setFilter(f.key)}>
              <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                {f.label}
                {count ? ` (${count})` : ""}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView contentContainerStyle={styles.listContent}>
        {filtered.length === 0 ? (
          <EmptyState
            title={filter === "requested" ? "No new requests" : "Nothing here yet"}
            subtitle={
              filter === "requested"
                ? "New booking requests will appear here for you to review."
                : "Bookings will show up here once they reach this stage."
            }
          />
        ) : (
          filtered.map((b) => (
            <View key={b.id} style={styles.card}>
              <View style={styles.cardTopRow}>
                <Text style={styles.vehicleName} numberOfLines={1}>
                  {b.vehicle_model}
                </Text>
                <Badge label={RENTAL_BOOKING_STATUS_LABEL[b.status]} tone={RENTAL_BOOKING_STATUS_TONE[b.status]} />
              </View>
              <Text style={styles.customerName}>{b.customer_name}</Text>
              <Text style={styles.dateRange}>
                {formatDateTime(b.pickup_at)} → {formatDateTime(b.return_at)}
              </Text>
              <Text style={styles.meta}>
                {b.fulfillment === "delivery" ? `Delivery: ${b.delivery_address || "-"}` : "Pick-up"}
                {b.with_driver ? " · With driver" : ""}
              </Text>
              {b.customer_note ? <Text style={styles.note}>“{b.customer_note}”</Text> : null}
              <Text style={styles.total}>${b.total_amount.toLocaleString()} total</Text>

              <View style={styles.actionsRow}>
                <Pressable style={styles.chatButton} onPress={() => openChat(b)}>
                  <Text style={styles.chatButtonText}>Chat</Text>
                </Pressable>
                {busyId === b.id ? (
                  <ActivityIndicator color={tones.brand} style={{ marginLeft: space.sm }} />
                ) : (
                  <>
                    {b.status === "requested" ? (
                      <>
                        <Pressable style={styles.declineButton} onPress={() => handleDecline(b)}>
                          <Text style={styles.declineButtonText}>Decline</Text>
                        </Pressable>
                        <Pressable style={styles.primaryButton} onPress={() => handleAccept(b)}>
                          <Text style={styles.primaryButtonText}>Accept</Text>
                        </Pressable>
                      </>
                    ) : null}
                    {b.status === "confirmed" ? (
                      <>
                        <Pressable style={styles.declineButton} onPress={() => handleCancelConfirmed(b)}>
                          <Text style={styles.declineButtonText}>Cancel</Text>
                        </Pressable>
                        <Pressable style={styles.primaryButton} onPress={() => handlePickedUp(b)}>
                          <Text style={styles.primaryButtonText}>Mark Picked Up</Text>
                        </Pressable>
                      </>
                    ) : null}
                    {b.status === "picked_up" || b.status === "active" ? (
                      <Pressable style={styles.primaryButton} onPress={() => handleReturned(b)}>
                        <Text style={styles.primaryButtonText}>Mark Returned</Text>
                      </Pressable>
                    ) : null}
                    {b.status === "returned" ? (
                      <Pressable style={styles.primaryButton} onPress={() => handleComplete(b)}>
                        <Text style={styles.primaryButtonText}>Complete Rental</Text>
                      </Pressable>
                    ) : null}
                  </>
                )}
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

function buildTones(color: ColorPalette) {
  return { brand: color.brand, textOnBrand: color.textOnBrand };
}

function buildStyles(color: ColorPalette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: color.bg },
    centered: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: color.bg },
    tabRow: { gap: space.sm, paddingHorizontal: space.lg, paddingVertical: space.md },
    tab: {
      paddingHorizontal: space.md,
      paddingVertical: space.sm,
      borderRadius: radius.pill,
      backgroundColor: color.surfaceAlt,
      borderWidth: 1,
      borderColor: color.border,
    },
    tabActive: { backgroundColor: color.brand, borderColor: color.brand },
    tabText: { ...font.caption, color: color.textMuted, textTransform: "none" },
    tabTextActive: { color: color.textOnBrand },
    listContent: { padding: space.lg, paddingTop: 0, gap: space.sm, flexGrow: 1 },
    card: { backgroundColor: color.surface, borderRadius: radius.md, padding: space.md },
    cardTopRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: space.sm },
    vehicleName: { ...font.bodyStrong, color: color.text, flex: 1 },
    customerName: { ...font.sub, color: color.textMuted, marginTop: 2 },
    dateRange: { ...font.sub, color: color.textSub, marginTop: space.xs },
    meta: { ...font.caption, color: color.textMuted, marginTop: 2, textTransform: "none" },
    note: { ...font.sub, color: color.text, fontStyle: "italic", marginTop: space.xs },
    total: { ...font.bodyStrong, color: color.brand, marginTop: space.sm },
    actionsRow: { flexDirection: "row", alignItems: "center", gap: space.sm, marginTop: space.md },
    chatButton: {
      paddingHorizontal: space.md,
      paddingVertical: space.sm,
      borderRadius: radius.md,
      backgroundColor: color.surfaceAlt,
      borderWidth: 1,
      borderColor: color.border,
    },
    chatButtonText: { ...font.caption, color: color.text, textTransform: "none" },
    primaryButton: {
      flex: 1,
      paddingVertical: space.sm,
      borderRadius: radius.md,
      alignItems: "center",
      backgroundColor: color.brand,
    },
    primaryButtonText: { ...font.caption, color: color.textOnBrand, textTransform: "none" },
    declineButton: {
      flex: 1,
      paddingVertical: space.sm,
      borderRadius: radius.md,
      alignItems: "center",
      backgroundColor: color.dangerTint,
    },
    declineButtonText: { ...font.caption, color: color.danger, textTransform: "none" },
  });
}
