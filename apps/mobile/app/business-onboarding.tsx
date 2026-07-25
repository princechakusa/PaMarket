import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { toast } from "../components/ui/Toast";
import { BRAND_BLUE, BRAND_GOLD, CATEGORIES, PROVINCES, CITIES_BY_PROVINCE } from "../lib/constants";
import type { Business } from "../lib/businesses";

// Mirrors www/js/business-onboarding.js STEPS. Payment/subscription is
// deferred (Play Billing out of scope) — the wizard only ever submits the
// Free plan; picking a paid plan just shows "Coming soon".
const STEPS = ["details", "category", "plan", "activate"] as const;
type Step = (typeof STEPS)[number];
const STEP_LABELS: Record<Step, string> = { details: "Details", category: "Category", plan: "Plan", activate: "Activate" };

const BIZ_PLANS = [
  { id: "free", name: "Free", price: 0, tagline: "Get started", features: ["Up to 3 listings", "Basic visibility"] },
  { id: "starter", name: "Starter", price: 9.99, tagline: "For small sellers", features: ["Up to 15 listings", "Standard ranking"] },
  { id: "pro", name: "Pro", price: 19.99, tagline: "Grow faster", features: ["Up to 60 listings", "Higher ranking"] },
  { id: "premium", name: "Premium", price: 29.99, tagline: "Maximum reach", features: ["Unlimited listings", "Top ranking"] },
];

const BIZ_TYPES = [
  { id: "individual", label: "Individual", sub: "Sole trader / personal" },
  { id: "company", label: "Company", sub: "Registered business" },
  { id: "agency", label: "Agency", sub: "Multi-client agency" },
];

// Affinity groups — a business may only pick categories from ONE
// non-universal group. Mirrors H.BIZ_CAT_GROUPS / H.bizCatCompat.
const CAT_GROUPS = [
  { id: "home", cats: ["property", "furniture", "rooms"] },
  { id: "transport", cats: ["vehicles"] },
  { id: "style", cats: ["fashion", "kids", "electronics"] },
  { id: "nature", cats: ["agriculture", "pets"] },
  { id: "work", cats: ["jobs"] },
  { id: "universal", cats: ["services", "other"] },
];

