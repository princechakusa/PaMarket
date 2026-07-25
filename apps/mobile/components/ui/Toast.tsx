import { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, Text } from "react-native";

type ToastState = { message: string; isError: boolean; key: number } | null;

let showToastImpl: ((message: string, duration?: number, isError?: boolean) => void) | null = null;

// Global toast function, mirrors www/js/app.js H.toast — call from anywhere,
// no context/provider plumbing needed at call sites.
export function toast(message: string, duration = 4000, isError = false) {
  showToastImpl?.(message, duration, isError);
}

export function ToastHost() {
  const [state, setState] = useState<ToastState>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    showToastImpl = (message, duration = 4000, isError = false) => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      setState({ message, isError, key: Date.now() });
      Animated.timing(opacity, { toValue: 1, duration: 150, useNativeDriver: true }).start();
      hideTimer.current = setTimeout(() => {
        Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => setState(null));
      }, duration);
    };
    return () => {
      showToastImpl = null;
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [opacity]);

  if (!state) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.container, state.isError && styles.containerError, { opacity }]}
    >
      <Text style={styles.text}>{state.message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 90,
    left: 24,
    right: 24,
    backgroundColor: "rgba(17,24,39,0.94)",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    zIndex: 999,
  },
  containerError: {
    backgroundColor: "rgba(192,57,43,0.96)",
  },
  text: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
  },
});
