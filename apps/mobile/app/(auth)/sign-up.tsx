import { useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyboardAvoidingView } from "../../lib/keyboard";
import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "../../lib/supabase";
import { signInWithApple, signInWithOAuthProvider } from "../../lib/oauth";
import { BrandWordmark } from "../../components/BrandLogo";
import { ZimbabweFlag } from "../../components/ZimbabweFlag";
import { PasswordField } from "../../components/PasswordField";
import { GlassBackButton, MailIcon, LockIcon, PersonIcon, CallIcon } from "../../components/ui";
import { AppleIcon, GoogleIcon, SocialButton, SocialDivider } from "../../components/SocialAuthButtons";
import { LegalDocSheet } from "../../components/LegalDocSheet";
import { TERMS, PRIVACY, type LegalDoc } from "../../lib/legal";
import { useLegalDocUpgrade } from "../../lib/content";
import { isValidEmail, isStrongEnoughPassword } from "../../lib/validation";
import { normalizeZwPhone } from "../../lib/phone";
import { friendlyError } from "../../lib/safety";
import { getAppSettings, useAppSettings } from "../../lib/app-settings";
import { useT } from "../../lib/i18n";

// Admin → General Settings → Pause new signups. The database also rejects
// new accounts while paused (block_signup_when_paused trigger).
const SIGNUP_PAUSED_MESSAGE = "New sign-ups are paused for a short while. Existing members can still sign in. Please try again later.";
import { font, radius, shadow, space, type ColorPalette } from "../../lib/theme";
import { useThemedStyles } from "../../lib/theme-provider";
import { useKeyboardAvoidingReset } from "../../lib/useKeyboardAvoidingReset";

