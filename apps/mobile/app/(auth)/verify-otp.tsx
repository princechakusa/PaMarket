import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { supabase } from "../../lib/supabase";

const OTP_LENGTH = 6;
const RESEND_COOLDOWN_MS = 60_000;

export default function VerifyOtpScreen() {
  const { email } = useLocalSearchParams<{ email: string }>();
  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendAvailableAt, setResendAvailableAt] = useState(0);
  const inputs = useRef<Array<TextInput | null>>([]);

  function handleChange(text: string, index: number) {
    const clean = text.replace(/[^0-9]/g, "").slice(-1);
    setDigits((prev) => {
      const next = [...prev];
      next[index] = clean;
      return next;
    });
    if (clean && index < OTP_LENGTH - 1) {
      inputs.current[index + 1]?.focus();
    }
    const code = digits.map((d, i) => (i === index ? clean : d)).join("");
    if (code.length === OTP_LENGTH) {
      void handleVerify(code);
    }
  }

  function handleKeyPress(index: number, key: string) {
    if (key === "Backspace" && !digits[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  }

  async function handleVerify(code: string) {
    if (!email) return;
    setError(null);
    setIsSubmitting(true);
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: "signup",
    });
    setIsSubmitting(false);
    if (verifyError) {
      setError(verifyError.message);
      return;
    }
    router.replace("/(tabs)");
  }

  async function handleResend() {
    if (!email || Date.now() < resendAvailableAt) return;
    setError(null);
    setIsResending(true);
    const { error: resendError } = await supabase.auth.resend({ type: "signup", email });
    setIsResending(false);
    if (resendError) {
      setError(resendError.message);
      return;
    }
    setResendAvailableAt(Date.now() + RESEND_COOLDOWN_MS);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Verify your email</Text>
      <Text style={styles.subtitle}>Enter the 6-digit code we sent to {email}</Text>

      <View style={styles.otpRow}>
        {digits.map((digit, i) => (
          <TextInput
            key={i}
            ref={(el) => {
              inputs.current[i] = el;
            }}
            style={styles.otpBox}
            keyboardType="number-pad"
            maxLength={1}
            value={digit}
            onChangeText={(text) => handleChange(text, i)}
            onKeyPress={({ nativeEvent }) => handleKeyPress(i, nativeEvent.key)}
          />
        ))}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {isSubmitting ? <ActivityIndicator color="#1A3A8F" style={{ marginTop: 8 }} /> : null}

      <Pressable onPress={handleResend} disabled={isResending} style={styles.resendLink}>
        <Text style={styles.resendText}>{isResending ? "Sending…" : "Resend code"}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#111827",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    color: "#5A6478",
    textAlign: "center",
    marginBottom: 20,
  },
  otpRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  otpBox: {
    width: 44,
    height: 52,
    borderWidth: 1,
    borderColor: "#D8DCE5",
    borderRadius: 10,
    textAlign: "center",
    fontSize: 20,
    fontWeight: "600",
    color: "#111827",
  },
  error: {
    color: "#C0392B",
    fontSize: 14,
    textAlign: "center",
    marginTop: 12,
  },
  resendLink: {
    alignItems: "center",
    marginTop: 20,
  },
  resendText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1A3A8F",
  },
});
