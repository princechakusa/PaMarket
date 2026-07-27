import { useState, type ReactNode } from "react";
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
import { Link, Redirect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { useAuth } from "../../lib/auth";
import { supabase } from "../../lib/supabase";
import { signInWithOAuthProvider } from "../../lib/oauth";
import { checkAuthLock, recordAuthFailure, recordAuthSuccess } from "../../lib/auth-lockout";
import { BrandSymbol, BrandWordmark } from "../../components/BrandLogo";
import { PasswordField } from "../../components/PasswordField";
import { GlassBackButton } from "../../components/ui";
import { font, radius, shadow, space, type ColorPalette } from "../../lib/theme";
import { useThemedStyles } from "../../lib/theme-provider";

function GoogleIcon({ size = 22 }: { size?: number }) {
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

function AppleIcon({ size = 23, fill = "#FFFFFF" }: { size?: number; fill?: string }) {
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
      <View style={styles.socialIcon}>{isLoading ? <ActivityIndicator color={dark ? "#FFFFFF" : tones.brand} /> : icon}</View>
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

  if (!sessionLoading && session) {
    return <Redirect href="/(tabs)" />;
  }

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

  async function handleOAuth(provider: "google" | "apple") {
    setError(null);
    if (provider === "google") setIsGoogleLoading(true);
    else setIsAppleLoading(true);
    try {
      await signInWithOAuthProvider(provider);
    } catch (e) {
      setError(e instanceof Error ? e.message : `${provider === "google" ? "Google" : "Apple"} sign-in failed`);
    } finally {
      if (provider === "google") setIsGoogleLoading(false);
      else setIsAppleLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={[styles.hero, { paddingTop: insets.top + space.md }]}>
          <View style={styles.heroOrbLarge} />
          <View style={styles.heroOrbSmall} />
          <GlassBackButton onPress={handleBack} tone="light" style={styles.backButton} />

          <View style={styles.heroBrandRow}>
            <View style={styles.logoShell}>
              <BrandSymbol size={62} />
            </View>
            <BrandWordmark size={34} onBrand />
          </View>
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>Sign in to buy, sell, hire and chat across Zimbabwe.</Text>
        </View>

        <View style={[styles.card, shadow.lg]}>
          <Text style={styles.eyebrow}>FAST SIGN IN</Text>
          <View style={styles.socialStack}>
            <SocialButton
              label="Continue with Apple"
              icon={<AppleIcon />}
              onPress={() => handleOAuth("apple")}
              isLoading={isAppleLoading}
              dark
            />
            <SocialButton
              label="Continue with Google"
              icon={<GoogleIcon />}
              onPress={() => handleOAuth("google")}
              isLoading={isGoogleLoading}
            />
          </View>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or continue with email</Text>
            <View style={styles.dividerLine} />
          </View>

          <View style={styles.form}>
            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>Email</Text>
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
            </View>
            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>Password</Text>
              <PasswordField value={password} onChangeText={setPassword} placeholder="Password" inputStyle={styles.passwordInput} />
            </View>

            <Pressable onPress={() => router.push("/(auth)/forgot-password")} style={styles.forgotLink}>
              <Text style={styles.forgotText}>Forgot?</Text>
            </Pressable>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Pressable style={[styles.button, isSubmitting && styles.disabled]} onPress={handleSignIn} disabled={isSubmitting}>
              {isSubmitting ? <ActivityIndicator color={tones.textOnBrand} /> : <Text style={styles.buttonText}>Sign In</Text>}
            </Pressable>
          </View>

          <View style={styles.trustRow}>
            <TrustPill label="Secure login" />
            <TrustPill label="Private chats" />
            <TrustPill label="No listing fees" />
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Don&apos;t have an account? </Text>
            <Link href="/(auth)/sign-up">
              <Text style={styles.footerLink}>Create one</Text>
            </Link>
          </View>
        </View>

        <View style={[styles.bottomBand, { paddingBottom: Math.max(insets.bottom, space.lg) }]}>
          <Text style={styles.bottomTitle}>PaMarket Zimbabwe</Text>
          <Text style={styles.bottomSubtitle}>Buy • Sell • Jobs • Property • Vehicles</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function TrustPill({ label }: { label: string }) {
  const styles = useThemedStyles(buildStyles);
  return (
    <View style={styles.trustPill}>
      <View style={styles.trustDot} />
      <Text style={styles.trustText}>{label}</Text>
    </View>
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
      backgroundColor: color.bg,
    },
    scroll: {
      flexGrow: 1,
      backgroundColor: color.bg,
    },
    hero: {
      minHeight: 360,
      paddingHorizontal: space.xl,
      backgroundColor: color.brand,
      overflow: "hidden",
    },
    heroOrbLarge: {
      position: "absolute",
      right: -74,
      top: -92,
      width: 290,
      height: 290,
      borderRadius: 145,
      backgroundColor: "rgba(255,255,255,0.12)",
    },
    heroOrbSmall: {
      position: "absolute",
      right: 62,
      bottom: -96,
      width: 330,
      height: 330,
      borderRadius: 165,
      backgroundColor: "rgba(255,255,255,0.08)",
    },
    backButton: {
      marginTop: space.xs,
      marginBottom: space.lg,
    },
    heroBrandRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: space.md,
      marginTop: space.xs,
    },
    logoShell: {
      width: 70,
      height: 70,
      borderRadius: 24,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: color.surface,
      ...shadow.md,
    },
    title: {
      ...font.h1,
      color: color.textOnBrand,
      marginTop: space.md,
      fontSize: 35,
      letterSpacing: -1,
    },
    subtitle: {
      ...font.bodyStrong,
      color: "rgba(255,255,255,0.82)",
      marginTop: space.sm,
      maxWidth: 330,
      lineHeight: 23,
    },
    card: {
      marginHorizontal: space.lg,
      marginTop: -62,
      borderRadius: 34,
      backgroundColor: color.surface,
      paddingHorizontal: space.lg,
      paddingTop: space.xl,
      paddingBottom: space.xl,
    },
    eyebrow: {
      ...font.micro,
      color: color.textMuted,
      letterSpacing: 2.4,
      marginBottom: space.lg,
    },
    socialStack: {
      gap: space.sm,
    },
    socialButton: {
      minHeight: 62,
      borderRadius: 22,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: space.lg,
      borderWidth: 1.5,
      position: "relative",
    },
    socialButtonDark: {
      backgroundColor: "#020C0A",
      borderColor: "#020C0A",
    },
    socialButtonLight: {
      backgroundColor: color.surface,
      borderColor: color.border,
    },
    socialIcon: {
      position: "absolute",
      left: space.xl,
      width: 28,
      height: 28,
      alignItems: "center",
      justifyContent: "center",
    },
    socialText: {
      ...font.bodyStrong,
      fontSize: 16,
    },
    socialTextDark: {
      color: "#FFFFFF",
    },
    socialTextLight: {
      color: color.text,
    },
    divider: {
      flexDirection: "row",
      alignItems: "center",
      gap: space.sm,
      marginVertical: space.xl,
    },
    dividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: color.border,
    },
    dividerText: {
      ...font.caption,
      color: color.textMuted,
    },
    form: {
      gap: space.md,
    },
    fieldBlock: {
      gap: space.xs,
    },
    fieldLabel: {
      ...font.micro,
      color: color.textMuted,
      letterSpacing: 1.4,
    },
    input: {
      minHeight: 60,
      borderWidth: 1.5,
      borderColor: color.border,
      borderRadius: 20,
      paddingHorizontal: space.lg,
      fontSize: 16,
      fontWeight: "700",
      color: color.text,
      backgroundColor: color.surface,
    },
    passwordInput: {
      minHeight: 60,
      borderWidth: 1.5,
      borderColor: color.border,
      borderRadius: 20,
      paddingHorizontal: space.lg,
      paddingVertical: 0,
      paddingRight: 72,
      fontSize: 16,
      fontWeight: "700",
      color: color.text,
      backgroundColor: color.surface,
    },
    forgotLink: {
      alignSelf: "flex-end",
      marginTop: -2,
    },
    forgotText: {
      ...font.bodyStrong,
      color: color.brand,
    },
    button: {
      minHeight: 64,
      backgroundColor: color.brand,
      borderRadius: 22,
      alignItems: "center",
      justifyContent: "center",
      marginTop: space.sm,
    },
    disabled: {
      opacity: 0.6,
    },
    buttonText: {
      ...font.bodyStrong,
      color: color.textOnBrand,
      fontSize: 18,
    },
    error: {
      ...font.caption,
      color: color.danger,
    },
    trustRow: {
      flexDirection: "row",
      justifyContent: "center",
      gap: space.sm,
      flexWrap: "wrap",
      marginTop: space.xl,
    },
    trustPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: space.xs,
      borderRadius: radius.pill,
      backgroundColor: color.surfaceAlt,
      paddingHorizontal: space.md,
      paddingVertical: space.sm,
    },
    trustDot: {
      width: 9,
      height: 9,
      borderRadius: 4.5,
      backgroundColor: color.gold,
    },
    trustText: {
      ...font.caption,
      color: color.brand,
      fontWeight: "900",
    },
    footer: {
      flexDirection: "row",
      justifyContent: "center",
      marginTop: space.xl,
      flexWrap: "wrap",
    },
    footerText: {
      ...font.bodyStrong,
      color: color.textSub,
    },
    footerLink: {
      ...font.bodyStrong,
      color: color.brand,
      fontWeight: "900",
    },
    bottomBand: {
      marginTop: space.xl,
      paddingTop: space.xl,
      paddingHorizontal: space.lg,
      alignItems: "center",
      backgroundColor: color.brand,
    },
    bottomTitle: {
      ...font.bodyStrong,
      color: color.textOnBrand,
      fontSize: 17,
    },
    bottomSubtitle: {
      ...font.caption,
      color: "rgba(255,255,255,0.75)",
      marginTop: space.xs,
      fontWeight: "800",
    },
  });
}
