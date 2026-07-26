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
import * as Linking from "expo-linking";
import { router } from "expo-router";
import { supabase } from "../../lib/supabase";
import { isValidEmail } from "../../lib/validation";
import type { ColorPalette } from "../../lib/theme";
import { useThemedStyles } from "../../lib/theme-provider";

export default function ForgotPasswordScreen() {
  const styles = useThemedStyles(buildStyles);
  const tones = useThemedStyles(buildTones);
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSendReset() {
    if (!isValidEmail(email)) {
      setError("Enter a valid email address.");
      return;
    }
    setError(null);
    setIsSubmitting(true);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: Linking.createURL("login-callback"),
    });
    setIsSubmitting(false);
    if (resetError) {
      setError(resetError.message);
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <View style={styles.container}>
        <View style={styles.centeredBlock}>
          <Text style={styles.checkmark}>✓</Text>
          <Text style={styles.title}>Check your email</Text>
          <Text style={styles.subtitle}>
            We&apos;ve sent a password reset link to {email.trim()}.
          </Text>
          <Pressable style={styles.button} onPress={() => router.replace("/(auth)/sign-in")}>
            <Text style={styles.buttonText}>Back to Sign In</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.formBlock}>
        <Text style={styles.title}>Reset password</Text>
        <Text style={styles.subtitle}>Enter your email and we&apos;ll send a reset link</Text>

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={tones.textMuted}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          style={[styles.button, isSubmitting && styles.buttonDisabled]}
          onPress={handleSendReset}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color={tones.textOnBrand} />
          ) : (
            <Text style={styles.buttonText}>Send Reset Link</Text>
          )}
        </Pressable>

        <Pressable onPress={() => router.back()} style={styles.backLink}>
          <Text style={styles.backLinkText}>Back to Sign In</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function buildTones(color: ColorPalette) {
  return { textOnBrand: color.textOnBrand, textMuted: color.textMuted };
}

function buildStyles(color: ColorPalette) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: color.bg,
      justifyContent: "center",
      paddingHorizontal: 24,
    },
    formBlock: {
      gap: 12,
    },
    centeredBlock: {
      alignItems: "center",
      gap: 8,
    },
    checkmark: {
      fontSize: 40,
      color: color.success,
      marginBottom: 4,
    },
    title: {
      fontSize: 22,
      fontWeight: "700",
      color: color.text,
      textAlign: "center",
    },
    subtitle: {
      fontSize: 14,
      color: color.textSub,
      textAlign: "center",
      marginBottom: 12,
    },
    input: {
      borderWidth: 1,
      borderColor: color.borderStrong,
      borderRadius: 10,
      paddingHorizontal: 16,
      paddingVertical: 14,
      fontSize: 16,
      color: color.text,
    },
    button: {
      backgroundColor: color.brand,
      borderRadius: 10,
      paddingVertical: 14,
      alignItems: "center",
      marginTop: 8,
    },
    buttonDisabled: {
      opacity: 0.6,
    },
    buttonText: {
      color: color.textOnBrand,
      fontSize: 16,
      fontWeight: "600",
    },
    error: {
      color: color.danger,
      fontSize: 14,
    },
    backLink: {
      alignItems: "center",
      marginTop: 8,
    },
    backLinkText: {
      fontSize: 14,
      fontWeight: "600",
      color: color.brand,
    },
  });
}
