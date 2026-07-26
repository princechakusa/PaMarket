import { useEffect, useState } from "react";
import * as Clipboard from "expo-clipboard";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import QRCode from "react-native-qrcode-svg";
import { useRouter } from "expo-router";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { createTotpSecret, totpUri, verifyTotpCode } from "../lib/totp";
import { toast } from "../components/ui/Toast";
import type { ColorPalette } from "../lib/theme";
import { useThemedStyles } from "../lib/theme-provider";

// Mirrors www/js/security_pages.js pages.TwoFactor / H._twoFactor.
export default function TwoFactorSetupScreen() {
  const styles = useThemedStyles(buildStyles);
  const tones = useThemedStyles(buildTones);
  const { session } = useAuth();
  const router = useRouter();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [pendingSecret, setPendingSecret] = useState("");
  const [code, setCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!session?.user) return;
    supabase
      .from("profiles")
      .select("two_factor_enabled")
      .eq("id", session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        setEnabled(!!data?.two_factor_enabled);
        if (!data?.two_factor_enabled) setPendingSecret(createTotpSecret());
      });
  }, [session]);

  if (!session?.user || enabled === null) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={tones.brand} />
      </View>
    );
  }

  const userId = session.user.id;
  const email = session.user.email || "user";
  const secretClean = pendingSecret.replace(/\s/g, "");
  // Rendered fully on-device (react-native-qrcode-svg) — the TOTP secret
  // never leaves the phone. The previous implementation sent it as a URL
  // query param to a third-party QR image service (api.qrserver.com),
  // which is a real credential-leak risk: that service's server logs and
  // network path would see the exact secret that bypasses 2FA.
  const qrValue = totpUri(pendingSecret, email);

  async function enable() {
    if (code.replace(/\D/g, "").length !== 6) {
      toast("Enter the 6-digit code from your authenticator app", 3000, true);
      return;
    }
    setIsSubmitting(true);
    const ok = await verifyTotpCode(pendingSecret, code);
    if (!ok) {
      setIsSubmitting(false);
      toast("Invalid authenticator code", 3000, true);
      return;
    }
    const { error } = await supabase
      .from("profiles")
      .update({ two_factor_enabled: true, two_factor_secret: pendingSecret })
      .eq("id", userId);
    setIsSubmitting(false);
    if (error) {
      toast("Failed to enable 2FA — try again", 3000, true);
      return;
    }
    setEnabled(true);
    setCode("");
    toast("2FA enabled");
  }

  async function disable() {
    if (code.replace(/\D/g, "").length !== 6) {
      toast("Enter the 6-digit code from your authenticator app", 3000, true);
      return;
    }
    setIsSubmitting(true);
    const { data } = await supabase
      .from("profiles")
      .select("two_factor_secret")
      .eq("id", userId)
      .single();
    const serverSecret = data?.two_factor_secret;
    if (!serverSecret || !(await verifyTotpCode(serverSecret, code))) {
      setIsSubmitting(false);
      toast("Invalid authenticator code", 3000, true);
      return;
    }
    const { error } = await supabase
      .from("profiles")
      .update({ two_factor_enabled: false, two_factor_secret: null })
      .eq("id", userId);
    setIsSubmitting(false);
    if (error) {
      toast("Failed to disable 2FA — try again", 3000, true);
      return;
    }
    setEnabled(false);
    setPendingSecret(createTotpSecret());
    setCode("");
    toast("2FA disabled");
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      {enabled ? (
        <>
          <View style={[styles.box, styles.activeBox]}>
            <Text style={styles.activeTitle}>2FA is Active</Text>
            <Text style={styles.activeSub}>
              Your account is protected with two-factor authentication. You&apos;ll need your authenticator app every
              time you log in.
            </Text>
          </View>
          <View style={styles.box}>
            <Text style={styles.boxTitle}>Disable Two-Factor Authentication</Text>
            <Text style={styles.boxText}>
              Open your authenticator app and enter the 6-digit code to confirm you want to disable 2FA.
            </Text>
            <TextInput
              style={styles.codeInput}
              placeholder="123456"
              keyboardType="number-pad"
              maxLength={6}
              value={code}
              onChangeText={(t) => setCode(t.replace(/\D/g, ""))}
            />
            <Pressable style={[styles.dangerButton, isSubmitting && styles.buttonDisabled]} onPress={disable} disabled={isSubmitting}>
              <Text style={styles.dangerButtonText}>Disable 2FA</Text>
            </Pressable>
          </View>
        </>
      ) : (
        <>
          <View style={[styles.box, { alignItems: "center" }]}>
            <Text style={styles.boxTitle}>Set Up Two-Factor Authentication</Text>
            <Text style={styles.boxText}>
              Add an extra layer of security. After setup, every login will require a 6-digit code from your
              authenticator app.
            </Text>
          </View>
          <View style={styles.box}>
            <Text style={styles.boxTitle}>Step 1 — Install an Authenticator App</Text>
            <Text style={styles.boxText}>
              Download one of these free apps: Google Authenticator, Microsoft Authenticator, or Authy
            </Text>
          </View>
          <View style={styles.box}>
            <Text style={styles.boxTitle}>Step 2 — Scan the QR Code</Text>
            <Text style={styles.boxText}>
              Open your authenticator app, tap + or Add account, then scan this code:
            </Text>
            <View style={styles.qrWrap}>
              <QRCode value={qrValue} size={180} />
            </View>
            <Text style={styles.boxTextCenter}>Can&apos;t scan? Tap to copy the manual key instead:</Text>
            <Pressable
              style={styles.secretBox}
              onPress={async () => {
                await Clipboard.setStringAsync(secretClean);
                toast("Key copied!");
              }}
            >
              <Text style={styles.secretText}>{pendingSecret}</Text>
            </Pressable>
          </View>
          <View style={styles.box}>
            <Text style={styles.boxTitle}>Step 3 — Enter the 6-Digit Code</Text>
            <Text style={styles.boxText}>After scanning, your app will show a 6-digit code. Enter it below.</Text>
            <TextInput
              style={styles.codeInput}
              placeholder="123456"
              keyboardType="number-pad"
              maxLength={6}
              value={code}
              onChangeText={(t) => setCode(t.replace(/\D/g, ""))}
            />
            <Pressable style={[styles.primaryButton, isSubmitting && styles.buttonDisabled]} onPress={enable} disabled={isSubmitting}>
              <Text style={styles.primaryButtonText}>Enable 2FA</Text>
            </Pressable>
          </View>
        </>
      )}
      <Pressable style={styles.backButton} onPress={() => router.back()}>
        <Text style={styles.backButtonText}>Back</Text>
      </Pressable>
    </ScrollView>
  );
}