function catCompat(existing: string[], newCat: string): { ok: boolean; msg?: string } {
  const univ = CAT_GROUPS.find((g) => g.id === "universal")?.cats ?? [];
  if (univ.includes(newCat)) return { ok: true };
  const newGroup = CAT_GROUPS.find((g) => g.id !== "universal" && g.cats.includes(newCat));
  if (!newGroup) return { ok: true };
  const usedGroupIds = new Set(
    existing
      .filter((c) => !univ.includes(c))
      .map((c) => CAT_GROUPS.find((g) => g.id !== "universal" && g.cats.includes(c))?.id)
      .filter(Boolean)
  );
  if (usedGroupIds.size === 0 || usedGroupIds.has(newGroup.id)) return { ok: true };
  return { ok: false, msg: "That category doesn't match your other categories. Choose categories from the same type of business." };
}

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
    planId: "",
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
    } else {
      setDraft(blankDraft(undefined, session.user.email ?? undefined));
    }
  }, [session]);

  useEffect(() => {
    setIsLoading(true);
    load().finally(() => setIsLoading(false));
  }, [load]);

  const cities = useMemo(() => CITIES_BY_PROVINCE[draft.province] ?? [], [draft.province]);
  const stepIndex = STEPS.indexOf(step);

  function update<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function toggleCategory(catId: string) {
    setDraft((d) => {
      const has = d.categories.includes(catId);
      if (has) return { ...d, categories: d.categories.filter((c) => c !== catId) };
      const check = catCompat(d.categories, catId);
      if (!check.ok) {
        toast(check.msg!);
        return d;
      }
      return { ...d, categories: [...d.categories, catId] };
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
      if (!draft.province || !draft.city) { toast("Select your province and city"); return; }
      setStep("category");
    } else if (step === "category") {
      if (!draft.categories.length) { toast("Pick at least one category"); return; }
      setStep("plan");
    } else if (step === "plan") {
      if (!draft.planId) { toast("Select a plan to continue"); return; }
      setStep("activate");
    }
  }

  function goBack() {
    const i = STEPS.indexOf(step);
    if (i > 0) setStep(STEPS[i - 1]);
    else router.back();
  }

  function selectPlan(planId: string) {
    if (planId !== "free") {
      // Paid plans activate only through a verified Google Play purchase —
      // that native IAP flow is explicitly deferred in this migration.
      Alert.alert("Paid Plans", "Coming soon. Continue with the Free plan for now — you can upgrade later.");
      return;
    }
    update("planId", planId);
  }

  async function activate() {
    if (!draft.name || !draft.phone || !draft.province || !draft.city) { setStep("details"); return; }
    if (!draft.categories.length) { setStep("category"); return; }
    if (!draft.planId) { setStep("plan"); return; }

    setIsSubmitting(true);
    // New businesses go to pending_activation for admin review; editing an
    // already-active business (existingStatus === 'active') stays active.
    const status = existingStatus === "active" ? "active" : "pending_activation";
    const id = await persist(status);
    setIsSubmitting(false);
    if (!id) return;

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
        <ActivityIndicator color={BRAND_BLUE} />
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
            <Field label="Business name">
              <TextInput style={styles.input} value={draft.name} onChangeText={(v) => update("name", v)} maxLength={60} placeholder="e.g. Tariro Electronics" placeholderTextColor="#8A93A6" />
            </Field>
            <Field label="Business type">
              <View style={styles.rowGap}>
                {BIZ_TYPES.map((t) => (
                  <Pressable key={t.id} style={[styles.typeButton, draft.bizType === t.id && styles.typeButtonActive]} onPress={() => update("bizType", t.id)}>
                    <Text style={[styles.typeButtonLabel, draft.bizType === t.id && styles.typeButtonLabelActive]}>{t.label}</Text>
                    <Text style={styles.typeButtonSub}>{t.sub}</Text>
                  </Pressable>
                ))}
              </View>
            </Field>
            <Field label="Short description">
              <TextInput style={[styles.input, styles.textArea]} value={draft.description} onChangeText={(v) => update("description", v)} multiline maxLength={300} placeholder="What does your business sell or offer?" placeholderTextColor="#8A93A6" />
            </Field>
            <Field label="Contact phone">
              <TextInput style={styles.input} value={draft.phone} onChangeText={(v) => update("phone", v)} keyboardType="phone-pad" placeholder="0771234567" placeholderTextColor="#8A93A6" />
            </Field>
            <Field label="WhatsApp (optional)">
              <TextInput style={styles.input} value={draft.whatsapp} onChangeText={(v) => update("whatsapp", v)} keyboardType="phone-pad" placeholder="0771234567" placeholderTextColor="#8A93A6" />
            </Field>
            <Field label="Contact email (optional)">
              <TextInput style={styles.input} value={draft.email} onChangeText={(v) => update("email", v)} keyboardType="email-address" autoCapitalize="none" placeholder="you@business.com" placeholderTextColor="#8A93A6" />
            </Field>
            <Field label="Province">
              <View style={styles.chipsWrap}>
                {PROVINCES.map((p) => (
                  <Pressable key={p} style={[styles.chip, draft.province === p && styles.chipActive]} onPress={() => { update("province", p); update("city", ""); }}>
                    <Text style={[styles.chipText, draft.province === p && styles.chipTextActive]}>{p}</Text>
                  </Pressable>
                ))}
              </View>
            </Field>
            {draft.province ? (
              <Field label="City / Town">
                <View style={styles.chipsWrap}>
                  {cities.map((c) => (
                    <Pressable key={c} style={[styles.chip, draft.city === c && styles.chipActive]} onPress={() => update("city", c)}>
                      <Text style={[styles.chipText, draft.city === c && styles.chipTextActive]}>{c}</Text>
                    </Pressable>
                  ))}
                </View>
              </Field>
            ) : null}
            <Field label="Suburb / Area (optional)">
              <TextInput style={styles.input} value={draft.suburb} onChangeText={(v) => update("suburb", v)} placeholder="e.g. Avondale" placeholderTextColor="#8A93A6" />
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
            <StepNav onBack={goBack} onNext={goNext} />
          </>
        ) : null}

        {step === "plan" ? (
          <>
            <Text style={styles.intro}>Choose a plan to activate your business. Even the Free plan must be selected to go live.</Text>
            {BIZ_PLANS.map((p) => {
              const sel = draft.planId === p.id;
              return (
                <Pressable key={p.id} style={[styles.planCard, sel && styles.planCardActive]} onPress={() => selectPlan(p.id)}>
                  <View style={styles.planHeaderRow}>
                    <Text style={[styles.planName, sel && styles.planNameActive]}>{p.name}</Text>
                    <Text style={styles.planPrice}>{p.price === 0 ? "Free" : `$${p.price}/mo`}</Text>
                  </View>
                  <Text style={styles.planTagline}>{p.tagline}{p.price > 0 ? " · Coming soon" : ""}</Text>
                  <View style={styles.chipsWrap}>
                    {p.features.map((f) => (
                      <View key={f} style={styles.featurePill}>
                        <Text style={styles.featurePillText}>{f}</Text>
                      </View>
                    ))}
                  </View>
                </Pressable>
              );
            })}
            <StepNav onBack={goBack} onNext={goNext} />
          </>
        ) : null}

        {step === "activate" ? (
          <>
            <Text style={styles.intro}>Review your details, then activate to get your business live on PaMarket.</Text>
            <View style={styles.reviewCard}>
              <ReviewRow label="Name" value={draft.name || "—"} />
              <ReviewRow label="Type" value={BIZ_TYPES.find((t) => t.id === draft.bizType)?.label ?? draft.bizType} />
              <ReviewRow label="Categories" value={draft.categories.map((id) => CATEGORIES.find((c) => c.id === id)?.name ?? id).join(", ") || "—"} />
              <ReviewRow label="Phone" value={draft.phone || "—"} />
              <ReviewRow label="Location" value={[draft.suburb, draft.city, draft.province].filter(Boolean).join(", ") || "—"} />
              <ReviewRow label="Plan" value={BIZ_PLANS.find((p) => p.id === draft.planId)?.name ?? "—"} last />
            </View>
            <View style={styles.rowGap}>
              <Pressable style={styles.secondaryButton} onPress={goBack} disabled={isSubmitting}>
                <Text style={styles.secondaryButtonText}>Back</Text>
              </Pressable>
              <Pressable style={[styles.primaryButton, styles.flexButton]} onPress={activate} disabled={isSubmitting}>
                {isSubmitting ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.primaryButtonText}>{existingStatus === "active" ? "Save Changes" : "Activate Business"}</Text>}
              </Pressable>
            </View>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

function ReviewRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.reviewRow, last && { borderBottomWidth: 0 }]}>
      <Text style={styles.reviewRowLabel}>{label}</Text>
      <Text style={styles.reviewRowValue}>{value}</Text>
    </View>
  );
}

