import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
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
import {
  color,
  font,
  radius,
  shadow,
  space,
  type ColorPalette,
} from "../../lib/theme";
import { useThemedStyles } from "../../lib/theme-provider";
import { useIOSNativeHeader } from "../../lib/useIOSNativeHeader";
import {
  JOB_CATEGORIES,
  JOB_DESCRIPTION_MAX,
  JOB_TYPES,
  jobDescriptionOverflow,
  recruiterPlanEntitlements,
} from "../../lib/jobs";
import { friendlyError } from "../../lib/safety";
import { JOB_CREDIT_PRODUCTS } from "../../lib/billing-products";
import { purchaseProduct } from "../../lib/iap";
import { useStoreProducts } from "../../lib/use-store-products";
import { StoreProductOption } from "../../components/StoreProductOption";
import {
  Badge,
  BriefcaseIcon,
  Button,
  Card,
  Chip,
  CollapsibleCard,
  CountedTextArea,
  DocumentIcon,
  FieldCol,
  FieldLabel,
  FieldRow,
  GlassBackButton,
  MoneyIcon,
  SendIcon,
  ToolsIcon,
} from "../../components/ui";
import { toast } from "../../components/ui/Toast";

const JOB_CREDIT_PRODUCT_IDS = Object.keys(JOB_CREDIT_PRODUCTS);

function ShieldIcon() {
  return (
    <Svg
      width={26}
      height={26}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color.brand}
      strokeWidth={2}
    >
      <Path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <Polyline points="9 12 11 14 15 10" />
    </Svg>
  );
}

