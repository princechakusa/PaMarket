// Two-step phone flow shared by "Continue with phone" sign-in
// (app/(auth)/phone.tsx, mode="login") and "Verify phone number" on an
// existing account (app/verify-phone.tsx, mode="phone_change").
//
// Step 1: a Zimbabwe mobile number, normalised to E.164 (lib/phone.ts).
// Step 2: the 6-digit code, sent by WhatsApp or SMS (login) or SMS
// (phone_change — Supabase's updateUser has no channel option).
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Button, CallIcon } from "./ui";
import { friendlyError } from "../lib/safety";
import { logClientError } from "../lib/error-log";
import {
  formatZwPhone,
  normalizeZwPhone,
  sendPhoneChangeCode,
  sendPhoneLoginCode,
  verifyPhoneCode,
  type OtpChannel,
} from "../lib/phone";
import { font, radius, space, type ColorPalette } from "../lib/theme";
import { useThemedStyles } from "../lib/theme-provider";

const OTP_LENGTH = 6;
const RESEND_COOLDOWN_S = 60;

type Props = {
  mode: "login" | "phone_change";
  initialPhone?: string | null;
  onVerified: (phoneE164: string) => void;
};

export function PhoneOtpFlow({ mode, initialPhone, onVerified }: Props) {
  const styles = useThemedStyles(buildStyles);
  const tones = useThemedStyles(buildTones);
  const [rawPhone, setRawPhone] = useState(initialPhone ?? "");
  const [phone, setPhone] = useState<string | null>(null); // E.164 once a code was sent
  const [channel, setChannel] = useState<OtpChannel>(mode === "login" ? "whatsapp" : "sms");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const codeInput = useRef<TextInput>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function sendCode(target: string, via: OtpChannel) {
    setError(null);
    setBusy(true);
    const { error: sendError } =
      mode === "login" ? await sendPhoneLoginCode(target, via) : await sendPhoneChangeCode(target);
    setBusy(false);
    if (sendError) {
      const msg = sendError.message ?? "";
      // WhatsApp delivery depends on the provider's WhatsApp sender being
      // approved — fall back to SMS instead of leaving the user stuck.
      if (via === "whatsapp" && /whatsapp|channel/i.test(msg)) {
        setChannel("sms");
        setError("WhatsApp codes aren't available right now. Tap Send code to get it by SMS instead.");
      } else if (/database error saving new user/i.test(msg)) {
        setError(friendlyError("signup_paused").message);
      } else {
        setError(friendlyError(sendError).message);
      }
      logClientError({ error: sendError, screen: "phone-otp", component: `send-${mode}-${via}`, severity: "warning" });
      return false;
    }
    setPhone(target);
    setCode("");
    setCooldown(RESEND_COOLDOWN_S);
    setTimeout(() => codeInput.current?.focus(), 250);
    return true;
  }

  async function handleSend() {
    const normalised = normalizeZwPhone(rawPhone);
    if (!normalised) {
      setError("Enter a valid Zimbabwe mobile number, e.g. 077 123 4567.");
      return;
    }
    await sendCode(normalised, channel);
  }

  async function handleVerify(token: string) {
    if (!phone || busy) return;
    setError(null);
    setBusy(true);
    const { error: verifyError } = await verifyPhoneCode(phone, token, mode);
    if (verifyError) {
      setBusy(false);
      setError(/expired|invalid/i.test(verifyError.message ?? "")
        ? "That code is wrong or has expired. Check it, or request a new one."
        : friendlyError(verifyError).message);
      return;
    }
    // Caller navigates away; leaving busy=true avoids a same-tick state
    // update racing the screen transition.
    onVerified(phone);
  }

  function onCodeChange(text: string) {
    const clean = text.replace(/\D/g, "").slice(0, OTP_LENGTH);
    setCode(clean);
    if (clean.length === OTP_LENGTH) void handleVerify(clean);
  }

  if (!phone) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.label}>Mobile number</Text>
        <View style={styles.inputRow}>
          <CallIcon c={tones.textMuted} size={18} />
          <TextInput
            style={styles.input}
            placeholder="077 123 4567"
            placeholderTextColor={tones.textMuted}
            keyboardType="phone-pad"
            autoComplete="tel"
            textContentType="telephoneNumber"
            value={rawPhone}
            onChangeText={setRawPhone}
            editable={!busy}
            accessibilityLabel="Mobile number"
          />
        </View>

        {mode === "login" ? (
          <>
            <Text style={[styles.label, { marginTop: space.lg }]}>Send my code by</Text>
            <View style={styles.channelRow}>
              {(["whatsapp", "sms"] as OtpChannel[]).map((c) => (
                <Pressable
                  key={c}
                  style={[styles.channel, channel === c && styles.channelOn]}
                  onPress={() => setChannel(c)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: channel === c }}
                >
                  <Text style={[styles.channelText, channel === c && styles.channelTextOn]}>
                    {c === "whatsapp" ? "WhatsApp" : "SMS"}
                  </Text>
                </Pressable>
              ))}
            </View>
          </>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={{ marginTop: space.xl }}>
          <Button label="Send code" onPress={handleSend} loading={busy} />
        </View>
        <Text style={styles.hint}>
          {mode === "login"
            ? "New to PaMarket? The same code creates your account. Standard message rates may apply."
            : "We'll text a 6-digit code to confirm this number is yours."}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.sentTo}>
        Enter the 6-digit code we sent by {channel === "whatsapp" && mode === "login" ? "WhatsApp" : "SMS"} to{" "}
        <Text style={styles.sentToStrong}>{formatZwPhone(phone)}</Text>
      </Text>
      <TextInput
        ref={codeInput}
        style={styles.codeInput}
        value={code}
        onChangeText={onCodeChange}
        keyboardType="number-pad"
        autoComplete="sms-otp"
        textContentType="oneTimeCode"
        maxLength={OTP_LENGTH}
        editable={!busy}
        placeholder="------"
        placeholderTextColor={tones.textMuted}
        accessibilityLabel="Verification code"
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {busy ? <ActivityIndicator color={tones.brand} style={{ marginTop: space.md }} /> : null}

      <View style={styles.linkRow}>
        <Pressable
          disabled={cooldown > 0 || busy}
          onPress={() => void sendCode(phone, channel)}
          hitSlop={8}
        >
          <Text style={[styles.link, (cooldown > 0 || busy) && styles.linkDisabled]}>
            {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
          </Text>
        </Pressable>
        {mode === "login" && channel === "whatsapp" && cooldown === 0 ? (
          <Pressable onPress={() => { setChannel("sms"); void sendCode(phone, "sms"); }} hitSlop={8}>
            <Text style={styles.link}>Send by SMS instead</Text>
          </Pressable>
        ) : null}
        <Pressable onPress={() => { setPhone(null); setError(null); }} hitSlop={8}>
          <Text style={styles.link}>Change number</Text>
        </Pressable>
      </View>
    </View>
  );
}