function StepNav({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  return (
    <View style={styles.rowGap}>
      <Pressable style={styles.secondaryButton} onPress={onBack}>
        <Text style={styles.secondaryButtonText}>Back</Text>
      </Pressable>
      <Pressable style={[styles.primaryButton, styles.flexButton]} onPress={onNext}>
        <Text style={styles.primaryButtonText}>Continue</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#ffffff" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  centeredTitle: { fontSize: 16, fontWeight: "700", color: "#111827", marginBottom: 16 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  progressRow: { flexDirection: "row", gap: 6, paddingHorizontal: 18, paddingTop: 14, paddingBottom: 4 },
  progressCol: { flex: 1, alignItems: "center" },
  progressBar: { height: 5, width: "100%", borderRadius: 4, backgroundColor: "#E8ECF4" },
  progressBarActive: { backgroundColor: BRAND_GOLD },
  progressLabel: { fontSize: 10.5, fontWeight: "600", color: "#8A93A6", marginTop: 5 },
  progressLabelActive: { fontWeight: "800", color: BRAND_BLUE },
  intro: { fontSize: 13, color: "#8A93A6", lineHeight: 19, marginBottom: 16 },
  field: { marginBottom: 14 },
  fieldLabel: { fontSize: 13, fontWeight: "700", color: "#111827", marginBottom: 8 },
  input: { borderWidth: 1, borderColor: "#D8DCE5", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: "#111827" },
  textArea: { minHeight: 80, textAlignVertical: "top" },
  rowGap: { flexDirection: "row", gap: 10 },
  typeButton: { flex: 1, padding: 12, borderRadius: 14, borderWidth: 1.5, borderColor: "#E8ECF4", backgroundColor: "#ffffff" },
  typeButtonActive: { borderColor: BRAND_BLUE, backgroundColor: "#EEF2FB" },
  typeButtonLabel: { fontSize: 13.5, fontWeight: "800", color: "#111827" },
  typeButtonLabelActive: { color: BRAND_BLUE },
  typeButtonSub: { fontSize: 11, color: "#8A93A6", marginTop: 2 },
  chipsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: "#E8ECF4", backgroundColor: "#ffffff" },
  chipActive: { borderColor: BRAND_BLUE, backgroundColor: BRAND_BLUE },
  chipText: { fontSize: 12.5, fontWeight: "700", color: "#111827" },
  chipTextActive: { color: "#ffffff" },
  selCount: { fontSize: 12, fontWeight: "700", color: BRAND_BLUE, marginBottom: 12 },
  catGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 18 },
  catButton: { width: "47%", padding: 14, borderRadius: 14, borderWidth: 1.5, borderColor: "#E8ECF4", backgroundColor: "#ffffff" },
  catButtonActive: { borderColor: BRAND_BLUE, backgroundColor: "#EEF2FB" },
  catButtonLabel: { fontSize: 13.5, fontWeight: "700", color: "#111827" },
  catButtonLabelActive: { color: BRAND_BLUE },
  planCard: { padding: 16, borderRadius: 16, borderWidth: 2, borderColor: "#E8ECF4", backgroundColor: "#ffffff", marginBottom: 12 },
  planCardActive: { borderColor: BRAND_BLUE, backgroundColor: "#EEF2FB" },
  planHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  planName: { fontSize: 16, fontWeight: "800", color: "#111827" },
  planNameActive: { color: BRAND_BLUE },
  planPrice: { fontSize: 15, fontWeight: "800", color: BRAND_BLUE },
  planTagline: { fontSize: 12, color: "#8A93A6", marginBottom: 8 },
  featurePill: { backgroundColor: "rgba(26,58,143,0.07)", borderRadius: 20, paddingHorizontal: 9, paddingVertical: 3 },
  featurePillText: { fontSize: 11, fontWeight: "600", color: BRAND_BLUE },
  reviewCard: { backgroundColor: "#ffffff", borderWidth: 1, borderColor: "#E8ECF4", borderRadius: 16, paddingHorizontal: 16, marginBottom: 18 },
  reviewRow: { flexDirection: "row", justifyContent: "space-between", gap: 12, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: "#E8ECF4" },
  reviewRowLabel: { fontSize: 13, color: "#8A93A6" },
  reviewRowValue: { fontSize: 13, fontWeight: "700", color: "#111827", textAlign: "right", flexShrink: 1 },
  primaryButton: { backgroundColor: BRAND_BLUE, borderRadius: 10, paddingVertical: 14, alignItems: "center", marginTop: 4 },
  flexButton: { flex: 2, marginTop: 0 },
  primaryButtonText: { color: "#ffffff", fontSize: 14, fontWeight: "700" },
  secondaryButton: { flex: 1, borderRadius: 10, paddingVertical: 14, alignItems: "center", backgroundColor: "#F5F6F9" },
  secondaryButtonText: { fontSize: 14, fontWeight: "700", color: "#111827" },
});
