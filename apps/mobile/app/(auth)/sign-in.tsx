import { useEffect, useState, type ReactNode } from "react";
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
import { Link, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { useAuth } from "../../lib/auth";
import { supabase } from "../../lib/supabase";
import { signInWithApple, signInWithOAuthProvider } from "../../lib/oauth";
import { checkAuthLock, recordAuthFailure, recordAuthSuccess } from "../../lib/auth-lockout";
import { BrandSymbol, BrandWordmark } from "../../components/BrandLogo";
import { PasswordField } from "../../components/PasswordField";
import { GlassBackButton } from "../../components/ui";
import { font, space, type ColorPalette } from "../../lib/theme";
import { useThemedStyles } from "../../lib/theme-provider";

function GoogleIcon({ size = 17 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z"
      />
      <Path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.6 15.9 18.9 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4c-7.4 0-13.8 4.2-17.7 10.7z"
      />
      <Path
        fill="#4CAF50"
        d="M24 44c5.5 0 10.4-1.9 14.3-5.1l-6.6-5.6c-2 1.4-4.6 2.2-7.7 2.2-5.2 0-9.6-3.3-11.3-7.9l-6.6 5.1C9.9 39.7 16.4 44 24 44z"
      />
      <Path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.3-4.1 5.7l6.6 5.6C41.4 36.4 44 30.9 44 24c0-1.3-.1-2.7-.4-3.5z"
      />
    </Svg>
  );
}

function AppleIcon({ size = 16, fill = "#FFFFFF" }: { size?: number; fill?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 384 512">
      <Path
        fill={fill}
        d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.6-2.8-74.5 20.7-88.5 20.7-14.8 0-48.8-19.7-75.6-19.2-39 .6-75 22.7-95.1 57.6-40.6 70.5-10.4 174.9 29.2 232.1 19.4 28 42.4 59.5 72.7 58.4 29.2-1.2 40.2-18.9 75.5-18.9 35.1 0 45.3 18.9 76.2 18.3 31.5-.6 51.4-28.6 70.6-56.8 22.3-32.5 31.5-64.1 32-65.7-.7-.3-61.7-23.7-62.3-97.1zM260.6 101.9C276.7 82.4 287.6 55.3 284.6 28c-23.3.9-51.5 15.5-68.2 35-15 17.3-28.1 45.1-24.6 71.6 26 .2 52.6-13.2 68.8-32.7z"
      />
    </Svg>
  );
}

function SocialButton({
  label,
  icon,
  onPress,
  isLoading,
  dark = false,
}: {
  label: string;
  icon: ReactNode;
  onPress: () => void;
  isLoading?: boolean;
  dark?: boolean;
}) {
  const styles = useThemedStyles(buildStyles);
  const tones = useThemedStyles(buildTones);

  return (
    <Pressable
      style={[styles.socialButton, dark ? styles.socialButtonDark : styles.socialButtonLight, isLoading && styles.disabled]}
      onPress={onPress}
      disabled={isLoading}
    >
      {isLoading ? <ActivityIndicator color={dark ? "#FFFFFF" : tones.brand} /> : icon}
      <Text style={[styles.socialText, dark ? styles.socialTextDark : styles.socialTextLight]}>{label}</Text>
    </Pressable>
  );
}

export default function SignInScreen() {
  const styles = useThemedStyles(buildStyles);
  const tones = useThemedStyles(buildTones);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session, isLoading: sessionLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isAppleLoading, setIsAppleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  function handleBack() {
    router.replace("/(tabs)");
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
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <GlassBackButton onPress={handleBack} tone="dark" style={[styles.backButton, { marginTop: insets.top + space.sm }]} />

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
        <Text style={styles.title}>Welcome Back</Text>

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

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.dividerLine} />
          </View>

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
        </View>
      </ScrollView>
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
