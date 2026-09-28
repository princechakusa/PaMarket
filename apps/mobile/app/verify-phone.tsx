// Verify (or change) the phone number on a signed-in account. Confirms the
// number with Supabase Auth (phone_confirmed_at), which drives the public
// "Phone verified" badge (profiles.phone_verified) and satisfies Admin →
// General Settings → Require phone verification.
import { useEffect, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { formatZwPhone } from "../lib/phone";
import { useAppSettings } from "../lib/app-settings";
import { PhoneOtpFlow } from "../components/PhoneOtpFlow";
import { Button, CheckCircleIcon, toast } from "../components/ui";
import { font, radius, space, type ColorPalette } from "../lib/theme";
import { useThemedStyles } from "../lib/theme-provider";

export default function VerifyPhoneScreen() {
  const styles = useThemedStyles(buildStyles);
  const tones = useThemedStyles((c: ColorPalette) => ({ success: c.success, brand: c.brand }));
  const router = useRouter();
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  const { session } = useAuth();
  const settings = useAppSettings();
  const [verifiedPhone, setVerifiedPhone] = useState<string | null>(null);
  const [profilePhone, setProfilePhone] = useState<string | null>(null);
  const [changing, setChanging] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (!cancelled && user) {
        setVerifiedPhone(user.phone && user.phone_confirmed_at ? `+${user.phone.replace(/^\+/, "")}` : null);
        const { data: p } = await supabase.from("profiles").select("phone").eq("id", user.id).maybeSingle();
        if (!cancelled) setProfilePhone((p as { phone?: string | null } | null)?.phone ?? null);
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [session?.user?.id]);

  async function onVerified(phone: string) {
    if (session?.user) await supabase.from("profiles").update({ phone }).eq("id", session.user.id);
    toast("Phone number verified.");
    setVerifiedPhone(phone);
    setChanging(false);
    if (returnTo) router.back();
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={tones.brand} />
      </View>
    );
  }

  if (!settings.phoneAuthEnabled) {
    return (
      <View style={styles.center}>
        <Text style={styles.body}>Phone verification isn't available yet. Please check back soon.</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {verifiedPhone && !changing ? (
          <View style={styles.verifiedCard}>
            <CheckCircleIcon c={tones.success} size={28} />
            <Text style={styles.title}>Your phone is verified</Text>
            <Text style={styles.body}>{formatZwPhone(verifiedPhone)}</Text>
            <Text style={styles.sub}>Buyers see a "Phone verified" badge on your profile and listings.</Text>
            <View style={{ marginTop: space.lg, alignSelf: "stretch" }}>
              <Button label="Use a different number" variant="secondary" onPress={() => setChanging(true)} />
            </View>
          </View>
        ) : (
          <>
            <Text style={styles.title}>Verify your phone number</Text>
            <Text style={styles.sub}>
              A verified number earns you a "Phone verified" badge, builds trust with buyers and protects your
              account.
            </Text>
            <View style={{ marginTop: space.xl }}>
              <PhoneOtpFlow mode="phone_change" initialPhone={profilePhone} onVerified={(p) => void onVerified(p)} />
            </View>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function buildStyles(color: ColorPalette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: color.bg },
    center: { flex: 1, alignItems: "center", justifyContent: "center", padding: space.xl, backgroundColor: color.bg },
    scroll: { padding: space.xl },
    verifiedCard: {
      alignItems: "center",
      gap: space.sm,
      backgroundColor: color.surface,
      borderRadius: radius.lg,
      padding: space.xl,
    },
    title: { ...font.h3, color: color.text, textAlign: "center" },
    body: { ...font.bodyStrong, color: color.text, textAlign: "center" },
    sub: { ...font.sub, color: color.textSub, textAlign: "center", marginTop: space.xs },
  });
}
