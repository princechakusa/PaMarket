import { Component, type ReactNode } from "react";
import { Appearance, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Sentry } from "../lib/sentry";

// Nothing in this app previously caught a render-time error anywhere —
// any single unhandled exception in any screen crashed the entire app
// instead of degrading gracefully (RN release builds show no red box,
// just a hard crash/close). This is the last line of defense: it can't
// fix whatever actually threw, but it stops one bad screen from taking
// the whole app down, reports the real error to Sentry (already wired up
// in lib/sentry.ts) so it's actually diagnosable next time, and gives the
// user a way to recover instead of force-closing the app themselves.
//
// Deliberately a plain class component with no dependency on
// useThemedStyles/theme context — if the crash happened to originate
// inside the theme provider itself, this must still be able to render.

type Props = { children: ReactNode };
type State = { error: Error | null };

const isDark = Appearance.getColorScheme() === "dark";
const bg = isDark ? "#0B1220" : "#FFFFFF";
const text = isDark ? "#F1F5F9" : "#111827";
const textMuted = isDark ? "#94A3B8" : "#6B7280";
const brand = "#1A3A8F";

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    console.error("[ErrorBoundary] caught:", error, info?.componentStack);
    Sentry.captureException(error, { contexts: { react: { componentStack: info?.componentStack } } });
  }

  handleRestart = () => {
    // Not a full native relaunch (expo-updates isn't installed) — instead,
    // clear the caught error AND force navigation back to Home. Just
    // clearing the error alone can re-render the exact same crashed
    // screen with the exact same bad state, causing the same crash again;
    // sending the user somewhere known-good first actually recovers.
    try {
      router.replace("/(tabs)");
    } catch {
      // no-op — even if navigation itself is what's broken, clearing the
      // error below still gives the tree a chance to re-mount cleanly.
    }
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      return (
        <View style={[styles.container, { backgroundColor: bg }]}>
          <Text style={[styles.title, { color: text }]}>Something went wrong</Text>
          <Text style={[styles.subtitle, { color: textMuted }]}>
            PaMarket ran into an unexpected error. Restarting usually fixes it.
          </Text>
          <Pressable style={[styles.button, { backgroundColor: brand }]} onPress={this.handleRestart}>
            <Text style={styles.buttonText}>Restart PaMarket</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 },
  title: { fontSize: 18, fontWeight: "800", textAlign: "center", marginBottom: 8 },
  subtitle: { fontSize: 14, textAlign: "center", lineHeight: 20, marginBottom: 24 },
  button: { borderRadius: 10, paddingHorizontal: 24, paddingVertical: 13 },
  buttonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },
});
