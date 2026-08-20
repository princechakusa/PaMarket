import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "../lib/supabase";
import { clearAllPushTokens } from "../lib/push";
import { clearIAPUserContext } from "../lib/iap";
import { toast } from "../components/ui/Toast";
import type { ColorPalette } from "../lib/theme";
import { useThemedStyles } from "../lib/theme-provider";

// Mirrors www/js/security_pages.js pages.ActiveSessions. The web version
// tracks a locally-stored session list with revoke actions; RN has no
// equivalent multi-session bookkeeping (Supabase manages refresh tokens
// server-side), so this shows the current device and offers a real
// "sign out everywhere" action via Supabase's global sign-out scope.
export default function ActiveSessionsScreen() {
  const styles = useThemedStyles(buildStyles);
  const router = useRouter();
  const deviceLabel = Platform.OS === "ios" ? "iPhone / iPad" : "Android Device";

  async function signOutEverywhere() {
    await clearIAPUserContext();
    await clearAllPushTokens();
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
    </ScrollView>
  );
}

function buildStyles(color: ColorPalette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: color.bg },
    box: {
      backgroundColor: color.surface,
      borderRadius: 14,
      padding: 16,
      marginBottom: 16,
    },
    boxTitle: { fontSize: 14, fontWeight: "700", color: color.text, marginBottom: 12 },
    row: { flexDirection: "row", alignItems: "center", gap: 12 },
    iconWrap: {
      width: 38,
      height: 38,
      borderRadius: 11,
      backgroundColor: color.brandTint,
      alignItems: "center",
      justifyContent: "center",
    },
    iconText: { fontSize: 18 },
    deviceName: { fontSize: 13, fontWeight: "700", color: color.text },
    deviceMeta: { fontSize: 11, color: color.textMuted, marginTop: 2 },
    currentPill: {
      backgroundColor: color.successTint,
      borderRadius: 20,
      paddingHorizontal: 10,
      paddingVertical: 3,
    },
    currentPillText: { fontSize: 11, fontWeight: "700", color: color.success },
    dangerButton: {
      backgroundColor: color.dangerTint,
      borderRadius: 10,
      paddingVertical: 14,
      alignItems: "center",
    },
    dangerButtonText: { color: color.danger, fontSize: 14, fontWeight: "700" },
  });
}
