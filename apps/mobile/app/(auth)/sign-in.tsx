import { useEffect, useState } from "react";
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
import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../lib/auth";
import { supabase } from "../../lib/supabase";
import { signInWithApple, signInWithOAuthProvider } from "../../lib/oauth";
import { checkAuthLock, recordAuthFailure, recordAuthSuccess } from "../../lib/auth-lockout";
import { BrandSymbol, BrandWordmark } from "../../components/BrandLogo";
import { PasswordField } from "../../components/PasswordField";
import { GlassBackButton } from "../../components/ui";
import { AppleIcon, GoogleIcon, SocialButton, SocialDivider } from "../../components/SocialAuthButtons";
import { LegalDocSheet } from "../../components/LegalDocSheet";
import { TERMS, PRIVACY, type LegalDoc } from "../../lib/legal";
import { font, space, type ColorPalette } from "../../lib/theme";
import { useThemedStyles } from "../../lib/theme-provider";
import { useKeyboardAvoidingReset } from "../../lib/useKeyboardAvoidingReset";

export default function SignInScreen() {
  const kavResetKey = useKeyboardAvoidingReset();
  const styles = useThemedStyles(buildStyles);
  const tones = useThemedStyles(buildTones);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { message } = useLocalSearchParams<{ message?: string }>();
  const { session, isLoading: sessionLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isAppleLoading, setIsAppleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [legalDoc, setLegalDoc] = useState<LegalDoc | null>(null);

  // Returns to whatever screen the user was on before being gated to sign
  // in (e.g. "Create a Shop" while signed out) instead of always dumping
  // them at Home — previously every gated action landed on Home after
  // signing in, requiring a second tap to actually continue what they were
  // doing. router.back() only has somewhere to go back to when sign-in was
  // pushed on top of another screen; a direct/deep-linked visit falls back
  // to Home since there's no prior screen in this stack.
  useEffect(() => {
    if (!sessionLoading && session) {
      if (router.canGoBack()) router.back();
      else router.replace("/(tabs)");
    }
  }, [sessionLoading, session]);

  if (!sessionLoading && session) {
    return null;
  }

  // A hard replace() unmounts this screen and mounts a brand-new Home tab
  // from scratch (its own render/data cycle), instead of smoothly revealing
  // whatever screen was already sitting underneath — that mismatch is what
  // reads as a flicker. back() pops to reveal it directly; replace() is
  // only the right call when there's truly nothing to go back to (sign-in
  // opened via a deep link, with no prior screen in this stack).
  function handleBack() {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)");
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

  async function handleGoogleSignIn() {
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

  async function handleAppleSignIn() {
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
    <KeyboardAvoidingView key={kavResetKey} style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <GlassBackButton onPress={handleBack} tone="dark" style={[styles.backButton, { marginTop: insets.top + space.sm }]} flat />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: Math.max(insets.bottom, space.lg) + space.xl }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.logoShell}>
          <BrandSymbol size={32} monochrome />
        </View>
        <View style={styles.wordmarkRow}>
          <BrandWordmark size={17} />
        </View>
        <Text style={styles.title}>{message || "Welcome Back"}</Text>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Email address"
            placeholderTextColor={tones.textMuted}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <PasswordField value={password} onChangeText={setPassword} placeholder="Password" inputStyle={styles.passwordInput} />

          <Pressable onPress={() => router.push("/(auth)/forgot-password")} style={styles.forgotLink}>
            <Text style={styles.forgotText}>Forgot password?</Text>
          </Pressable>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable style={[styles.button, isSubmitting && styles.disabled]} onPress={handleSignIn} disabled={isSubmitting}>
            {isSubmitting ? <ActivityIndicator color={tones.textOnBrand} /> : <Text style={styles.buttonText}>Sign In</Text>}
          </Pressable>

          <SocialDivider />

          <View style={styles.socialStack}>
            {Platform.OS === "ios" ? (
              <SocialButton
                label="Continue with Apple"
                icon={<AppleIcon />}
                onPress={handleAppleSignIn}
                isLoading={isAppleLoading}
                dark
              />
            ) : null}
            <SocialButton
              label="Continue with Google"
              icon={<GoogleIcon />}
              onPress={handleGoogleSignIn}
              isLoading={isGoogleLoading}
            />
          </View>

          {/* Google/Apple sign-in silently creates a new account for a
              first-time user — unlike the email/password Sign Up screen,
              there's no separate consent step to gate on, so this notice is
              the only place a new-via-OAuth user sees Terms/Privacy before
              their account exists. */}
          <Text style={styles.consentText}>
            By continuing, you agree to our{" "}
            <Text style={styles.consentLink} onPress={() => setLegalDoc(TERMS)}>
              Terms &amp; Conditions
            </Text>{" "}
            and{" "}
            <Text style={styles.consentLink} onPress={() => setLegalDoc(PRIVACY)}>
              Privacy Policy
            </Text>
            .
          </Text>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Don&apos;t have an account? </Text>
            <Link href="/(auth)/sign-up">
              <Text style={styles.footerLink}>Sign Up</Text>
            </Link>
          </View>
        </View>
      </ScrollView>

      <LegalDocSheet doc={legalDoc} visible={legalDoc != null} onClose={() => setLegalDoc(null)} />
    </KeyboardAvoidingView>
  );
}

