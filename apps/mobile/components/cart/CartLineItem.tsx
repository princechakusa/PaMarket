// One row in the cart screen — mirrors components/ListingRow.tsx's photo +
// title + price layout, plus a quantity stepper, a subtotal, and a remove
// action. A line item whose listing has gone stale (deleted, no longer
// orderable, price changed to invalid) renders in a distinct "unavailable"
// state with a short explanation instead of a stepper — the customer can
// still remove it, but can't check out until they do.
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import Svg, { Line, Path } from "react-native-svg";
import { formatMoney } from "../../lib/shop-orders";
import { MAX_QTY_PER_ITEM } from "../../lib/cart";
import { font, radius, space, type ColorPalette } from "../../lib/theme";
import { useThemedStyles } from "../../lib/theme-provider";

export type ResolvedCartLine = {
  listingId: string;
  quantity: number;
  title: string | null;
  photo: string | null;
  price: number | null;
  currency: string | null;
  available: boolean;
};

type Props = {
  line: ResolvedCartLine;
  onIncrement: () => void;
  onDecrement: () => void;
  onRemove: () => void;
};

export function CartLineItem({ line, onIncrement, onDecrement, onRemove }: Props) {
  const styles = useThemedStyles(buildStyles);
  const subtotal = line.available && line.price != null ? line.price * line.quantity : null;

  return (
    <View style={[styles.row, !line.available && styles.rowUnavailable]}>
      <View style={styles.photoWrap}>
        {line.photo ? (
          <Image source={{ uri: line.photo }} style={styles.photo} contentFit="cover" cachePolicy="memory-disk" />
        ) : (
          <View style={[styles.photo, styles.placeholder]} />
        )}
      </View>

      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={2}>
          {line.title ?? "This item is no longer available"}
        </Text>

        {line.available ? (
          <>
            <Text style={styles.price}>{line.price != null ? formatMoney(line.price, line.currency) : ""}</Text>
            <View style={styles.stepperRow}>
              <View style={styles.stepper}>
                <Pressable style={styles.stepBtn} onPress={onDecrement} hitSlop={8}>
                  <Svg width={14} height={14} viewBox="0 0 24 24" stroke={styles.stepIcon.color} strokeWidth={2.4}>
                    <Line x1={5} y1={12} x2={19} y2={12} />
                  </Svg>
                </Pressable>
                <Text style={styles.stepValue}>{line.quantity}</Text>
                <Pressable style={styles.stepBtn} onPress={onIncrement} disabled={line.quantity >= MAX_QTY_PER_ITEM} hitSlop={8}>
                  <Svg width={14} height={14} viewBox="0 0 24 24" stroke={styles.stepIcon.color} strokeWidth={2.4}>
                    <Line x1={12} y1={5} x2={12} y2={19} />
                    <Line x1={5} y1={12} x2={19} y2={12} />
                  </Svg>
                </Pressable>
              </View>
              {subtotal != null ? <Text style={styles.subtotal}>{formatMoney(subtotal, line.currency)}</Text> : null}
            </View>
          </>
        ) : (
          <Text style={styles.unavailableText}>No longer available for order — please remove it to continue.</Text>
        )}
      </View>

      <Pressable style={styles.removeBtn} onPress={onRemove} hitSlop={8}>
        <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={styles.removeIcon.color} strokeWidth={2}>
          <Path d="M3 6h18" />
          <Path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6" />
        </Svg>
      </Pressable>
    </View>
  );
}

function buildStyles(color: ColorPalette) {
  return StyleSheet.create({
    row: {
      flexDirection: "row",
      backgroundColor: color.surface,
      borderRadius: radius.lg,
      padding: space.sm,
      gap: space.md,
      alignItems: "flex-start",
    },
    rowUnavailable: { opacity: 0.7 },
    photoWrap: { width: 72, height: 72, borderRadius: radius.md, overflow: "hidden", backgroundColor: color.surfaceAlt },
    photo: { width: "100%", height: "100%" },
    placeholder: { backgroundColor: color.skeleton },
    body: { flex: 1, gap: 4, paddingTop: 2 },
    title: { ...font.body, color: color.text, fontWeight: "600" },
    price: { ...font.caption, color: color.textMuted },
    unavailableText: { ...font.caption, color: color.danger, marginTop: 2 },
    stepperRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 },
    stepper: { flexDirection: "row", alignItems: "center", backgroundColor: color.surfaceAlt, borderRadius: radius.sm },
    stepBtn: { width: 28, height: 30, alignItems: "center", justifyContent: "center" },
    stepIcon: { color: color.text },
    stepValue: { ...font.caption, color: color.text, minWidth: 18, textAlign: "center" },
    subtotal: { ...font.bodyStrong, color: color.brand },
    removeBtn: { padding: 4 },
    removeIcon: { color: color.textMuted },
  });
}
