// "Continue with phone" — WhatsApp / SMS one-time-code sign-in. Shown only
// when Admin → General Settings → Phone / WhatsApp sign-in is on (it needs an
// SMS/WhatsApp provider configured in Supabase Auth first).
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GlassBackButton } from "../../components/ui";
import { BrandWordmark } from "../../components/BrandLogo";
import { PhoneOtpFlow } from "../../components/PhoneOtpFlow";
import { LegalDocSheet } from "../../components/LegalDocSheet";
import { TERMS, PRIVACY, type LegalDoc } from "../../lib/legal";
import { useLegalDocUpgrade } from "../../lib/content";
import { supabase } from "../../lib/supabase";
import { font, space, type ColorPalette } from "../../lib/theme";
import { useThemedStyles } from "../../lib/theme-provider";

export default function PhoneSignInScreen() {
  const styles = useThemedStyles(buildStyles);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [legalDoc, setLegalDoc] = useState<LegalDoc | null>(null);
  const termsDoc = useLegalDocUpgrade("terms", TERMS);
  const privacyDoc = useLegalDocUpgrade("privacy", PRIVACY);

  function handleBack() {
    if (router.canGoBack()) router.back();
    else router.replace("/(auth)/sign-in");
  }

  async function onVerified(phone: string) {
    // Keep profiles.phone in step with the verified number so sellers'
    // contact details are right from the first listing.
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      await supabase.from("profiles").update({ phone }).eq("id", data.user.id);
    }
    router.replace("/(tabs)");
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + space.sm }]}>
        <GlassBackButton onPress={handleBack} tone="dark" flat />
        <Text style={styles.headerTitle}>Continue with phone</Text>
        <View style={{ width: 52 }} />
      </View>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + space.xxl }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.brand}>
          <BrandWordmark size={26} />
        </View>
        <Text style={styles.title}>Sign in with your number</Text>
        <Text style={styles.subtitle}>We'll send a one-time code to your WhatsApp or by SMS. No password needed.</Text>

        <PhoneOtpFlow mode="login" onVerified={(p) => void onVerified(p)} />

        <Text style={styles.consent}>
          By continuing, you confirm you are 18+ and agree to our{" "}
          <Text style={styles.consentLink} onPress={() => setLegalDoc(termsDoc)}>Terms of Service</Text> and{" "}
          <Text style={styles.consentLink} onPress={() => setLegalDoc(privacyDoc)}>Privacy Policy</Text>.
        </Text>
      </ScrollView>
      <LegalDocSheet doc={legalDoc} visible={legalDoc != null} onClose={() => setLegalDoc(null)} />
    </KeyboardAvoidingView>
  );
}

function buildStyles(color: ColorPalette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: color.surface },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: space.lg,
      paddingBottom: space.sm,
    },
    headerTitle: { ...font.title, color: color.text },
    scroll: { paddingHorizontal: space.xl, paddingTop: space.lg },
    brand: { alignItems: "center", marginBottom: space.xl },
    title: { ...font.h2, color: color.text, textAlign: "center" },
    subtitle: { ...font.body, color: color.textSub, textAlign: "center", marginTop: space.xs, marginBottom: space.xl },
    consent: { ...font.caption, color: color.textSub, textAlign: "center", marginTop: space.xxl },
    consentLink: { color: color.brand, fontWeight: "700" },
  });
}
