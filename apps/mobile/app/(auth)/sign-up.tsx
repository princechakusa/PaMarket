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
import { signInWithOAuthProvider } from "../../lib/oauth";
import { GoogleButton } from "../../components/GoogleButton";
import { PasswordField } from "../../components/PasswordField";
import { LegalDocSheet } from "../../components/LegalDocSheet";
import { TERMS, PRIVACY, type LegalDoc } from "../../lib/legal";
import { isValidEmail, isValidPhone, isStrongEnoughPassword } from "../../lib/validation";

export default function SignUpScreen() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [consent, setConsent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
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

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.brandBlock}>
          <Text style={styles.brand}>Create account</Text>
          <Text style={styles.subtitle}>Join Zimbabwe&apos;s largest marketplace</Text>
        </View>

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
            placeholderTextColor="#8A93A6"
            autoComplete="name"
            value={fullName}
            onChangeText={setFullName}
          />
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#8A93A6"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <TextInput
            style={styles.input}
            placeholder="Phone (optional)"
            placeholderTextColor="#8A93A6"
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
              <ActivityIndicator color="#ffffff" />
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
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
    color: "#1A3A8F",
  },
  subtitle: {
    fontSize: 14,
    color: "#5A6478",
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
    backgroundColor: "#E4E7EF",
  },
  dividerText: {
    fontSize: 12,
    color: "#8A93A6",
  },
  form: {
    gap: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: "#D8DCE5",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: "#111827",
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
    borderColor: "#D8DCE5",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  checkboxChecked: {
    backgroundColor: "#1A3A8F",
    borderColor: "#1A3A8F",
  },
  checkboxMark: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },
  consentText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    color: "#3A4258",
  },
  consentLink: {
    color: "#1A3A8F",
    fontWeight: "600",
  },
  button: {
    backgroundColor: "#1A3A8F",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 4,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
  error: {
    color: "#C0392B",
    fontSize: 14,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 24,
  },
  footerText: {
    fontSize: 14,
    color: "#5A6478",
  },
  footerLink: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1A3A8F",
  },
});
