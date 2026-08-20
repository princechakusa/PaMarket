import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import Svg, { Polyline } from "react-native-svg";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { clearPushToken } from "../lib/push";
import { clearIAPUserContext } from "../lib/iap";
import type { ColorPalette } from "../lib/theme";
import { useThemedStyles } from "../lib/theme-provider";

type Styles = ReturnType<typeof buildStyles>;

function ChevronRight({ color }: { color: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.5}>
      <Polyline points="9 18 15 12 9 6" />
    </Svg>
  );
}

function Row({
  label,
  value,
  onPress,
  styles,
  chevronColor,
}: {
  label: string;
  value?: string;
  onPress: () => void;
  styles: Styles;
  chevronColor: string;
}) {
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.rowRight}>
        {value ? <Text style={styles.rowValue}>{value}</Text> : null}
        <ChevronRight color={chevronColor} />
      </View>
    </Pressable>
  );
}

function SectionLabel({ children, styles }: { children: string; styles: Styles }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

export default function SettingsScreen() {
  const styles = useThemedStyles(buildStyles);
  const tones = useThemedStyles(buildTones);
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
          await clearIAPUserContext();
          if (userId) await clearPushToken(userId);
          await supabase.auth.signOut();
        },
      },
    ]);
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <SectionLabel styles={styles}>Appearance</SectionLabel>
      <View style={styles.group}>
        <Row label="Theme" onPress={() => router.push("/theme-settings")} styles={styles} chevronColor={tones.chevron} />
      </View>

      <SectionLabel styles={styles}>Notifications</SectionLabel>
      <View style={styles.group}>
        <Row
          label="Notification Preferences"
          onPress={() => router.push("/notification-preferences")}
          styles={styles}
          chevronColor={tones.chevron}
        />
      </View>

      <SectionLabel styles={styles}>Account &amp; Privacy</SectionLabel>
      <View style={styles.group}>
        <Row label="Privacy Settings" onPress={() => router.push("/privacy-settings")} styles={styles} chevronColor={tones.chevron} />
        <Row label="Change Password" onPress={() => router.push("/change-password")} styles={styles} chevronColor={tones.chevron} />
        <Row
          label="Two-Factor Authentication"
          onPress={() => router.push("/two-factor-setup")}
          styles={styles}
          chevronColor={tones.chevron}
        />
        <Row label="Active Sessions" onPress={() => router.push("/active-sessions")} styles={styles} chevronColor={tones.chevron} />
        <Row
          label="Language"
          value="English"
          onPress={() => router.push("/language-settings")}
          styles={styles}
          chevronColor={tones.chevron}
        />
        <Row label="Delete Account" onPress={() => router.push("/delete-account")} styles={styles} chevronColor={tones.chevron} />
      </View>

      <SectionLabel styles={styles}>Activity</SectionLabel>
      <View style={styles.group}>
        <Row label="My Activity" onPress={() => router.push("/my-activity")} styles={styles} chevronColor={tones.chevron} />
        <Row label="Blocked Users" onPress={() => router.push("/blocked-users")} styles={styles} chevronColor={tones.chevron} />
      </View>

      <SectionLabel styles={styles}>Legal</SectionLabel>
      <View style={styles.group}>
        <Row label="Legal Hub" onPress={() => router.push("/legal-hub")} styles={styles} chevronColor={tones.chevron} />
        <Row label="About PaMarket" value="v1.29.0" onPress={() => router.push("/about")} styles={styles} chevronColor={tones.chevron} />
      </View>

      <Pressable style={styles.signOutButton} onPress={signOut}>
        <Text style={styles.signOutButtonText}>Sign Out</Text>
      </Pressable>
    </ScrollView>
  );
}

function buildTones(color: ColorPalette) {
  return { chevron: color.textMuted };
}

function buildStyles(color: ColorPalette) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: color.bg,
    },
    sectionLabel: {
      fontSize: 11,
      fontWeight: "700",
      color: color.textMuted,
      textTransform: "uppercase",
      letterSpacing: 0.4,
      marginTop: 20,
      marginBottom: 8,
      marginHorizontal: 16,
    },
    group: {
      backgroundColor: color.surface,
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
      borderBottomColor: color.divider,
    },
    rowLabel: {
      fontSize: 14,
      fontWeight: "600",
      color: color.text,
    },
    rowRight: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    rowValue: {
      fontSize: 13,
      color: color.textMuted,
    },
    signOutButton: {
      marginHorizontal: 16,
      marginTop: 24,
      paddingVertical: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: color.dangerTint,
      alignItems: "center",
    },
    signOutButtonText: {
      fontSize: 14,
      fontWeight: "700",
      color: color.danger,
    },
  });
}
