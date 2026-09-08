// Quantity-and-add sheet opened either by long-pressing an eligible shop
// product card, or by tapping its small always-visible quick-add badge —
// the tap path is the accessible alternative Part B requires (long press
// alone would leave VoiceOver/TalkBack/keyboard users with no way to reach
// this), and both paths land here so there is exactly one add-to-cart flow
// to keep correct, not two. Mirrors AddToCartBar's quantity-stepper +
// cross-shop-conflict logic; kept separate because AddToCartBar renders
// inline on the listing detail screen while this renders as a modal over a
// grid card.
import { useState } from "react";
import { Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { BlurView } from "expo-blur";
import { Image } from "expo-image";
import Svg, { Line } from "react-native-svg";
import { Button, ConfirmModal, toast } from "../ui";
import { useCart } from "../../lib/cart-context";
import { MAX_QTY_PER_ITEM } from "../../lib/cart";
import { glass, font, radius, space, type ColorPalette } from "../../lib/theme";
import { useThemedStyles } from "../../lib/theme-provider";

type Props = {
  visible: boolean;
  listingId: string;
  title: string;
  photo: string | null;
  business: { id: string; name: string };
  onClose: () => void;
};

export function QuickAddSheet({ visible, listingId, title, photo, business, onClose }: Props) {
  const styles = useThemedStyles(buildStyles);
  const { cart, addItem, replaceWithItem } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [conflictOpen, setConflictOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  function reset() {
    setQuantity(1);
    setBusy(false);
  }

  function handleClose() {
    reset();
    onClose();
  }

  function step(delta: number) {
    setQuantity((q) => Math.min(MAX_QTY_PER_ITEM, Math.max(1, q + delta)));
  }

  function handleAdd() {
    if (busy) return;
    setBusy(true);
    const result = addItem(business, listingId, quantity);
    setBusy(false);
    if (result === "added" || result === "updated") {
      toast("Added to order request");
      handleClose();
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
    toast("Cart cleared and this item added.");
    handleClose();
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <Pressable style={styles.backdrop} onPress={handleClose}>
        <BlurView
          intensity={glass.intensity.strong}
          tint="dark"
          blurMethod={Platform.OS === "android" ? glass.androidBlurMethod : undefined}
          style={StyleSheet.absoluteFill}
        />
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <View style={styles.row}>
            {photo ? (
              <Image source={{ uri: photo }} style={styles.photo} contentFit="cover" cachePolicy="memory-disk" />
            ) : (
              <View style={[styles.photo, styles.placeholder]} />
            )}
            <Text style={styles.title} numberOfLines={2}>
              {title}
            </Text>
          </View>

          <View style={styles.stepperRow}>
            <Text style={styles.qtyLabel}>Quantity</Text>
            <View style={styles.stepper}>
              <Pressable style={styles.stepBtn} onPress={() => step(-1)} disabled={quantity <= 1} hitSlop={8} accessibilityLabel="Decrease quantity">
                <Svg width={16} height={16} viewBox="0 0 24 24" stroke={styles.stepIcon.color} strokeWidth={2.4}>
                  <Line x1={5} y1={12} x2={19} y2={12} />
                </Svg>
              </Pressable>
              <Text style={styles.stepValue}>{quantity}</Text>
              <Pressable style={styles.stepBtn} onPress={() => step(1)} disabled={quantity >= MAX_QTY_PER_ITEM} hitSlop={8} accessibilityLabel="Increase quantity">
                <Svg width={16} height={16} viewBox="0 0 24 24" stroke={styles.stepIcon.color} strokeWidth={2.4}>
                  <Line x1={12} y1={5} x2={12} y2={19} />
                  <Line x1={5} y1={12} x2={19} y2={12} />
                </Svg>
              </Pressable>
            </View>
          </View>

          <View style={styles.buttonRow}>
            <View style={{ flex: 1 }}>
              <Button label="Cancel" variant="secondary" onPress={handleClose} />
            </View>
            <View style={{ flex: 1 }}>
              <Button label="Add to Order Request" onPress={handleAdd} loading={busy} />
            </View>
          </View>
        </Pressable>
      </Pressable>

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
    </Modal>
  );
}

function buildStyles(color: ColorPalette) {
  return StyleSheet.create({
    backdrop: { flex: 1, justifyContent: "flex-end" },
    card: {
      backgroundColor: color.surface,
      borderTopLeftRadius: radius.lg,
      borderTopRightRadius: radius.lg,
      padding: space.lg,
      gap: space.lg,
    },
    row: { flexDirection: "row", alignItems: "center", gap: space.md },
    photo: { width: 56, height: 56, borderRadius: radius.md },
    placeholder: { backgroundColor: color.skeleton },
    title: { ...font.bodyStrong, color: color.text, flex: 1 },
    stepperRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    qtyLabel: { ...font.body, color: color.textSub },
    stepper: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: color.surfaceAlt,
      borderRadius: radius.md,
      paddingHorizontal: space.xs,
    },
    stepBtn: { width: 36, height: 40, alignItems: "center", justifyContent: "center" },
    stepIcon: { color: color.text },
    stepValue: { ...font.bodyStrong, color: color.text, minWidth: 24, textAlign: "center" },
    buttonRow: { flexDirection: "row", gap: space.md },
  });
}
