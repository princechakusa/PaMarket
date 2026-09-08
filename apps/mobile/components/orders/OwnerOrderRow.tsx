// One row in the owner's order inbox. `pending` gets a distinct left-edge
// accent and bold reference — the status that actually needs the owner's
// attention — everything else reads as a calmer, already-handled row.
import { Pressable, StyleSheet, Text, View } from "react-native";
import { FULFILLMENT_LABELS, formatMoney, formatOrderDateTime, orderStatusMeta, type OwnerOrderListRow } from "../../lib/shop-orders";
import { font, radius, space, type ColorPalette } from "../../lib/theme";
import { useThemedStyles } from "../../lib/theme-provider";

export function OwnerOrderRow({ order, onPress }: { order: OwnerOrderListRow; onPress: () => void }) {
  const styles = useThemedStyles(buildStyles);
  const meta = orderStatusMeta(order.status);
  const needsAttention = order.status === "pending";

  return (
    <Pressable style={[styles.row, needsAttention && styles.rowPending]} onPress={onPress}>
      <View style={styles.topRow}>
        <Text style={[styles.reference, needsAttention && styles.referencePending]}>#{order.id.slice(0, 8).toUpperCase()}</Text>
        <View style={[styles.statusPill, { backgroundColor: meta.bg, borderColor: meta.border }]}>
          <Text style={[styles.statusPillText, { color: meta.color }]}>{meta.label}</Text>
        </View>
      </View>

      <Text style={styles.customerName} numberOfLines={1}>
        {order.customer_name || "Customer"}
      </Text>

      <View style={styles.metaRow}>
        <Text style={styles.metaText}>
          {order.item_count} item{order.item_count === 1 ? "" : "s"} · {FULFILLMENT_LABELS[order.fulfillment_method]}
        </Text>
        <Text style={styles.total}>{formatMoney(order.total, order.currency)}</Text>
      </View>

      <Text style={styles.time}>{formatOrderDateTime(order.created_at)}</Text>
    </Pressable>
  );
}

function buildStyles(color: ColorPalette) {
  return StyleSheet.create({
    row: {
      backgroundColor: color.surface,
      borderRadius: radius.lg,
      padding: space.md,
      gap: 4,
      borderLeftWidth: 3,
      borderLeftColor: "transparent",
    },
    rowPending: { borderLeftColor: color.warning, backgroundColor: color.warningTint },
    topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    reference: { ...font.caption, color: color.textMuted },
    referencePending: { color: color.text, fontWeight: "800" },
    statusPill: { paddingHorizontal: space.sm, paddingVertical: 3, borderRadius: radius.pill, borderWidth: 1 },
    statusPillText: { fontSize: 10.5, fontWeight: "800" },
    customerName: { ...font.bodyStrong, color: color.text, marginTop: 2 },
    metaRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 2 },
    metaText: { ...font.caption, color: color.textMuted },
    total: { ...font.bodyStrong, color: color.brand },
    time: { ...font.caption, color: color.textMuted, marginTop: 2 },
  });
}
