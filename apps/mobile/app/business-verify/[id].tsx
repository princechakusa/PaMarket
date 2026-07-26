import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import type { Business } from "../../lib/businesses";
import { uploadVerificationDoc } from "../../lib/verification";
import { toast } from "../../components/ui/Toast";
import { EmptyState } from "../../components/ui/EmptyState";
import type { ColorPalette } from "../../lib/theme";
import { useThemedStyles } from "../../lib/theme-provider";

const PHONE_RE = /^(\+263|0)[0-9]{9}$/;

type Styles = ReturnType<typeof buildStyles>;

function StepCard({
  number,
  done,
  active,
  title,
  subtitle,
  children,
  styles,
}: {
  number: number;
  done: boolean;
  active: boolean;
  title: string;
  subtitle: string;
  children?: React.ReactNode;
  styles: Styles;
}) {
  return (
    <View style={[styles.step, active && styles.stepActive]}>
      <View style={styles.stepRow}>
        <View style={[styles.stepBadge, done ? styles.stepBadgeDone : active ? styles.stepBadgeActive : styles.stepBadgeIdle]}>
          {done ? <Text style={styles.stepCheck}>✓</Text> : <Text style={styles.stepNumber}>{number}</Text>}
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.stepTitle}>{title}</Text>
          <Text style={styles.stepSub}>{subtitle}</Text>
          {children}
        </View>
      </View>
    </View>
  );
}