function buildTones(color: ColorPalette) {
  return {
    brand: color.brand,
    textOnBrand: color.textOnBrand,
    textMuted: color.textMuted,
  };
}

function buildStyles(color: ColorPalette) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: color.surface,
    },
    backButton: {
      marginLeft: space.lg,
      marginBottom: 0,
    },
    scroll: {
      paddingHorizontal: space.xl,
      paddingTop: space.xl,
      alignItems: "center",
    },
    logoShell: {
      width: 60,
      height: 60,
      borderRadius: 16,
      backgroundColor: color.brand,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: space.sm,
    },
    wordmarkRow: {
      marginBottom: space.xl,
    },
    title: {
      ...font.h2,
      color: color.text,
      marginBottom: space.xl,
    },
    form: {
      width: "100%",
    },
    input: {
      width: "100%",
      minHeight: 50,
      borderWidth: 1.5,
      borderColor: color.border,
      borderRadius: 10,
      paddingHorizontal: space.md,
      fontSize: 14,
      color: color.text,
      backgroundColor: color.surface,
      marginBottom: space.md,
    },
    passwordInput: {
      minHeight: 50,
      borderWidth: 1.5,
      borderColor: color.border,
      borderRadius: 10,
      paddingHorizontal: space.md,
      paddingVertical: 0,
      paddingRight: 60,
      fontSize: 14,
      color: color.text,
      backgroundColor: color.surface,
    },
    forgotLink: {
      alignSelf: "flex-end",
      marginTop: space.sm,
      marginBottom: space.md,
    },
    forgotText: {
      ...font.caption,
      fontWeight: "700",
      color: color.brand,
    },
    error: {
      ...font.caption,
      color: color.danger,
      marginBottom: space.sm,
    },
    button: {
      width: "100%",
      minHeight: 52,
      backgroundColor: color.brand,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: space.lg,
    },
    disabled: {
      opacity: 0.6,
    },
    buttonText: {
      ...font.bodyStrong,
      color: color.textOnBrand,
      fontSize: 15,
    },
    divider: {
      flexDirection: "row",
      alignItems: "center",
      gap: space.sm,
      marginBottom: space.lg,
    },
    dividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: color.border,
    },
    dividerText: {
      ...font.caption,
      fontWeight: "700",
      color: color.textMuted,
    },
    socialStack: {
      gap: space.sm,
      marginBottom: space.lg,
    },
    consentText: {
      fontSize: 12.5,
      lineHeight: 18,
      color: color.textMuted,
      textAlign: "center",
      marginBottom: space.lg,
    },
    consentLink: {
      color: color.brand,
      fontWeight: "600",
    },
    socialButton: {
      minHeight: 48,
      borderRadius: 10,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: space.sm,
      paddingHorizontal: space.lg,
      borderWidth: 1.5,
    },
    socialButtonDark: {
      backgroundColor: "#111827",
      borderColor: "#111827",
    },
    socialButtonLight: {
      backgroundColor: color.surface,
      borderColor: color.border,
    },
    socialText: {
      ...font.caption,
      fontWeight: "700",
      fontSize: 13.5,
    },
    socialTextDark: {
      color: "#FFFFFF",
    },
    socialTextLight: {
      color: color.text,
    },
    footer: {
      flexDirection: "row",
      justifyContent: "center",
      flexWrap: "wrap",
    },
    footerText: {
      ...font.caption,
      color: color.textSub,
    },
    footerLink: {
      ...font.caption,
      color: color.brand,
      fontWeight: "900",
    },
  });
}
