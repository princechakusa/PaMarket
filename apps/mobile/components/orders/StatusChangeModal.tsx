// Confirmation dialog for an owner status-change action, with an optional
// note field. Mirrors components/ui/ConfirmModal.tsx's visual language
// (blur backdrop, opaque card) but adds the note input update_shop_order_status
// accepts — ConfirmModal itself has no slot for that, and every other use
// of it in the app is a plain yes/no confirm, so this stays a separate,
// small, order-specific component rather than growing ConfirmModal's API
// for one caller.
import { useEffect, useState } from "react";
import { Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { font, glass, radius, space, type ColorPalette } from "../../lib/theme";
import { useThemedStyles } from "../../lib/theme-provider";

type Props = {
  visible: boolean;
  actionLabel: string;
  fromStatus: string;
  toStatusLabel: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: (note: string) => void;
  onCancel: () => void;
};

export function StatusChangeModal({ visible, actionLabel, fromStatus, toStatusLabel, danger, busy, onConfirm, onCancel }: Props) {
  const styles = useThemedStyles(buildStyles);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (visible) setNote("");
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    (danger ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning) : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)).catch(() => {});
  }, [visible, danger]);

  function handleCancel() {
    if (busy) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onCancel();
  }

  function handleConfirm() {
    if (busy) return;
    Haptics.impactAsync(danger ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onConfirm(note.trim());
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleCancel}>
      <View style={styles.backdrop}>
        <BlurView
          intensity={glass.intensity.strong}
          tint="dark"
          blurMethod={Platform.OS === "android" ? glass.androidBlurMethod : undefined}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.card}>
          <Text style={styles.title}>{actionLabel}?</Text>
          <Text style={styles.body}>
            This moves the order from {fromStatus} to {toStatusLabel}. The customer will see this update.
          </Text>
          <TextInput
            style={styles.noteInput}
            value={note}
            onChangeText={setNote}
            placeholder="Add a note for the customer (optional)"
            placeholderTextColor={styles.placeholder.color}
            multiline
            maxLength={300}
            editable={!busy}
          />
          <View style={styles.buttonRow}>
            <Pressable style={styles.cancelButton} onPress={handleCancel} disabled={busy}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.confirmButton, danger && styles.confirmButtonDanger, busy && styles.confirmButtonBusy]}
              onPress={handleConfirm}
              disabled={busy}
            >
              <Text style={styles.confirmText}>{busy ? "Updating..." : actionLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function buildStyles(color: ColorPalette) {
  return StyleSheet.create({
    backdrop: { flex: 1, justifyContent: "center", paddingHorizontal: 28, overflow: "hidden" },
    card: { backgroundColor: color.surface, borderRadius: 16, padding: 20 },
    title: { ...font.h3, color: color.text, textAlign: "center" },
    body: { ...font.body, color: color.textSub, textAlign: "center", marginTop: 8, lineHeight: 19 },
    placeholder: { color: color.textMuted },
    noteInput: {
      ...font.body,
      color: color.text,
      backgroundColor: color.surfaceAlt,
      borderRadius: radius.md,
      paddingHorizontal: space.md,
      paddingVertical: space.sm,
      marginTop: space.md,
      minHeight: 60,
      textAlignVertical: "top",
    },
    buttonRow: { flexDirection: "row", gap: 10, marginTop: 20 },
    cancelButton: { flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: color.border, alignItems: "center" },
    cancelText: { fontSize: 14, fontWeight: "600", color: color.text },
    confirmButton: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: color.brand, alignItems: "center" },
    confirmButtonDanger: { backgroundColor: color.danger },
    confirmButtonBusy: { opacity: 0.7 },
    confirmText: { fontSize: 14, fontWeight: "700", color: color.textOnBrand },
  });
}
