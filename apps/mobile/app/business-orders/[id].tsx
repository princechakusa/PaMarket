// Shop-owner order inbox for one business. Ownership is re-verified from
// the database every time this screen loads (never trusted from the route
// param) — mirrors the exact pattern app/business-leads/[id].tsx already
// uses: fetch businesses.owner_user_id fresh and compare to the signed-in
// user, rather than assuming the id in the URL belongs to this user.
// Reads go through the existing "shop_orders: customer or owner or admin
// read" RLS policy — an owner id mismatch here is a defense-in-depth UX
// gate (better error message), not the actual security boundary.
import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Platform, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import { fetchShopOrdersForBusiness, type OwnerOrderListRow } from "../../lib/shop-orders";
import { OwnerOrderRow } from "../../components/orders/OwnerOrderRow";
import { EmptyState, ErrorState, GlassBackButton } from "../../components/ui";
import { space, type ColorPalette } from "../../lib/theme";
import { useThemedStyles } from "../../lib/theme-provider";
import { useIOSNativeHeader } from "../../lib/useIOSNativeHeader";

const FETCH_TIMEOUT_MS = 12000;

function withTimeout<T>(promise: PromiseLike<T>, ms: number): Promise<T> {
  return Promise.race([promise, new Promise<T>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms))]);
}

type LoadState = "loading" | "not-owner" | "error" | "ready";

export default function BusinessOrdersScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const styles = useThemedStyles(buildStyles);

  const [state, setState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState<string>("Orders");
  const [orders, setOrders] = useState<OwnerOrderListRow[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const navigatingRef = useRef(false);

  useIOSNativeHeader({ backgroundColor: styles.headerBg.color, tintColor: "#FFFFFF", title: businessName });

  const load = useCallback(async () => {
    const userId = session?.user?.id;
    if (!id || !userId) return;
    setErrorMessage(null);
    try {
      const { data: biz, error: bizError } = await withTimeout(
        supabase.from("businesses").select("id,name,owner_user_id").eq("id", id).maybeSingle(),
        FETCH_TIMEOUT_MS
      );
      if (bizError) throw bizError;
      if (!biz) {
        setState("error");
        setErrorMessage("This shop couldn't be found.");
        return;
      }
      if (biz.owner_user_id !== userId) {
        setState("not-owner");
        return;
      }
      setBusinessName(biz.name || "Orders");

      const { orders: rows, error: ordersError } = await fetchShopOrdersForBusiness(id);
      if (ordersError) {
        setState("error");
        setErrorMessage(ordersError);
        return;
      }
      setOrders(rows);
      setState("ready");
    } catch (e) {
      setState("error");
      setErrorMessage((e as Error)?.message === "timeout" ? "This is taking longer than expected." : "Couldn't load orders. Please try again.");
    }
  }, [id, session?.user?.id]);

  // Refetch every time this screen gains focus (returning from an order's
  // detail screen after a status change) rather than only once on mount —
  // the reliable, leak-free alternative to a realtime subscription for
  // this stage.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function onRefresh() {
    setIsRefreshing(true);
    await load();
    setIsRefreshing(false);
  }

  function openOrder(orderId: string) {
    if (navigatingRef.current) return;
    navigatingRef.current = true;
    router.push({ pathname: "/owner-order/[id]", params: { id: orderId } });
    setTimeout(() => {
      navigatingRef.current = false;
    }, 800);
  }

  const header = Platform.OS !== "ios" ? (
    <View style={[styles.headerBar, { paddingTop: insets.top + 10 }]}>
      <GlassBackButton onPress={() => router.back()} tone="light" flat />
      <Text style={styles.headerTitle} numberOfLines={1}>
        {businessName}
      </Text>
      <View style={{ width: 40 }} />
    </View>
  ) : null;

  if (state === "loading") {
    return (
      <View style={styles.container}>
        {header}
        <View style={styles.centered}>
          <ActivityIndicator color={styles.headerBg.color} />
        </View>
      </View>
    );
  }

  if (state === "not-owner") {
    return (
      <View style={styles.container}>
        {header}
        <EmptyState title="Owner only" subtitle="Only this shop's owner can view its orders." />
      </View>
    );
  }

  if (state === "error") {
    return (
      <View style={styles.container}>
        {header}
        <ErrorState subtitle={errorMessage ?? undefined} onRetry={load} />
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
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
        renderItem={({ item }) => <OwnerOrderRow order={item} onPress={() => openOrder(item.id)} />}
        ItemSeparatorComponent={() => <View style={{ height: space.sm }} />}
        ListEmptyComponent={
          <EmptyState
            icon={
              <Svg width={30} height={30} viewBox="0 0 24 24" fill="none" stroke={styles.emptyIcon.color} strokeWidth={2}>
                <Path d="M3 9l1-5h16l1 5M4 9h16v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9Z" />
                <Path d="M8 9v2a2 2 0 0 0 4 0V9M12 9v2a2 2 0 0 0 4 0V9" />
              </Svg>
            }
            title="No orders yet"
            subtitle="Orders customers place through your shop will show up here."
          />
        }
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
    list: { padding: space.lg, flexGrow: 1 },
  });
}
