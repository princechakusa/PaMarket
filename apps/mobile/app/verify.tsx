import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { uploadVerificationDoc } from "../lib/verification";
import { toast } from "../components/ui/Toast";
import type { ColorPalette } from "../lib/theme";
import { useThemedStyles } from "../lib/theme-provider";

// Mirrors www/js/verify.js pages.Verify — 3-step identity verification
// (phone auto-confirmed, ID document, face selfie) feeding the blue
// verified badge. Uploads go to the private R2 verification/ prefix.
export default function VerifyScreen() {
  const styles = useThemedStyles(buildStyles);
  const tones = useThemedStyles(buildTones);
  const { session } = useAuth();

  const [phone, setPhone] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);
  const [pending, setPending] = useState(false);
  const [idImage, setIdImage] = useState<string | null>(null);
  const [selfieImage, setSelfieImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!session?.user) return;
    const { data } = await supabase
      .from("profiles")
      .select("phone,verified,verification_pending")
      .eq("id", session.user.id)
      .maybeSingle();
    setPhone(data?.phone ?? null);
    setVerified(!!data?.verified);
    setPending(!!(data as any)?.verification_pending);
  }, [session]);

  useEffect(() => {
    setIsLoading(true);
    load().finally(() => setIsLoading(false));
  }, [load]);

  async function pickId() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.82,
    });
    if (!result.canceled && result.assets?.[0]) setIdImage(result.assets[0].uri);
  }

  async function takeSelfie() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      toast("Camera permission is needed to take a selfie", 3000, true);
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      cameraType: ImagePicker.CameraType.front,
      quality: 0.85,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets?.[0]) setSelfieImage(result.assets[0].uri);
  }

  async function cancelPending() {
    if (!session?.user) return;
    await supabase.from("profiles").update({ verification_pending: false }).eq("id", session.user.id);
    setPending(false);
    toast("Verification request cancelled");
  }

  async function submit() {
    if (!session?.user || !idImage || !selfieImage) {
      toast("Complete both steps first", 3000, true);
      return;
    }
    setIsSubmitting(true);
    const idPath = await uploadVerificationDoc(session.user.id, idImage, "id");
    const selfiePath = await uploadVerificationDoc(session.user.id, selfieImage, "selfie");
    await supabase.from("verifications").upsert(
      {
        user_id: session.user.id,
        status: "pending",
        submitted_at: new Date().toISOString(),
        id_doc_path: idPath,
        selfie_path: selfiePath,
      },
      { onConflict: "user_id" }
    );
    await supabase.from("profiles").update({ verification_pending: true }).eq("id", session.user.id);
    setIsSubmitting(false);
    setPending(true);
    setIdImage(null);
    setSelfieImage(null);
    toast("Documents submitted! Admin will review within 24 hours.");
  }

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={tones.brand} />
      </View>
    );
  }

  if (verified) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
        <View style={styles.successHero}>
          <Text style={styles.successTitle}>You're Verified</Text>
          <Text style={styles.successSub}>Your blue badge is live across your listings and profile.</Text>
        </View>
      </ScrollView>
    );
  }

  if (pending) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
        <View style={styles.pendingHero}>
          <Text style={styles.pendingTitle}>Under Review</Text>
          <Text style={styles.pendingSub}>
            Your ID and selfie were submitted. Our team reviews within 24 hours and you'll be notified once approved.
          </Text>
        </View>
        <Pressable style={styles.cancelButton} onPress={cancelPending}>
          <Text style={styles.cancelButtonText}>Cancel request</Text>
        </Pressable>
      </ScrollView>
    );
  }

  const doneCount = 1 + (idImage ? 1 : 0) + (selfieImage ? 1 : 0);
  const pct = Math.round((doneCount / 3) * 100);
  const ready = !!idImage && !!selfieImage;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>Get Verified</Text>
        <Text style={styles.heroSub}>Verified sellers get up to 4× more enquiries</Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${pct}%` }]} />
        </View>
        <Text style={styles.progressLabel}>{doneCount} of 3</Text>
      </View>

      <View style={[styles.step, styles.stepDone]}>
        <View style={[styles.badge, styles.badgeDone]}>
          <Text style={styles.badgeCheck}>✓</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.stepTitle}>Phone Verified</Text>
          <Text style={styles.stepSub}>{phone || "Your phone number is confirmed"}</Text>
        </View>
      </View>

      <View style={styles.step}>
        <View style={[styles.badge, idImage ? styles.badgeDone : styles.badgeActive]}>
          <Text style={idImage ? styles.badgeCheck : styles.badgeNumber}>{idImage ? "✓" : "2"}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.stepTitle}>Upload ID Document</Text>
          <Text style={styles.stepSub}>National ID, passport or driver's licence.</Text>
          <Pressable style={styles.actionButton} onPress={pickId}>
            <Text style={styles.actionButtonText}>{idImage ? "Replace ID" : "Upload ID"}</Text>
          </Pressable>
          {idImage ? <Image source={{ uri: idImage }} style={styles.idPreview} /> : null}
        </View>
      </View>

      <View style={styles.step}>
        <View style={[styles.badge, selfieImage ? styles.badgeDone : idImage ? styles.badgeActive : styles.badgeIdle]}>
          <Text style={selfieImage ? styles.badgeCheck : styles.badgeNumber}>{selfieImage ? "✓" : "3"}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.stepTitle}>Face Selfie</Text>
          <Text style={styles.stepSub}>Take a clear photo of your face. Reviewed alongside your ID.</Text>
          <Pressable style={styles.actionButton} onPress={takeSelfie}>
            <Text style={styles.actionButtonText}>{selfieImage ? "Re-take Selfie" : "Take Selfie"}</Text>
          </Pressable>
          {selfieImage ? <Image source={{ uri: selfieImage }} style={styles.selfiePreview} /> : null}
        </View>
      </View>

      <Pressable style={[styles.submitButton, (!ready || isSubmitting) && styles.buttonDisabled]} onPress={submit} disabled={!ready || isSubmitting}>
        <Text style={styles.submitButtonText}>{ready ? (isSubmitting ? "Submitting…" : "Submit for Review") : "Add ID & selfie to continue"}</Text>
      </Pressable>
      <Text style={styles.footNote}>Reviewed by our team within 24 hours.</Text>

      <View style={styles.secureBox}>
        <Text style={styles.secureText}>
          <Text style={styles.secureBold}>Your data is secure.</Text> Your ID and selfie are stored privately and used only to confirm your identity. They are never sold or shared.
        </Text>
      </View>
    </ScrollView>
  );
}

function buildTones(color: ColorPalette) {
  return { brand: color.brand };
}

function buildStyles(color: ColorPalette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: color.bg },
    centered: { flex: 1, alignItems: "center", justifyContent: "center" },
    successHero: { backgroundColor: color.success, borderRadius: 20, padding: 26, alignItems: "center" },
    successTitle: { fontSize: 19, fontWeight: "800", color: color.textOnBrand },
    successSub: { fontSize: 13, color: color.textOnBrandSub, marginTop: 4, textAlign: "center" },
    pendingHero: { backgroundColor: color.brand, borderRadius: 20, padding: 26, alignItems: "center" },
    pendingTitle: { fontSize: 19, fontWeight: "800", color: color.textOnBrand },
    pendingSub: { fontSize: 13, color: color.textOnBrandSub, marginTop: 6, textAlign: "center", lineHeight: 19 },
    cancelButton: { marginTop: 12, backgroundColor: color.surface, borderRadius: 10, paddingVertical: 12, alignItems: "center" },
    cancelButtonText: { fontSize: 14, fontWeight: "700", color: color.text },
    hero: { backgroundColor: color.brand, borderRadius: 22, padding: 20, marginBottom: 18 },
    heroTitle: { fontSize: 18, fontWeight: "800", color: color.textOnBrand },
    heroSub: { fontSize: 12.5, color: color.textOnBrandSub, marginTop: 2 },
    progressTrack: { height: 8, backgroundColor: "rgba(255,255,255,0.18)", borderRadius: 5, overflow: "hidden", marginTop: 14 },
    progressFill: { height: "100%", backgroundColor: color.gold },
    progressLabel: { fontSize: 12, fontWeight: "800", color: color.gold, marginTop: 6 },
    step: { flexDirection: "row", gap: 14, backgroundColor: color.surface, borderRadius: 18, padding: 16, marginBottom: 12 },
    stepDone: {},
    badge: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
    badgeDone: { backgroundColor: color.success },
    badgeActive: { backgroundColor: color.brand },
    badgeIdle: { backgroundColor: color.brandTint },
    badgeCheck: { color: color.textOnBrand, fontWeight: "800" },
    badgeNumber: { color: color.textMuted, fontWeight: "800" },
    stepTitle: { fontSize: 15, fontWeight: "800", color: color.text },
    stepSub: { fontSize: 12.5, color: color.textMuted, marginTop: 3, lineHeight: 18 },
    actionButton: { marginTop: 10, alignSelf: "flex-start", backgroundColor: color.brand, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10 },
    actionButtonText: { color: color.textOnBrand, fontSize: 13.5, fontWeight: "700" },
    idPreview: { width: "100%", maxWidth: 240, height: 140, borderRadius: 12, marginTop: 10 },
    selfiePreview: { width: 104, height: 104, borderRadius: 52, marginTop: 12, borderWidth: 3, borderColor: color.success },
    submitButton: { backgroundColor: color.brand, borderRadius: 12, paddingVertical: 14, alignItems: "center", marginTop: 6 },
    buttonDisabled: { opacity: 0.5 },
    submitButtonText: { color: color.textOnBrand, fontSize: 14, fontWeight: "700" },
    footNote: { fontSize: 12, color: color.textMuted, textAlign: "center", marginTop: 8 },
    secureBox: { flexDirection: "row", backgroundColor: color.brandTint, borderRadius: 14, padding: 14, marginTop: 16 },
    secureText: { fontSize: 12, color: color.textMuted, lineHeight: 18 },
    secureBold: { color: color.brand, fontWeight: "700" },
  });
}
