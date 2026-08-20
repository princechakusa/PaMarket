import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { useAuth } from "../lib/auth";
import { GlassBackButton, ProvinceCityFields } from "../components/ui";
import { supabase } from "../lib/supabase";
import { toast } from "../components/ui/Toast";
import { CATEGORIES, PROVINCES, CITIES_BY_PROVINCE } from "../lib/constants";
import type { Business } from "../lib/businesses";
import type { ColorPalette } from "../lib/theme";
import { useThemedStyles } from "../lib/theme-provider";

// Mirrors www/js/business-onboarding.js STEPS. Every business onboards on
// the Free plan — paid plans are only ever purchased through the real
// StoreKit/Play Billing flow on business-subscription/[id].tsx (reachable
// from Seller Center right after onboarding completes), never from here.
// This screen used to show priced paid tiers that just alerted "Coming
// soon" when tapped — a real App Review risk (priced-but-inert products).
const STEPS = ["details", "category", "activate"] as const;
type Step = (typeof STEPS)[number];
const STEP_LABELS: Record<Step, string> = { details: "Details", category: "Category", activate: "Activate" };
const draftStorageKey = (userId: string) => `business-onboarding-draft:${userId}`;

const BIZ_TYPES = [
  { id: "individual", label: "Individual", sub: "Sole trader / personal" },
  { id: "company", label: "Company", sub: "Registered business" },
  { id: "agency", label: "Agency", sub: "Multi-client agency" },
];

type Draft = {
  name: string;
  bizType: string;
  description: string;
  phone: string;
  whatsapp: string;
  email: string;
  province: string;
  city: string;
  suburb: string;
  categories: string[];
  planId: string;
};

function blankDraft(phone?: string, email?: string): Draft {
  return {
    name: "",
    bizType: "individual",
    description: "",
    phone: phone ?? "",
    whatsapp: "",
    email: email ?? "",
    province: "",
    city: "",
    suburb: "",
    categories: [],
    planId: "free",
  };
}

function fromBusiness(b: Business): Draft {
  return {
    name: b.name ?? "",
    bizType: b.biz_type ?? "individual",
    description: b.description ?? "",
    phone: b.phone ?? "",
    whatsapp: b.whatsapp ?? "",
    email: b.email ?? "",
    province: b.province ?? "",
    city: b.city ?? "",
    suburb: b.suburb ?? "",
    categories: (b.category ?? "").split("|").filter(Boolean),
    planId: "free",
  };
}