const SALARY_RE =
  /^(\d+(\.\d+)?(\s*-\s*\d+(\.\d+)?)?|negotiable|competitive|tbd)$/i;

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
  let d = `COMPANY: ${opts.company}\nJOB TYPE: ${opts.jobType}\nINDUSTRY: ${opts.category}\nSALARY: ${opts.salary}`;
  if (opts.experience) d += `\nEXPERIENCE: ${opts.experience}`;
  if (opts.skills.length) d += `\nSKILLS: ${opts.skills.join(", ")}`;
  d += `\n\nDESCRIPTION:\n${opts.description}`;
  if (opts.responsibilities)
    d += `\n\nRESPONSIBILITIES:\n${opts.responsibilities}`;
  if (opts.requirements) d += `\n\nREQUIREMENTS:\n${opts.requirements}`;
  if (opts.email || opts.phone) {
    d += `\n\nHOW TO APPLY:\n${opts.email ? `Email: ${opts.email}\n` : ""}${
      opts.phone ? `WhatsApp: ${opts.phone}` : ""
    }`;
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
  // Section icons are stroke-only, so they need the raw brand colour rather
  // than a StyleSheet entry.
  const tones = useThemedStyles((c: ColorPalette) => ({ brand: c.brand }));

  useIOSNativeHeader({
    backgroundColor: color.brand,
    tintColor: color.textOnBrand,
    title: "Post a Job",
  });

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
  const {
    prices: creditPrices,
    availableProductIds: availableCreditIds,
    isLoading: isLoadingCredits,
    error: creditProductError,
    retry: retryCreditProducts,
  } = useStoreProducts(JOB_CREDIT_PRODUCT_IDS, "consumable");

  const refreshCredits = useCallback(async () => {
    const { data } = await supabase.rpc("get_job_credit_balance");
    if (typeof data === "number") setCreditBalance(data);
  }, []);

  const load = useCallback(async () => {
    if (!session?.user) return;
    const [{ data }, { data: recruiterProfile }, { count }] = await Promise.all(
      [
        supabase
          .from("profiles")
          .select(
            "company,company_verified,company_verification_pending,name,email,phone,city"
          )
          .eq("id", session.user.id)
          .maybeSingle(),
        supabase
          .from("recruiter_profiles")
          .select("plan_id")
          .eq("user_id", session.user.id)
          .maybeSingle(),
        supabase
          .from("listings")
          .select("id", { count: "exact", head: true })
          .eq("seller_id", session.user.id)
          .eq("category", "jobs")
          .neq("status", "removed"),
      ]
    );
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
    // The card says "up to 5 key skills", so enforce it rather than letting
    // the chip row grow unbounded.
    if (skills.length >= 5) {
      toast("You can add up to 5 skills.");
      return;
    }
    if (!skills.some((x) => x.toLowerCase() === s.toLowerCase()))
      setSkills([...skills, s]);
    setSkillInput("");
  }

  function removeSkill(skill: string) {
    setSkills(skills.filter((s) => s !== skill));
  }

  const ent = recruiterPlanEntitlements(planId);
  const overLimit =
    ent.activeJobPosts >= 0 && activeJobPosts >= ent.activeJobPosts;
  const remainingFreePosts =
    ent.activeJobPosts < 0
      ? Infinity
      : Math.max(0, ent.activeJobPosts - activeJobPosts);

  // Counts the generated description, not the raw fields — that is what the
  // database limit applies to, so this is the only number that tells a seller
  // whether the post will actually save.
  const descriptionLength = useMemo(
    () =>
      buildDescription({
        company: company.trim(),
        jobType,
        category,
        salary: salary.trim()
          ? `${currency} ${salary.trim()}`
          : "Negotiable",
        experience,
        skills,
        description: description.trim(),
        responsibilities: responsibilities.trim(),
        requirements: requirements.trim(),
        email: email.trim(),
        phone: phone.trim(),
      }).length,
    [
      company,
      jobType,
      category,
      salary,
      currency,
      experience,
      skills,
      description,
      responsibilities,
      requirements,
      email,
      phone,
    ]
  );
  const descriptionOver = descriptionLength > JOB_DESCRIPTION_MAX;

  async function buyCredit(productId: string) {
    if (!availableCreditIds.includes(productId)) {
      toast(
        "This credit pack is unavailable from the store. Retry loading prices."
      );
      return;
    }
    setPurchasingCredit(productId);
    try {
      const result = await purchaseProduct(productId);
      if (result.ok) {
        setCreditPickerOpen(false);
        toast("Job credits added!");
        refreshCredits();
      } else if (result.code === "user-cancelled") {
        toast("Purchase cancelled");
      } else {
        toast(result.error);
      }
    } finally {
      setPurchasingCredit(null);
    }
  }

  async function submit() {
    if (!session?.user) return;
    if (!company.trim()) return toast("Company name is required");
    if (!title.trim()) return toast("Job title is required");
    if (!category) return toast("Please select a job category");
    if (!province) return toast("Please select a province");
    if (!city.trim()) return toast("Please enter a city / town");
    if (description.trim().length < 30)
      return toast("Please write a job description (min 30 chars)");
    const salaryRaw = salary.trim();
    if (salaryRaw && !SALARY_RE.test(salaryRaw))
      return toast('Enter a valid salary amount or "Negotiable"');
    if (overLimit && creditBalance <= 0) {
      toast(
        "You've reached your plan's free job post limit. Buy a job credit or upgrade your recruiter plan to post more.",
        5000,
        true
      );
      return;
    }

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

    // Checked against the string that is actually submitted, before any
    // network call — the database rejects anything longer and the raw
    // constraint error is meaningless to a seller.
    const over = jobDescriptionOverflow(fullDescription);
    if (over > 0) {
      return toast(
        `Your job post is too long. Please remove about ${over.toLocaleString()} character${
          over === 1 ? "" : "s"
        } and try again.`,
        5000,
        true
      );
    }

    setIsSubmitting(true);
    // create_job_listing checks the entitlement, inserts the listing and spends
    // the credit in one transaction. The previous flow inserted the row and
    // then fired spend_job_credit in an unawaited .then(), so a failed spend
    // left the job published and unpaid. The server also owns seller_id, and a
    // direct insert to `listings` with category='jobs' is now rejected.
    const { data, error } = await supabase.rpc("create_job_listing", {
      p_title: title.trim(),
      p_description: fullDescription,
      p_price: parseFloat(finalSalary) || 0,
      p_currency: currency,
      p_city: city.trim(),
      p_province: province.trim(),
      p_seller_name: company.trim(),
      p_seller_phone: phone.trim(),
    });

    setIsSubmitting(false);
    if (error) {
      toast(friendlyError(error).message, 4000, true);
      return;
    }
    const result = data as
      | { ok: boolean; msg?: string; used_credit?: boolean }
      | null;
    if (!result?.ok) {
      toast(
        result?.msg || "Could not post job — please try again",
        4000,
        true
      );
      return;
    }
    if (result.used_credit) refreshCredits();
    toast("Job posted! Candidates can now apply.");
    router.back();
  }

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Header
          title="Post a Job"
          onBack={() => router.back()}
          insetTop={insets.top}
          styles={styles}
        />
        <View style={styles.centered}>
          <ActivityIndicator color={color.brand} />
        </View>
      </View>
    );
  }

  if (!verified) {
    return (
      <View style={styles.container}>
        <Header
          title="Post a Job"
          onBack={() => router.back()}
          insetTop={insets.top}
          styles={styles}
        />
        <ScrollView contentContainerStyle={styles.gateContent}>
          <Card style={styles.gateCard}>
            <View style={styles.gateIcon}>
              <ShieldIcon />
            </View>
            <Text style={styles.gateTitle}>Employer verification required</Text>
            <Text style={styles.gateBody}>
              We verify every employer before their roles go live. It keeps
              fraudulent postings off PaMarket and means candidates trust the
              jobs they apply to.
            </Text>
            <View style={styles.gateList}>
              <GateRow
                text="Registered companies and sole traders are both welcome"
                styles={styles}
              />
              <GateRow
                text="Sole traders only need a National ID or Passport"
                styles={styles}
              />
              <GateRow
                text="Most reviews are completed within one business day"
                styles={styles}
              />
            </View>
            {pending ? (
              <View style={styles.pendingBanner}>
                <Badge label="UNDER REVIEW" tone="gold" />
                <Text style={styles.pendingBannerSub}>
                  Your documents are with our team. We&apos;ll notify you the
                  moment you&apos;re approved, and this form will unlock
                  automatically.
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
      <Header
        title="Post a Job"
        onBack={() => router.back()}
        insetTop={insets.top}
        styles={styles}
      />

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.introWrap}>
          <Card style={styles.introCard}>
            <Text style={styles.introTitle}>
              Reach candidates across Zimbabwe
            </Text>
            <Text style={styles.introText}>
              Your role goes live immediately and appears in the Jobs feed. Your
              company name is always shown to candidates — a complete, specific
              posting attracts far stronger applicants.
            </Text>
          </Card>

          <Card style={styles.creditCard}>
            <Text style={styles.creditText}>
              {ent.activeJobPosts < 0
                ? "Your plan includes unlimited job posts."
                : `Posting is free up to ${ent.activeJobPosts} active job${
                    ent.activeJobPosts === 1 ? "" : "s"
                  }. You have ${activeJobPosts} active now.`}
              {creditBalance > 0
                ? ` You have ${creditBalance} credit${
                    creditBalance === 1 ? "" : "s"
                  }.`
                : ""}
            </Text>
            {/* Shown at every allowance level, not only once the free posts
                run out. Gating this behind overLimit meant a seller only ever
                discovered credits and the recruiter plan at the moment they
                were blocked — by which point the options read as a paywall
                rather than something they could have chosen earlier. */}
            {ent.activeJobPosts >= 0 ? (
              <>
                {!overLimit ? (
                  <Text style={styles.creditHint}>
                    {remainingFreePosts > 0
                      ? `${remainingFreePosts} free post${
                          remainingFreePosts === 1 ? "" : "s"
                        } left. Need more? Buy credits or go unlimited.`
                      : "Buy credits or go unlimited to keep posting."}
                  </Text>
                ) : null}
                <View style={styles.creditActions}>
                  <Pressable onPress={() => setCreditPickerOpen((v) => !v)}>
                    <Text style={styles.creditLink}>
                      {creditPickerOpen ? "Hide credit options" : "Buy job credits"}
                    </Text>
                  </Pressable>
                  <Text style={styles.creditOr}>or</Text>
                  <Pressable
                    onPress={() => router.push("/jobs/recruiter-subscription")}
                  >
                    <Text style={styles.creditLink}>upgrade plan</Text>
                  </Pressable>
                </View>
              </>
            ) : null}
            {creditPickerOpen ? (
              <View style={styles.creditOptions}>
                {Object.entries(JOB_CREDIT_PRODUCTS).map(([productId, p]) => (
                  <StoreProductOption
                    key={productId}
                    title={`${p.credits} Job Credit${
                      p.credits === 1 ? "" : "s"
                    }`}
                    price={creditPrices[productId]}
                    description={`Adds ${p.credits} job-posting credit${
                      p.credits === 1 ? "" : "s"
                    } to your account.`}
                    buttonLabel={`Buy ${p.credits} Credit${
                      p.credits === 1 ? "" : "s"
                    }`}
                    isLoading={isLoadingCredits}
                    isAvailable={availableCreditIds.includes(productId)}
                    isPurchasing={purchasingCredit === productId}
                    purchaseBlocked={!!purchasingCredit}
                    error={creditProductError}
                    recommended={p.credits === 5}
                    onPurchase={() => buyCredit(productId)}
                    onRetry={retryCreditProducts}
                  />
                ))}
              </View>
            ) : null}
          </Card>
        </View>

        {/* ── Company ─────────────────────────────────────── */}
        {/* Card 1 — Job Details */}
        <Padded styles={styles}>
          <CollapsibleCard title="Job Details" icon={<BriefcaseIcon c={tones.brand} />}>
            <FieldRow>
              <FieldCol>
                <FieldLabel text="Job title" required />
                <Input
                  value={title}
                  onChangeText={setTitle}
                  placeholder="e.g. Accountant"
                  last
                  styles={styles}
                />
              </FieldCol>
              <FieldCol>
                <FieldLabel text="Company" required />
                <Input
                  value={company}
                  onChangeText={setCompany}
                  placeholder="Your company"
                  last
                  styles={styles}
                />
              </FieldCol>
            </FieldRow>

            <View>
              <FieldLabel text="Industry" required />
              <View style={styles.chipsWrap}>
                {JOB_CATEGORIES.map((c) => (
                  <Chip key={c} label={c} active={category === c} onPress={() => setCategory(c)} />
                ))}
              </View>
            </View>

            <View>
              <FieldLabel text="Employment type" required />
              <View style={styles.chipsWrap}>
                {JOB_TYPES.map((t) => (
                  <Chip key={t} label={t} active={jobType === t} onPress={() => setJobType(t)} />
                ))}
              </View>
            </View>

            <View>
              <FieldLabel text="Province" required />
              <View style={styles.chipsWrap}>
                {PROVINCES.map((p) => (
                  <Chip
                    key={p}
                    label={p}
                    active={province === p}
                    onPress={() => {
                      setProvince(p);
                      setCity("");
                    }}
                  />
                ))}
              </View>
            </View>

            <View>
              <FieldLabel text="City / town" required />
              <Input
                value={city}
                onChangeText={setCity}
                placeholder="e.g. Harare"
                last
                styles={styles}
              />
              {cityOptions.length ? (
                <View style={[styles.chipsWrap, { marginTop: space.sm }]}>
                  {cityOptions.slice(0, 14).map((c) => (
                    <Chip key={c} label={c} active={city === c} onPress={() => setCity(c)} />
                  ))}
                </View>
              ) : null}
            </View>
          </CollapsibleCard>
        </Padded>

        {/* Card 2 — Job Description */}
        <Padded styles={styles}>
          <CollapsibleCard title="Job Description" icon={<DocumentIcon c={tones.brand} />}>
            <View>
              <FieldLabel text="Summary" required />
              <CountedTextArea
                value={description}
                onChangeText={setDescription}
                placeholder="Describe the role, the team, and what a typical week looks like…"
                limit={600}
                minHeight={96}
              />
              {description.trim().length < 30 ? (
                <Text style={styles.helperText}>Minimum 30 characters.</Text>
              ) : null}
            </View>

            <View>
              <FieldLabel text="Responsibilities" />
              <CountedTextArea
                value={responsibilities}
                onChangeText={setResponsibilities}
                placeholder="List the main duties, one per line…"
                limit={500}
                minHeight={90}
              />
              <Text style={styles.helperText}>
                One duty per line — each line becomes its own bullet on the job page.
              </Text>
            </View>

            <View>
              <FieldLabel text="Requirements & Qualifications" />
              <CountedTextArea
                value={requirements}
                onChangeText={setRequirements}
                placeholder="Qualifications, licences and experience a candidate must have…"
                limit={500}
                minHeight={90}
              />
            </View>

            <View>
              <FieldLabel text="Experience level" />
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
            </View>
          </CollapsibleCard>
        </Padded>

        {/* Card 3 — Skills required */}
        <Padded styles={styles}>
          <CollapsibleCard
            title="Skills required"
            subtitle="Add up to 5 key skills for this role"
            icon={<ToolsIcon c={tones.brand} />}
          >
            <View style={styles.skillRow}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Input
                  value={skillInput}
                  onChangeText={setSkillInput}
                  placeholder="Add a skill (e.g. QuickBooks)"
                  last
                  styles={styles}
                  onSubmitEditing={addSkill}
                />
              </View>
              <Button label="Add" variant="secondary" onPress={addSkill} />
            </View>
            {skills.length ? (
              <View style={styles.chipsWrap}>
                {skills.map((s) => (
                  <Chip key={s} label={`${s}  ✕`} active onPress={() => removeSkill(s)} />
                ))}
              </View>
            ) : null}
          </CollapsibleCard>
        </Padded>

        {/* Card 4 — Compensation (optional, collapsed by default) */}
        <Padded styles={styles}>
          <CollapsibleCard
            title="Compensation"
            subtitle="Optional — postings with a salary get more applications"
            icon={<MoneyIcon c={tones.brand} />}
            defaultOpen={false}
          >
            <View>
              <FieldLabel text="Monthly salary" />
              <Input
                value={salary}
                onChangeText={setSalary}
                placeholder="e.g. 500, 500-1000, or Negotiable"
                last
                styles={styles}
              />
              <View style={[styles.chipsWrap, { marginTop: space.sm }]}>
                {CURRENCIES.map((c) => (
                  <Chip key={c} label={c} active={currency === c} onPress={() => setCurrency(c)} />
                ))}
              </View>
              <Text style={styles.helperText}>
                Leave blank to show &ldquo;Negotiable&rdquo; on the listing.
              </Text>
            </View>
          </CollapsibleCard>
        </Padded>

        {/* Card 5 — How to apply */}
        <Padded styles={styles}>
          <CollapsibleCard
            title="How to apply"
            subtitle="Where applications should reach you"
            icon={<SendIcon c={tones.brand} />}
          >
            <View>
              <FieldLabel text="Application email" />
              <Input
                value={email}
                onChangeText={setEmail}
                placeholder="hiring@yourcompany.co.zw"
                last
                styles={styles}
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </View>
            <View>
              <FieldLabel text="WhatsApp number" />
              <Input
                value={phone}
                onChangeText={setPhone}
                placeholder="e.g. +263771234567"
                last
                styles={styles}
                keyboardType="phone-pad"
              />
            </View>
          </CollapsibleCard>
        </Padded>
      </ScrollView>

      <View
        style={[styles.ctaBar, { paddingBottom: insets.bottom + space.md }]}
      >
        {/* Sits directly above Publish because it describes the whole post,
            not any single field — it counts the generated description that
            listings.description actually stores. */}
        <Text
          style={[
            styles.counterText,
            descriptionOver && styles.counterTextOver,
          ]}
        >
          {descriptionLength.toLocaleString()} /{" "}
          {JOB_DESCRIPTION_MAX.toLocaleString()} characters used
          {descriptionOver
            ? ` — remove about ${(
                descriptionLength - JOB_DESCRIPTION_MAX
              ).toLocaleString()}`
            : ""}
        </Text>
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

function Header({
  title,
  onBack,
  insetTop,
  styles,
}: {
  title: string;
  onBack: () => void;
  insetTop: number;
  styles: Styles;
}) {
  if (Platform.OS === "ios") return null;
  return (
    <View style={[styles.header, { paddingTop: insetTop + 10 }]}>
      <GlassBackButton onPress={onBack} tone="light" flat />
      <Text style={styles.headerTitle}>{title}</Text>
      <View style={{ width: 20 }} />
    </View>
  );
}

function Padded({
  children,
  styles,
}: {
  children: React.ReactNode;
  styles: Styles;
}) {
  return <View style={styles.padded}>{children}</View>;
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
  autoCapitalize,
  onSubmitEditing,
  styles,
}: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  last?: boolean;
  keyboardType?: "email-address" | "phone-pad";
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  onSubmitEditing?: () => void;
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
      autoCapitalize={
        autoCapitalize ??
        (keyboardType === "email-address" ? "none" : "sentences")
      }
      onSubmitEditing={onSubmitEditing}
      returnKeyType={onSubmitEditing ? "done" : undefined}
    />
  );
}

function buildStyles(color: ColorPalette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: color.bg },
    centered: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: color.bg,
    },
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
    introText: {
      ...font.sub,
      color: color.textSub,
      marginTop: space.xs,
      lineHeight: 19,
    },

    creditCard: { backgroundColor: color.surfaceAlt },
    creditText: { ...font.sub, color: color.textSub, lineHeight: 19 },
    creditHint: {
      ...font.caption,
      color: color.textMuted,
      fontWeight: "500",
      marginTop: space.xs,
      lineHeight: 16,
    },
    counterText: {
      ...font.caption,
      color: color.textMuted,
      fontWeight: "500",
      textAlign: "center",
      marginBottom: space.sm,
    },
    counterTextOver: { color: color.danger, fontWeight: "700" },
    helperText: {
      ...font.caption,
      color: color.textMuted,
      fontWeight: "500",
      marginTop: space.sm,
      lineHeight: 16,
    },
    skillRow: { flexDirection: "row", alignItems: "flex-start", gap: space.sm },
    creditActions: {
      flexDirection: "row",
      alignItems: "center",
      gap: space.sm,
      marginTop: space.sm,
    },
    creditLink: {
      ...font.sub,
      color: color.brand,
      fontWeight: "800",
      textDecorationLine: "underline",
    },
    creditOr: { ...font.caption, color: color.textMuted },
    creditOptions: { gap: space.sm, marginTop: space.md },
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
    creditOptTagText: {
      fontSize: 9,
      fontWeight: "800",
      color: "#fff",
      letterSpacing: 0.3,
    },
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
    gateBody: {
      ...font.body,
      color: color.textSub,
      marginTop: space.sm,
      lineHeight: 22,
    },
    gateList: { marginTop: space.xl, gap: space.md },
    gateRow: { flexDirection: "row", alignItems: "flex-start", gap: space.md },
    gateDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: color.brand,
      marginTop: 7,
    },
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
    counter: {
      ...font.caption,
      color: color.textMuted,
      marginTop: space.sm,
      textAlign: "right",
    },
    hint: {
      ...font.sub,
      color: color.textMuted,
      marginTop: space.md,
      lineHeight: 18,
    },

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
