import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { supabase } from "../../lib/supabase";
import { toast } from "../../components/ui/Toast";
import type { RentalAvailabilityBlock } from "../../lib/rentals";
import { EmptyState } from "../../components/ui/EmptyState";
import type { ColorPalette } from "../../lib/theme";
import { useThemedStyles } from "../../lib/theme-provider";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function rangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return aStart <= bEnd && bStart <= aEnd;
}

// Mirrors www/js/rentals-business.js H.pages.RentalAvailability — block/
// unblock date ranges in rental_vehicle_availability (display-only calendar,
// no booking engine, per rental_marketplace_schema.sql TABLE 10 comments).
export default function RentalAvailabilityScreen() {
  const styles = useThemedStyles(buildStyles);
  const tones = useThemedStyles(buildTones);
  const { id } = useLocalSearchParams<{ id: string }>();

  const [canWrite, setCanWrite] = useState(true);
  const [blocks, setBlocks] = useState<RentalAvailabilityBlock[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const { data: accessData } = await supabase.rpc("get_user_rental_access");
    setCanWrite(!!accessData?.can_create_vehicle);
    const { data } = await supabase
      .from("rental_vehicle_availability")
      .select("id,listing_id,starts_on,ends_on,reason")
      .eq("listing_id", id)
      .order("starts_on");
    setBlocks((data as RentalAvailabilityBlock[]) ?? []);
  }, [id]);

  useEffect(() => {
    setIsLoading(true);
    load().finally(() => setIsLoading(false));
  }, [load]);

  async function addBlock() {
    if (!id) return;
    if (!startDate || !endDate) {
      toast("Please enter both start and end dates.");
      return;
    }
    if (!ISO_DATE_RE.test(startDate) || !ISO_DATE_RE.test(endDate)) {
      toast("Use date format YYYY-MM-DD.");
      return;
    }
    if (startDate > endDate) {
      toast("Start date must be before end date.");
      return;
    }
    if (blocks.some((b) => rangesOverlap(startDate, endDate, b.starts_on, b.ends_on))) {
      toast("These dates overlap with an existing blocked period.", 4000, true);
      return;
    }
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from("rental_vehicle_availability")
        .insert({ listing_id: id, starts_on: startDate, ends_on: endDate, reason: reason.trim() || null });
      if (error) throw error;
      toast("Dates blocked.");
      setStartDate("");
      setEndDate("");
      setReason("");
      load();
    } catch (e: any) {
      if (e?.code === "42501") toast("Access denied. Your company account is not active.", 4000, true);
      else toast("Could not block dates.", 4000, true);
    } finally {
      setIsSubmitting(false);
    }
  }

  function removeBlock(blockId: string) {
    Alert.alert("Remove this block?", undefined, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          await supabase.from("rental_vehicle_availability").delete().eq("id", blockId);
          toast("Dates unblocked.");
          load();
        },
      },
    ]);
  }

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={tones.brand} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      {canWrite ? (
        <>
          <Text style={styles.sectionLabel}>Block Dates</Text>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>From</Text>
              <TextInput
                style={styles.input}
                value={startDate}
                onChangeText={setStartDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={tones.textMuted}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>To</Text>
              <TextInput
                style={styles.input}
                value={endDate}
                onChangeText={setEndDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={tones.textMuted}
              />
            </View>
          </View>
          <Text style={styles.label}>Reason (optional)</Text>
          <TextInput
            style={styles.input}
            value={reason}
            onChangeText={setReason}
            placeholder="Maintenance, personal use..."
            placeholderTextColor={tones.textMuted}
          />
          <Pressable style={[styles.secondaryBtn, isSubmitting && styles.disabled]} onPress={addBlock} disabled={isSubmitting}>
            {isSubmitting ? <ActivityIndicator color={tones.brand} /> : <Text style={styles.secondaryBtnText}>Block Selected Dates</Text>}
          </Pressable>
        </>
      ) : (
        <View style={styles.blockedBox}>
          <Text style={styles.blockedTitle}>Read-only mode</Text>
          <Text style={styles.blockedBody}>Availability management requires an active company account.</Text>
        </View>
      )}

      <Text style={styles.sectionLabel}>Blocked Periods</Text>
      {blocks.length ? (
        blocks.map((b) => (
          <View key={b.id} style={styles.blockRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.blockDates}>
                {b.starts_on} to {b.ends_on}
              </Text>
              <Text style={styles.blockReason}>{b.reason || "Blocked"}</Text>
            </View>
            {canWrite ? (
              <Pressable onPress={() => removeBlock(b.id)}>
                <Text style={styles.removeText}>Remove</Text>
              </Pressable>
            ) : null}
          </View>
        ))
      ) : (
        <EmptyState title="No blocked dates" subtitle="Vehicle is available." />
      )}
    </ScrollView>
  );
}

function buildTones(color: ColorPalette) {
  return { brand: color.brand, textMuted: color.textMuted };
}

function buildStyles(color: ColorPalette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: color.bg },
    centered: { flex: 1, alignItems: "center", justifyContent: "center" },
    sectionLabel: { fontSize: 14, fontWeight: "700", color: color.text, marginTop: 20, marginBottom: 10 },
    label: { fontSize: 12, fontWeight: "700", color: color.textSub, marginBottom: 6, marginTop: 10 },
    input: {
      height: 46,
      borderWidth: 1.5,
      borderColor: color.border,
      borderRadius: 14,
      paddingHorizontal: 14,
      fontSize: 14,
      color: color.text,
      backgroundColor: color.surface,
    },
    row: { flexDirection: "row", gap: 10 },
    secondaryBtn: { marginTop: 14, borderWidth: 2, borderColor: color.brand, borderRadius: 14, paddingVertical: 14, alignItems: "center" },
    secondaryBtnText: { color: color.brand, fontSize: 14, fontWeight: "700" },
    disabled: { opacity: 0.6 },
    blockedBox: { backgroundColor: color.surfaceAlt, borderWidth: 1.5, borderColor: color.border, borderRadius: 14, padding: 20, alignItems: "center" },
    blockedTitle: { fontSize: 14, fontWeight: "700", color: color.textSub, marginBottom: 4 },
    blockedBody: { fontSize: 12, color: color.textMuted, textAlign: "center", lineHeight: 17 },
    blockRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: color.surface,
      padding: 14,
      borderRadius: 12,
      marginBottom: 8,
    },
    blockDates: { fontSize: 13, fontWeight: "700", color: color.text },
    blockReason: { fontSize: 12, color: color.textMuted, marginTop: 2 },
    removeText: { fontSize: 12, fontWeight: "700", color: color.danger },
  });
}
