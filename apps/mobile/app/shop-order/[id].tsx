// Customer order confirmation + detail screen. Reads go through ordinary
// RLS-scoped selects (fetchShopOrderDetail in lib/shop-orders.ts) — the
// same policy that already restricts a customer to their own orders, so
// there is nothing extra to enforce here. Doubles as the post-submission
// confirmation screen when opened with ?placed=1 (a banner + two buttons
// on top of the same detail content, rather than a second near-duplicate
// screen).
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, BackHandler, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { SmartImage } from "../../components/ui/SmartImage";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  FULFILLMENT_LABELS,
  fetchShopOrderDetail,
  formatOrderDateTime,
  orderStatusMeta,
  type ShopOrderBusiness,
  type ShopOrderItemRow,
  type ShopOrderRow,
  type ShopOrderStatusHistoryRow,
} from "../../lib/shop-orders";
import { buildWhatsAppOrderMessage, resolveShopWhatsAppNumber, shareOrderWithImage } from "../../lib/order-whatsapp";
import { logClientError } from "../../lib/error-log";
import { Button, Card, ConfirmModal, ErrorState, GlassBackButton } from "../../components/ui";
import { font, radius, space, type ColorPalette } from "../../lib/theme";
import { useThemedStyles } from "../../lib/theme-provider";
import { useIOSNativeHeader } from "../../lib/useIOSNativeHeader";

const FETCH_TIMEOUT_MS = 12000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([promise, new Promise<T>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms))]);
}

