import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { BRAND_BLUE } from "../lib/constants";
import { uploadVerificationDoc } from "../lib/verification";
import { toast } from "../components/ui/Toast";

type VerifyType = "company" | "individual" | null;

const COMPANY_DOCS: [string, string, string][] = [
  ["reg", "Certificate of Incorporation", "CIPC business registration certificate"],
  ["tax", "Tax Clearance Certificate", "Valid certificate from ZIMRA"],
  ["premises", "Business Premises Photo", "Outside of your premises showing any signage"],
];
const INDIVIDUAL_DOCS: [string, string, string][] = [
  ["nationalId", "National ID or Passport", "A clear photo of your national ID or passport"],
];

// Mirrors www/js/verify.js pages.CompanyVerify — company/sole-trader
// verification required to post jobs (separate from the personal ID+selfie
// flow in app/verify.tsx).
export default function CompanyVerifyScreen() {
  const { session } = useAuth();

  const [verified, setVerified] = useState(false);
  const [pending, setPending] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [verifyType, setVerifyType] = useState<VerifyType>(null);
  const [docs, setDocs] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!session?.user) return;
    const { data } = await supabase
      .from("profiles")
      .select("company,company_verified,company_verification_pending")
      .eq("id", session.user.id)
      .maybeSingle();
    setCompanyName((data as any)?.company ?? "");
    setVerified(!!(data as any)?.company_verified);
    setPending(!!(data as any)?.company_verification_pending);
  }, [session]);

  useEffect(() => {
    setIsLoading(true);
    load().finally(() => setIsLoading(false));
  }, [load]);

  async function cancelPending() {
    if (!session?.user) return;
    await supabase.from("profiles").update({ company_verification_pending: false }).eq("id", session.user.id);
    setPending(false);
    toast("Request cancelled");
  }

  async function captureDoc(key: string) {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.82,
    });
    if (!result.canceled && result.assets?.[0]) {
      setDocs((prev) => ({ ...prev, [key]: result.assets[0].uri }));
    }
  }

  const activeDocs = verifyType === "individual" ? INDIVIDUAL_DOCS : COMPANY_DOCS;
  const allDone = verifyType ? activeDocs.every(([key]) => docs[key]) : false;

  async function submit() {
    if (!session?.user || !verifyType) return;
    const name = companyName.trim();
    if (!name) {
      toast(verifyType === "individual" ? "Enter your full name" : "Enter your company name", 3000, true);
      return;
    }
    if (!allDone) {
      toast("Add all required documents", 3000, true);
      return;
    }
    setIsSubmitting(true);
    const paths: Record<string, string | null> = {};
    for (const [key] of activeDocs) {
      paths[key] = await uploadVerificationDoc(session.user.id, docs[key], `co_${key}`);
    }
    const storedName = verifyType === "individual" ? `SOLE TRADER: ${name}` : name;
    await supabase.from("company_verifications").upsert(
      {
        user_id: session.user.id,
        company_name: storedName,
        status: "pending",
        submitted_at: new Date().toISOString(),
        reg_cert_path: paths.reg || null,
        owner_id_path: paths.nationalId || null,
        tax_cert_path: paths.tax || null,
        premises_path: paths.premises || null,
      },
      { onConflict: "user_id" }
    );
    await supabase.from("profiles").update({ company_verification_pending: true, company: name }).eq("id", session.user.id);
    setIsSubmitting(false);
    setPending(true);
    setDocs({});
    setVerifyType(null);
    toast("Documents submitted! Reviewed within 2 business days.");
  }

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={BRAND_BLUE} />
      </View>
    );
  }

  if (verified) {
    return (
      <View style={styles.centered}>
        <Text style={styles.successTitle}>Verified</Text>
        <Text style={styles.successSub}>Your blue Verified badge is active. You can post jobs.</Text>
      </View>
    );
  }

  if (pending) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
        <View style={styles.pendingHero}>
          <Text style={styles.pendingTitle}>Under Review</Text>
          <Text style={styles.pendingSub}>Your documents were submitted. Our team reviews within 2 business days.</Text>
        </View>
        <Pressable style={styles.cancelButton} onPress={cancelPending}>
          <Text style={styles.cancelButtonText}>Cancel Request</Text>
        </Pressable>
      </ScrollView>
    );
  }

  if (!verifyType) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
        <Text style={styles.intro}>Choose the option that applies to you. Both allow you to post jobs on PaMarket.</Text>
        <Pressable style={styles.typeCard} onPress={() => setVerifyType("company")}>
          <Text style={styles.typeTitle}>Registered Company</Text>
          <Text style={styles.typeSub}>You have a registered business with a Certificate of Incorporation from CIPC. Requires 3 documents.</Text>
        </Pressable>
        <Pressable style={styles.typeCard} onPress={() => setVerifyType("individual")}>
          <Text style={styles.typeTitle}>Sole Trader / Individual</Text>
          <Text style={styles.typeSub}>You are a sole trader, freelancer, or individual employer without a registered company. Requires your National ID or Passport only.</Text>
        </Pressable>
      </ScrollView>
    );
  }

  const isIndividual = verifyType === "individual";

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <Pressable style={styles.changeTypeButton} onPress={() => setVerifyType(null)}>
        <Text style={styles.changeTypeText}>← Change type</Text>
      </Pressable>

      <Text style={styles.label}>{isIndividual ? "Your Full Name" : "Company / Business Name"}</Text>
      <TextInput
        style={styles.input}
        placeholder={isIndividual ? "Your full legal name" : "Registered business name"}
        value={companyName}
        onChangeText={setCompanyName}
      />

      {activeDocs.map(([key, title, sub], i) => {
        const done = !!docs[key];
        return (
          <View key={key} style={styles.docStep}>
            <View style={[styles.docBadge, done && styles.docBadgeDone]}>
              <Text style={done ? styles.docBadgeCheck : styles.docBadgeNumber}>{done ? "✓" : i + 1}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.docTitle}>{title}</Text>
              <Text style={styles.docSub}>{sub}</Text>
              <Pressable style={styles.docButton} onPress={() => captureDoc(key)}>
                <Text style={styles.docButtonText}>{done ? "Replace Photo" : "Add Photo"}</Text>
              </Pressable>
              {done ? <Image source={{ uri: docs[key] }} style={styles.docPreview} /> : null}
            </View>
          </View>
        );
      })}

      <Pressable style={[styles.submitButton, (!allDone || isSubmitting) && styles.buttonDisabled]} onPress={submit} disabled={!allDone || isSubmitting}>
        <Text style={styles.submitButtonText}>{isSubmitting ? "Submitting…" : "Submit for Review"}</Text>
      </Pressable>

      <View style={styles.secureBox}>
        <Text style={styles.secureText}>Your documents are stored privately and used only to verify your identity. Never sold or shared.</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F6F9" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  successTitle: { fontSize: 18, fontWeight: "800", color: "#111827", marginBottom: 6 },
  successSub: { fontSize: 13, color: "#8A93A6", textAlign: "center" },
  pendingHero: { alignItems: "center", padding: 20 },
  pendingTitle: { fontSize: 18, fontWeight: "800", color: "#111827", marginBottom: 6 },
  pendingSub: { fontSize: 13, color: "#8A93A6", textAlign: "center", lineHeight: 19 },
  cancelButton: { marginTop: 12, backgroundColor: "#ffffff", borderRadius: 10, paddingVertical: 12, alignItems: "center" },
  cancelButtonText: { fontSize: 14, fontWeight: "700", color: "#111827" },
  intro: { fontSize: 14, color: "#5A6478", lineHeight: 21, marginBottom: 24 },
  typeCard: { backgroundColor: "#ffffff", borderWidth: 2, borderColor: "#E8ECF4", borderRadius: 16, padding: 20, marginBottom: 14 },
  typeTitle: { fontSize: 16, fontWeight: "800", color: "#111827", marginBottom: 4 },
  typeSub: { fontSize: 13, color: "#8A93A6", lineHeight: 19 },
  changeTypeButton: { alignSelf: "flex-start", backgroundColor: "#EEF2FF", borderWidth: 1.5, borderColor: BRAND_BLUE, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8, marginBottom: 16 },
  changeTypeText: { color: BRAND_BLUE, fontSize: 14, fontWeight: "700" },
  label: { fontSize: 13, fontWeight: "600", color: "#111827", marginBottom: 6 },
  input: { backgroundColor: "#ffffff", borderWidth: 1, borderColor: "#D8DCE5", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, marginBottom: 18 },
  docStep: { flexDirection: "row", gap: 12, marginBottom: 16 },
  docBadge: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#EEF2FB", alignItems: "center", justifyContent: "center" },
  docBadgeDone: { backgroundColor: "#16a34a" },
  docBadgeCheck: { color: "#ffffff", fontWeight: "800" },
  docBadgeNumber: { color: "#94a3b8", fontWeight: "700" },
  docTitle: { fontSize: 14, fontWeight: "800", color: "#111827" },
  docSub: { fontSize: 12, color: "#8A93A6", marginTop: 2 },
  docButton: { marginTop: 8, alignSelf: "flex-start", backgroundColor: BRAND_BLUE, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  docButtonText: { color: "#ffffff", fontSize: 12.5, fontWeight: "700" },
  docPreview: { width: "100%", maxWidth: 240, height: 140, borderRadius: 12, marginTop: 10 },
  submitButton: { backgroundColor: BRAND_BLUE, borderRadius: 12, paddingVertical: 14, alignItems: "center", marginTop: 6 },
  buttonDisabled: { opacity: 0.5 },
  submitButtonText: { color: "#ffffff", fontSize: 14, fontWeight: "700" },
  secureBox: { backgroundColor: "#EEF2FB", borderRadius: 14, padding: 14, marginTop: 16 },
  secureText: { fontSize: 12, color: "#8A93A6", lineHeight: 18 },
});
