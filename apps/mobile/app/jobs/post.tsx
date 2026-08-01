import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path, Polyline } from "react-native-svg";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import { CITIES_BY_PROVINCE, PROVINCES } from "../../lib/constants";
import { color, font, radius, shadow, space, type ColorPalette } from "../../lib/theme";
import { useThemedStyles } from "../../lib/theme-provider";
import { JOB_CATEGORIES, JOB_TYPES, recruiterPlanEntitlements } from "../../lib/jobs";
import { friendlyError } from "../../lib/safety";
import { JOB_CREDIT_PRODUCTS } from "../../lib/billing-products";
import { purchaseProduct } from "../../lib/iap";
import { Badge, Button, Card, Chip, GlassBackButton, SectionHeader } from "../../components/ui";
import { toast } from "../../components/ui/Toast";

function ShieldIcon() {
  return (
    <Svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke={color.brand} strokeWidth={2}>
      <Path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <Polyline points="9 12 11 14 15 10" />
    </Svg>
  );
}

const SALARY_RE = /^(\d+(\.\d+)?(\s*-\s*\d+(\.\d+)?)?|negotiable|competitive|tbd)$/i;

// listings.currency has a check constraint of ('USD','ZiG') — see
// supabase/schema/listings.sql. Never send anything else.
const CURRENCIES = ["USD", "ZiG"] as const;

// Experience levels mirror profiles.exp keys used by cv-profile.tsx so the
// employer's requirement and the candidate's self-rating speak the same
// language. Stored as the human label inside the EXPERIENCE: description line.
const EXPERIENCE_LEVELS = [
  "Entry Level (0-2 yrs)",
  "3-5 Years",
  "5-10 Years",
  "10+ Years",
];

// Builds the KEY: value encoded description exactly like www/js/jobs.js
// H._submitJob / H._updateJob — job-specific fields are NOT separate DB
// columns, they live inside listings.description as plain-text lines.
function buildDescription(opts: {
  company: string;
  jobType: string;
  category: string;
  salary: string;
  experience: string;
  skills: string[];
  description: string;
  responsibilities: string;
  requirements: string;
  email: string;
  phone: string;
}) {
  let d =
    `COMPANY: ${opts.company}\nJOB TYPE: ${opts.jobType}\nINDUSTRY: ${opts.category}\nSALARY: ${opts.salary}`;
  if (opts.experience) d += `\nEXPERIENCE: ${opts.experience}`;
  if (opts.skills.length) d += `\nSKILLS: ${opts.skills.join(", ")}`;
  d += `\n\nDESCRIPTION:\n${opts.description}`;
  if (opts.responsibilities) d += `\n\nRESPONSIBILITIES:\n${opts.responsibilities}`;
  if (opts.requirements) d += `\n\nREQUIREMENTS:\n${opts.requirements}`;
  if (opts.email || opts.phone) {
    d += `\n\nHOW TO APPLY:\n${opts.email ? `Email: ${opts.email}\n` : ""}${opts.phone ? `WhatsApp: ${opts.phone}` : ""}`;
  }
  return d;
}