function buildTones(color: ColorPalette) {
  return { brand: color.brand };
}

function buildStyles(color: ColorPalette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: color.bg },
    centered: { flex: 1, alignItems: "center", justifyContent: "center" },
    box: {
      backgroundColor: color.surface,
      borderRadius: 14,
      padding: 16,
      marginBottom: 12,
    },
    activeBox: {
      backgroundColor: color.successTint,
      alignItems: "center",
    },
    activeTitle: { fontSize: 17, fontWeight: "800", color: color.success, marginBottom: 4 },
    activeSub: { fontSize: 13, color: color.success, lineHeight: 19, textAlign: "center" },
    boxTitle: { fontSize: 14, fontWeight: "700", color: color.text, marginBottom: 8 },
    boxText: { fontSize: 13, color: color.textSub, lineHeight: 19 },
    boxTextCenter: { fontSize: 12, color: color.textSub, textAlign: "center", marginTop: 4, marginBottom: 8 },
    qrWrap: {
      alignSelf: "center",
      marginVertical: 12,
      padding: 12,
      backgroundColor: color.surface,
      borderRadius: 12,
    },
    secretBox: {
      backgroundColor: color.brandTint,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: color.brandTintStrong,
      padding: 12,
      alignItems: "center",
    },
    secretText: { fontSize: 15, fontWeight: "800", letterSpacing: 2, color: color.brand },
    codeInput: {
      borderWidth: 1,
      borderColor: color.borderStrong,
      borderRadius: 10,
      paddingVertical: 12,
      paddingHorizontal: 14,
      fontSize: 18,
      fontWeight: "700",
      letterSpacing: 4,
      textAlign: "center",
      marginTop: 12,
      marginBottom: 12,
      color: color.text,
    },
    primaryButton: {
      backgroundColor: color.brand,
      borderRadius: 10,
      paddingVertical: 13,
      alignItems: "center",
    },
    primaryButtonText: { color: color.textOnBrand, fontSize: 14, fontWeight: "700" },
    dangerButton: {
      backgroundColor: color.danger,
      borderRadius: 10,
      paddingVertical: 13,
      alignItems: "center",
    },
    dangerButtonText: { color: "#ffffff", fontSize: 14, fontWeight: "700" },
    buttonDisabled: { opacity: 0.6 },
    backButton: { alignItems: "center", paddingVertical: 14 },
    backButtonText: { fontSize: 14, fontWeight: "700", color: color.textSub },
  });
}
