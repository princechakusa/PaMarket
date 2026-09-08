// Customer shop cart — single-shop only (enforced when items are added,
// see lib/cart.ts). Cart storage only ever holds listing ids + quantities
// (lib/cart-context.tsx); this screen fetches the live listing rows every
// time it opens so price/title/availability shown here always reflect the
// current database, never a stale local copy. The server re-validates all
// of this again at order time regardless — this is UX, not the source of
// truth.
import { useState } from "react";
import { ActivityIndicator, FlatList, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { useCart } from "../lib/cart-context";
import { useResolvedCart } from "../lib/use-resolved-cart";
import { MAX_ITEMS_PER_ORDER, cartUnitCount } from "../lib/cart";
import { CartLineItem } from "../components/cart/CartLineItem";
import { Button, ConfirmModal, EmptyState, ErrorState, GlassBackButton } from "../components/ui";
import { font, space, type ColorPalette } from "../lib/theme";
import { useThemedStyles } from "../lib/theme-provider";
import { useIOSNativeHeader } from "../lib/useIOSNativeHeader";

export default function ShopCartScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const styles = useThemedStyles(buildStyles);
  const { cart, setQuantity, removeItem, clear } = useCart();
  const { lines, isLoading, error, reload, hasUnavailable } = useResolvedCart();
  const itemCount = cartUnitCount(cart);

  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);

  useIOSNativeHeader({ backgroundColor: styles.headerBg.color, tintColor: "#FFFFFF", title: "Your Cart" });

  function handleClear() {
    clear();
    setClearConfirmOpen(false);
  }

  function goToCheckout() {
    if (!cart.businessId || hasUnavailable || !lines.length) return;
    router.push("/shop-checkout");
  }

  const header = (
    <View style={styles.header}>
      {Platform.OS !== "ios" ? (
        <View style={[styles.headerBar, { paddingTop: insets.top + 10 }]}>
          <GlassBackButton onPress={() => router.back()} tone="light" flat />
          <Text style={styles.headerTitle}>Your Cart</Text>
          <View style={{ width: 40 }} />
        </View>
      ) : null}
      {cart.businessName ? (
        <View style={styles.shopRow}>
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={styles.shopIcon.color} strokeWidth={2}>
            <Path d="M3 9l1-5h16l1 5M4 9h16v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9Z" />
          </Svg>
          <Text style={styles.shopName} numberOfLines={1}>
            {cart.businessName}
          </Text>
        </View>
      ) : null}
    </View>
  );

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
        <ErrorState subtitle={error} onRetry={reload} />
      </View>
    );
  }

  if (!lines.length) {
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
          title="Your cart is empty"
          subtitle="Browse a shop and add items you'd like to order."
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
        data={lines}
        keyExtractor={(l) => l.listingId}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <CartLineItem
            line={item}
            onIncrement={() => setQuantity(item.listingId, Math.min(item.quantity + 1, 20))}
            onDecrement={() => setQuantity(item.listingId, item.quantity - 1)}
            onRemove={() => removeItem(item.listingId)}
          />
        )}
        ItemSeparatorComponent={() => <View style={{ height: space.sm }} />}
        ListFooterComponent={
          <Pressable style={styles.clearRow} onPress={() => setClearConfirmOpen(true)}>
            <Text style={styles.clearText}>Clear cart</Text>
          </Pressable>
        }
      />

      <View style={[styles.summaryBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        {lines.length >= MAX_ITEMS_PER_ORDER ? (
          <Text style={styles.limitNote}>You've reached the {MAX_ITEMS_PER_ORDER}-item limit for one order.</Text>
        ) : null}
        {hasUnavailable ? (
          <Text style={styles.unavailableNote}>Remove unavailable items to continue.</Text>
        ) : (
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>
              {itemCount} item{itemCount === 1 ? "" : "s"} in this order request
            </Text>
          </View>
        )}
        <View style={styles.buttonRow}>
          <View style={{ flex: 1 }}>
            <Button label="Continue Browsing" variant="secondary" onPress={() => router.back()} />
          </View>
          <View style={{ flex: 1 }}>
            <Button label="Continue to Order Request" onPress={goToCheckout} disabled={hasUnavailable || !lines.length} />
          </View>
        </View>
      </View>

      <ConfirmModal
        visible={clearConfirmOpen}
        title="Clear your cart?"
        body="This removes every item currently in your cart."
        confirmText="Clear Cart"
        danger
        onConfirm={handleClear}
        onCancel={() => setClearConfirmOpen(false)}
      />
    </View>
  );
}

function buildStyles(color: ColorPalette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: color.bg },
    centered: { flex: 1, alignItems: "center", justifyContent: "center" },
    headerBg: { color: color.brand },
    header: { backgroundColor: color.surface },
    headerBar: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      backgroundColor: color.brand,
      paddingHorizontal: 14,
      paddingBottom: 12,
    },
    headerTitle: { flex: 1, fontSize: 15, fontWeight: "700", color: color.textOnBrand, textAlign: "center" },
    shopRow: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: space.lg, paddingVertical: space.sm },
    shopIcon: { color: color.textMuted },
    shopName: { ...font.caption, color: color.textMuted, flexShrink: 1 },
    emptyIcon: { color: color.brand },
    list: { padding: space.lg, paddingBottom: space.xxxl },
    clearRow: { alignItems: "center", paddingVertical: space.lg },
    clearText: { ...font.caption, color: color.danger, fontWeight: "700" },
    summaryBar: {
      padding: space.lg,
      borderTopWidth: 1,
      borderTopColor: color.divider,
      backgroundColor: color.surface,
      gap: space.sm,
    },
    limitNote: { ...font.caption, color: color.warning, textAlign: "center" },
    unavailableNote: { ...font.caption, color: color.danger, textAlign: "center" },
    totalRow: { flexDirection: "row", justifyContent: "center", alignItems: "center" },
    totalLabel: { ...font.body, color: color.textSub, fontWeight: "600" },
    buttonRow: { flexDirection: "row", gap: space.md },
  });
}