export default function SignUpScreen() {
  const kavResetKey = useKeyboardAvoidingReset();
  const styles = useThemedStyles(buildStyles);
  const tones = useThemedStyles(buildTones);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const appSettings = useAppSettings();
  const tr = useT();
  const params = useLocalSearchParams<{ ref?: string }>();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [inviteCode, setInviteCode] = useState(typeof params.ref === "string" ? params.ref.toUpperCase() : "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [consent, setConsent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isAppleLoading, setIsAppleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [legalDoc, setLegalDoc] = useState<LegalDoc | null>(null);
  // Stage 2: silently upgraded to the published content_pages wording in
  // the background — falls back to the bundled TERMS/PRIVACY on any
  // failure, and never blocks or delays sign-up.
  const termsDoc = useLegalDocUpgrade("terms", TERMS);
  const privacyDoc = useLegalDocUpgrade("privacy", PRIVACY);

  function handleBack() {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)");
  }

  async function handleSignUp() {
    if (isSubmitting) return;
    if ((await getAppSettings(true)).signupPaused) {
      setError(SIGNUP_PAUSED_MESSAGE);
      return;
    }
    if (fullName.trim().length < 2) {
      setError("Enter your full name.");
      return;
    }
    if (!isValidEmail(email)) {
      setError("Enter a valid email address.");
      return;
    }
    // The field shows a fixed +263 prefix, so people type "77 123 4567";
    // normalizeZwPhone accepts that as well as 077…/+263… forms.
    const phoneE164 = phone.trim() ? normalizeZwPhone(phone) : null;
    if (phone.trim() && !phoneE164) {
      setError("Enter a valid Zimbabwean mobile number, e.g. 77 123 4567.");
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
          phone: phoneE164,
          // Linked to the inviter server-side (profiles_link_signup_referral).
          ...(inviteCode.trim() ? { referral_code: inviteCode.trim().toUpperCase() } : {}),
        },
      },
    });

    if (signUpError) {
      setIsSubmitting(false);
      setError(friendlyError(signUpError).message);
      return;
    }

    if (data.user && data.user.identities && data.user.identities.length === 0) {
      setIsSubmitting(false);
      setError("An account with this email already exists. Try signing in instead.");
      return;
    }

    // isSubmitting is intentionally left true here — this screen is about
    // to be replaced by router.push below, so resetting it in the same
    // tick as that navigation is exactly the race that produced a real
    // production crash elsewhere in the app (a native Fabric
    // IllegalStateException — "child already has a parent" — see
    // project_fabric_navigation_crash memory).
    if (!data.session) {
      router.push({ pathname: "/(auth)/verify-otp", params: { email: email.trim() } });
    } else {
      setIsSubmitting(false);
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
    <KeyboardAvoidingView key={kavResetKey} style={styles.container} behavior="padding"
      automaticOffset>
      <View style={[styles.header, { paddingTop: insets.top + space.sm }]}>
        <GlassBackButton onPress={handleBack} tone="dark" flat />
        <Text style={styles.headerTitle}>{tr("auth.signUp")}</Text>
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
            <View style={{ marginLeft: 6 }}>
              <ZimbabweFlag width={18} />
            </View>
          </View>
        </View>

        <View style={styles.titleBlock}>
          <Text style={styles.title}>{tr("auth.createAccount")}</Text>
          <Text style={styles.subtitle}>{tr("auth.createAccountSubtitle")}</Text>
        </View>

        {appSettings.signupPaused ? (
          <View style={styles.pausedBanner} accessibilityRole="alert">
            <Text style={styles.pausedBannerText}>{SIGNUP_PAUSED_MESSAGE}</Text>
          </View>
        ) : null}

        <View style={styles.form}>
          <View style={styles.labelRow}>
            <Text style={styles.fieldLabel}>Full Name</Text>
            <Text style={styles.hintText}>Required</Text>
          </View>
          <View style={styles.inputRow}>
            <View style={styles.leadingIcon}>
              <PersonIcon c={tones.textMuted} size={18} />
            </View>
            <TextInput
              style={styles.input}
              placeholder="e.g. Tanaka Chakusa"
              placeholderTextColor={tones.textMuted}
              autoComplete="name"
              value={fullName}
              onChangeText={setFullName}
            />
          </View>

          <View style={[styles.labelRow, styles.fieldSpacing]}>
            <Text style={styles.fieldLabel}>{tr("auth.email")}</Text>
            <Text style={styles.hintText}>For verification</Text>
          </View>
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

          <View style={[styles.labelRow, styles.fieldSpacing]}>
            <Text style={styles.fieldLabel}>Phone Number</Text>
            <Text style={styles.hintText}>Optional · Ecocash / OneMoney</Text>
          </View>
          <View style={styles.inputRow}>
            <View style={styles.leadingIcon}>
              <CallIcon c={tones.textMuted} size={18} />
            </View>
            <View style={styles.prefixChip}>
              <Text style={styles.prefixChipText}>+263</Text>
            </View>
            <TextInput
              style={[styles.input, styles.inputWithPrefix]}
              placeholder="77 123 4567"
              placeholderTextColor={tones.textMuted}
              autoComplete="tel"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
            />
          </View>

          <View style={[styles.labelRow, styles.fieldSpacing]}>
            <Text style={styles.fieldLabel}>Invite Code</Text>
            <Text style={styles.hintText}>Optional · from a friend</Text>
          </View>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder="e.g. TAN7K2M"
              placeholderTextColor={tones.textMuted}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={12}
              value={inviteCode}
              onChangeText={(t) => setInviteCode(t.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
            />
          </View>

          <View style={[styles.labelRow, styles.fieldSpacing]}>
            <Text style={styles.fieldLabel}>{tr("auth.password")}</Text>
            <Text style={styles.hintText}>Min. 8 characters</Text>
          </View>
          <PasswordField
            value={password}
            onChangeText={setPassword}
            placeholder="At least 8 characters"
            autoComplete="password-new"
            showStrength
            icon={<LockIcon c={tones.textMuted} size={18} />}
            inputStyle={styles.passwordInput}
          />

          <View style={[styles.labelRow, styles.fieldSpacing]}>
            <Text style={styles.fieldLabel}>Confirm Password</Text>
          </View>
          <PasswordField
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Re-enter your password"
            autoComplete="password-new"
            icon={<LockIcon c={tones.textMuted} size={18} />}
            inputStyle={styles.passwordInput}
          />

          <Pressable style={styles.consentRow} onPress={() => setConsent((v) => !v)}>
            <View style={[styles.checkbox, consent && styles.checkboxChecked]}>
              {consent ? <Text style={styles.checkboxMark}>✓</Text> : null}
            </View>
            <Text style={styles.consentCheckboxText}>
              I am 18+ and agree to{" "}
              <Text style={styles.consentLink} onPress={() => setLegalDoc(termsDoc)}>
                Terms of Service
              </Text>{" "}
              and{" "}
              <Text style={styles.consentLink} onPress={() => setLegalDoc(privacyDoc)}>
                Privacy Policy
              </Text>
            </Text>
          </Pressable>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            style={[styles.button, isSubmitting && styles.disabled]}
            onPress={handleSignUp}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color={tones.textOnBrand} />
            ) : (
              <Text style={styles.buttonText}>{tr("auth.signUp")}  →</Text>
            )}
          </Pressable>

          <SocialDivider label={tr("auth.orContinueWith")} />

          <View style={styles.socialStack}>
            {Platform.OS === "ios" ? (
              <SocialButton label="Continue with Apple" icon={<AppleIcon />} onPress={handleApple} isLoading={isAppleLoading} dark />
            ) : null}
            <SocialButton label="Continue with Google" icon={<GoogleIcon />} onPress={handleGoogle} isLoading={isGoogleLoading} />
            {appSettings.phoneAuthEnabled ? (
              <SocialButton
                label={tr("auth.continuePhone")}
                icon={<CallIcon c={tones.brand} size={20} />}
                onPress={() => router.push("/(auth)/phone")}
              />
            ) : null}
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>{tr("auth.haveAccount")}</Text>
            <Link href="/(auth)/sign-in">
              <Text style={styles.footerLink}>{tr("auth.signIn")}</Text>
            </Link>
          </View>
        </View>
      </ScrollView>

      <LegalDocSheet doc={legalDoc} visible={legalDoc != null} onClose={() => setLegalDoc(null)} />
    </KeyboardAvoidingView>
  );
}

