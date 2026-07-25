import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Polyline } from "react-native-svg";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../../lib/auth";
import { BRAND_BLUE, BRAND_GOLD } from "../../../lib/constants";
import { JOB_CATEGORIES, JOB_TYPES, parseJobField } from "../../../lib/jobs";
import { toast } from "../../../components/ui/Toast";
import { EmptyState } from "../../../components/ui/EmptyState";

function BackIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth={2.4}>
      <Polyline points="15 18 9 12 15 6" />
    </Svg>
  );
}

const SALARY_RE = /^(\d+(\.\d+)?(\s*-\s*\d+(\.\d+)?)?|negotiable|competitive|tbd)$/i;

// Splits the KEY: value encoded description back into its named sections,
// mirroring www/js/jobs.js H.pages.EditJob's indexOf-based parsing exactly
// (DESCRIPTION: / RESPONSIBILITIES: / REQUIREMENTS: / HOW TO APPLY:).
function parseSections(d: string) {
  const descS = d.indexOf("\nDESCRIPTION:\n");
  const respS = d.indexOf("\nRESPONSIBILITIES:\n");
  const reqS = d.indexOf("\nREQUIREMENTS:\n");
  const applyS = d.indexOf("\nHOW TO APPLY:");
  const nextAfter = (pos: number) =>
    [respS, reqS, applyS, d.length].filter((x) => x > pos).sort((a, b) => a - b)[0];
  const description = descS > -1 ? d.slice(descS + 14, nextAfter(descS)).trim() : "";
  const responsibilities = respS > -1 ? d.slice(respS + 19, nextAfter(respS)).trim() : "";
  const requirements = reqS > -1 ? d.slice(reqS + 15, nextAfter(reqS)).trim() : "";
  const applySection = applyS > -1 ? d.slice(applyS + 14).trim() : "";
  const emailMatch = applySection.match(/Email:\s*(.+)/);
  const phoneMatch = applySection.match(/WhatsApp:\s*(.+)/);
  return {
    description,
    responsibilities,
    requirements,
    email: emailMatch ? emailMatch[1].trim() : "",
    phone: phoneMatch ? phoneMatch[1].trim() : "",
  };
}

function buildDescription(opts: {
  company: string;
  jobType: string;
  category: string;
  salary: string;
  description: string;
  responsibilities: string;
  requirements: string;
  email: string;
  phone: string;
}) {
  let d =
    `COMPANY: ${opts.company}\nJOB TYPE: ${opts.jobType}\nINDUSTRY: ${opts.category}\nSALARY: ${opts.salary}` +
    `\n\nDESCRIPTION:\n${opts.description}`;
  if (opts.responsibilities) d += `\n\nRESPONSIBILITIES:\n${opts.responsibilities}`;
  if (opts.requirements) d += `\n\nREQUIREMENTS:\n${opts.requirements}`;
  if (opts.email || opts.phone) {
    d += `\n\nHOW TO APPLY:\n${opts.email ? `Email: ${opts.email}\n` : ""}${opts.phone ? `WhatsApp: ${opts.phone}` : ""}`;
  }
  return d;
}

