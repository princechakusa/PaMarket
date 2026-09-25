// Booking options + price breakdown + submit, opened once the customer has
// picked valid pick-up/return dates on the detail screen's calendar.
// Flow: Vehicle -> Dates (detail screen) -> this sheet (Pickup/Return time,
// Options, Price breakdown) -> Booking request -> Confirmation.
//
// The price shown here always comes from rental_quote_booking() (server
// side) — never computed client-side — and requestRentalBooking() is the
// only call that actually creates the booking, re-verifying availability
// and identity itself. This sheet is a UI convenience only; it has no
// authority over what gets booked or at what price.
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { BlurView } from "expo-blur";
import { Button } from "../ui";
import {
  quoteRentalBooking,
  requestRentalBooking,
  RENTAL_DATES_INVALID_CODE,
  RENTAL_DATES_UNAVAILABLE_CODE,
  type RentalQuote,
} from "../../lib/rentals";
import { radius, space, font, type ColorPalette } from "../../lib/theme";
import { useThemedStyles } from "../../lib/theme-provider";

const PICKUP_HOURS = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19];

function formatHour(h: number): string {
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:00 ${period}`;
}

function isoToTimestamp(dateIso: string, hour: number): string {
  // Local device time is fine here — the server only reasons about whole
  // days for availability, and stores the exact instant the customer chose.
  const d = new Date(`${dateIso}T00:00:00`);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

function formatDateLabel(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

export type RentalBookingSheetVehicle = {
  id: string;
  title: string; // "Toyota Corolla 2019"
  daily_rate: number | null;
  driver_rate: number | null;
};

export function RentalBookingSheet({
  visible,
  vehicle,
  startDate,
  endDate,
  onClose,
  onRequested,
  onDatesUnavailable,
}: {
  visible: boolean;
  vehicle: RentalBookingSheetVehicle;
  startDate: string;
  endDate: string;
  onClose: () => void;
  onRequested: (bookingId: string) => void;
  onDatesUnavailable: () => void;
}) {
  const styles = useThemedStyles(buildStyles);
  const [pickupHour, setPickupHour] = useState(10);
  const [returnHour, setReturnHour] = useState(10);
  const [fulfillment, setFulfillment] = useState<"pickup" | "delivery">("pickup");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [withDriver, setWithDriver] = useState(false);
  const [note, setNote] = useState("");
  const [quote, setQuote] = useState<RentalQuote | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const pickupAt = useMemo(() => isoToTimestamp(startDate, pickupHour), [startDate, pickupHour]);
  const returnAt = useMemo(() => isoToTimestamp(endDate, returnHour), [endDate, returnHour]);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setQuoting(true);
    setQuoteError(null);
    quoteRentalBooking({ listingId: vehicle.id, pickupAt, returnAt, withDriver }).then((r) => {
      if (cancelled) return;
      setQuoting(false);
      if (r.error) setQuoteError(r.error);
      else setQuote(r.quote);
    });
    return () => {
      cancelled = true;
    };
  }, [visible, vehicle.id, pickupAt, returnAt, withDriver]);

  // Reset transient fields whenever a fresh date range is opened, so a
  // previous booking's note/options don't silently carry over.
  useEffect(() => {
    if (visible) {
      setPickupHour(10);
      setReturnHour(10);
      setFulfillment("pickup");
      setDeliveryAddress("");
      setWithDriver(false);
      setNote("");
    }
  }, [visible, startDate, endDate]);

  const canSubmit =
    !!quote &&
    !quoting &&
    !submitting &&
    (fulfillment === "pickup" || deliveryAddress.trim().length > 0);

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const result = await requestRentalBooking({
        listingId: vehicle.id,
        pickupAt,
        returnAt,
        fulfillment,
        deliveryAddress: fulfillment === "delivery" ? deliveryAddress.trim() : null,
        withDriver,
        customerNote: note.trim() || null,
      });
      if (result.ok) {
        onRequested(result.bookingId);
        return;
      }
      if (result.code === RENTAL_DATES_UNAVAILABLE_CODE) {
        onDatesUnavailable();
        return;
      }
      if (result.code === RENTAL_DATES_INVALID_CODE) {
        setQuoteError(result.message);
        return;
      }
      setQuoteError("Couldn't send your request. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropTap} onPress={onClose} />
        <BlurView intensity={40} tint="light" style={styles.sheet}>
          <View style={styles.grabber} />
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <Text style={styles.title}>Complete your request</Text>
            <Text style={styles.subtitle}>{vehicle.title}</Text>

            <View style={styles.dateRow}>
              <Text style={styles.dateRowText}>
                {formatDateLabel(startDate)} → {formatDateLabel(endDate)}
              </Text>
            </View>

            <Text style={styles.sectionLabel}>Pick-up time</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hourRow}>
              {PICKUP_HOURS.map((h) => (
                <Pressable
                  key={h}
                  accessibilityRole="button"
                  accessibilityState={{ selected: pickupHour === h }}
                  style={[styles.hourChip, pickupHour === h && styles.hourChipActive]}
                  onPress={() => setPickupHour(h)}
                >
                  <Text style={[styles.hourChipText, pickupHour === h && styles.hourChipTextActive]}>{formatHour(h)}</Text>
                </Pressable>
              ))}
            </ScrollView>

            <Text style={styles.sectionLabel}>Return time</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hourRow}>
              {PICKUP_HOURS.map((h) => (
                <Pressable
                  key={h}
                  accessibilityRole="button"
                  accessibilityState={{ selected: returnHour === h }}
                  style={[styles.hourChip, returnHour === h && styles.hourChipActive]}
                  onPress={() => setReturnHour(h)}
                >
                  <Text style={[styles.hourChipText, returnHour === h && styles.hourChipTextActive]}>{formatHour(h)}</Text>
                </Pressable>
              ))}
            </ScrollView>

            <Text style={styles.sectionLabel}>Fulfillment</Text>
            <View style={styles.segmentRow}>
              <Pressable
                style={[styles.segment, fulfillment === "pickup" && styles.segmentActive]}
                onPress={() => setFulfillment("pickup")}
              >
                <Text style={[styles.segmentText, fulfillment === "pickup" && styles.segmentTextActive]}>Pick up</Text>
              </Pressable>
              <Pressable
                style={[styles.segment, fulfillment === "delivery" && styles.segmentActive]}
                onPress={() => setFulfillment("delivery")}
              >
                <Text style={[styles.segmentText, fulfillment === "delivery" && styles.segmentTextActive]}>Delivery</Text>
              </Pressable>
            </View>
            {fulfillment === "delivery" ? (
              <TextInput
                style={styles.input}
                placeholder="Delivery address"
                placeholderTextColor={undefined}
                value={deliveryAddress}
                onChangeText={setDeliveryAddress}
              />
            ) : null}

            {vehicle.driver_rate != null ? (
              <View style={styles.driverRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionLabel}>Driver</Text>
                  <Text style={styles.driverHint}>+${vehicle.driver_rate}/day</Text>
                </View>
                <Switch value={withDriver} onValueChange={setWithDriver} />
              </View>
            ) : null}

            <Text style={styles.sectionLabel}>Note to provider (optional)</Text>
            <TextInput
              style={[styles.input, styles.noteInput]}
              placeholder="Anything the provider should know…"
              value={note}
              onChangeText={setNote}
              multiline
              maxLength={300}
            />

            <View style={styles.breakdownCard}>
              {quoting ? (
                <ActivityIndicator style={{ paddingVertical: space.lg }} />
              ) : quoteError ? (
                <Text style={styles.errorText}>{quoteError}</Text>
              ) : quote ? (
                <>
                  <BreakdownRow label={`$${quote.daily_rate}/day × ${quote.rental_days} day${quote.rental_days === 1 ? "" : "s"}`} value={quote.rate_subtotal} styles={styles} />
                  {quote.driver_fee > 0 ? <BreakdownRow label="Driver" value={quote.driver_fee} styles={styles} /> : null}
                  {quote.extras_fee > 0 ? <BreakdownRow label="Extras" value={quote.extras_fee} styles={styles} /> : null}
                  {quote.deposit > 0 ? <BreakdownRow label="Security deposit" value={quote.deposit} styles={styles} /> : null}
                  <View style={styles.breakdownDivider} />
                  <BreakdownRow label="Total" value={quote.total_amount} bold styles={styles} />
                </>
              ) : null}
            </View>

            <Button
              label={submitting ? "Sending…" : "Send booking request"}
              onPress={handleSubmit}
              disabled={!canSubmit}
              loading={submitting}
            />
            <Text style={styles.disclaimer}>
              This sends a request to the provider — you're not charged yet. Payment is arranged directly with the
              company once confirmed.
            </Text>
          </ScrollView>
        </BlurView>
      </View>
    </Modal>
  );
}

function BreakdownRow({
  label,
  value,
  bold,
  styles,
}: {
  label: string;
  value: number;
  bold?: boolean;
  styles: ReturnType<typeof buildStyles>;
}) {
  return (
    <View style={styles.breakdownRow}>
      <Text style={[styles.breakdownLabel, bold && styles.breakdownLabelBold]}>{label}</Text>
      <Text style={[styles.breakdownValue, bold && styles.breakdownValueBold]}>${value.toLocaleString()}</Text>
    </View>
  );
}

function buildStyles(color: ColorPalette) {
  return StyleSheet.create({
    backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.35)" },
    backdropTap: { flex: 1 },
    sheet: {
      maxHeight: "88%",
      borderTopLeftRadius: radius.xl,
      borderTopRightRadius: radius.xl,
      backgroundColor: color.surface,
      overflow: "hidden",
    },
    grabber: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: color.border, marginTop: space.sm },
    content: { padding: space.lg, paddingBottom: space.xxxl },
    title: { ...font.h3, color: color.text },
    subtitle: { ...font.sub, color: color.textMuted, marginTop: 2, marginBottom: space.md },
    dateRow: { backgroundColor: color.brandTint, borderRadius: radius.md, padding: space.md, marginBottom: space.lg },
    dateRowText: { ...font.bodyStrong, color: color.brand },
    sectionLabel: { ...font.caption, color: color.textMuted, marginTop: space.md, marginBottom: space.sm, textTransform: "uppercase" },
    hourRow: { gap: space.sm, paddingBottom: space.xs },
    hourChip: {
      paddingHorizontal: space.md,
      paddingVertical: space.sm,
      borderRadius: radius.pill,
      backgroundColor: color.surfaceAlt,
      borderWidth: 1,
      borderColor: color.border,
    },
    hourChipActive: { backgroundColor: color.brand, borderColor: color.brand },
    hourChipText: { ...font.sub, color: color.text },
    hourChipTextActive: { color: color.textOnBrand, fontWeight: "700" },
    segmentRow: { flexDirection: "row", gap: space.sm },
    segment: {
      flex: 1,
      paddingVertical: space.sm,
      borderRadius: radius.md,
      alignItems: "center",
      backgroundColor: color.surfaceAlt,
      borderWidth: 1,
      borderColor: color.border,
    },
    segmentActive: { backgroundColor: color.brand, borderColor: color.brand },
    segmentText: { ...font.bodyStrong, color: color.text },
    segmentTextActive: { color: color.textOnBrand },
    input: {
      marginTop: space.sm,
      borderWidth: 1,
      borderColor: color.border,
      borderRadius: radius.md,
      paddingHorizontal: space.md,
      paddingVertical: space.sm,
      ...font.body,
      color: color.text,
    },
    noteInput: { minHeight: 70, textAlignVertical: "top" },
    driverRow: { flexDirection: "row", alignItems: "center", marginTop: space.sm },
    driverHint: { ...font.sub, color: color.textMuted },
    breakdownCard: {
      marginTop: space.lg,
      backgroundColor: color.surfaceAlt,
      borderRadius: radius.md,
      padding: space.md,
    },
    breakdownRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 5 },
    breakdownLabel: { ...font.sub, color: color.textMuted },
    breakdownLabelBold: { ...font.bodyStrong, color: color.text },
    breakdownValue: { ...font.sub, color: color.text },
    breakdownValueBold: { ...font.price, color: color.brand },
    breakdownDivider: { height: 1, backgroundColor: color.border, marginVertical: space.xs },
    errorText: { ...font.body, color: color.danger, textAlign: "center", paddingVertical: space.md },
    disclaimer: { ...font.caption, color: color.textMuted, marginTop: space.md, textTransform: "none", lineHeight: 16 },
  });
}
