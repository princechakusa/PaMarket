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
import { logClientError } from "../../lib/error-log";
import { BrandWordmark } from "../../components/BrandLogo";
import { PasswordField } from "../../components/PasswordField";
import { GlassBackButton, MailIcon, LockIcon } from "../../components/ui";
import { AppleIcon, GoogleIcon, SocialButton, SocialDivider } from "../../components/SocialAuthButtons";
import { LegalDocSheet } from "../../components/LegalDocSheet";
import { TERMS, PRIVACY, type LegalDoc } from "../../lib/legal";
import { useLegalDocUpgrade } from "../../lib/content";
import { font, radius, shadow, space, type ColorPalette } from "../../lib/theme";
import { useThemedStyles } from "../../lib/theme-provider";
import { useKeyboardAvoidingReset } from "../../lib/useKeyboardAvoidingReset";

export default function SignInScreen() {
  const kavResetKey = useKeyboardAvoidingReset();
  const styles = useThemedStyles(buildStyles);
  const tones = useThemedStyles(buildTones);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { message, redirectHome } = useLocalSearchParams<{ message?: string; redirectHome?: string }>();
  const { session, isLoading: sessionLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isAppleLoading, setIsAppleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [legalDoc, setLegalDoc] = useState<LegalDoc | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  // Stage 2: silently upgraded to the published content_pages wording in
  // the background — falls back to the bundled TERMS/PRIVACY on any
  // failure, and never blocks or delays sign-in.
  const termsDoc = useLegalDocUpgrade("terms", TERMS);
  const privacyDoc = useLegalDocUpgrade("privacy", PRIVACY);

  // Returns to whatever screen the user was on before being gated to sign
  // in (e.g. "Create a Shop" while signed out) instead of always dumping
  // them at Home — previously every gated action landed on Home after
  // signing in, requiring a second tap to actually continue what they were
  // doing. router.back() only has somewhere to go back to when sign-in was
  // pushed on top of another screen; a direct/deep-linked visit falls back
  // to Home since there's no prior screen in this stack.
  //
  // Exception: the guest Account tab pushes sign-in from its own inline
  // "Sign In / Sign Up" prompt, so back() just pops right back to that same
  // guest prompt — reading as "login always dumps me on Account" even
  // though it's technically returning to where sign-in was opened from.
  // Those callers pass redirectHome to explicitly ask for Home instead.
  useEffect(() => {
    if (sessionLoading || !session) return;
    if (redirectHome) router.replace("/(tabs)");
    else if (router.canGoBack()) router.back();
    else router.replace("/(tabs)");

    // Guaranteed escape hatch. This screen renders no form once a session
    // exists (see below), so if the navigation above doesn't take effect —
    // which can happen when the auth state changes mid-transition, e.g.
    // returning from the Google account picker — the user is left on a
    // blank screen with no way out but force-quitting the app. That was a
    // real, reported bug on Android. A hard replace() shortly after always
    // gets them to Home; it's a no-op if the navigation above already
    // moved us off this screen and unmounted it.
    const escapeHatch = setTimeout(() => router.replace("/(tabs)"), 700);
    return () => clearTimeout(escapeHatch);
  }, [sessionLoading, session, redirectHome]);

  // Signed in — the form is gone, but never render nothing: an empty render
  // is an all-white screen, which is exactly what the blank-screen-after-
  // sign-in bug looked like. A themed spinner makes the hand-off visible
  // and, if navigation is briefly delayed, looks intentional.
  if (!sessionLoading && session) {
    return (
      <View style={styles.redirecting}>
        <ActivityIndicator color={tones.brand} />
      </View>
    );
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
        // Never logs the email/password themselves — only Supabase's own
        // error object/message (e.g. "Invalid login credentials").
        logClientError({ error: signInError, screen: "(auth)/sign-in", component: "password", severity: "warning" });
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
      logClientError({ error: e, screen: "(auth)/sign-in", component: "google-oauth" });
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
      logClientError({ error: e, screen: "(auth)/sign-in", component: "apple-oauth" });
    } finally {
      setIsAppleLoading(false);
    }
  }

  const showBanner = !!message && !bannerDismissed;

  return (
    <KeyboardAvoidingView key={kavResetKey} style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + space.sm }]}>
        <GlassBackButton onPress={handleBack} tone="dark" flat />
        <Text style={styles.headerTitle}>Sign In</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: Math.max(insets.bottom, space.lg) + space.xl }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.brandBlock}>
          <BrandWordmark size={26} />
          <View style={styles.tagline}>
            <Text style={styles.taglineText}>Zimbabwe&apos;s Marketplace</Text>
            <Text style={styles.taglineFlag}> 🇿🇼</Text>
          </View>
        </View>

        {showBanner ? (
          <View style={styles.banner}>
            <Text style={styles.bannerText}>{message}</Text>
            <Pressable onPress={() => setBannerDismissed(true)} hitSlop={8}>
              <Text style={styles.bannerDismiss}>✕</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.titleBlock}>
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>Sign in to buy, sell, and manage your account</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.fieldLabel}>Email Address</Text>
          <View style={styles.inputRow}>
            <View style={styles.leadingIcon}>
              <MailIcon c={tones.textMuted} size={18} />
            </View>
            <TextInput
              style={styles.input}
              placeholder="e.g. tanaka@gmail.com"
              placeholderTextColor={tones.textMuted}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
          </View>

          <View style={styles.passwordLabelRow}>
            <Text style={styles.fieldLabel}>Password</Text>
            <Pressable onPress={() => router.push("/(auth)/forgot-password")}>
              <Text style={styles.forgotText}>Forgot password?</Text>
            </Pressable>
          </View>
          <PasswordField
            value={password}
            onChangeText={setPassword}
            placeholder="Enter your password"
            icon={<LockIcon c={tones.textMuted} size={18} />}
            inputStyle={styles.passwordInput}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable style={[styles.button, isSubmitting && styles.disabled]} onPress={handleSignIn} disabled={isSubmitting}>
            {isSubmitting ? (
              <ActivityIndicator color={tones.textOnBrand} />
            ) : (
              <Text style={styles.buttonText}>Sign In  →</Text>
            )}
          </Pressable>

          <SocialDivider label="or continue with" />

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

          <View style={styles.footer}>
            <Text style={styles.footerText}>Don&apos;t have an account? </Text>
            <Link href="/(auth)/sign-up">
              <Text style={styles.footerLink}>Sign Up</Text>
            </Link>
          </View>

          {/* Google/Apple sign-in silently creates a new account for a
              first-time user — unlike the email/password Sign Up screen,
              there's no separate consent step to gate on, so this notice is
              the only place a new-via-OAuth user sees Terms/Privacy before
              their account exists. */}
          <Text style={styles.consentText}>
            By continuing, you agree to our{" "}
            <Text style={styles.consentLink} onPress={() => setLegalDoc(termsDoc)}>
              Terms of Service
            </Text>{" "}
            and{" "}
            <Text style={styles.consentLink} onPress={() => setLegalDoc(privacyDoc)}>
              Privacy Policy
            </Text>
            .
          </Text>
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
    redirecting: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: color.surface,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: space.lg,
      paddingBottom: space.sm,
    },
    headerTitle: {
      flex: 1,
      textAlign: "center",
      ...font.h3,
      color: color.text,
      marginRight: 44,
    },
    headerSpacer: {
      width: 0,
    },
    scroll: {
      paddingHorizontal: space.xl,
      paddingTop: space.md,
    },
    brandBlock: {
      alignItems: "center",
      marginBottom: space.lg,
    },
    tagline: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: space.xxs,
    },
    taglineText: {
      ...font.caption,
      color: color.textMuted,
    },
    taglineFlag: {
      fontSize: 12,
    },
    banner: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: color.goldTint,
      borderRadius: radius.lg,
      paddingVertical: space.sm,
      paddingHorizontal: space.md,
      marginBottom: space.lg,
    },
    bannerText: {
      ...font.sub,
      color: color.goldDark,
      flex: 1,
      marginRight: space.sm,
    },
    bannerDismiss: {
      ...font.caption,
      color: color.goldDark,
    },
    titleBlock: {
      marginBottom: space.xl,
    },
    title: {
      ...font.h2,
      color: color.text,
    },
    subtitle: {
      ...font.body,
      color: color.textSub,
      marginTop: space.xxs,
    },
    form: {
      width: "100%",
    },
    fieldLabel: {
      ...font.caption,
      color: color.text,
      fontWeight: "700",
      marginBottom: space.xs,
    },
    passwordLabelRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: space.md,
      marginBottom: space.xs,
    },
    forgotText: {
      ...font.caption,
      fontWeight: "700",
      color: color.brand,
    },
    inputRow: {
      position: "relative",
      justifyContent: "center",
    },
    leadingIcon: {
      position: "absolute",
      left: space.md,
      zIndex: 1,
    },
    input: {
      width: "100%",
      minHeight: 50,
      borderRadius: radius.lg,
      paddingHorizontal: space.md,
      paddingLeft: 44,
      fontSize: 15,
      color: color.text,
      backgroundColor: color.surfaceAlt,
      ...shadow.sm,
    },
    passwordInput: {
      minHeight: 50,
      borderRadius: radius.lg,
      paddingHorizontal: space.md,
      paddingVertical: 0,
      paddingRight: 60,
      fontSize: 15,
      color: color.text,
      backgroundColor: color.surfaceAlt,
      borderWidth: 0,
      ...shadow.sm,
    },
    error: {
      ...font.caption,
      color: color.danger,
      marginTop: space.sm,
    },
    button: {
      width: "100%",
      minHeight: 52,
      backgroundColor: color.brand,
      borderRadius: radius.pill,
      alignItems: "center",
      justifyContent: "center",
      marginTop: space.lg,
      marginBottom: space.lg,
      ...shadow.sm,
    },
    disabled: {
      opacity: 0.6,
    },
    buttonText: {
      ...font.bodyStrong,
      color: color.textOnBrand,
      fontSize: 15,
    },
    socialStack: {
      gap: space.sm,
      marginBottom: space.lg,
    },
    footer: {
      flexDirection: "row",
      justifyContent: "center",
      flexWrap: "wrap",
      marginBottom: space.lg,
    },
    footerText: {
      ...font.body,
      color: color.textSub,
    },
    footerLink: {
      ...font.body,
      color: color.brand,
      fontWeight: "900",
    },
    consentText: {
      fontSize: 12,
      lineHeight: 17,
      color: color.textMuted,
      textAlign: "center",
    },
    consentLink: {
      color: color.brand,
      fontWeight: "600",
    },
  });
}
