import { useEffect } from "react";
import { Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { glass, type ColorPalette } from "../../lib/theme";
import { useThemedStyles } from "../../lib/theme-provider";

// Mirrors www/js/app.js H.modal — generic confirm/cancel dialog. Backdrop is
// a real blur (native "overlay" material) rather than a flat dim, matching
// the rest of the glass system; the card itself stays solid/opaque so a
// destructive confirm (delete account, remove listing, etc.) stays fully
// legible rather than fighting a translucent surface for contrast.
export function ConfirmModal({
  visible,
  title,
  body,
  confirmText = "Confirm",
  cancelText = "Cancel",
  danger,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  title: string;
  body?: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const styles = useThemedStyles(buildStyles);

  useEffect(() => {
    if (!visible) return;
    (danger ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning) : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)).catch(
      () => {}
    );
  }, [visible, danger]);

  function handleCancel() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onCancel();
  }
  function handleConfirm() {
    Haptics.impactAsync(danger ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onConfirm();
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <BlurView
          intensity={glass.intensity.strong}
          tint="dark"
          experimentalBlurMethod={Platform.OS === "android" ? glass.androidBlurMethod : undefined}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          {body ? <Text style={styles.body}>{body}</Text> : null}
          <View style={styles.buttonRow}>
            <Pressable style={styles.cancelButton} onPress={handleCancel}>
              <Text style={styles.cancelText}>{cancelText}</Text>
            </Pressable>
            <Pressable style={[styles.confirmButton, danger && styles.confirmButtonDanger]} onPress={handleConfirm}>
              <Text style={styles.confirmText}>{confirmText}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function buildStyles(color: ColorPalette) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      justifyContent: "center",
      paddingHorizontal: 28,
      overflow: "hidden",
    },
    card: {
      backgroundColor: color.surface,
      borderRadius: 16,
      padding: 20,
    },
    title: {
      fontSize: 16,
      fontWeight: "700",
      color: color.text,
      textAlign: "center",
    },
    body: {
      fontSize: 13,
      color: color.textSub,
      textAlign: "center",
      marginTop: 8,
      lineHeight: 19,
    },
    buttonRow: {
      flexDirection: "row",
      gap: 10,
      marginTop: 20,
    },
    cancelButton: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: color.border,
      alignItems: "center",
    },
    cancelText: {
      fontSize: 14,
      fontWeight: "600",
      color: color.text,
    },
    confirmButton: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 10,
      backgroundColor: color.brand,
      alignItems: "center",
    },
    confirmButtonDanger: {
      backgroundColor: color.danger,
    },
    confirmText: {
      fontSize: 14,
      fontWeight: "700",
      color: color.textOnBrand,
    },
  });
}
