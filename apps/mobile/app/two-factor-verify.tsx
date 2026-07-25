import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import { useAuth } from "../lib/auth";
import { BRAND_BLUE } from "../lib/constants";

// Mirrors www/js/auth.js H.authShow2FA — the login-time TOTP gate shown when
// a profile has two_factor_enabled.
export default function TwoFactorVerifyScreen() {
  const { verifyPendingTwoFactor, cancelPendingTwoFactor } = useAuth();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit() {
    if (code.replace(/\D/g, "").length !== 6) {
      setError("Enter the 6-digit code from your authenticator app");
      return;
    }
    setError(null);
    setIsSubmitting(true);
    const ok = await verifyPendingTwoFactor(code);
    setIsSubmitting(false);
    if (!ok) setError("Invalid authentication code");
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.iconWrap}>
        <Svg width={28} height={28} viewBox="0 0 32 32" fill="none">
          <Rect x={6} y={13} width={20} height={16} rx={3} stroke={BRAND_BLUE} strokeWidth={1.8} />
          <Path d="M10 13V9a6 6 0 0112 0v4" stroke={BRAND_BLUE} strokeWidth={1.8} strokeLinecap="round" />
          <Circle cx={16} cy={21} r={2} fill={BRAND_BLUE} />
        </Svg>
      </View>
      <Text style={styles.title}>Two-factor auth</Text>
      <Text style={styles.subtitle}>Open your authenticator app and enter the 6-digit code for PaMarket.</Text>

      <TextInput
        style={styles.input}
        placeholder="000000"
        placeholderTextColor="#C4C9D4"
        keyboardType="number-pad"
        maxLength={6}
        value={code}
        onChangeText={(t) => setCode(t.replace(/\D/g, ""))}
        autoFocus
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable style={[styles.button, isSubmitting && styles.buttonDisabled]} onPress={submit} disabled={isSubmitting}>
        {isSubmitting ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.buttonText}>Verify &amp; Continue</Text>}
      </Pressable>
      <Pressable style={styles.cancelButton} onPress={cancelPendingTwoFactor}>
        <Text style={styles.cancelText}>Cancel</Text>
      </Pressable>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: "#EEF2FF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: "#111827",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    color: "#5A6478",
    textAlign: "center",
    marginTop: 8,
    lineHeight: 20,
  },
  input: {
    width: "100%",
    marginTop: 28,
    borderWidth: 1,
    borderColor: "#D8DCE5",
    borderRadius: 10,
    paddingVertical: 14,
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: 8,
    textAlign: "center",
    color: "#111827",
  },
  error: {
    color: "#C0392B",
    fontSize: 13,
    marginTop: 10,
    textAlign: "center",
  },
  button: {
    width: "100%",
    backgroundColor: BRAND_BLUE,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 18,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
  cancelButton: {
    marginTop: 12,
    paddingVertical: 8,
  },
  cancelText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#8A93A6",
  },
});