function buildTones(color: ColorPalette) {
  return { textOnBrand: color.textOnBrand, textMuted: color.textMuted, brand: color.brand };
}

function buildStyles(color: ColorPalette) {
  return StyleSheet.create({
    container: {
      flex: 1,
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
    titleBlock: {
      marginBottom: space.xl,
      alignItems: "center",
    },
    title: {
      ...font.h2,
      color: color.text,
      textAlign: "center",
    },
    subtitle: {
      ...font.body,
      color: color.textSub,
      marginTop: space.xxs,
      textAlign: "center",
    },
    pausedBanner: {
      width: "100%",
      backgroundColor: color.warningTint,
      borderColor: color.warning,
      borderWidth: 1,
      borderRadius: radius.md,
      padding: space.md,
      marginBottom: space.md,
    },
    pausedBannerText: {
      ...font.body,
      color: color.text,
      textAlign: "center",
    },
    form: {
      width: "100%",
    },
    labelRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: space.xs,
    },
    fieldSpacing: {
      marginTop: space.md,
    },
    fieldLabel: {
      ...font.caption,
      color: color.text,
      fontWeight: "700",
    },
    hintText: {
      ...font.caption,
      color: color.textMuted,
    },
    hintTextGold: {
      ...font.caption,
      color: color.goldDark,
      fontWeight: "700",
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
    prefixChip: {
      position: "absolute",
      left: 40,
      backgroundColor: color.surfaceAlt,
      borderRadius: radius.sm,
      paddingHorizontal: space.sm,
      paddingVertical: 3,
      zIndex: 1,
    },
    prefixChipText: {
      ...font.caption,
      fontWeight: "700",
      color: color.brand,
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
    inputWithPrefix: {
      paddingLeft: 96,
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
    consentRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: space.sm,
      marginTop: space.md,
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
    consentCheckboxText: {
      flex: 1,
      fontSize: 13,
      lineHeight: 19,
      color: color.textSub,
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
    consentLink: {
      color: color.brand,
      fontWeight: "600",
    },
  });
}
