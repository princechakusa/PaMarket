// Shop-owner order detail + status management. Ownership of the order's
// business is re-verified from the database on every load — a customer or
// another shop's owner who somehow reaches this route (e.g. a stale deep
// link) sees "Owner only", never the management actions, even though RLS
// itself would let the actual customer read the same order row via
// shop_orders' own policy. All writes go through update_shop_order_status;
// there is no direct client update anywhere in this file.
import { useCallback, useState } from "react";
import { ActivityIndicator, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import {
  FULFILLMENT_LABELS,
  ORDER_STATUS_TRANSITIONS,
  fetchShopOrderDetail,
  formatMoney,
  formatOrderDateTime,
  orderStatusMeta,
  updateShopOrderStatus,
  type OrderStatus,
  type ShopOrderItemRow,
  type ShopOrderRow,
  type ShopOrderStatusHistoryRow,
} from "../../lib/shop-orders";
import { contactCustomerByPhone, contactCustomerByWhatsApp, normalizedPhoneDigits } from "../../lib/order-whatsapp";
import { logClientError } from "../../lib/error-log";
import { StatusChangeModal } from "../../components/orders/StatusChangeModal";
import { Button, Card, EmptyState, ErrorState, GlassBackButton, toast } from "../../components/ui";
import { font, radius, space, type ColorPalette } from "../../lib/theme";
import { useThemedStyles } from "../../lib/theme-provider";
import { useIOSNativeHeader } from "../../lib/useIOSNativeHeader";

const FETCH_TIMEOUT_MS = 12000;

function withTimeout<T>(promise: PromiseLike<T>, ms: number): Promise<T> {
  return Promise.race([promise, new Promise<T>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms))]);
}

type LoadState = "loading" | "not-owner" | "error" | "ready";

