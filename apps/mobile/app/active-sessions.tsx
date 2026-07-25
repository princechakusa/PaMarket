import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "../lib/supabase";
import { toast } from "../components/ui/Toast";

// Mirrors www/js/security_pages.js pages.ActiveSessions. The web version
// tracks a locally-stored session list with revoke actions; RN has no
// equivalent multi-session bookkeeping (Supabase manages refresh tokens
// server-side), so this shows the current device and offers a real
// "sign out everywhere" action via Supabase's global sign-out scope.
export default function ActiveSessionsScreen() {
  const router = useRouter();
  const deviceLabel = Platform.OS === "ios" ? "iPhone / iPad" : "Android Device";

  async function signOutEverywhere() {
    const { error } = await supabase.auth.signOut({ scope: "global" });
    if (error) {
      toast("Failed to sign out other devices", 3000, true);
      return;
    }
    toast("Signed out of all devices");
    router.replace("/(auth)/sign-in");
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <View style={styles.box}>
        <Text style={styles.boxTitle}>Logged-in Devices</Text>
        <View style={styles.row}>
          <View style={styles.iconWrap}>
            <Text style={styles.iconText}>📱</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.deviceName}>{deviceLabel}</Text>
            <Text style={styles.deviceMeta}>This device</Text>
          </View>
          <View style={styles.currentPill}>
            <Text style={styles.currentPillText}>Current</Text>
          </View>
        </View>
      </View>

      <Pressable style={styles.dangerButton} onPress={signOutEverywhere}>
        <Text style={styles.dangerButtonText}>Sign Out All Other Devices</Text>
      </Pressable>
      <Pressable style={styles.cancelButton} onPress={() => router.back()}>
        <Text style={styles.cancelButtonText}>Back</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F6F9" },
  box: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },
  boxTitle: { fontSize: 14, fontWeight: "700", color: "#111827", marginBottom: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
  },
  iconText: { fontSize: 18 },
  deviceName: { fontSize: 13, fontWeight: "700", color: "#111827" },
  deviceMeta: { fontSize: 11, color: "#8A93A6", marginTop: 2 },
  currentPill: {
    backgroundColor: "#DCFCE7",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  currentPillText: { fontSize: 11, fontWeight: "700", color: "#16A34A" },
  dangerButton: {
    backgroundColor: "#FEE2E2",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
  },
  dangerButtonText: { color: "#C0392B", fontSize: 14, fontWeight: "700" },
  cancelButton: { alignItems: "center", paddingVertical: 14 },
  cancelButtonText: { fontSize: 14, fontWeight: "700", color: "#5A6478" },
});
