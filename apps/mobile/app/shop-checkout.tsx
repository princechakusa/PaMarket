// Order request form — the customer's last step before create_shop_order
// is called. Nothing here is trusted by the server: it re-reads every
// listing, recomputes every price, and ignores any total this screen
// shows. This screen only sends listing ids, quantities, the customer's
// own contact/fulfillment details, and one idempotency key.
import { useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { useCart } from "../lib/cart-context";
import { useResolvedCart } from "../lib/use-resolved-cart";
import { useKeyboardAvoidingReset } from "../lib/useKeyboardAvoidingReset";
import { isValidPhone } from "../lib/validation";
import { createShopOrder, formatMoney, generateIdempotencyKey, type FulfillmentMethod } from "../lib/shop-orders";
import { Button, CountedTextArea, ErrorState, FieldLabel, GlassBackButton, toast } from "../components/ui";
import { font, radius, space, type ColorPalette } from "../lib/theme";
import { useThemedStyles } from "../lib/theme-provider";
import { useIOSNativeHeader } from "../lib/useIOSNativeHeader";
import { logClientError } from "../lib/error-log";

const NOTE_LIMIT = 300;

export default function ShopCheckoutScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const styles = useThemedStyles(buildStyles);
  const { session } = useAuth();
  const { cart, clear } = useCart();
  const { lines, isLoading, error, hasUnavailable, estimatedTotal, currency } = useResolvedCart();
  const keyboardAvoidingKey = useKeyboardAvoidingReset();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [fulfillment, setFulfillment] = useState<FulfillmentMethod>("collection");
  const [address, setAddress] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // One key per checkout attempt. Regenerated only when the customer leaves
  // with an empty cart (a genuinely new checkout) — a failed submission
  // keeps the same key so retrying it can never create a second order.
  const idempotencyKeyRef = useRef(generateIdempotencyKey());

  useIOSNativeHeader({ backgroundColor: styles.headerBg.color, tintColor: "#FFFFFF", title: "Order Request" });

  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId) return;
    supabase
      .from("profiles")
      .select("name,phone")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.name) setName((current) => current || data.name);
        if (data?.phone) setPhone((current) => current || data.phone);
      });
  }, [session?.user?.id]);

  // The cart can legitimately become empty or invalid while this screen is
  // open (another tab clearing it, a listing going stale) — bounce back
  // rather than let the customer submit against nothing.
  useEffect(() => {
    if (!isLoading && (!lines.length || hasUnavailable)) {
      router.replace("/shop-cart");
    }
  }, [isLoading, lines.length, hasUnavailable, router]);

  async function handleSubmit() {
    if (submitting) return;
    if (!cart.businessId) return;
    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();
    if (!trimmedName) {
      toast("Please enter your name.", 3500, true);
      return;
    }
    if (!isValidPhone(trimmedPhone)) {
      toast("Please enter a valid phone number.", 3500, true);
      return;
    }
    if (fulfillment === "delivery" && !address.trim()) {
      toast("Please enter a delivery address.", 3500, true);
      return;
    }

    setSubmitting(true);
    const result = await createShopOrder({
      businessId: cart.businessId,
      items: cart.items,
      fulfillmentMethod: fulfillment,
      customerName: trimmedName,
      customerPhone: trimmedPhone,
      idempotencyKey: idempotencyKeyRef.current,
      deliveryAddress: fulfillment === "delivery" ? address.trim() : undefined,
      customerNote: note.trim() || undefined,
    });

    if (!result.ok) {
      // Button is restored either way — the same idempotency key survives
      // for a genuine retry (network failure, rate limit, etc).
      setSubmitting(false);
      toast(result.message, 4500, true);
      logClientError({ error: result.message, screen: "shop-checkout", component: "createShopOrder", severity: "warning", metadata: { code: result.code } });
      return;
    }

    clear();
    router.replace({ pathname: "/shop-order/[id]", params: { id: result.orderId, placed: "1" } });
  }

  if (isLoading) return null;
  if (error) return <ErrorState subtitle={error} onRetry={() => router.replace("/shop-cart")} />;
  if (!lines.length || hasUnavailable) return null;

  return (
    <KeyboardAvoidingView key={keyboardAvoidingKey} style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      {Platform.OS !== "ios" ? (
        <View style={[styles.headerBar, { paddingTop: insets.top + 10 }]}>
          <GlassBackButton onPress={() => router.back()} tone="light" flat />
          <Text style={styles.headerTitle}>Order Request</Text>
          <View style={{ width: 40 }} />
        </View>
      ) : null}

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.field}>
          <FieldLabel text="Your name" required />
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Full name" placeholderTextColor={styles.placeholder.color} maxLength={80} />
        </View>

        <View style={styles.field}>
          <FieldLabel text="Phone number" required />
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            placeholder="0771234567"
            placeholderTextColor={styles.placeholder.color}
            keyboardType="phone-pad"
            maxLength={20}
          />
        </View>

        <View style={styles.field}>
          <FieldLabel text="Fulfillment" required />
          <View style={styles.segmentRow}>
            {(["collection", "delivery"] as FulfillmentMethod[]).map((method) => (
              <Pressable
                key={method}
                style={[styles.segment, fulfillment === method && styles.segmentActive]}
                onPress={() => setFulfillment(method)}
              >
                <Text style={[styles.segmentText, fulfillment === method && styles.segmentTextActive]}>
                  {method === "collection" ? "Pickup" : "Delivery"}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {fulfillment === "delivery" ? (
          <View style={styles.field}>
            <FieldLabel text="Delivery address" required />
            <TextInput
              style={[styles.input, styles.textArea]}
              value={address}
              onChangeText={setAddress}
              placeholder="Street, suburb, city"
              placeholderTextColor={styles.placeholder.color}
              multiline
              maxLength={200}
            />
          </View>
        ) : null}

        <View style={styles.field}>
          <FieldLabel text="Note to the shop (optional)" />
          <CountedTextArea value={note} onChangeText={setNote} limit={NOTE_LIMIT} maxLength={NOTE_LIMIT} placeholder="Anything the shop should know about this order" placeholderTextColor={styles.placeholder.color} minHeight={70} />
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Order summary</Text>
          {lines.map((line) => (
            <View key={line.listingId} style={styles.summaryRow}>
              <Text style={styles.summaryItemTitle} numberOfLines={1}>
                {line.quantity} × {line.title}
              </Text>
              <Text style={styles.summaryItemPrice}>{formatMoney((line.price ?? 0) * line.quantity, line.currency)}</Text>
            </View>
          ))}
          <View style={styles.summaryDivider} />
          <View style={styles.summaryRow}>
            <Text style={styles.summaryTotalLabel}>Estimated total</Text>
            <Text style={styles.summaryTotalValue}>{formatMoney(estimatedTotal, currency)}</Text>
          </View>
          <Text style={styles.summaryHint}>The shop confirms the final total — this is an estimate based on current prices.</Text>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <Button label="Submit Order Request" onPress={handleSubmit} loading={submitting} disabled={submitting} />
      </View>
    </KeyboardAvoidingView>
  );
}

function buildStyles(color: ColorPalette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: color.bg },
    headerBg: { color: color.brand },
    headerBar: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: color.brand, paddingHorizontal: 14, paddingBottom: 12 },
    headerTitle: { flex: 1, fontSize: 15, fontWeight: "700", color: color.textOnBrand, textAlign: "center" },
    scroll: { padding: space.lg, gap: space.lg, paddingBottom: space.huge },
    field: { gap: 0 },
    placeholder: { color: color.textMuted },
    input: {
      ...font.body,
      color: color.text,
      backgroundColor: color.surface,
      borderWidth: 1,
      borderColor: color.border,
      borderRadius: radius.md,
      paddingHorizontal: space.md,
      paddingVertical: 12,
    },
    textArea: { minHeight: 60, textAlignVertical: "top" },
    segmentRow: { flexDirection: "row", gap: space.sm },
    segment: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: color.border,
      alignItems: "center",
      backgroundColor: color.surface,
    },
    segmentActive: { backgroundColor: color.brand, borderColor: color.brand },
    segmentText: { ...font.bodyStrong, color: color.text },
    segmentTextActive: { color: color.textOnBrand },
    summaryCard: {
      backgroundColor: color.surfaceAlt,
      borderRadius: radius.lg,
      padding: space.lg,
      gap: space.sm,
    },
    summaryTitle: { ...font.title, color: color.text, marginBottom: 4 },
    summaryRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: space.md },
    summaryItemTitle: { ...font.body, color: color.textSub, flex: 1 },
    summaryItemPrice: { ...font.body, color: color.text, fontWeight: "600" },
    summaryDivider: { height: 1, backgroundColor: color.divider, marginVertical: 4 },
    summaryTotalLabel: { ...font.bodyStrong, color: color.text },
    summaryTotalValue: { ...font.h3, color: color.brand },
    summaryHint: { ...font.caption, color: color.textMuted, marginTop: 4 },
    footer: { padding: space.lg, borderTopWidth: 1, borderTopColor: color.divider, backgroundColor: color.surface },
  });
}
