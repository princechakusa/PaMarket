// Customer-facing list of the caller's own shop order requests — the
// screen Part D's "My Orders" requirement was missing entirely (only the
// shop-owner side, business-orders/[id].tsx, existed before). Reads go
// through the existing RLS-scoped `shop_orders` select (the same
// "customer or owner or admin read" policy fetchShopOrderDetail already
// relies on) — no new table, no new RPC, and closing/reopening the app
// never loses these rows since they live in the database, not local state.
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { fetchMyShopOrders, orderStatusMeta, FULFILLMENT_LABELS, type MyOrderListRow } from "../lib/shop-orders";
import { logClientError } from "../lib/error-log";
import { EmptyState, ErrorState, GlassBackButton } from "../components/ui";
import { font, radius, space, type ColorPalette } from "../lib/theme";
import { useThemedStyles } from "../lib/theme-provider";
import { useIOSNativeHeader } from "../lib/useIOSNativeHeader";

export default function MyOrdersScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const styles = useThemedStyles(buildStyles);
  const { session } = useAuth();

  const [orders, setOrders] = useState<MyOrderListRow[]>([]);
  const [shopNames, setShopNames] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useIOSNativeHeader({ backgroundColor: styles.headerBg.color, tintColor: "#FFFFFF", title: "Order Requests" });

  const load = useCallback(async () => {
    const userId = session?.user?.id;
    if (!userId) return;
    setError(null);
    const result = await fetchMyShopOrders(userId);
    if (result.error) {
      setError(result.error);
      logClientError({ error: result.error, screen: "my-orders", component: "load" });
      return;
    }
    setOrders(result.orders);
    const businessIds = Array.from(new Set(result.orders.map((o) => o.business_id)));
    if (businessIds.length) {
      const { data } = await supabase.from("businesses").select("id,name").in("id", businessIds);
      const map: Record<string, string> = {};
      for (const b of (data as { id: string; name: string }[]) ?? []) map[b.id] = b.name;
      setShopNames(map);
    }
  }, [session?.user?.id]);

  useEffect(() => {
    setIsLoading(true);
    load().finally(() => setIsLoading(false));
  }, [load]);

  const header = Platform.OS !== "ios" ? (
    <View style={[styles.headerBar, { paddingTop: insets.top + 10 }]}>
      <GlassBackButton onPress={() => router.back()} tone="light" flat />
      <Text style={styles.headerTitle}>Order Requests</Text>
      <View style={{ width: 40 }} />
    </View>
  ) : null;

  if (isLoading) {
    return (
      <View style={styles.container}>
        {header}
        <View style={styles.centered}>
          <ActivityIndicator color={styles.headerBg.color} />
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        {header}
        <ErrorState subtitle={error} onRetry={load} />
      </View>
    );
  }

  if (!orders.length) {
    return (
      <View style={styles.container}>
        {header}
        <EmptyState
          icon={
            <Svg width={30} height={30} viewBox="0 0 24 24" fill="none" stroke={styles.emptyIcon.color} strokeWidth={2}>
              <Path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
              <Path d="M3 6h18" />
              <Path d="M16 10a4 4 0 0 1-8 0" />
            </Svg>
          }
          title="No order requests yet"
          subtitle="Orders you send to shops will show up here."
          buttonLabel="Browse Shops"
          onPressButton={() => router.push("/shops")}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {header}
      <FlatList
        data={orders}
        keyExtractor={(o) => o.id}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={{ height: space.sm }} />}
        renderItem={({ item }) => {
          const meta = orderStatusMeta(item.status);
          return (
            <Pressable
              style={styles.row}
              onPress={() => router.push({ pathname: "/shop-order/[id]", params: { id: item.id } })}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.shopName} numberOfLines={1}>
                  {shopNames[item.business_id] ?? "Shop"}
                </Text>
                <Text style={styles.meta}>
                  {item.item_count} item{item.item_count === 1 ? "" : "s"} · {FULFILLMENT_LABELS[item.fulfillment_method]}
                </Text>
                <Text style={styles.reference}>#{item.id.slice(0, 8).toUpperCase()}</Text>
              </View>
              <View style={[styles.statusPill, { backgroundColor: meta.bg, borderColor: meta.border }]}>
                <Text style={[styles.statusPillText, { color: meta.color }]}>{meta.label}</Text>
              </View>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

function buildStyles(color: ColorPalette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: color.bg },
    centered: { flex: 1, alignItems: "center", justifyContent: "center" },
    headerBg: { color: color.brand },
    headerBar: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: color.brand, paddingHorizontal: 14, paddingBottom: 12 },
    headerTitle: { flex: 1, fontSize: 15, fontWeight: "700", color: color.textOnBrand, textAlign: "center" },
    emptyIcon: { color: color.brand },
    list: { padding: space.lg, paddingBottom: space.xxxl },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: space.md,
      backgroundColor: color.surface,
      borderRadius: radius.lg,
      padding: space.md,
    },
    shopName: { ...font.bodyStrong, color: color.text },
    meta: { ...font.caption, color: color.textMuted, marginTop: 2 },
    reference: { ...font.caption, color: color.textMuted, marginTop: 2 },
    statusPill: { paddingHorizontal: space.md, paddingVertical: 6, borderRadius: radius.pill, borderWidth: 1 },
    statusPillText: { ...font.caption, fontWeight: "800" },
  });
}