// Mirrors www/js/jobs.js H.pages.PostJob — dedicated job posting flow, not
// the generic listing wizard, since jobs need company/job-type/salary
// fields the generic post flow doesn't collect. Gated on the same
// company_verified check as company-verify.tsx (posting jobs requires
// verification "to protect job seekers from fraudulent listings").
// Job credits / recruiter-plan enforcement (H.recruiterPlanEntitlements,
// spend_job_credit RPC) is Google Play Billing-gated and deferred — this
// screen always allows posting, matching how a Free-plan recruiter with
// posts remaining behaves today.
export default function PostJobScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const insets = useSafeAreaInsets();
  const styles = useThemedStyles(buildStyles);

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [verified, setVerified] = useState(false);
  const [pending, setPending] = useState(false);

  const [company, setCompany] = useState("");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [province, setProvince] = useState("");
  const [city, setCity] = useState("");
  const [jobType, setJobType] = useState<string>(JOB_TYPES[0]);
  const [experience, setExperience] = useState("");
  const [salary, setSalary] = useState("");
  const [currency, setCurrency] = useState<string>("USD");
  const [skills, setSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState("");
  const [description, setDescription] = useState("");
  const [requirements, setRequirements] = useState("");
  const [responsibilities, setResponsibilities] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const [planId, setPlanId] = useState("free");
  const [activeJobPosts, setActiveJobPosts] = useState(0);
  const [creditBalance, setCreditBalance] = useState(0);
  const [creditPickerOpen, setCreditPickerOpen] = useState(false);
  const [purchasingCredit, setPurchasingCredit] = useState<string | null>(null);

  const refreshCredits = useCallback(async () => {
    const { data } = await supabase.rpc("get_job_credit_balance");
    if (typeof data === "number") setCreditBalance(data);
  }, []);

  const load = useCallback(async () => {
    if (!session?.user) return;
    const [{ data }, { data: recruiterProfile }, { count }] = await Promise.all([
      supabase
        .from("profiles")
        .select("company,company_verified,company_verification_pending,name,email,phone,city")
        .eq("id", session.user.id)
        .maybeSingle(),
      supabase.from("recruiter_profiles").select("plan_id").eq("user_id", session.user.id).maybeSingle(),
      supabase
        .from("listings")
        .select("id", { count: "exact", head: true })
        .eq("seller_id", session.user.id)
        .eq("category", "jobs")
        .neq("status", "removed"),
    ]);
    const p = data as any;
    setVerified(!!p?.company_verified);
    setPending(!!p?.company_verification_pending);
    setCompany(p?.company || p?.name || "");
    setEmail(p?.email || "");
    setPhone(p?.phone || "");
    if (p?.city) setCity(p.city);
    setPlanId((recruiterProfile as any)?.plan_id || "free");
    setActiveJobPosts(count || 0);
    await refreshCredits();
  }, [session, refreshCredits]);

  useEffect(() => {
    setIsLoading(true);
    load().finally(() => setIsLoading(false));
  }, [load]);

  const cityOptions = useMemo(
    () => (province ? CITIES_BY_PROVINCE[province] || [] : []),
    [province]
  );

  function addSkill() {
    const s = skillInput.trim();
    if (!s) return;
    if (!skills.some((x) => x.toLowerCase() === s.toLowerCase())) setSkills([...skills, s]);
    setSkillInput("");
  }

  const ent = recruiterPlanEntitlements(planId);
  const overLimit = ent.activeJobPosts >= 0 && activeJobPosts >= ent.activeJobPosts;

  async function buyCredit(productId: string) {
    setPurchasingCredit(productId);
    const result = await purchaseProduct(productId);
    setPurchasingCredit(null);
    if (result.ok) {
      setCreditPickerOpen(false);
      toast("Job credits added!");
      refreshCredits();
    } else if (result.error) {
      toast(result.error);
    }
  }

  async function submit() {
    if (!session?.user) return;
    if (!company.trim()) return toast("Company name is required");
    if (!title.trim()) return toast("Job title is required");
    if (!category) return toast("Please select a job category");
    if (!province) return toast("Please select a province");
    if (!city.trim()) return toast("Please enter a city / town");
    if (description.trim().length < 30) return toast("Please write a job description (min 30 chars)");
    const salaryRaw = salary.trim();
    if (salaryRaw && !SALARY_RE.test(salaryRaw)) return toast('Enter a valid salary amount or "Negotiable"');
    if (overLimit && creditBalance <= 0) {
      toast("You've reached your plan's free job post limit. Buy a job credit or upgrade your recruiter plan to post more.", 5000, true);
      return;
    }

    setIsSubmitting(true);
    const finalSalary = salaryRaw || "Negotiable";
    const salaryLabel = salaryRaw ? `${currency} ${finalSalary}` : finalSalary;
    const fullDescription = buildDescription({
      company: company.trim(),
      jobType,
      category,
      salary: salaryLabel,
      experience,
      skills,
      description: description.trim(),
      responsibilities: responsibilities.trim(),
      requirements: requirements.trim(),
      email: email.trim(),
      phone: phone.trim(),
    });

    const { data, error } = await supabase
      .from("listings")
      .insert({
        seller_id: session.user.id,
        seller_name: company.trim(),
        seller_phone: phone.trim(),
        title: title.trim(),
        description: fullDescription,
        price: parseFloat(finalSalary) || 0,
        currency,
        category: "jobs",
        city: city.trim(),
        province: province.trim(),
        photos: [],
        status: "active",
      })
      .select("id,status")
      .single();

    setIsSubmitting(false);
    if (error || !data) {
      toast(error ? friendlyError(error).message : "Could not post job — please try again", 4000, true);
      return;
    }
    if (overLimit) {
      supabase.rpc("spend_job_credit", { p_listing_id: data.id }).then(({ error: spendError }) => {
        if (!spendError) refreshCredits();
      });
    }
    if (data.status && data.status !== "active") {
      toast("Job submitted — it will appear once it passes review.");
    } else {
      toast("Job posted! Candidates can now apply.");
    }
    router.back();
  }

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Header title="Post a Job" onBack={() => router.back()} insetTop={insets.top} styles={styles} />
        <View style={styles.centered}>
          <ActivityIndicator color={color.brand} />
        </View>
      </View>
    );
  }

  if (!verified) {
    return (
      <View style={styles.container}>
        <Header title="Post a Job" onBack={() => router.back()} insetTop={insets.top} styles={styles} />
        <ScrollView contentContainerStyle={styles.gateContent}>
          <Card style={styles.gateCard}>
            <View style={styles.gateIcon}>
              <ShieldIcon />
            </View>
            <Text style={styles.gateTitle}>Employer verification required</Text>
            <Text style={styles.gateBody}>
              We verify every employer before their roles go live. It keeps fraudulent postings off PaMarket and
              means candidates trust the jobs they apply to.
            </Text>
            <View style={styles.gateList}>
              <GateRow text="Registered companies and sole traders are both welcome" styles={styles} />
              <GateRow text="Sole traders only need a National ID or Passport" styles={styles} />
              <GateRow text="Most reviews are completed within one business day" styles={styles} />
            </View>
            {pending ? (
              <View style={styles.pendingBanner}>
                <Badge label="UNDER REVIEW" tone="gold" />
                <Text style={styles.pendingBannerSub}>
                  Your documents are with our team. We&apos;ll notify you the moment you&apos;re approved, and this
                  form will unlock automatically.
                </Text>
              </View>
            ) : (
              <Button
                label="Start verification"
                size="lg"
                onPress={() => router.push("/company-verify")}
                style={{ marginTop: space.xl }}
              />
            )}
          </Card>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title="Post a Job" onBack={() => router.back()} insetTop={insets.top} styles={styles} />

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.introWrap}>
          <Card style={styles.introCard}>
            <Text style={styles.introTitle}>Reach candidates across Zimbabwe</Text>
            <Text style={styles.introText}>
              Your role goes live immediately and appears in the Jobs feed. Your company name is always shown to
              candidates — a complete, specific posting attracts far stronger applicants.
            </Text>
          </Card>

          <Card style={styles.creditCard}>
            <Text style={styles.creditText}>
              {ent.activeJobPosts < 0
                ? "Your plan includes unlimited job posts."
                : `Posting is free up to ${ent.activeJobPosts} active job${ent.activeJobPosts === 1 ? "" : "s"}. You have ${activeJobPosts} active now.`}
              {creditBalance > 0 ? ` You have ${creditBalance} credit${creditBalance === 1 ? "" : "s"}.` : ""}
            </Text>
            {overLimit ? (
              <View style={styles.creditActions}>
                <Pressable onPress={() => setCreditPickerOpen((v) => !v)}>
                  <Text style={styles.creditLink}>Buy credits</Text>
                </Pressable>
                <Text style={styles.creditOr}>or</Text>
                <Pressable onPress={() => router.push("/jobs/recruiter-subscription")}>
                  <Text style={styles.creditLink}>upgrade plan</Text>
                </Pressable>
              </View>
            ) : null}
            {creditPickerOpen ? (
              <View style={styles.creditOptions}>
                {Object.entries(JOB_CREDIT_PRODUCTS).map(([productId, p]) => (
                  <Pressable
                    key={productId}
                    style={[styles.creditOpt, p.credits === 5 && styles.creditOptReco]}
                    onPress={() => buyCredit(productId)}
                    disabled={!!purchasingCredit}
                  >
                    {p.credits === 5 ? (
                      <View style={styles.creditOptTag}>
                        <Text style={styles.creditOptTagText}>BEST VALUE</Text>
                      </View>
                    ) : null}
                    <Text style={styles.creditOptLabel}>{p.credits} credit{p.credits === 1 ? "" : "s"}</Text>
                    {purchasingCredit === productId ? (
                      <ActivityIndicator color={color.brand} />
                    ) : (
                      <Text style={styles.creditOptCta}>Buy</Text>
                    )}
                  </Pressable>
                ))}
              </View>
            ) : null}
          </Card>
        </View>

        {/* ── Company ─────────────────────────────────────── */}
        <SectionHeader title="Company" subtitle="Who is hiring" />
        <Padded styles={styles}>
          <Card>
            <Label text="Company name" required  styles={styles} />
            <Input value={company} onChangeText={setCompany} placeholder="Your company or organisation name" last  styles={styles} />
          </Card>
        </Padded>

        {/* ── Role ────────────────────────────────────────── */}
        <SectionHeader title="The role" subtitle="Title, industry and employment type" />
        <Padded styles={styles}>
          <Card>
            <Label text="Job title" required  styles={styles} />
            <Input
              value={title}
              onChangeText={setTitle}
              placeholder="e.g. Accountant, Delivery Driver, Sales Representative"
             styles={styles} />

            <Label text="Industry" required  styles={styles} />
            <View style={styles.chipsWrap}>
              {JOB_CATEGORIES.map((c) => (
                <Chip key={c} label={c} active={category === c} onPress={() => setCategory(c)} />
              ))}
            </View>

            <Label text="Employment type" style={styles.spacedLabel}  styles={styles} />
            <View style={styles.chipsWrap}>
              {JOB_TYPES.map((t) => (
                <Chip key={t} label={t} active={jobType === t} onPress={() => setJobType(t)} />
              ))}
            </View>

            <Label text="Experience level" style={styles.spacedLabel}  styles={styles} />
            <View style={styles.chipsWrap}>
              {EXPERIENCE_LEVELS.map((lv) => (
                <Chip
                  key={lv}
                  label={lv}
                  active={experience === lv}
                  onPress={() => setExperience(experience === lv ? "" : lv)}
                />
              ))}
            </View>
          </Card>
        </Padded>

        {/* ── Location ────────────────────────────────────── */}
        <SectionHeader title="Location" subtitle="Where the role is based" />
        <Padded styles={styles}>
          <Card>
            <Label text="Province" required  styles={styles} />
            <View style={styles.chipsWrap}>
              {PROVINCES.map((p) => (
                <Chip
                  key={p}
                  label={p}
                  active={province === p}
                  onPress={() => {
                    setProvince(p);
                    if (!(CITIES_BY_PROVINCE[p] || []).includes(city)) setCity("");
                  }}
                />
              ))}
            </View>

            <Label text="City / town" required style={styles.spacedLabel}  styles={styles} />
            <Input value={city} onChangeText={setCity} placeholder="e.g. Harare, or Remote" last={!cityOptions.length}  styles={styles} />
            {cityOptions.length ? (
              <View style={[styles.chipsWrap, { marginTop: space.md }]}>
                {cityOptions.slice(0, 14).map((c) => (
                  <Chip key={c} label={c} active={city === c} onPress={() => setCity(c)} />
                ))}
              </View>
            ) : null}
          </Card>
        </Padded>

        {/* ── Pay ─────────────────────────────────────────── */}
        <SectionHeader title="Pay" subtitle="Postings with a salary get more applications" />
        <Padded styles={styles}>
          <Card>
            <Label text="Monthly salary"  styles={styles} />
            <Input
              value={salary}
              onChangeText={setSalary}
              placeholder="e.g. 500, 500-1000, or Negotiable"
              last
             styles={styles} />
            <View style={[styles.chipsWrap, { marginTop: space.md }]}>
              {CURRENCIES.map((c) => (
                <Chip key={c} label={c} active={currency === c} onPress={() => setCurrency(c)} />
              ))}
            </View>
            <Text style={styles.hint}>Leave blank to show &ldquo;Negotiable&rdquo; on the listing.</Text>
          </Card>
        </Padded>

        {/* ── Description ─────────────────────────────────── */}
        <SectionHeader title="Job details" subtitle="What the work involves" />
        <Padded styles={styles}>
          <Card>
            <Label text="About the role" required  styles={styles} />
            <TextInput
              style={[styles.input, styles.textarea]}
              value={description}
              onChangeText={setDescription}
              placeholder="Describe the role, the team, and what a typical week looks like…"
              placeholderTextColor={color.textMuted}
              multiline
            />
            <Text style={styles.counter}>{description.trim().length}/30 minimum</Text>

            <Label text="Key responsibilities" style={styles.spacedLabel}  styles={styles} />
            <TextInput
              style={[styles.input, styles.textareaSm]}
              value={responsibilities}
              onChangeText={setResponsibilities}
              placeholder="List the main duties, one per line…"
              placeholderTextColor={color.textMuted}
              multiline
            />

            <Label text="Requirements & qualifications" style={styles.spacedLabel}  styles={styles} />
            <TextInput
              style={[styles.input, styles.textareaSm]}
              value={requirements}
              onChangeText={setRequirements}
              placeholder="Qualifications, licences and experience a candidate must have…"
              placeholderTextColor={color.textMuted}
              multiline
            />
          </Card>
        </Padded>

        {/* ── Skills ──────────────────────────────────────── */}
        <SectionHeader title="Skills required" subtitle="Helps the right candidates find this role" />
        <Padded styles={styles}>
          <Card>
            <View style={styles.skillAddRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={skillInput}
                onChangeText={setSkillInput}
                placeholder="Add a skill (e.g. QuickBooks)"
                placeholderTextColor={color.textMuted}
                onSubmitEditing={addSkill}
                returnKeyType="done"
              />
              <Button label="Add" size="sm" fullWidth={false} onPress={addSkill} />
            </View>
            {skills.length ? (
              <View style={[styles.chipsWrap, { marginTop: space.md }]}>
                {skills.map((s) => (
                  <Pressable
                    key={s}
                    style={styles.removableChip}
                    onPress={() => setSkills(skills.filter((x) => x !== s))}
                  >
                    <Text style={styles.removableChipText}>{s}</Text>
                    <Text style={styles.removableChipX}>×</Text>
                  </Pressable>
                ))}
              </View>
            ) : (
              <Text style={styles.hint}>No skills added yet — add three to five for the best match rate.</Text>
            )}
          </Card>
        </Padded>

        {/* ── How to apply ────────────────────────────────── */}
        <SectionHeader title="How to apply" subtitle="Where applications should reach you" />
        <Padded styles={styles}>
          <Card>
            <Label text="Application email"  styles={styles} />
            <Input
              value={email}
              onChangeText={setEmail}
              placeholder="hiring@yourcompany.co.zw"
              keyboardType="email-address"
             styles={styles} />
            <Label text="WhatsApp number"  styles={styles} />
            <Input value={phone} onChangeText={setPhone} placeholder="e.g. +263771234567" keyboardType="phone-pad" last  styles={styles} />
            <Text style={styles.hint}>
              Candidates can also apply in-app — you&apos;ll see every applicant under Applications.
            </Text>
          </Card>
        </Padded>
      </ScrollView>

      <View style={[styles.ctaBar, { paddingBottom: insets.bottom + space.md }]}>
        <Button
          label={isSubmitting ? "Publishing…" : "Publish job"}
          variant="gold"
          size="lg"
          loading={isSubmitting}
          onPress={submit}
        />
      </View>
    </View>
  );
}

