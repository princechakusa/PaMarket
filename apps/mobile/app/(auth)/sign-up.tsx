import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Link, router } from "expo-router";
import { supabase } from "../../lib/supabase";
import { signInWithApple, signInWithOAuthProvider } from "../../lib/oauth";
import { GoogleButton } from "../../components/GoogleButton";
import { AppleButton } from "../../components/AppleButton";
import { PasswordField } from "../../components/PasswordField";
import { LegalDocSheet } from "../../components/LegalDocSheet";
import { TERMS, PRIVACY, type LegalDoc } from "../../lib/legal";
import { isValidEmail, isValidPhone, isStrongEnoughPassword } from "../../lib/validation";
import type { ColorPalette } from "../../lib/theme";
import { useThemedStyles } from "../../lib/theme-provider";

export default function SignUpScreen() {
  const styles = useThemedStyles(buildStyles);
  const tones = useThemedStyles(buildTones);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [consent, setConsent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isAppleLoading, setIsAppleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [legalDoc, setLegalDoc] = useState<LegalDoc | null>(null);

  async function handleSignUp() {
    if (fullName.trim().length < 2) {
      setError("Enter your full name.");
      return;
    }
    if (!isValidEmail(email)) {
      setError("Enter a valid email address.");
      return;
    }
    if (phone.trim() && !isValidPhone(phone)) {
      setError("Enter a valid Zimbabwean phone number.");
      return;
    }
    if (!isStrongEnoughPassword(password)) {
      setError("Password must be 8+ characters with an uppercase letter and a number or symbol.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (!consent) {
      setError("Please confirm you are 18+ and agree to our policies.");
      return;
    }

    setError(null);
    setIsSubmitting(true);
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          full_name: fullName.trim(),
          phone: phone.trim() || null,
        },
      },
    });
    setIsSubmitting(false);

    if (signUpError) {
      setError(signUpError.message);
      return;
    }

    if (data.user && data.user.identities && data.user.identities.length === 0) {
      setError("An account with this email already exists. Try signing in instead.");
      return;
    }

    if (!data.session) {
      router.push({ pathname: "/(auth)/verify-otp", params: { email: email.trim() } });
    }
  }

  async function handleGoogle() {
    setError(null);
    setIsGoogleLoading(true);
    try {
      await signInWithOAuthProvider("google");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Google sign-in failed");
    } finally {
      setIsGoogleLoading(false);
    }
  }

  async function handleApple() {
    setError(null);
    setIsAppleLoading(true);
    try {
      await signInWithApple();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Apple sign-in failed");
    } finally {
      setIsAppleLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.brandBlock}>
          <Text style={styles.brand}>Create account</Text>
          <Text style={styles.subtitle}>Join Zimbabwe&apos;s largest marketplace</Text>
        </View>

        {Platform.OS === "ios" ? (
          <View style={{ marginBottom: 10 }}>
            <AppleButton onPress={handleApple} isLoading={isAppleLoading} label="Sign up with Apple" />
          </View>
        ) : null}
        <GoogleButton onPress={handleGoogle} isLoading={isGoogleLoading} label="Sign up with Google" />

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or use email</Text>
          <View style={styles.dividerLine} />
        </View>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Full name"
            placeholderTextColor={tones.textMuted}
            autoComplete="name"
            value={fullName}
            onChangeText={setFullName}
          />
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
          <TextInput
            style={styles.input}
            placeholder="Phone (optional)"
            placeholderTextColor={tones.textMuted}
            autoComplete="tel"
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
          />
          <PasswordField
            value={password}
            onChangeText={setPassword}
            placeholder="8+ chars, uppercase & number"
            showStrength
            autoComplete="password-new"
          />
          <PasswordField
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Confirm password"
            autoComplete="password-new"
          />

          <Pressable style={styles.consentRow} onPress={() => setConsent((v) => !v)}>
            <View style={[styles.checkbox, consent && styles.checkboxChecked]}>
              {consent ? <Text style={styles.checkboxMark}>✓</Text> : null}
            </View>
            <Text style={styles.consentText}>
              I am 18+ and agree to{" "}
              <Text style={styles.consentLink} onPress={() => setLegalDoc(TERMS)}>
                Terms &amp; Conditions
              </Text>{" "}
              and{" "}
              <Text style={styles.consentLink} onPress={() => setLegalDoc(PRIVACY)}>
                Privacy Policy
              </Text>
            </Text>
          </Pressable>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            style={[styles.button, isSubmitting && styles.buttonDisabled]}
            onPress={handleSignUp}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color={tones.textOnBrand} />
            ) : (
              <Text style={styles.buttonText}>Create Account</Text>
            )}
          </Pressable>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account? </Text>
          <Link href="/(auth)/sign-in">
            <Text style={styles.footerLink}>Sign in</Text>
          </Link>
        </View>
      </ScrollView>

      <LegalDocSheet doc={legalDoc} visible={legalDoc != null} onClose={() => setLegalDoc(null)} />
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
    },
    scroll: {
      flexGrow: 1,
      justifyContent: "center",
      paddingHorizontal: 24,
      paddingVertical: 40,
    },
    brandBlock: {
      alignItems: "center",
      marginBottom: 28,
    },
    brand: {
      fontSize: 26,
      fontWeight: "700",
      color: color.brand,
    },
    subtitle: {
      fontSize: 14,
      color: color.textSub,
      marginTop: 6,
      textAlign: "center",
    },
    divider: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginVertical: 20,
    },
    dividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: color.border,
    },
    dividerText: {
      fontSize: 12,
      color: color.textMuted,
    },
    form: {
      gap: 12,
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
    consentRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 10,
      marginTop: 4,
    },
    checkbox: {
      width: 20,
      height: 20,
      borderRadius: 5,
      borderWidth: 1.5,
      borderColor: color.borderStrong,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 1,
    },
    checkboxChecked: {
      backgroundColor: color.brand,
      borderColor: color.brand,
    },
    checkboxMark: {
      color: color.textOnBrand,
      fontSize: 13,
      fontWeight: "700",
    },
    consentText: {
      flex: 1,
      fontSize: 13,
      lineHeight: 19,
      color: color.textSub,
    },
    consentLink: {
      color: color.brand,
      fontWeight: "600",
    },
    button: {
      backgroundColor: color.brand,
      borderRadius: 10,
      paddingVertical: 14,
      alignItems: "center",
      marginTop: 4,
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
    footer: {
      flexDirection: "row",
      justifyContent: "center",
      marginTop: 24,
    },
    footerText: {
      fontSize: 14,
      color: color.textSub,
    },
    footerLink: {
      fontSize: 14,
      fontWeight: "700",
      color: color.brand,
    },
  });
}