// Mirrors www/js/jobs.js H.pages.EditJob / H._updateJob. RLS on
// public.listings ("listings: own update") already restricts writes to
// seller_id = auth.uid(), so the ownership check here is defense-in-depth /
// UX, not the security boundary.
export default function EditJobScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const insets = useSafeAreaInsets();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const [company, setCompany] = useState("");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [city, setCity] = useState("");
  const [jobType, setJobType] = useState<string>(JOB_TYPES[0]);
  const [salary, setSalary] = useState("");
  const [description, setDescription] = useState("");
  const [requirements, setRequirements] = useState("");
  const [responsibilities, setResponsibilities] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const load = useCallback(async () => {
    if (!id || !session?.user) return;
    const { data } = await supabase
      .from("listings")
      .select("id,seller_id,seller_name,title,description,city,province")
      .eq("id", id)
      .maybeSingle();
    if (!data || data.seller_id !== session.user.id) {
      setNotFound(true);
      return;
    }
    const desc = data.description || "";
    setCompany(parseJobField(desc, "COMPANY") || data.seller_name || "");
    setTitle(data.title || "");
    setCategory(parseJobField(desc, "INDUSTRY") || "");
    setCity(data.city || "");
    setJobType(parseJobField(desc, "JOB TYPE") || JOB_TYPES[0]);
    setSalary(parseJobField(desc, "SALARY") || "");
    const sections = parseSections(desc);
    setDescription(sections.description);
    setRequirements(sections.requirements);
    setResponsibilities(sections.responsibilities);
    setEmail(sections.email);
    setPhone(sections.phone);
  }, [id, session]);

  useEffect(() => {
    setIsLoading(true);
    load().finally(() => setIsLoading(false));
  }, [load]);

  async function save() {
    if (!id || !session?.user) return;
    if (!company.trim()) return toast("Company name is required");
    if (!title.trim()) return toast("Job title is required");
    if (!category) return toast("Please select a job category");
    if (!city.trim()) return toast("Please enter a city / town");
    if (description.trim().length < 30) return toast("Please write a job description (min 30 chars)");
    const salaryRaw = salary.trim();
    if (salaryRaw && !SALARY_RE.test(salaryRaw)) return toast('Enter a valid salary amount or "Negotiable"');

    setIsSaving(true);
    const finalSalary = salaryRaw || "Negotiable";
    const fullDescription = buildDescription({
      company: company.trim(),
      jobType,
      category,
      salary: finalSalary,
      description: description.trim(),
      responsibilities: responsibilities.trim(),
      requirements: requirements.trim(),
      email: email.trim(),
      phone: phone.trim(),
    });

    const { error } = await supabase
      .from("listings")
      .update({
        title: title.trim(),
        seller_name: company.trim(),
        description: fullDescription,
        price: parseFloat(finalSalary) || 0,
        city: city.trim(),
        province: city.trim(),
      })
      .eq("id", id)
      .eq("seller_id", session.user.id);

    setIsSaving(false);
    if (error) {
      toast("Could not save changes");
      return;
    }
    toast("Job updated!");
    router.back();
  }

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={BRAND_BLUE} />
      </View>
    );
  }

  if (notFound) {
    return (
      <View style={styles.centered}>
        <EmptyState title="Job not found" subtitle="This posting may have been removed." />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <BackIcon />
        </Pressable>
        <Text style={styles.headerTitle}>Edit Job</Text>
        <View style={{ width: 20 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }} keyboardShouldPersistTaps="handled">
        <Field label="Company Name *" value={company} onChangeText={setCompany} placeholder="Your company or organisation name" />
        <Field label="Job Title *" value={title} onChangeText={setTitle} placeholder="e.g. Accountant, Driver, Sales Representative" />

        <Text style={styles.label}>Job Category *</Text>
        <View style={styles.chipsWrap}>
          {JOB_CATEGORIES.map((c) => (
            <Pressable key={c} style={[styles.chip, category === c && styles.chipActive]} onPress={() => setCategory(c)}>
              <Text style={[styles.chipText, category === c && styles.chipTextActive]}>{c}</Text>
            </Pressable>
          ))}
        </View>

        <Field label="City / Town *" value={city} onChangeText={setCity} placeholder="e.g. Harare, or Remote" />

        <Text style={styles.label}>Job Type</Text>
        <View style={styles.chipsWrap}>
          {JOB_TYPES.map((t) => (
            <Pressable key={t} style={[styles.chip, jobType === t && styles.chipActive]} onPress={() => setJobType(t)}>
              <Text style={[styles.chipText, jobType === t && styles.chipTextActive]}>{t}</Text>
            </Pressable>
          ))}
        </View>

        <Field label="Salary (USD)" value={salary} onChangeText={setSalary} placeholder="e.g. 500, 500-1000, or Negotiable" />

        <Text style={styles.label}>Job Description *</Text>
        <TextInput
          style={[styles.input, styles.textarea]}
          value={description}
          onChangeText={setDescription}
          placeholder="Describe the role, responsibilities, company culture…"
          placeholderTextColor="#9CA3AF"
          multiline
          numberOfLines={6}
        />

        <Text style={styles.label}>Requirements & Qualifications</Text>
        <TextInput
          style={[styles.input, styles.textarea]}
          value={requirements}
          onChangeText={setRequirements}
          placeholder="List qualifications, experience, skills required…"
          placeholderTextColor="#9CA3AF"
          multiline
          numberOfLines={4}
        />

        <Text style={styles.label}>Key Responsibilities</Text>
        <TextInput
          style={[styles.input, styles.textarea]}
          value={responsibilities}
          onChangeText={setResponsibilities}
          placeholder="List the main duties and responsibilities…"
          placeholderTextColor="#9CA3AF"
          multiline
          numberOfLines={4}
        />

        <Field label="Application Email" value={email} onChangeText={setEmail} placeholder="Email to receive applications" />
        <Field label="WhatsApp Number" value={phone} onChangeText={setPhone} placeholder="e.g. +263771234567" />

        <Pressable style={[styles.submitButton, isSaving && { opacity: 0.6 }]} onPress={save} disabled={isSaving}>
          <Text style={styles.submitButtonText}>{isSaving ? "Saving…" : "Save Changes"}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
}) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9CA3AF"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F6F9" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: BRAND_BLUE,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerTitle: { fontSize: 17, fontWeight: "700", color: "#ffffff" },
  label: { fontSize: 12, fontWeight: "700", color: "#111827", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 },
  input: {
    backgroundColor: "#ffffff",
    borderWidth: 1.5,
    borderColor: "#E8ECF4",
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 12,
    fontSize: 14,
    color: "#111827",
    marginBottom: 14,
  },
  textarea: { minHeight: 90, textAlignVertical: "top" },
  chipsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 13,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "#E8ECF4",
    backgroundColor: "#ffffff",
  },
  chipActive: { backgroundColor: BRAND_BLUE, borderColor: BRAND_BLUE },
  chipText: { fontSize: 12.5, fontWeight: "600", color: "#111827" },
  chipTextActive: { color: "#ffffff" },
  submitButton: { backgroundColor: BRAND_GOLD, borderRadius: 14, paddingVertical: 15, alignItems: "center", marginTop: 6 },
  submitButtonText: { color: "#ffffff", fontSize: 15, fontWeight: "800" },
});