// ── Building blocks ────────────────────────────────────────────────────────
type Styles = ReturnType<typeof buildStyles>;

function Header({ title, onBack, insetTop, styles }: { title: string; onBack: () => void; insetTop: number; styles: Styles }) {
  return (
    <View style={[styles.header, { paddingTop: insetTop + 10 }]}>
      <GlassBackButton onPress={onBack} tone="light" flat />
      <Text style={styles.headerTitle}>{title}</Text>
      <View style={{ width: 20 }} />
    </View>
  );
}

function Padded({ children, styles }: { children: React.ReactNode; styles: Styles }) {
  return <View style={styles.padded}>{children}</View>;
}

function Label({ text, required, style, styles }: { text: string; required?: boolean; style?: object; styles: Styles }) {
  return (
    <Text style={[styles.label, style]}>
      {text}
      {required ? <Text style={styles.required}> *</Text> : null}
    </Text>
  );
}

function GateRow({ text, styles }: { text: string; styles: Styles }) {
  return (
    <View style={styles.gateRow}>
      <View style={styles.gateDot} />
      <Text style={styles.gateRowText}>{text}</Text>
    </View>
  );
}

function Input({
  value,
  onChangeText,
  placeholder,
  last,
  keyboardType,
  styles,
}: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  last?: boolean;
  keyboardType?: "email-address" | "phone-pad";
  styles: Styles;
}) {
  return (
    <TextInput
      style={[styles.input, !last && { marginBottom: space.lg }]}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={color.textMuted}
      keyboardType={keyboardType}
      autoCapitalize={keyboardType === "email-address" ? "none" : "sentences"}
    />
  );
}