export default function ShopOrderDetailScreen() {
  const { id, placed } = useLocalSearchParams<{ id: string; placed?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const styles = useThemedStyles(buildStyles);

  const [order, setOrder] = useState<ShopOrderRow | null>(null);
  const [business, setBusiness] = useState<ShopOrderBusiness | null>(null);
  const [items, setItems] = useState<ShopOrderItemRow[]>([]);
  const [history, setHistory] = useState<ShopOrderStatusHistoryRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [sharingToWhatsApp, setSharingToWhatsApp] = useState(false);
  const [whatsAppPreview, setWhatsAppPreview] = useState<string | null>(null);

  // Reached straight from a successful checkout submission — the previous
  // screen in the navigation stack is the shop cart, which is now
  // legitimately empty (clear() already ran). Letting the back gesture/
  // button/hardware-key land there would show a "Your cart is empty" screen
  // immediately after placing an order, reading as if the order vanished.
  // Route back to the shop (or the shops directory as a fallback) instead —
  // never to checkout or the now-empty cart. Opening this same screen any
  // other way (My Orders, a notification) is untouched: back behaves
  // normally.
  const cameFromCheckout = placed === "1";
  const goBackSafely = useCallback(() => {
    router.replace(business ? { pathname: "/business/[id]", params: { id: business.id } } : "/shops");
  }, [business, router]);

  useFocusEffect(
    useCallback(() => {
      if (!cameFromCheckout) return;
      const sub = BackHandler.addEventListener("hardwareBackPress", () => {
        goBackSafely();
        return true;
      });
      return () => sub.remove();
    }, [cameFromCheckout, goBackSafely])
  );

  useIOSNativeHeader({
    backgroundColor: styles.headerBg.color,
    tintColor: "#FFFFFF",
    title: "Order",
    headerLeft: cameFromCheckout ? () => <GlassBackButton onPress={goBackSafely} tone="light" flat /> : undefined,
  });

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      const result = await withTimeout(fetchShopOrderDetail(id), FETCH_TIMEOUT_MS);
      if (result.error === "not-found") {
        setError("This order couldn't be found.");
        return;
      }
      if (result.error) {
        setError(result.error);
        logClientError({ error: result.error, screen: "shop-order/[id]", component: "load" });
        return;
      }
      setOrder(result.order);
      setBusiness(result.business);
      setItems(result.items);
      setHistory(result.history);
    } catch (e) {
      setError((e as Error)?.message === "timeout" ? "This is taking longer than expected." : "Couldn't load this order.");
      logClientError({ error: e, screen: "shop-order/[id]", component: "load" });
    }
  }, [id]);

  useEffect(() => {
    setIsLoading(true);
    load().finally(() => setIsLoading(false));
  }, [load]);

  // This never touches the order itself — no RPC call, no status change, no
  // new notification. It only composes a pre-filled, user-editable message
  // and opens WhatsApp (or the share sheet) via the existing safe url
  // opener. Re-opening it is always safe and repeatable: the message is
  // rebuilt fresh from the current order every time, never stored. The
  // customer sees the exact message text (and whether a photo will be
  // attached) before anything opens — nothing is ever sent automatically.
  function openWhatsAppPreview() {
    if (!order) return;
    const message = buildWhatsAppOrderMessage({
      orderId: order.id,
      shopName: business?.name ?? "the shop",
      itemLines: items.map((item) => ({ title: item.title_snapshot, quantity: item.quantity })),
      fulfillmentMethod: order.fulfillment_method,
      deliveryAddress: order.delivery_address,
      customerNote: order.customer_note,
    });
    setWhatsAppPreview(message);
  }

  async function confirmSendToWhatsApp() {
    const message = whatsAppPreview;
    setWhatsAppPreview(null);
    if (!message || sharingToWhatsApp) return;
    setSharingToWhatsApp(true);
    try {
      // Attaching the first item's photo is only actually supported on iOS
      // with the tools currently in this app (see shareOrderWithImage) — on
      // Android this transparently falls back to the same text-only message
      // rather than presenting a button that silently drops the image.
      await shareOrderWithImage(resolveShopWhatsAppNumber(business), message, items[0]?.image_snapshot ?? null);
    } finally {
      setSharingToWhatsApp(false);
    }
  }

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={styles.headerBg.color} />
      </View>
    );
  }

  if (error || !order) {
    return <ErrorState subtitle={error ?? "This order couldn't be found."} onRetry={load} />;
  }

  const meta = orderStatusMeta(order.status);
  const showBanner = placed === "1" && !bannerDismissed;

  return (
    <View style={styles.container}>
      {Platform.OS !== "ios" ? (
        <View style={[styles.headerBar, { paddingTop: insets.top + 10 }]}>
          <GlassBackButton onPress={cameFromCheckout ? goBackSafely : () => router.back()} tone="light" flat />
          <Text style={styles.headerTitle}>Order</Text>
          <View style={{ width: 40 }} />
        </View>
      ) : null}

      <ScrollView contentContainerStyle={styles.scroll}>
        {showBanner ? (
          <Card style={styles.banner} elevated={false}>
            <Text style={styles.bannerTitle}>Request sent!</Text>
            <Text style={styles.bannerBody}>
              {business?.name ?? "The shop"} needs to confirm this order. You'll be notified once they respond.
            </Text>
            <View style={styles.bannerButtons}>
              <View style={{ flex: 1 }}>
                <Button
                  label="Back to Shop"
                  variant="secondary"
                  size="sm"
                  onPress={() => (business ? router.replace(`/business/${business.id}`) : router.replace("/shops"))}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Button label="View Order Details" size="sm" onPress={() => setBannerDismissed(true)} />
              </View>
            </View>
          </Card>
        ) : null}

        <Card style={styles.card}>
          <View style={styles.statusRow}>
            <View style={[styles.statusPill, { backgroundColor: meta.bg, borderColor: meta.border }]}>
              <Text style={[styles.statusPillText, { color: meta.color }]}>{meta.label}</Text>
            </View>
            <Text style={styles.reference}>#{order.id.slice(0, 8).toUpperCase()}</Text>
          </View>
          <Text style={styles.statusMessage}>{meta.message}</Text>

          {order.status === "pending" ? (
            <View style={styles.whatsappRow}>
              <Button
                label="Send order to shop on WhatsApp"
                variant="secondary"
                size="sm"
                loading={sharingToWhatsApp}
                onPress={openWhatsAppPreview}
              />
              <Text style={styles.whatsappHint}>
                Optional — the order stays pending until the shop confirms it here in PaMarket.
                {Platform.OS === "ios" ? " Includes a photo where possible." : ""}
              </Text>
            </View>
          ) : null}

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
          <Text style={styles.sectionTitle}>Items</Text>
          {items.map((item) => (
            <View key={item.id} style={styles.itemRow}>
              <SmartImage uri={item.image_snapshot} style={styles.itemPhoto} screen="shop-order/[id]" />
              <View style={styles.itemBody}>
                <Text style={styles.itemTitle} numberOfLines={2}>
                  {item.title_snapshot}
                </Text>
                <Text style={styles.itemMeta}>Quantity: {item.quantity}</Text>
              </View>
            </View>
          ))}
          <View style={styles.summaryDivider} />
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>
              {order.item_count} item{order.item_count === 1 ? "" : "s"} in this request
            </Text>
          </View>
        </Card>

        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Fulfillment</Text>
          <DetailRow label="Method" value={FULFILLMENT_LABELS[order.fulfillment_method]} />
          {order.fulfillment_method === "delivery" && order.delivery_address ? (
            <DetailRow label="Delivery address" value={order.delivery_address} />
          ) : null}
          <DetailRow label="Contact name" value={order.customer_name} />
          <DetailRow label="Contact phone" value={order.customer_phone} />
          {order.customer_note ? <DetailRow label="Note" value={order.customer_note} /> : null}
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

      <ConfirmModal
        visible={!!whatsAppPreview}
        title="Send to shop on WhatsApp?"
        body={
          (whatsAppPreview ?? "") +
          (Platform.OS === "ios"
            ? "\n\n(A product photo will be attached where available.)"
            : "\n\n(This device shares the text above — a photo attachment isn't supported here yet.)")
        }
        confirmText="Continue"
        onConfirm={confirmSendToWhatsApp}
        onCancel={() => setWhatsAppPreview(null)}
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
    centered: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: color.bg },
    headerBg: { color: color.brand },
    headerBar: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: color.brand, paddingHorizontal: 14, paddingBottom: 12 },
    headerTitle: { flex: 1, fontSize: 15, fontWeight: "700", color: color.textOnBrand, textAlign: "center" },
    scroll: { padding: space.lg, gap: space.md, paddingBottom: space.huge },
    banner: { backgroundColor: color.brandTint, gap: space.sm },
    bannerTitle: { ...font.h3, color: color.text },
    bannerBody: { ...font.body, color: color.textSub },
    bannerButtons: { flexDirection: "row", gap: space.sm, marginTop: space.xs },
    card: { gap: space.sm, marginBottom: space.md },
    statusRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    statusPill: { paddingHorizontal: space.md, paddingVertical: 6, borderRadius: radius.pill, borderWidth: 1 },
    statusPillText: { ...font.caption, fontWeight: "800" },
    reference: { ...font.caption, color: color.textMuted },
    statusMessage: { ...font.body, color: color.textSub },
    whatsappRow: { marginTop: space.sm, gap: 6 },
    whatsappHint: { ...font.caption, color: color.textMuted },
    shopRow: { flexDirection: "row", alignItems: "center", gap: space.sm, marginTop: space.xs },
    shopLogo: { width: 32, height: 32, borderRadius: 16 },
    shopLogoPlaceholder: { backgroundColor: color.surfaceAlt },
    shopName: { ...font.bodyStrong, color: color.text },
    sectionTitle: { ...font.title, color: color.text, marginBottom: 4 },
    itemRow: { flexDirection: "row", alignItems: "center", gap: space.sm, paddingVertical: space.xs },
    itemPhoto: { width: 48, height: 48, borderRadius: radius.sm },
    itemPhotoPlaceholder: { backgroundColor: color.surfaceAlt },
    itemBody: { flex: 1 },
    itemTitle: { ...font.body, color: color.text, fontWeight: "600" },
    itemMeta: { ...font.caption, color: color.textMuted },
    summaryDivider: { height: 1, backgroundColor: color.divider, marginVertical: space.xs },
    summaryRow: { flexDirection: "row", justifyContent: "space-between" },
    summaryLabel: { ...font.bodyStrong, color: color.text },
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
  });
}