export default function BusinessOnboardingScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const styles = useThemedStyles(buildStyles);
  const tones = useThemedStyles(buildTones);
  const [step, setStep] = useState<Step>("details");
  const [draft, setDraft] = useState<Draft>(blankDraft(undefined, session?.user?.email ?? undefined));
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [existingStatus, setExistingStatus] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Resume an incomplete draft only — an already-submitted/active/suspended
  // business must not reopen here (mirrors ensureDraft's guard).
  const load = useCallback(async () => {
    if (!session?.user) return;
    const { data } = await supabase
      .from("businesses")
      .select("id,owner_user_id,name,logo,cover,description,biz_type,category,phone,whatsapp,email,province,city,suburb,status,verification_level")
      .eq("owner_user_id", session.user.id)
      .eq("status", "draft")
      .maybeSingle();
    if (data) {
      setBusinessId(data.id);
      setExistingStatus(data.status);
      setDraft(fromBusiness(data as Business));
      await SecureStore.deleteItemAsync(draftStorageKey(session.user.id)).catch(() => {});
    } else {
      const saved = await SecureStore.getItemAsync(draftStorageKey(session.user.id)).catch(() => null);
      if (saved) {
        try {
          const parsed = JSON.parse(saved) as { draft?: Draft; step?: Step };
          setDraft(parsed.draft ?? blankDraft(undefined, session.user.email ?? undefined));
          if (parsed.step && STEPS.includes(parsed.step)) setStep(parsed.step);
        } catch {
          setDraft(blankDraft(undefined, session.user.email ?? undefined));
        }
      } else {
        setDraft(blankDraft(undefined, session.user.email ?? undefined));
      }
    }
  }, [session]);

  useEffect(() => {
    setIsLoading(true);
    load().finally(() => setIsLoading(false));
  }, [load]);

  // Preserve an unsent local draft across temporary navigation without
  // creating a premature server business record.
  useEffect(() => {
    if (isLoading || !session?.user || businessId) return;
    const timer = setTimeout(() => {
      SecureStore.setItemAsync(
        draftStorageKey(session.user.id),
        JSON.stringify({ draft, step })
      ).catch(() => {});
    }, 250);
    return () => clearTimeout(timer);
  }, [businessId, draft, isLoading, session?.user?.id, step]);

  const stepIndex = STEPS.indexOf(step);

  function update<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function toggleCategory(catId: string) {
    setDraft((d) => {
      const has = d.categories.includes(catId);
      return has
        ? { ...d, categories: d.categories.filter((c) => c !== catId) }
        : { ...d, categories: [...d.categories, catId] };
    });
  }

  // Persist current draft state to Supabase (id assigned on first save).
  async function persist(status: string) {
    if (!session?.user) return null;
    const row = {
      id: businessId ?? undefined,
      owner_user_id: session.user.id,
      name: draft.name,
      description: draft.description || null,
      biz_type: draft.bizType,
      category: draft.categories.join("|") || null,
      phone: draft.phone || null,
      whatsapp: draft.whatsapp || null,
      email: draft.email || null,
      province: draft.province || null,
      city: draft.city || null,
      suburb: draft.suburb || null,
      status,
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await supabase.from("businesses").upsert(row).select("id").single();
    if (error) {
      toast("Could not save. Please check your connection.", 4000, true);
      return null;
    }
    if (data?.id) setBusinessId(data.id);
    return data?.id ?? businessId;
  }

  function goNext() {
    if (step === "details") {
      if (!draft.name.trim()) { toast("Enter a business name"); return; }
      if (!draft.phone.trim()) { toast("A contact phone is required"); return; }
      if (!/^(\+263|0)[0-9]{9}$/.test(draft.phone.trim())) { toast("Enter a valid Zimbabwe phone (e.g. 0771234567)"); return; }
      if (!PROVINCES.includes(draft.province) || !(CITIES_BY_PROVINCE[draft.province] ?? []).includes(draft.city)) {
        toast("Select a valid Province and City");
        return;
      }
      setStep("category");
    } else if (step === "category") {
      if (!draft.categories.length || draft.categories.some((id) => !CATEGORIES.some((category) => category.id === id))) {
        toast("Pick at least one valid category");
        return;
      }
      setStep("activate");
    }
  }

  function goBack() {
    const i = STEPS.indexOf(step);
    if (i > 0) setStep(STEPS[i - 1]);
    else router.back();
  }

  // Same pattern as the Post wizard's hardware-back handling: Android system
  // Back should step the wizard back one stage, not exit the whole screen,
  // for every step after the first.
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== "android") return;
      const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
        const i = STEPS.indexOf(step);
        if (i > 0) {
          setStep(STEPS[i - 1]);
          return true;
        }
        return false;
      });
      return () => subscription.remove();
    }, [step])
  );

  async function activate() {
    if (!session?.user) return;
    if (!draft.name || !draft.phone || !PROVINCES.includes(draft.province)
      || !(CITIES_BY_PROVINCE[draft.province] ?? []).includes(draft.city)) { setStep("details"); return; }
    if (!draft.categories.length || draft.categories.some((id) => !CATEGORIES.some((category) => category.id === id))) {
      setStep("category");
      return;
    }

    setIsSubmitting(true);
    // New businesses go to pending_activation for admin review; editing an
    // already-active business (existingStatus === 'active') stays active.
    const status = existingStatus === "active" ? "active" : "pending_activation";
    const id = await persist(status);
    setIsSubmitting(false);
    if (!id) return;
    await SecureStore.deleteItemAsync(draftStorageKey(session.user.id)).catch(() => {});

    if (status === "active") {
      toast("Business updated");
      router.replace(`/business/${id}`);
      return;
    }
    toast("Submitted for review");
    router.replace({ pathname: "/business-manage/[id]", params: { id, submitted: "1" } });
  }

  if (!session?.user) {
    return (
      <View style={styles.centered}>
        <Text style={styles.centeredTitle}>Sign in required</Text>
        <Pressable style={styles.primaryButton} onPress={() => router.push("/(auth)/sign-in")}>
          <Text style={styles.primaryButtonText}>Sign In</Text>
        </Pressable>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={tones.brand} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.progressRow}>
        {STEPS.map((s, i) => (
          <View key={s} style={styles.progressCol}>
            <View style={[styles.progressBar, i <= stepIndex && styles.progressBarActive]} />
            <Text style={[styles.progressLabel, i === stepIndex && styles.progressLabelActive]}>{STEP_LABELS[s]}</Text>
          </View>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {step === "details" ? (
          <>
            <Text style={styles.intro}>Tell buyers who you are. You can refine everything later.</Text>
            <Field label="Business name" styles={styles}>
              <TextInput style={styles.input} value={draft.name} onChangeText={(v) => update("name", v)} maxLength={60} placeholder="e.g. Tariro Electronics" placeholderTextColor={tones.textMuted} />
            </Field>
            <Field label="Business type" styles={styles}>
              <View style={styles.rowGap}>
                {BIZ_TYPES.map((t) => (
                  <Pressable key={t.id} style={[styles.typeButton, draft.bizType === t.id && styles.typeButtonActive]} onPress={() => update("bizType", t.id)}>
                    <Text style={[styles.typeButtonLabel, draft.bizType === t.id && styles.typeButtonLabelActive]}>{t.label}</Text>
                    <Text style={styles.typeButtonSub}>{t.sub}</Text>
                  </Pressable>
                ))}
              </View>
            </Field>
            <Field label="Short description" styles={styles}>
              <TextInput style={[styles.input, styles.textArea]} value={draft.description} onChangeText={(v) => update("description", v)} multiline maxLength={300} placeholder="What does your business sell or offer?" placeholderTextColor={tones.textMuted} />
            </Field>
            <Field label="Contact phone" styles={styles}>
              <TextInput style={styles.input} value={draft.phone} onChangeText={(v) => update("phone", v)} keyboardType="phone-pad" placeholder="0771234567" placeholderTextColor={tones.textMuted} />
            </Field>
            <Field label="WhatsApp (optional)" styles={styles}>
              <TextInput style={styles.input} value={draft.whatsapp} onChangeText={(v) => update("whatsapp", v)} keyboardType="phone-pad" placeholder="0771234567" placeholderTextColor={tones.textMuted} />
            </Field>
            <Field label="Contact email (optional)" styles={styles}>
              <TextInput style={styles.input} value={draft.email} onChangeText={(v) => update("email", v)} keyboardType="email-address" autoCapitalize="none" placeholder="you@business.com" placeholderTextColor={tones.textMuted} />
            </Field>
            <ProvinceCityFields
              provinces={PROVINCES}
              citiesByProvince={CITIES_BY_PROVINCE}
              province={draft.province}
              city={draft.city}
              onChange={({ province, city }) => {
                update("province", province);
                update("city", city);
              }}
            />
            <Field label="Suburb / Area (optional)" styles={styles}>
              <TextInput style={styles.input} value={draft.suburb} onChangeText={(v) => update("suburb", v)} placeholder="e.g. Avondale" placeholderTextColor={tones.textMuted} />
            </Field>
            <Pressable style={styles.primaryButton} onPress={goNext}>
              <Text style={styles.primaryButtonText}>Continue</Text>
            </Pressable>
          </>
        ) : null}

        {step === "category" ? (
          <>
            <Text style={styles.intro}>Select all categories that match your business. You can pick more than one.</Text>
            <Text style={styles.selCount}>{draft.categories.length ? `${draft.categories.length} selected` : "None selected yet"}</Text>
            <View style={styles.catGrid}>
              {CATEGORIES.map((c) => {
                const active = draft.categories.includes(c.id);
                return (
                  <Pressable key={c.id} style={[styles.catButton, active && styles.catButtonActive]} onPress={() => toggleCategory(c.id)}>
                    <Text style={[styles.catButtonLabel, active && styles.catButtonLabelActive]}>{c.name}</Text>
                  </Pressable>
                );
              })}
            </View>
            <StepNav onBack={goBack} onNext={goNext} styles={styles} />
          </>
        ) : null}

        {step === "activate" ? (
          <>
            <Text style={styles.intro}>Review your details, then activate to get your business live on PaMarket. You'll start on the Free plan — upgrade any time from Seller Center.</Text>
            <View style={styles.reviewCard}>
              <ReviewRow label="Name" value={draft.name || "—"} styles={styles} />
              <ReviewRow label="Type" value={BIZ_TYPES.find((t) => t.id === draft.bizType)?.label ?? draft.bizType} styles={styles} />
              <ReviewRow label="Categories" value={draft.categories.map((id) => CATEGORIES.find((c) => c.id === id)?.name ?? id).join(", ") || "—"} styles={styles} />
              <ReviewRow label="Phone" value={draft.phone || "—"} styles={styles} />
              <ReviewRow label="Location" value={[draft.suburb, draft.city, draft.province].filter(Boolean).join(", ") || "—"} styles={styles} />
              <ReviewRow label="Plan" value="Free" last styles={styles} />
            </View>
            <View style={styles.rowGap}>
              <View style={[styles.backNavSlot, isSubmitting && styles.disabledNav]}>
                <GlassBackButton onPress={goBack} flat />
              </View>
              <Pressable style={[styles.primaryButton, styles.flexButton]} onPress={activate} disabled={isSubmitting}>
                {isSubmitting ? <ActivityIndicator color={tones.textOnBrand} /> : <Text style={styles.primaryButtonText}>{existingStatus === "active" ? "Save Changes" : "Activate Business"}</Text>}
              </Pressable>
            </View>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

type Styles = ReturnType<typeof buildStyles>;

function Field({ label, children, styles }: { label: string; children: React.ReactNode; styles: Styles }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

function ReviewRow({ label, value, last, styles }: { label: string; value: string; last?: boolean; styles: Styles }) {
  return (
    <View style={[styles.reviewRow, last && { borderBottomWidth: 0 }]}>
      <Text style={styles.reviewRowLabel}>{label}</Text>
      <Text style={styles.reviewRowValue}>{value}</Text>
    </View>
  );
}

function StepNav({ onBack, onNext, styles }: { onBack: () => void; onNext: () => void; styles: Styles }) {
  return (
    <View style={styles.rowGap}>
      <View style={styles.backNavSlot}>
        <GlassBackButton onPress={onBack} flat />
      </View>
      <Pressable style={[styles.primaryButton, styles.flexButton]} onPress={onNext}>
        <Text style={styles.primaryButtonText}>Continue</Text>
      </Pressable>
    </View>
  );
}

function buildTones(color: ColorPalette) {
  return { brand: color.brand, textMuted: color.textMuted, textOnBrand: color.textOnBrand };
}

function buildStyles(color: ColorPalette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: color.surface },
    centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
    centeredTitle: { fontSize: 16, fontWeight: "700", color: color.text, marginBottom: 16 },
    scrollContent: { padding: 16, paddingBottom: 40 },
    progressRow: { flexDirection: "row", gap: 6, paddingHorizontal: 18, paddingTop: 14, paddingBottom: 4 },
    progressCol: { flex: 1, alignItems: "center" },
    progressBar: { height: 5, width: "100%", borderRadius: 4, backgroundColor: color.border },
    progressBarActive: { backgroundColor: color.gold },
    progressLabel: { fontSize: 10.5, fontWeight: "600", color: color.textMuted, marginTop: 5 },
    progressLabelActive: { fontWeight: "800", color: color.brand },
    intro: { fontSize: 13, color: color.textMuted, lineHeight: 19, marginBottom: 16 },
    field: { marginBottom: 14 },
    fieldLabel: { fontSize: 13, fontWeight: "700", color: color.text, marginBottom: 8 },
    input: { borderWidth: 1, borderColor: color.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: color.text },
    textArea: { minHeight: 80, textAlignVertical: "top" },
    rowGap: { flexDirection: "row", gap: 10 },
    typeButton: { flex: 1, padding: 12, borderRadius: 14, borderWidth: 1.5, borderColor: color.border, backgroundColor: color.surface },
    typeButtonActive: { borderColor: color.brand, backgroundColor: color.brandTint },
    typeButtonLabel: { fontSize: 13.5, fontWeight: "800", color: color.text },
    typeButtonLabelActive: { color: color.brand },
    typeButtonSub: { fontSize: 11, color: color.textMuted, marginTop: 2 },
    chipsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: color.border, backgroundColor: color.surface },
    chipActive: { borderColor: color.brand, backgroundColor: color.brand },
    chipText: { fontSize: 12.5, fontWeight: "700", color: color.text },
    chipTextActive: { color: color.textOnBrand },
    selCount: { fontSize: 12, fontWeight: "700", color: color.brand, marginBottom: 12 },
    catGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 18 },
    catButton: { width: "47%", padding: 14, borderRadius: 14, borderWidth: 1.5, borderColor: color.border, backgroundColor: color.surface },
    catButtonActive: { borderColor: color.brand, backgroundColor: color.brandTint },
    catButtonLabel: { fontSize: 13.5, fontWeight: "700", color: color.text },
    catButtonLabelActive: { color: color.brand },
    planCard: { padding: 16, borderRadius: 16, borderWidth: 2, borderColor: color.border, backgroundColor: color.surface, marginBottom: 12 },
    planCardActive: { borderColor: color.brand, backgroundColor: color.brandTint },
    planHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
    planName: { fontSize: 16, fontWeight: "800", color: color.text },
    planNameActive: { color: color.brand },
    planPrice: { fontSize: 15, fontWeight: "800", color: color.brand },
    planTagline: { fontSize: 12, color: color.textMuted, marginBottom: 8 },
    featurePill: { backgroundColor: color.brandTint, borderRadius: 20, paddingHorizontal: 9, paddingVertical: 3 },
    featurePillText: { fontSize: 11, fontWeight: "600", color: color.brand },
    reviewCard: { backgroundColor: color.surface, borderWidth: 1, borderColor: color.border, borderRadius: 16, paddingHorizontal: 16, marginBottom: 18 },
    reviewRow: { flexDirection: "row", justifyContent: "space-between", gap: 12, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: color.border },
    reviewRowLabel: { fontSize: 13, color: color.textMuted },
    reviewRowValue: { fontSize: 13, fontWeight: "700", color: color.text, textAlign: "right", flexShrink: 1 },
    primaryButton: { backgroundColor: color.brand, borderRadius: 10, paddingVertical: 14, alignItems: "center", marginTop: 4 },
    flexButton: { flex: 2, marginTop: 0 },
    primaryButtonText: { color: color.textOnBrand, fontSize: 14, fontWeight: "700" },
    backNavSlot: { flex: 1, justifyContent: "center" },
    disabledNav: { opacity: 0.45, pointerEvents: "none" },
    secondaryButton: { flex: 1, borderRadius: 10, paddingVertical: 14, alignItems: "center", backgroundColor: color.surfaceAlt },
    secondaryButtonText: { fontSize: 14, fontWeight: "700", color: color.text },
  });
}
