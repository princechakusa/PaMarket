import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import { color, font, radius, space, type ColorPalette } from "../../lib/theme";
import { useThemedStyles } from "../../lib/theme-provider";
import { useIOSNativeHeader } from "../../lib/useIOSNativeHeader";
import { Button, Card, Chip } from "../../components/ui";
import { toast } from "../../components/ui/Toast";
import { fetchJobTaxonomy, type JobTaxonomyOption } from "../../lib/jobs";

// Employer/recruiter workspace identity (Phase E) — extends the existing
// recruiter_profiles row (lazily created at first job post/purchase, see
// recruiter-subscription.tsx) with public company fields. Read publicly via
// the job_employer_profiles view (migration 5); written here, owner-only.
export default function CompanyProfileScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const styles = useThemedStyles(buildStyles);
  useIOSNativeHeader({ backgroundColor: color.brand, tintColor: color.textOnBrand, title: "Company Profile", androidNative: true });

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [companyDescription, setCompanyDescription] = useState("");
  const [companyLocation, setCompanyLocation] = useState("");
  const [companyWebsite, setCompanyWebsite] = useState("");
  const [companyIndustryId, setCompanyIndustryId] = useState<string | null>(null);
  const [industries, setIndustries] = useState<JobTaxonomyOption[]>([]);

  const load = useCallback(async () => {
    if (!session?.user) return;
    const { data } = await supabase
      .from("recruiter_profiles")
      .select("company_name,company_description,company_location,company_website,company_industry_id")
      .eq("user_id", session.user.id)
      .maybeSingle();
    if (data) {
      const row = data as Record<string, unknown>;
      setCompanyName((row.company_name as string) || "");
      setCompanyDescription((row.company_description as string) || "");
      setCompanyLocation((row.company_location as string) || "");
      setCompanyWebsite((row.company_website as string) || "");
      setCompanyIndustryId((row.company_industry_id as string) || null);
    }
  }, [session?.user]);

  useEffect(() => {
    setIsLoading(true);
    load().finally(() => setIsLoading(false));
    fetchJobTaxonomy().then((t) => setIndustries(t.industries)).catch(() => {});
  }, [load]);

  async function save() {
    if (!session?.user || isSaving) return;
    setIsSaving(true);
    // Upsert: this row may not exist yet if the recruiter hasn't posted a
    // job or purchased a plan before (see recruiter-subscription.tsx).
    const { error } = await supabase.from("recruiter_profiles").upsert(
      {
        user_id: session.user.id,
        company_name: companyName.trim() || null,
        company_description: companyDescription.trim() || null,
        company_location: companyLocation.trim() || null,
        company_website: companyWebsite.trim() || null,
        company_industry_id: companyIndustryId,
      },
      { onConflict: "user_id" }
    );
    if (error) {
      setIsSaving(false);
      toast("Could not save company profile", 3500, true);
      return;
    }
    // No isSaving reset: a state update in the same tick as router.back()
    // races Fabric's unmount and crashes natively on Android.
    toast("Company profile saved");
    router.back();
  }

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={color.brand} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: space.lg, paddingBottom: 48 }}>
      <Card>
        <Text style={styles.label}>Company name</Text>
        <TextInput style={styles.input} value={companyName} onChangeText={setCompanyName} placeholder="Your company" placeholderTextColor={color.textMuted} />
        <Text style={[styles.label, styles.spaced]}>About the company</Text>
        <TextInput
          style={[styles.input, styles.textarea]}
          value={companyDescription}
          onChangeText={setCompanyDescription}
          placeholder="What your company does, culture, size…"
          placeholderTextColor={color.textMuted}
          multiline
        />
        <Text style={[styles.label, styles.spaced]}>Industry</Text>
        <View style={styles.chipsWrap}>
          {industries.map((ind) => (
            <Chip key={ind.id} label={ind.label} active={companyIndustryId === ind.id} onPress={() => setCompanyIndustryId(companyIndustryId === ind.id ? null : ind.id)} />
          ))}
        </View>
        <Text style={[styles.label, styles.spaced]}>Location</Text>
        <TextInput style={styles.input} value={companyLocation} onChangeText={setCompanyLocation} placeholder="City, Country" placeholderTextColor={color.textMuted} />
        <Text style={[styles.label, styles.spaced]}>Website</Text>
        <TextInput style={styles.input} value={companyWebsite} onChangeText={setCompanyWebsite} placeholder="https://…" placeholderTextColor={color.textMuted} autoCapitalize="none" />
      </Card>
      <Button label={isSaving ? "Saving…" : "Save company profile"} variant="gold" size="lg" loading={isSaving} onPress={save} style={{ marginTop: space.lg }} />
    </ScrollView>
  );
}

function buildStyles(color: ColorPalette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: color.bg },
    centered: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: color.bg },
    label: { ...font.caption, color: color.textSub, marginBottom: space.sm },
    spaced: { marginTop: space.md },
    input: {
      borderWidth: 1.5,
      borderColor: color.border,
      borderRadius: radius.md,
      paddingHorizontal: 13,
      paddingVertical: 12,
      ...font.body,
      color: color.text,
      backgroundColor: color.surface,
    },
    textarea: { minHeight: 90, textAlignVertical: "top" },
    chipsWrap: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  });
}
