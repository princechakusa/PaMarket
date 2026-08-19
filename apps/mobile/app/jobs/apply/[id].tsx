import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../../lib/auth";
import { jobCompany } from "../../../lib/jobs";
import { toast } from "../../../components/ui/Toast";
import { color, type ColorPalette } from "../../../lib/theme";
import { useThemedStyles } from "../../../lib/theme-provider";
import { GlassBackButton } from "../../../components/ui";
import { useIOSNativeHeader } from "../../../lib/useIOSNativeHeader";

type Styles = ReturnType<typeof buildStyles>;

type JobListing = {
  id: string;
  seller_id: string;
  seller_name: string | null;
  title: string;
  description: string | null;
};

// Mirrors www/js/jobs.js H.pages.ApplyJob / H._submitJobApplication, scoped
// down to what public.applications actually stores (id, job_id, job_title,
// company, applicant_id/name/phone/email, message, status, employer_id,
// applied_at — see supabase/schema/applications.sql). The web version's
// screening-question "answers" column isn't in the real schema, so it's
// left out here rather than guessed at.
export default function ApplyJobScreen() {
  const styles = useThemedStyles(buildStyles);
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const insets = useSafeAreaInsets();

  const [job, setJob] = useState<JobListing | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [alreadyApplied, setAlreadyApplied] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");

  useIOSNativeHeader({ backgroundColor: color.brand, tintColor: color.textOnBrand, title: "Apply for this Job" });

  const load = useCallback(async () => {
    if (!id || !session?.user) return;
    const [{ data: jobData }, profileRes, existingRes] = await Promise.all([
      supabase.from("listings").select("id,seller_id,seller_name,title,description").eq("id", id).maybeSingle(),
      supabase.from("profiles").select("name,email,phone").eq("id", session.user.id).maybeSingle(),
      supabase.from("applications").select("id").eq("job_id", id).eq("applicant_id", session.user.id).maybeSingle(),
    ]);
    setJob((jobData as JobListing) ?? null);
    const p = profileRes.data as { name: string | null; email: string | null; phone: string | null } | null;
    setName(p?.name || "");
    setEmail(p?.email || session.user.email || "");
    setPhone(p?.phone || "");
    setAlreadyApplied(!!existingRes.data);
  }, [id, session]);

  useEffect(() => {
    setIsLoading(true);
    load().finally(() => setIsLoading(false));
  }, [load]);

  async function submit() {
    if (!session?.user || !job) return;
    if (!name.trim()) {
      toast("Please enter your full name");
      return;
    }
    if (!email.trim()) {
      toast("Please enter your email address");
      return;
    }
    if (!phone.trim()) {
      toast("Please enter your phone number");
      return;
    }
    setIsSubmitting(true);
    const company = jobCompany(job.description, job.seller_name) || "Company";
    const { error } = await supabase.from("applications").insert({
      job_id: job.id,
      job_title: job.title,
      company,
      applicant_id: session.user.id,
      applicant_name: name.trim(),
      applicant_phone: phone.trim(),
      applicant_email: email.trim(),
      message: message.trim(),
      status: "pending",
      employer_id: job.seller_id,
    });
    setIsSubmitting(false);
    if (error) {
      if (error.code === "23505") {
        toast("You already applied for this job");
        router.back();
        return;
      }
      if (/rate_limited:/i.test(error.message)) {
        toast("You've submitted several applications recently. Please wait a little before applying again.", 3500, true);
        return;
      }
      toast("Could not submit your application");
      return;
    }
    toast("Application submitted! The employer will be in touch.");
    router.back();
  }

  if (isLoading) {
    return (
      <View style={{ flex: 1 }}>
        {Platform.OS !== "ios" ? (
          <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
            <GlassBackButton onPress={() => router.back()} tone="light" flat />
          </View>
        ) : null}
        <View style={styles.centered}>
          <ActivityIndicator color={color.brand} />
        </View>
      </View>
    );
  }

  if (!job) {
    return (
      <View style={{ flex: 1 }}>
        {Platform.OS !== "ios" ? (
          <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
            <GlassBackButton onPress={() => router.back()} tone="light" flat />
          </View>
        ) : null}
        <View style={styles.centered}>
          <Text style={styles.notFoundText}>Job not found</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {Platform.OS !== "ios" ? (
        <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
          <GlassBackButton onPress={() => router.back()} tone="light" flat />
          <Text style={styles.headerTitle} numberOfLines={1}>
            Apply for this Job
          </Text>
          <View style={{ width: 20 }} />
        </View>
      ) : null}

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 110 }} keyboardShouldPersistTaps="handled">
        <View style={styles.jobCard}>
          <Text style={styles.jobTitle} numberOfLines={1}>
            {job.title}
          </Text>
          <Text style={styles.jobCompany}>{jobCompany(job.description, job.seller_name)}</Text>
        </View>

        {alreadyApplied ? (
          <View style={styles.appliedBanner}>
            <Text style={styles.appliedBannerText}>You already applied for this job.</Text>
          </View>
        ) : (
          <>
            <Text style={styles.sectionLabel}>About you</Text>
            <Field label="Full name" required value={name} onChangeText={setName} placeholder="e.g. Tendai Moyo" styles={styles} />
            <Field label="Email address" required value={email} onChangeText={setEmail} placeholder="you@gmail.com" keyboardType="email-address" styles={styles} />
            <Field label="Phone number" required value={phone} onChangeText={setPhone} placeholder="077 123 4567" keyboardType="phone-pad" styles={styles} />

            <Text style={styles.sectionLabel}>Why are you a good fit?</Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              value={message}
              onChangeText={setMessage}
              placeholder="Tell the employer a bit about yourself — optional but recommended."
              placeholderTextColor={color.textMuted}
              multiline
              numberOfLines={4}
            />
          </>
        )}
      </ScrollView>

      {!alreadyApplied && (
        <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
          <Pressable style={[styles.submitButton, isSubmitting && { opacity: 0.6 }]} onPress={submit} disabled={isSubmitting}>
            <Text style={styles.submitButtonText}>{isSubmitting ? "Submitting…" : "Submit Application"}</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  required,
  keyboardType,
  styles,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  required?: boolean;
  keyboardType?: "email-address" | "phone-pad";
  styles: Styles;
}) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={styles.label}>
        {label}
        {required ? <Text style={{ color: color.danger }}> *</Text> : null}
      </Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={color.textMuted}
        keyboardType={keyboardType}
        autoCapitalize={keyboardType === "email-address" ? "none" : "words"}
      />
    </View>
  );
}