export default function OwnerOrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const styles = useThemedStyles(buildStyles);

  const [state, setState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [order, setOrder] = useState<ShopOrderRow | null>(null);
  const [business, setBusiness] = useState<{ id: string; name: string; logo: string | null } | null>(null);
  const [items, setItems] = useState<ShopOrderItemRow[]>([]);
  const [history, setHistory] = useState<ShopOrderStatusHistoryRow[]>([]);
  const [pendingAction, setPendingAction] = useState<{ to: OrderStatus; label: string; danger?: boolean } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useIOSNativeHeader({ backgroundColor: styles.headerBg.color, tintColor: "#FFFFFF", title: "Order" });

  const load = useCallback(async () => {
    const userId = session?.user?.id;
    if (!id || !userId) return;
    setErrorMessage(null);
    try {
      const result = await withTimeout(fetchShopOrderDetail(id), FETCH_TIMEOUT_MS);
      if (result.error === "not-found") {
        setState("error");
        setErrorMessage("This order couldn't be found.");
        return;
      }
      if (result.error) {
        setState("error");
        setErrorMessage(result.error);
        return;
      }

      const { data: biz, error: bizError } = await withTimeout(
        supabase.from("businesses").select("owner_user_id").eq("id", result.order!.business_id).maybeSingle(),
        FETCH_TIMEOUT_MS
      );
      if (bizError) throw bizError;
      if (!biz || biz.owner_user_id !== userId) {
        setState("not-owner");
        return;
      }

      setOrder(result.order);
      setBusiness(result.business);
      setItems(result.items);
      setHistory(result.history);
      setState("ready");
    } catch (e) {
      setState("error");
      setErrorMessage((e as Error)?.message === "timeout" ? "This is taking longer than expected." : "Couldn't load this order.");
      logClientError({ error: e, screen: "owner-order/[id]", component: "load" });
    }
  }, [id, session?.user?.id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function confirmStatusChange(note: string) {
    if (!order || !pendingAction || submitting) return;
    setSubmitting(true);
    const result = await updateShopOrderStatus(order.id, pendingAction.to, note || undefined);
    setSubmitting(false);
    setPendingAction(null);
    if (!result.ok) {
      toast(result.message, 4500, true);
      logClientError({ error: result.message, screen: "owner-order/[id]", component: "updateShopOrderStatus", severity: "warning", metadata: { code: result.code, to: pendingAction.to } });
    } else {
      toast(`Order marked ${orderStatusMeta(result.status).label}.`);
    }
    // Refresh regardless of outcome — a failure can mean the order was
    // already changed by another device, so the server's current state is
    // shown either way rather than trusting local state.
    load();
  }

  const header = Platform.OS !== "ios" ? (
    <View style={[styles.headerBar, { paddingTop: insets.top + 10 }]}>
      <GlassBackButton onPress={() => router.back()} tone="light" flat />
      <Text style={styles.headerTitle}>Order</Text>
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
        <EmptyState title="Owner only" subtitle="Only this shop's owner can manage this order." />
      </View>
    );
  }

  if (state === "error" || !order) {
    return (
      <View style={styles.container}>
        {header}
        <ErrorState subtitle={errorMessage ?? "This order couldn't be found."} onRetry={load} />
      </View>
    );
  }

  const meta = orderStatusMeta(order.status);
  const actions = ORDER_STATUS_TRANSITIONS[order.status] ?? [];

  return (
    <View style={styles.container}>
      {header}
      <ScrollView contentContainerStyle={styles.scroll}>
        <Card style={styles.card}>
          <View style={styles.statusRow}>
            <View style={[styles.statusPill, { backgroundColor: meta.bg, borderColor: meta.border }]}>
              <Text style={[styles.statusPillText, { color: meta.color }]}>{meta.label}</Text>
            </View>
            <Text style={styles.reference}>#{order.id.slice(0, 8).toUpperCase()}</Text>
          </View>
          {business ? (
            <View style={styles.shopRow}>
              {business.logo ? (
                <Image source={{ uri: business.logo }} style={styles.shopLogo} contentFit="cover" cachePolicy="memory-disk" />
              ) : (
                <View style={[styles.shopLogo, styles.shopLogoPlaceholder]} />
              )}
              <Text style={styles.shopName}>{business.name}</Text>
            </View>
          ) : null}
        </Card>

        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Customer</Text>
          <DetailRow label="Name" value={order.customer_name || "—"} />
          <DetailRow label="Phone" value={order.customer_phone || "—"} />
          {order.customer_note ? <DetailRow label="Note" value={order.customer_note} /> : null}
          {/* Visible only here — this screen already refuses to render
              anything past the "not-owner" gate above for a customer or
              another shop's owner, so this action can never reach them. */}
          <View style={styles.contactRow}>
            <View style={{ flex: 1 }}>
              <Button
                label="Call Customer"
                variant="secondary"
                size="sm"
                onPress={() => contactCustomerByPhone(normalizedPhoneDigits(order.customer_phone))}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                label="WhatsApp Customer"
                variant="secondary"
                size="sm"
                onPress={() => contactCustomerByWhatsApp(normalizedPhoneDigits(order.customer_phone))}
              />
            </View>
          </View>
        </Card>

        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Items</Text>
          {items.map((item) => (
            <View key={item.id} style={styles.itemRow}>
              {item.image_snapshot ? (
                <Image source={{ uri: item.image_snapshot }} style={styles.itemPhoto} contentFit="cover" cachePolicy="memory-disk" />
              ) : (
                <View style={[styles.itemPhoto, styles.itemPhotoPlaceholder]} />
              )}
              <View style={styles.itemBody}>
                <Text style={styles.itemTitle} numberOfLines={2}>
                  {item.title_snapshot}
                </Text>
                <Text style={styles.itemMeta}>
                  {item.quantity} × {formatMoney(item.unit_price_snapshot, item.currency_snapshot)}
                  {!item.listing_id ? " · listing no longer exists" : ""}
                </Text>
              </View>
              <Text style={styles.itemSubtotal}>{formatMoney(item.subtotal_snapshot, item.currency_snapshot)}</Text>
            </View>
          ))}
          <View style={styles.summaryDivider} />
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>
              Total ({order.item_count} item{order.item_count === 1 ? "" : "s"})
            </Text>
            <Text style={styles.summaryValue}>{formatMoney(order.total, order.currency)}</Text>
          </View>
        </Card>

        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Fulfillment</Text>
          <DetailRow label="Method" value={FULFILLMENT_LABELS[order.fulfillment_method]} />
          {order.fulfillment_method === "delivery" && order.delivery_address ? (
            <DetailRow label="Delivery address" value={order.delivery_address} />
          ) : null}
          <DetailRow label="Placed" value={formatOrderDateTime(order.created_at)} />
          <DetailRow label="Last updated" value={formatOrderDateTime(order.updated_at)} />
        </Card>

        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Status history</Text>
          {history.map((h, idx) => {
            const hMeta = orderStatusMeta(h.status);
            return (
              <View key={h.id} style={styles.historyRow}>
                <View style={[styles.historyDot, { backgroundColor: hMeta.color }]} />
                <View style={styles.historyBody}>
                  <Text style={styles.historyStatus}>{hMeta.label}</Text>
                  {h.note ? <Text style={styles.historyNote}>{h.note}</Text> : null}
                  <Text style={styles.historyTime}>{formatOrderDateTime(h.created_at)}</Text>
                </View>
                {idx < history.length - 1 ? <View style={styles.historyLine} /> : null}
              </View>
            );
          })}
        </Card>
      </ScrollView>

      {actions.length ? (
        <View style={[styles.actionBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          {actions.map((action) => (
            <View key={action.to} style={styles.actionButtonWrap}>
              <Button
                label={action.label}
                variant={action.danger ? "danger" : "primary"}
                onPress={() => setPendingAction(action)}
              />
            </View>
          ))}
        </View>
      ) : null}

      <StatusChangeModal
        visible={!!pendingAction}
        actionLabel={pendingAction?.label ?? ""}
        fromStatus={meta.label}
        toStatusLabel={pendingAction ? orderStatusMeta(pendingAction.to).label : ""}
        danger={pendingAction?.danger}
        busy={submitting}
        onConfirm={confirmStatusChange}
        onCancel={() => (submitting ? null : setPendingAction(null))}
      />
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  const styles = useThemedStyles(buildStyles);
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
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
    scroll: { padding: space.lg, gap: space.md, paddingBottom: space.huge },
    card: { gap: space.sm, marginBottom: space.md },
    statusRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    statusPill: { paddingHorizontal: space.md, paddingVertical: 6, borderRadius: radius.pill, borderWidth: 1 },
    statusPillText: { ...font.caption, fontWeight: "800" },
    reference: { ...font.caption, color: color.textMuted },
    shopRow: { flexDirection: "row", alignItems: "center", gap: space.sm, marginTop: space.xs },
    shopLogo: { width: 32, height: 32, borderRadius: 16 },
    shopLogoPlaceholder: { backgroundColor: color.surfaceAlt },
    shopName: { ...font.bodyStrong, color: color.text },
    contactRow: { flexDirection: "row", gap: space.sm, marginTop: space.sm },
    sectionTitle: { ...font.title, color: color.text, marginBottom: 4 },
    itemRow: { flexDirection: "row", alignItems: "center", gap: space.sm, paddingVertical: space.xs },
    itemPhoto: { width: 48, height: 48, borderRadius: radius.sm },
    itemPhotoPlaceholder: { backgroundColor: color.surfaceAlt },
    itemBody: { flex: 1 },
    itemTitle: { ...font.body, color: color.text, fontWeight: "600" },
    itemMeta: { ...font.caption, color: color.textMuted },
    itemSubtotal: { ...font.bodyStrong, color: color.text },
    summaryDivider: { height: 1, backgroundColor: color.divider, marginVertical: space.xs },
    summaryRow: { flexDirection: "row", justifyContent: "space-between" },
    summaryLabel: { ...font.bodyStrong, color: color.text },
    summaryValue: { ...font.h3, color: color.brand },
    detailRow: { flexDirection: "row", justifyContent: "space-between", gap: space.md, paddingVertical: 4 },
    detailLabel: { ...font.caption, color: color.textMuted, flexShrink: 0 },
    detailValue: { ...font.body, color: color.text, flexShrink: 1, textAlign: "right" },
    historyRow: { flexDirection: "row", gap: space.sm, position: "relative" },
    historyDot: { width: 10, height: 10, borderRadius: 5, marginTop: 5 },
    historyLine: { position: "absolute", left: 4.5, top: 16, bottom: -space.md, width: 1, backgroundColor: color.divider },
    historyBody: { flex: 1, paddingBottom: space.md },
    historyStatus: { ...font.bodyStrong, color: color.text },
    historyNote: { ...font.caption, color: color.textSub, marginTop: 2 },
    historyTime: { ...font.caption, color: color.textMuted, marginTop: 2 },
    actionBar: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, padding: space.lg, borderTopWidth: 1, borderTopColor: color.divider, backgroundColor: color.surface },
    actionButtonWrap: { flexGrow: 1, minWidth: "45%" },
  });
}
