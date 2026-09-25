// Customer "My Rentals" — upcoming requests, confirmed, active, completed,
// cancelled. Reads via list_my_rental_bookings() (RLS-scoped to the caller
// anyway, but this brings the vehicle/company display fields in one round
// trip). Distinct from the fleet-owner's booking inbox (rental-fleet/
// bookings.tsx) and from rental_vehicle_leads (analytics, untouched).
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import { useAuth } from "../../lib/auth";
import {
  listMyRentalBookings,
  RENTAL_BOOKING_STATUS_LABEL,
  RENTAL_BOOKING_STATUS_TONE,
  type MyRentalBooking,
  type RentalBookingStatus,
} from "../../lib/rentals";
import { Badge, EmptyState } from "../../components/ui";
import { color, radius, space, font, type ColorPalette } from "../../lib/theme";
import { useThemedStyles } from "../../lib/theme-provider";
import { useIOSNativeHeader } from "../../lib/useIOSNativeHeader";

type FilterKey = "upcoming" | "confirmed" | "active" | "completed" | "cancelled";

const FILTERS: { key: FilterKey; label: string; statuses: RentalBookingStatus[] }[] = [
  { key: "upcoming", label: "Requests", statuses: ["requested"] },
  { key: "confirmed", label: "Confirmed", statuses: ["confirmed"] },
  { key: "active", label: "Active", statuses: ["picked_up", "active"] },
  { key: "completed", label: "Completed", statuses: ["returned", "completed"] },
  { key: "cancelled", label: "Cancelled", statuses: ["declined", "cancelled"] },
];

function timeUntil(iso: string): string {
  const days = Math.round((new Date(iso).getTime() - Date.now()) / 86400000);
  if (days < 0) return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return `In ${days} days`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export default function MyRentalBookingsScreen() {
  const styles = useThemedStyles(buildStyles);
  const router = useRouter();
  const { session } = useAuth();
  const [filter, setFilter] = useState<FilterKey>("upcoming");
  const [bookings, setBookings] = useState<MyRentalBooking[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useIOSNativeHeader({
    backgroundColor: color.brand,
    tintColor: color.textOnBrand,
    androidNative: true,
    title: "My Rentals",
  });

  const load = useCallback(async () => {
    if (!session?.user) return;
    const rows = await listMyRentalBookings(null);
    setBookings(rows);
  }, [session]);

  useEffect(() => {
    setIsLoading(true);
    load().finally(() => setIsLoading(false));
  }, [load]);

  const activeFilter = FILTERS.find((f) => f.key === filter)!;
  const filtered = bookings.filter((b) => activeFilter.statuses.includes(b.status));

  return (
    <View style={styles.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabRow}>
        {FILTERS.map((f) => {
          const count = bookings.filter((b) => f.statuses.includes(b.status)).length;
          const isActive = f.key === filter;
          return (
            <Pressable
              key={f.key}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              style={[styles.tab, isActive && styles.tabActive]}
              onPress={() => setFilter(f.key)}
            >
              <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                {f.label}
                {count ? ` (${count})` : ""}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={color.brand} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={{ height: space.sm }} />}
          ListEmptyComponent={
            <EmptyState
              title={filter === "upcoming" ? "No booking requests yet" : "Nothing here yet"}
              subtitle={
                filter === "upcoming"
                  ? "Browse rental vehicles and send a booking request to see it here."
                  : "Bookings will show up here once they reach this stage."
              }
              buttonLabel={filter === "upcoming" ? "Browse Rentals" : undefined}
              onPressButton={filter === "upcoming" ? () => router.push("/rentals") : undefined}
            />
          }
          renderItem={({ item }) => (
            <Pressable
              style={styles.card}
              onPress={() => router.push({ pathname: "/rentals/booking/[id]", params: { id: item.id } })}
            >
              {item.cover_url ? (
                <Image source={{ uri: item.cover_url }} style={styles.thumb} contentFit="cover" />
              ) : (
                <View style={[styles.thumb, styles.thumbPlaceholder]} />
              )}
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={styles.cardTopRow}>
                  <Text style={styles.vehicleName} numberOfLines={1}>
                    {[item.vehicle_model, item.vehicle_year].filter(Boolean).join(" ")}
                  </Text>
                  <Badge label={RENTAL_BOOKING_STATUS_LABEL[item.status]} tone={RENTAL_BOOKING_STATUS_TONE[item.status]} />
                </View>
                <Text style={styles.companyName} numberOfLines={1}>
                  {item.company_name}
                </Text>
                <Text style={styles.dateRange}>
                  {formatDate(item.pickup_at)} → {formatDate(item.return_at)}
                  {item.status === "requested" || item.status === "confirmed" ? ` · ${timeUntil(item.pickup_at)}` : ""}
                </Text>
                <Text style={styles.total}>${item.total_amount.toLocaleString()}</Text>
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

function buildStyles(color: ColorPalette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: color.bg },
    centered: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 80 },
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
    listContent: { padding: space.lg, paddingTop: 0, flexGrow: 1 },
    card: {
      flexDirection: "row",
      gap: space.md,
      backgroundColor: color.surface,
      borderRadius: radius.md,
      padding: space.md,
    },
    thumb: { width: 72, height: 72, borderRadius: radius.sm },
    thumbPlaceholder: { backgroundColor: color.surfaceAlt },
    cardTopRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: space.sm },
    vehicleName: { ...font.bodyStrong, color: color.text, flex: 1 },
    companyName: { ...font.sub, color: color.textMuted, marginTop: 2 },
    dateRange: { ...font.sub, color: color.textSub, marginTop: space.xs },
    total: { ...font.bodyStrong, color: color.brand, marginTop: space.xs },
  });
}