function buildStyles(color: ColorPalette) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: color.bg },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: color.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: color.brand,
    paddingHorizontal: space.lg,
    paddingBottom: space.md,
  },
  headerTitle: { ...font.title, color: color.textOnBrand },

  padded: { paddingHorizontal: space.lg, marginBottom: space.xl },
  introWrap: { padding: space.lg, paddingBottom: space.sm, gap: space.md },
  introCard: { backgroundColor: color.brandTint },
  introTitle: { ...font.bodyStrong, color: color.brand },
  introText: { ...font.sub, color: color.textSub, marginTop: space.xs, lineHeight: 19 },

  creditCard: { backgroundColor: color.surfaceAlt },
  creditText: { ...font.sub, color: color.textSub, lineHeight: 19 },
  creditActions: { flexDirection: "row", alignItems: "center", gap: space.sm, marginTop: space.sm },
  creditLink: { ...font.sub, color: color.brand, fontWeight: "800", textDecorationLine: "underline" },
  creditOr: { ...font.caption, color: color.textMuted },
  creditOptions: { flexDirection: "row", gap: space.sm, marginTop: space.md },
  creditOpt: {
    flex: 1,
    alignItems: "center",
    gap: 4,
    backgroundColor: color.surface,
    borderRadius: radius.md,
    paddingVertical: space.md,
    borderWidth: 1.5,
    borderColor: "transparent",
    position: "relative",
  },
  creditOptReco: { borderColor: color.gold, backgroundColor: color.goldTint },
  creditOptTag: {
    position: "absolute",
    top: -9,
    alignSelf: "center",
    backgroundColor: color.gold,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  creditOptTagText: { fontSize: 9, fontWeight: "800", color: "#fff", letterSpacing: 0.3 },
  creditOptLabel: { ...font.sub, color: color.text, fontWeight: "700" },
  creditOptCta: { ...font.caption, color: color.brand, fontWeight: "800" },

  // Gate
  gateContent: { padding: space.lg, paddingTop: space.xxl },
  gateCard: { alignItems: "stretch" },
  gateIcon: {
    width: 56,
    height: 56,
    borderRadius: radius.lg,
    backgroundColor: color.brandTint,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: space.lg,
  },
  gateTitle: { ...font.h2, color: color.text },
  gateBody: { ...font.body, color: color.textSub, marginTop: space.sm, lineHeight: 22 },
  gateList: { marginTop: space.xl, gap: space.md },
  gateRow: { flexDirection: "row", alignItems: "flex-start", gap: space.md },
  gateDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: color.brand, marginTop: 7 },
  gateRowText: { ...font.sub, color: color.textSub, flex: 1, lineHeight: 19 },
  pendingBanner: {
    marginTop: space.xl,
    backgroundColor: color.goldTint,
    borderRadius: radius.md,
    padding: space.lg,
    gap: space.sm,
  },
  pendingBannerSub: { ...font.sub, color: color.textSub, lineHeight: 19 },

  // Form
  label: { ...font.caption, color: color.textSub, marginBottom: space.sm },
  required: { color: color.danger },
  spacedLabel: { marginTop: space.lg },
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
  textarea: { minHeight: 130, textAlignVertical: "top" },
  textareaSm: { minHeight: 90, textAlignVertical: "top" },
  counter: { ...font.caption, color: color.textMuted, marginTop: space.sm, textAlign: "right" },
  hint: { ...font.sub, color: color.textMuted, marginTop: space.md, lineHeight: 18 },

  chipsWrap: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  skillAddRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  removableChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: color.brandTint,
    borderRadius: radius.pill,
    paddingLeft: space.md,
    paddingRight: space.sm,
    paddingVertical: 7,
  },
  removableChipText: { ...font.caption, color: color.brand },
  removableChipX: { ...font.bodyStrong, color: color.brand, lineHeight: 16 },

  ctaBar: {
    padding: space.lg,
    borderTopWidth: 1,
    borderTopColor: color.border,
    backgroundColor: color.surface,
    ...shadow.md,
  },
  });
}