function buildTones(color: ColorPalette) {
  return { brand: color.brand, textMuted: color.textMuted };
}

function buildStyles(color: ColorPalette) {
  return StyleSheet.create({
    wrap: { width: "100%" },
    label: { ...font.bodyStrong, color: color.text, marginBottom: space.xs },
    inputRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: space.sm,
      borderWidth: 1,
      borderColor: color.borderStrong,
      borderRadius: radius.md,
      paddingHorizontal: space.md,
      backgroundColor: color.surface,
    },
    input: { flex: 1, height: 50, ...font.body, color: color.text },
    channelRow: { flexDirection: "row", gap: space.sm },
    channel: {
      flex: 1,
      height: 44,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: color.borderStrong,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: color.surface,
    },
    channelOn: { borderColor: color.brand, backgroundColor: color.brand },
    channelText: { ...font.bodyStrong, color: color.text },
    channelTextOn: { color: color.textOnBrand },
    error: { ...font.body, color: color.danger, marginTop: space.md, textAlign: "center" },
    hint: { ...font.caption, color: color.textSub, marginTop: space.md, textAlign: "center" },
    sentTo: { ...font.body, color: color.textSub, textAlign: "center" },
    sentToStrong: { color: color.text, fontWeight: "700" },
    codeInput: {
      marginTop: space.lg,
      height: 60,
      borderWidth: 1,
      borderColor: color.borderStrong,
      borderRadius: radius.md,
      textAlign: "center",
      fontSize: 26,
      fontWeight: "700",
      letterSpacing: 10,
      color: color.text,
      backgroundColor: color.surface,
    },
    linkRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: space.lg, marginTop: space.xl },
    link: { ...font.bodyStrong, color: color.brand },
    linkDisabled: { color: color.textMuted },
  });
}
