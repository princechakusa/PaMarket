import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { supabase } from "../../lib/supabase";
import { BRAND_BLUE } from "../../lib/constants";
import { toast } from "../../components/ui/Toast";
import type { RentalAvailabilityBlock } from "../../lib/rentals";
import { EmptyState } from "../../components/ui/EmptyState";

// Mirrors www/js/rentals-business.js H.pages.RentalAvailability — block/
// unblock date ranges in rental_vehicle_availability (display-only calendar,
// no booking engine, per rental_marketplace_schema.sql TABLE 10 comments).
export default function RentalAvailabilityScreen() {
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
    if (startDate > endDate) {
      toast("Start date must be before end date.");
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
        <ActivityIndicator color={BRAND_BLUE} />
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
                placeholderTextColor="#A1A1AA"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>To</Text>
              <TextInput
                style={styles.input}
                value={endDate}
                onChangeText={setEndDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#A1A1AA"
              />
            </View>
          </View>
          <Text style={styles.label}>Reason (optional)</Text>
          <TextInput
            style={styles.input}
            value={reason}
            onChangeText={setReason}
            placeholder="Maintenance, personal use..."
            placeholderTextColor="#A1A1AA"
          />
          <Pressable style={[styles.secondaryBtn, isSubmitting && styles.disabled]} onPress={addBlock} disabled={isSubmitting}>
            {isSubmitting ? <ActivityIndicator color={BRAND_BLUE} /> : <Text style={styles.secondaryBtnText}>Block Selected Dates</Text>}
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F6F9" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  sectionLabel: { fontSize: 14, fontWeight: "700", color: "#18181B", marginTop: 20, marginBottom: 10 },
  label: { fontSize: 12, fontWeight: "700", color: "#52525B", marginBottom: 6, marginTop: 10 },
  input: {
    height: 46,
    borderWidth: 1.5,
    borderColor: "#E4E4E7",
    borderRadius: 14,
    paddingHorizontal: 14,
    fontSize: 14,
    color: "#18181B",
    backgroundColor: "#ffffff",
  },
  row: { flexDirection: "row", gap: 10 },
  secondaryBtn: { marginTop: 14, borderWidth: 2, borderColor: BRAND_BLUE, borderRadius: 14, paddingVertical: 14, alignItems: "center" },
  secondaryBtnText: { color: BRAND_BLUE, fontSize: 14, fontWeight: "700" },
  disabled: { opacity: 0.6 },
  blockedBox: { backgroundColor: "#F9F9FB", borderWidth: 1.5, borderColor: "#E4E4E7", borderRadius: 14, padding: 20, alignItems: "center" },
  blockedTitle: { fontSize: 14, fontWeight: "700", color: "#52525B", marginBottom: 4 },
  blockedBody: { fontSize: 12, color: "#A1A1AA", textAlign: "center", lineHeight: 17 },
  blockRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#ffffff",
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
  },
  blockDates: { fontSize: 13, fontWeight: "700", color: "#18181B" },
  blockReason: { fontSize: 12, color: "#A1A1AA", marginTop: 2 },
  removeText: { fontSize: 12, fontWeight: "700", color: "#D92D20" },
});
