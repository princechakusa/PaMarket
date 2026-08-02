import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";
import { AppleIcon } from "./SocialAuthButtons";

// Mirrors GoogleButton.tsx's shape/sizing exactly (full-width, same
// padding/radius) but dark, matching Apple's own Human Interface Guidelines
// for the "Sign in with Apple" button — a light button would fail Apple's
// own review checklist for this control.
export function AppleButton({
  onPress,
  isLoading,
  label = "Continue with Apple",
}: {
  onPress: () => void;
  isLoading?: boolean;
  label?: string;
}) {
  return (
    <Pressable style={[styles.button, isLoading && styles.disabled]} onPress={onPress} disabled={isLoading}>
      {isLoading ? <ActivityIndicator color="#FFFFFF" /> : <AppleIcon />}
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: "#111827",
    borderRadius: 10,
    paddingVertical: 13,
    backgroundColor: "#111827",
  },
  disabled: {
    opacity: 0.6,
  },
  label: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFFFFF",
  },
});
