// Quantity stepper + "Add to Cart" control shown on an orderable listing.
// Isolated from app/listing/[id].tsx (already a very large screen) so the
// cart-specific logic — the cross-shop confirmation dialog, the
// quantity/item-count ceilings — lives in one small, focused file.
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Line, Path } from "react-native-svg";
import { Button, ConfirmModal, toast } from "../ui";
import { useCart } from "../../lib/cart-context";
import { MAX_QTY_PER_ITEM } from "../../lib/cart";
import { font, radius, space, type ColorPalette } from "../../lib/theme";
import { useThemedStyles } from "../../lib/theme-provider";

type Props = {
  listingId: string;
  business: { id: string; name: string };
};

export function AddToCartBar({ listingId, business }: Props) {
  const styles = useThemedStyles(buildStyles);
  const { cart, addItem, replaceWithItem } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [conflictOpen, setConflictOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const inCartQuantity = cart.items.find((i) => i.listingId === listingId)?.quantity ?? 0;

  function step(delta: number) {
    setQuantity((q) => Math.min(MAX_QTY_PER_ITEM, Math.max(1, q + delta)));
  }

  function handleAdd() {
    if (busy) return;
    setBusy(true);
    const result = addItem(business, listingId, quantity);
    setBusy(false);
    if (result === "added" || result === "updated") {
      toast(`Added to cart — ${inCartQuantity + quantity} in cart`);
      setQuantity(1);
      return;
    }
    if (result === "conflict") {
      setConflictOpen(true);
      return;
    }
    if (result === "quantity_limit") {
      toast(`You can only order up to ${MAX_QTY_PER_ITEM} of this item.`, 4000, true);
      return;
    }
    if (result === "item_limit") {
      toast("Your cart is full — remove an item before adding another.", 4000, true);
    }
  }

  function confirmReplace() {
    replaceWithItem(business, listingId, quantity);
    setConflictOpen(false);
    setQuantity(1);
    toast("Cart cleared and this item added.");
  }

  return (
    <View style={styles.row}>
      <View style={styles.stepper}>
        <Pressable style={styles.stepBtn} onPress={() => step(-1)} disabled={quantity <= 1} hitSlop={8}>
          <Svg width={16} height={16} viewBox="0 0 24 24" stroke={styles.stepIcon.color} strokeWidth={2.4}>
            <Line x1={5} y1={12} x2={19} y2={12} />
          </Svg>
        </Pressable>
        <Text style={styles.stepValue}>{quantity}</Text>
        <Pressable style={styles.stepBtn} onPress={() => step(1)} disabled={quantity >= MAX_QTY_PER_ITEM} hitSlop={8}>
          <Svg width={16} height={16} viewBox="0 0 24 24" stroke={styles.stepIcon.color} strokeWidth={2.4}>
            <Line x1={12} y1={5} x2={12} y2={19} />
            <Line x1={5} y1={12} x2={19} y2={12} />
          </Svg>
        </Pressable>
      </View>
      <View style={styles.addButtonWrap}>
        <Button label="Add to Cart" onPress={handleAdd} loading={busy} icon={<CartIcon color="#FFFFFF" />} />
      </View>

      <ConfirmModal
        visible={conflictOpen}
        title="Start a new cart?"
        body={`Your cart has items from ${cart.businessName ?? "another shop"}. An order can only include items from one shop — clear the cart and add this item instead?`}
        confirmText="Clear cart & add"
        cancelText="Cancel"
        danger
        onConfirm={confirmReplace}
        onCancel={() => setConflictOpen(false)}
      />
    </View>
  );
}

function CartIcon({ color }: { color: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
      <Path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
      <Path d="M3 6h18" />
      <Path d="M16 10a4 4 0 0 1-8 0" />
    </Svg>
  );
}

function buildStyles(color: ColorPalette) {
  return StyleSheet.create({
    row: { flexDirection: "row", alignItems: "center", gap: space.md, paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: space.xs },
    stepper: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: color.surfaceAlt,
      borderRadius: radius.md,
      paddingHorizontal: space.xs,
    },
    stepBtn: { width: 32, height: 40, alignItems: "center", justifyContent: "center" },
    stepIcon: { color: color.text },
    stepValue: { ...font.bodyStrong, color: color.text, minWidth: 22, textAlign: "center" },
    addButtonWrap: { flex: 1 },
  });
}
