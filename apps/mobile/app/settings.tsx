import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import Svg, { Polyline } from "react-native-svg";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { clearPushToken } from "../lib/push";
import { BRAND_BLUE } from "../lib/constants";

function ChevronRight() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#C4C9D4" strokeWidth={2.5}>
      <Polyline points="9 18 15 12 9 6" />
    </Svg>
  );
}

function Row({ label, value, onPress }: { label: string; value?: string; onPress: () => void }) {
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.rowRight}>
        {value ? <Text style={styles.rowValue}>{value}</Text> : null}
        <ChevronRight />
      </View>
    </Pressable>
  );
}

function SectionLabel({ children }: { children: string }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

export default function SettingsScreen() {
  const router = useRouter();
  const { session } = useAuth();

  function signOut() {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          const userId = session?.user?.id;
          if (userId) await clearPushToken(userId);
          await supabase.auth.signOut();
        },
      },
    ]);
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <SectionLabel>Appearance</SectionLabel>
      <View style={styles.group}>
        <Row label="Theme" onPress={() => router.push("/theme-settings")} />
      </View>

      <SectionLabel>Notifications</SectionLabel>
      <View style={styles.group}>
        <Row label="Notification Preferences" onPress={() => router.push("/notification-preferences")} />
      </View>

      <SectionLabel>Account &amp; Privacy</SectionLabel>
      <View style={styles.group}>
        <Row label="Privacy Settings" onPress={() => router.push("/privacy-settings")} />
        <Row label="Change Password" onPress={() => router.push("/change-password")} />
        <Row label="Two-Factor Authentication" onPress={() => router.push("/two-factor-setup")} />
        <Row label="Active Sessions" onPress={() => router.push("/active-sessions")} />
        <Row label="Language" value="English" onPress={() => router.push("/language-settings")} />
        <Row label="Delete Account" onPress={() => router.push("/delete-account")} />
      </View>

      <SectionLabel>Activity</SectionLabel>
      <View style={styles.group}>
        <Row label="My Activity" onPress={() => router.push("/my-activity")} />
        <Row label="Blocked Users" onPress={() => router.push("/blocked-users")} />
      </View>

      <SectionLabel>Legal</SectionLabel>
      <View style={styles.group}>
        <Row label="Legal Hub" onPress={() => router.push("/legal-hub")} />
        <Row label="About PaMarket" value="v1.29.0" onPress={() => router.push("/about")} />
      </View>

      <Pressable style={styles.signOutButton} onPress={signOut}>
        <Text style={styles.signOutButtonText}>Sign Out</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F6F9",
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#8A93A6",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginTop: 20,
    marginBottom: 8,
    marginHorizontal: 16,
  },
  group: {
    backgroundColor: "#ffffff",
    marginHorizontal: 16,
    borderRadius: 14,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F1F5",
  },
  rowLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
  },
  rowRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  rowValue: {
    fontSize: 13,
    color: "#8A93A6",
  },
  signOutButton: {
    marginHorizontal: 16,
    marginTop: 24,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#F3D6D3",
    alignItems: "center",
  },
  signOutButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#C0392B",
  },
});