// Mirrors www/js/business-verify.js pages.BusinessVerify — 3-tier
// verification (phone / owner ID doc / business registration doc), raising
// businesses.verification_level via admin review of business_verifications.
export default function BusinessVerifyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const styles = useThemedStyles(buildStyles);
  const tones = useThemedStyles(buildTones);

  const [business, setBusiness] = useState<Business | null>(null);
  const [isOwner, setIsOwner] = useState<boolean | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [pendingReg, setPendingReg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!id || !session?.user) return;
    const { data } = await supabase.from("businesses").select("*").eq("id", id).maybeSingle();
    if (!data || data.owner_user_id !== session.user.id) {
      setIsOwner(false);
      return;
    }
    setIsOwner(true);
    setBusiness(data as Business);
  }, [id, session]);

  useEffect(() => {
    setIsLoading(true);
    load().finally(() => setIsLoading(false));
  }, [load]);

  if (isLoading || isOwner === null) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={tones.brand} />
      </View>
    );
  }

  if (!isOwner || !business) {
    return (
      <View style={styles.centered}>
        <EmptyState title="Owner only" subtitle="Only the owner can verify this business." />
      </View>
    );
  }

  const level = business.verification_level ?? 0;
  const phoneOk = PHONE_RE.test(business.phone || "");
  const pendingReview = !!(business as any).verification_pending;

  async function confirmPhone() {
    if (!business) return;
    const newLevel = Math.max(level, 1);
    await supabase.from("businesses").update({ verification_level: newLevel }).eq("id", business.id);
    setBusiness({ ...business, verification_level: newLevel });
    toast("Phone verified");
  }

  async function pickImage(target: "id" | "reg") {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.82,
    });
    if (result.canceled || !result.assets?.[0]) return;
    if (target === "id") setPendingId(result.assets[0].uri);
    else setPendingReg(result.assets[0].uri);
  }

  async function submit() {
    if (!business || !session?.user) return;
    if (!pendingId && !pendingReg) {
      toast("Add a document first", 3000, true);
      return;
    }
    setIsSubmitting(true);
    const idPath = pendingId ? await uploadVerificationDoc(session.user.id, pendingId, "biz_id") : null;
    const regPath = pendingReg ? await uploadVerificationDoc(session.user.id, pendingReg, "biz_reg") : null;
    const levelRequested = pendingReg ? 3 : 2;
    await supabase.from("business_verifications").insert({
      business_id: business.id,
      level_requested: levelRequested,
      id_doc_path: idPath,
      reg_doc_path: regPath,
      status: "pending",
    });
    await supabase.from("businesses").update({ verification_pending: true }).eq("id", business.id);
    setBusiness({ ...business, ...({ verification_pending: true } as any) });
    setPendingId(null);
    setPendingReg(null);
    setIsSubmitting(false);
    toast("Submitted for review");
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>Verification level {level}</Text>
        <Text style={styles.heroSub}>Verified businesses earn buyer trust and rank higher.</Text>
      </View>

      {pendingReview ? (
        <View style={styles.pendingBanner}>
          <Text style={styles.pendingBannerText}>Your documents are under review. We'll update your level within 2 business days.</Text>
        </View>
      ) : null}

      <StepCard number={1} done={level >= 1} active={level < 1 && phoneOk} title="Phone Verified" subtitle={phoneOk ? business.phone || "" : "Add a valid phone in your profile first."} styles={styles}>
        {level < 1 && phoneOk ? (
          <Pressable style={styles.confirmButton} onPress={confirmPhone}>
            <Text style={styles.confirmButtonText}>Confirm phone</Text>
          </Pressable>
        ) : null}
      </StepCard>

      <StepCard number={2} done={level >= 2} active={level === 1} title="Owner ID Verified" subtitle="National ID or passport of the owner." styles={styles}>
        {level < 2 ? (
          <>
            <Pressable style={styles.uploadButton} onPress={() => pickImage("id")}>
              <Text style={styles.uploadButtonText}>{pendingId ? "Replace ID" : "Upload ID"}</Text>
            </Pressable>
            {pendingId ? <Image source={{ uri: pendingId }} style={styles.preview} /> : null}
          </>
        ) : null}
      </StepCard>

      <StepCard number={3} done={level >= 3} active={level === 2} title="Business Document" subtitle="Certificate of incorporation / registration." styles={styles}>
        {level < 3 ? (
          <>
            <Pressable style={styles.uploadButton} onPress={() => pickImage("reg")}>
              <Text style={styles.uploadButtonText}>{pendingReg ? "Replace Document" : "Upload Document"}</Text>
            </Pressable>
            {pendingReg ? <Image source={{ uri: pendingReg }} style={styles.preview} /> : null}
          </>
        ) : null}
      </StepCard>

      {(pendingId || pendingReg) && !pendingReview ? (
        <Pressable style={[styles.submitButton, isSubmitting && styles.buttonDisabled]} onPress={submit} disabled={isSubmitting}>
          <Text style={styles.submitButtonText}>{isSubmitting ? "Submitting…" : "Submit for Review"}</Text>
        </Pressable>
      ) : null}

      <View style={styles.noticeBox}>
        <Text style={styles.noticeText}>Documents are stored privately and used only to verify your business.</Text>
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
    hero: { backgroundColor: color.brand, borderRadius: 18, padding: 20, marginBottom: 18 },
    heroTitle: { fontSize: 18, fontWeight: "800", color: color.textOnBrand },
    heroSub: { fontSize: 12.5, color: color.textOnBrandSub, marginTop: 4 },
    pendingBanner: { backgroundColor: color.goldTint, borderRadius: 14, padding: 14, marginBottom: 14 },
    pendingBannerText: { fontSize: 13, color: color.goldDark },
    step: { backgroundColor: color.surface, borderWidth: 1, borderColor: color.border, borderRadius: 16, padding: 16, marginBottom: 12 },
    stepActive: { borderColor: color.brandTintStrong },
    stepRow: { flexDirection: "row", gap: 13, alignItems: "flex-start" },
    stepBadge: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
    stepBadgeDone: { backgroundColor: color.success },
    stepBadgeActive: { backgroundColor: color.brand },
    stepBadgeIdle: { backgroundColor: color.brandTint },
    stepCheck: { color: color.textOnBrand, fontWeight: "800" },
    stepNumber: { color: color.textMuted, fontWeight: "800" },
    stepTitle: { fontSize: 15, fontWeight: "800", color: color.text },
    stepSub: { fontSize: 12.5, color: color.textMuted, marginTop: 3, lineHeight: 18 },
    confirmButton: { marginTop: 10, backgroundColor: color.brand, borderRadius: 11, paddingHorizontal: 16, paddingVertical: 10, alignSelf: "flex-start" },
    confirmButtonText: { color: color.textOnBrand, fontSize: 13, fontWeight: "700" },
    uploadButton: { marginTop: 10, backgroundColor: color.brandTint, borderRadius: 11, paddingHorizontal: 16, paddingVertical: 10, alignSelf: "flex-start" },
    uploadButtonText: { color: color.brand, fontSize: 13, fontWeight: "700" },
    preview: { width: 220, height: 140, borderRadius: 12, marginTop: 10 },
    submitButton: { backgroundColor: color.brand, borderRadius: 10, paddingVertical: 14, alignItems: "center", marginTop: 4 },
    buttonDisabled: { opacity: 0.6 },
    submitButtonText: { color: color.textOnBrand, fontSize: 14, fontWeight: "700" },
    noticeBox: { flexDirection: "row", backgroundColor: color.brandTint, borderRadius: 14, padding: 14, marginTop: 16 },
    noticeText: { fontSize: 12, color: color.textMuted, lineHeight: 18 },
  });
}
