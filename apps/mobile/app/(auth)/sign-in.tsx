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
import { Link, Redirect, router } from "expo-router";
import { useAuth } from "../../lib/auth";
import { supabase } from "../../lib/supabase";
import { signInWithOAuthProvider } from "../../lib/oauth";
import { checkAuthLock, recordAuthFailure, recordAuthSuccess } from "../../lib/auth-lockout";
import { GoogleButton } from "../../components/GoogleButton";
import { PasswordField } from "../../components/PasswordField";

export default function SignInScreen() {
  const { session, isLoading: sessionLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!sessionLoading && session) {
    return <Redirect href="/(tabs)" />;
  }

  async function handleSignIn() {
    if (!email || !password) {
      setError("Enter your email and password.");
      return;
    }
    const lock = await checkAuthLock();
    if (lock.locked) {
      setError(`Too many attempts. Try again in ${lock.secondsLeft}s`);
      return;
    }
    setError(null);
    setIsSubmitting(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setIsSubmitting(false);
    if (signInError) {
      const lockout = await recordAuthFailure();
      if (lockout) {
        setError(
          `Too many failed attempts. Locked for ${
            lockout.secondsLeft < 90 ? `${lockout.secondsLeft} seconds` : `${Math.round(lockout.secondsLeft / 60)} minutes`
          }.`
        );
      } else {
        setError(signInError.message);
      }
      return;
    }
    await recordAuthSuccess();
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
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.brandBlock}>
          <Text style={styles.brand}>PaMarket</Text>
          <Text style={styles.subtitle}>Sign in to continue buying and selling</Text>
        </View>

        <GoogleButton onPress={handleGoogle} isLoading={isGoogleLoading} label="Continue with Google" />

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or continue with email</Text>
          <View style={styles.dividerLine} />
        </View>

        <View style={styles.form}>
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
          <PasswordField value={password} onChangeText={setPassword} placeholder="Password" />

          <Pressable onPress={() => router.push("/(auth)/forgot-password")} style={styles.forgotLink}>
            <Text style={styles.forgotText}>Forgot?</Text>
          </Pressable>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            style={[styles.button, isSubmitting && styles.buttonDisabled]}
            onPress={handleSignIn}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.buttonText}>Sign In</Text>
            )}
          </Pressable>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Don&apos;t have an account? </Text>
          <Link href="/(auth)/sign-up">
            <Text style={styles.footerLink}>Create one</Text>
          </Link>
        </View>
      </ScrollView>
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
    marginBottom: 32,
  },
  brand: {
    fontSize: 32,
    fontWeight: "700",
    color: "#1A3A8F",
  },
  subtitle: {
    fontSize: 15,
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
  forgotLink: {
    alignSelf: "flex-end",
  },
  forgotText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1A3A8F",
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
    marginTop: 28,
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