function buildStyles(color: ColorPalette) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: color.bg },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  notFoundText: { fontSize: 15, fontWeight: "600", color: color.text },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    backgroundColor: color.brand,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerTitle: { flex: 1, fontSize: 15, fontWeight: "700", color: color.textOnBrand, textAlign: "center" },
  jobCard: { backgroundColor: color.surface, borderRadius: 14, padding: 14, marginBottom: 16 },
  jobTitle: { fontSize: 15, fontWeight: "700", color: color.text },
  jobCompany: { fontSize: 13, color: color.textSub, marginTop: 3 },
  appliedBanner: { backgroundColor: color.brandTint, borderRadius: 12, padding: 16, alignItems: "center" },
  appliedBannerText: { fontSize: 14, fontWeight: "600", color: color.brand },
  sectionLabel: { fontSize: 13, fontWeight: "700", color: color.text, marginTop: 8, marginBottom: 12 },
  label: { fontSize: 12.5, fontWeight: "700", color: color.text, marginBottom: 7 },
  input: {
    borderWidth: 1.5,
    borderColor: color.border,
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 12,
    fontSize: 14,
    color: color.text,
    backgroundColor: color.surface,
  },
  textarea: { minHeight: 100, textAlignVertical: "top" },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: color.surface,
    borderTopWidth: 1,
    borderTopColor: color.divider,
    padding: 12,
  },
  submitButton: { backgroundColor: color.gold, borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  submitButtonText: { fontSize: 15, fontWeight: "700", color: "#ffffff" },
  });
}
