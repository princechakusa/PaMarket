import { supabase } from "./supabase";

// Consolidated Jobs Reconstruction taxonomy (Phase 3, Stage 4) — merges
// this list's previous 10 values with post-job.html's previous, different
// 20-value INDUSTRIES list (the two clients had genuinely diverged; see
// project_jobs_reconstruction memory). Nothing from either list was
// dropped, only merged where the concept was a duplicate under a
// different name (e.g. old "Healthcare" + web's "Healthcare / Medical" →
// "Healthcare & Medical" below).
//
// This constant is now the LEGACY-PARSING reference only — matching
// `INDUSTRY: <value>` text in an old-format listings.description. The
// live create/edit job forms fetch job_industries from the database
// (same pattern as rental_categories/rental_brands for Rentals) so a
// taxonomy change never requires a client release.
export const JOB_CATEGORIES = [
  "Accounting & Finance",
  "Administration & Office",
  "Agriculture & Farming",
  "Construction & Trades",
  "Customer Service",
  "Driving & Logistics",
  "Education & Training",
  "Engineering",
  "Events & Hospitality",
  "General Worker & Labour",
  "Healthcare & Medical",
  "Human Resources",
  "IT & Technology",
  "Legal",
  "Manufacturing",
  "Sales & Marketing",
  "NGO & Development",
  "Retail",
  "Security",
  "Other",
];

export const JOB_TYPES = ["Full-time", "Part-time", "Contract", "Freelance", "Internship"];

export type JobTaxonomyOption = { id: string; slug: string; label: string };

export async function fetchJobTaxonomy(): Promise<{ jobTypes: JobTaxonomyOption[]; industries: JobTaxonomyOption[] }> {
  const [typesRes, industriesRes] = await Promise.all([
    supabase.from("job_types").select("id,slug,label").order("sort_order"),
    supabase.from("job_industries").select("id,slug,label").order("sort_order"),
  ]);
  return {
    jobTypes: (typesRes.data as JobTaxonomyOption[] | null) ?? [],
    industries: (industriesRes.data as JobTaxonomyOption[] | null) ?? [],
  };
}

// Job-specific fields live inside the plain-text description as `KEY: value`
// lines (see www/js/jobs.js parseLine) rather than dedicated columns.
export function parseJobField(description: string | null | undefined, key: string): string {
  if (!description) return "";
  const lines = description.split("\n");
  const prefix = `${key.toUpperCase()}:`;
  const line = lines.find((l) => l.trim().toUpperCase().startsWith(prefix));
  if (!line) return "";
  return line.slice(line.indexOf(":") + 1).trim();
}

export function jobCompany(description: string | null | undefined, fallbackSellerName: string | null | undefined): string {
  return parseJobField(description, "COMPANY") || fallbackSellerName || "";
}

export function jobSalary(description: string | null | undefined): string {
  return parseJobField(description, "SALARY") || "Negotiable";
}

export function jobType(description: string | null | undefined): string {
  return parseJobField(description, "JOB TYPE");
}

// ── Job seeker CV (jobs.js stores this as profiles.cv jsonb) ────────────
export type CvExperience = {
  title?: string;
  company?: string;
  duration?: string;
  current?: boolean;
  desc?: string;
};

export type CvEducation = {
  degree?: string;
  school?: string;
  year?: string;
};

export type CvCertification = {
  name?: string;
  issuer?: string;
  year?: string;
};

export type CvLanguage = {
  language?: string;
  proficiency?: string;
};

export type CvPortfolioItem = {
  label?: string;
  url?: string;
};

export type JobSeekerCv = {
  headline?: string;
  location?: string;
  summary?: string;
  skills?: string[];
  expectedSalary?: string;
  currency?: string;
  sector?: string;
  exp?: string;
  availability?: string;
  visible?: boolean;
  photoUrl?: string;
  experience?: CvExperience[];
  education?: CvEducation[];
  certifications?: CvCertification[];
  languages?: CvLanguage[];
  portfolio?: CvPortfolioItem[];
  educationLevel?: string;
  noticePeriod?: string;
  /** External link the candidate pasted themselves (Google Drive, etc.) — not our data, not gated. */
  cvFileUrl?: string;
  /** Internal object path in the private cv-files bucket, e.g. "{userId}/{uuid}.pdf" — never a URL, resolved via get-cv-url. */
  cvFilePath?: string;
};

export const AVAILABILITY_OPTIONS = [
  "Available immediately",
  "2 weeks notice",
  "1 month notice",
  "Not actively looking",
];

export const LANGUAGE_PROFICIENCY = ["Basic", "Conversational", "Fluent", "Native"];

export const SALARY_CURRENCIES = ["USD", "ZWL", "ZAR"];

// Application lifecycle (Jobs Reconstruction Phase 3, migration 4). 'pending'
// is kept exactly as the original value — it's what every existing
// application row already has, not renamed to 'submitted' or similar. The
// database's applications_validate_status_transition trigger is the single
// source of truth for which of these transitions is actually legal; this
// union and the label map just mirror it for display.
export type ApplicationStatus =
  | "pending"
  | "reviewing"
  | "shortlisted"
  | "interview"
  | "offered"
  | "hired"
  | "declined"
  | "withdrawn";

export const APPLICATION_STATUS_LABEL: Record<ApplicationStatus, string> = {
  pending: "Submitted",
  reviewing: "Under Review",
  shortlisted: "Shortlisted",
  interview: "Interview",
  offered: "Offer Extended",
  hired: "Hired",
  declined: "Not Selected",
  withdrawn: "Withdrawn",
};

// Terminal states an applicant can no longer withdraw from (matches the
// database trigger's own rule exactly — kept here only so the UI can grey
// out the withdraw action instead of letting the call fail server-side).
export const APPLICATION_TERMINAL_STATUSES: ApplicationStatus[] = ["hired", "declined", "withdrawn"];

export type ApplicationEvent = {
  id: string;
  application_id: string;
  event_type: "submitted" | "status_changed" | "interview_scheduled" | "note_added" | "withdrawn";
  actor_role: "applicant" | "employer" | "system" | null;
  detail: Record<string, unknown>;
  created_at: string;
};

// Row shape of public.applications (see supabase/schema/applications.sql).
export type JobApplication = {
  id: string;
  job_id: string;
  job_title: string;
  company: string;
  applicant_id: string;
  applicant_name: string;
  applicant_phone: string;
  applicant_email: string;
  message: string;
  status: ApplicationStatus;
  employer_id: string;
  applied_at: string;
  answers?: { question: string; answer: string }[];
};

export async function withdrawApplication(applicationId: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.rpc("withdraw_application", { p_application_id: applicationId });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function addApplicationNote(applicationId: string, note: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.rpc("add_application_note", { p_application_id: applicationId, p_note: note });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function fetchApplicationEvents(applicationId: string): Promise<ApplicationEvent[]> {
  const { data } = await supabase
    .from("application_events")
    .select("id,application_id,event_type,actor_role,detail,created_at")
    .eq("application_id", applicationId)
    .order("created_at", { ascending: false });
  return (data as ApplicationEvent[] | null) ?? [];
}

export async function closeJobListing(
  listingId: string,
  reason: "filled" | "paused" | "removed"
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.rpc("close_job_listing", { p_listing_id: listingId, p_reason: reason });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// Mirrors the exact classification rule used by the Phase 3 backfill
// migration's SQL (extract-then-classify, never guess): a bare number
// (optionally currency-prefixed) becomes min=max=that number; a
// negotiable/TBD/competitive keyword becomes negotiable=true with no
// number; anything else (including an unrecognized range format) is left
// ambiguous — null, not guessed — same as the server-side backfill would
// do for it.
export function parseSalaryText(raw: string): { min: number | null; max: number | null; negotiable: boolean } {
  const trimmed = raw.trim();
  if (!trimmed) return { min: null, max: null, negotiable: false };
  if (/negotiable|tbd|competitive/i.test(trimmed)) return { min: null, max: null, negotiable: true };
  const rangeMatch = trimmed.match(/([0-9]+(?:\.[0-9]+)?)\s*[-–]\s*([0-9]+(?:\.[0-9]+)?)/);
  if (rangeMatch) return { min: parseFloat(rangeMatch[1]), max: parseFloat(rangeMatch[2]), negotiable: false };
  const singleMatch = trimmed.match(/^[A-Za-z$]*\s*([0-9]+(?:\.[0-9]+)?)\s*$/);
  if (singleMatch) {
    const n = parseFloat(singleMatch[1]);
    return { min: n, max: n, negotiable: false };
  }
  return { min: null, max: null, negotiable: false };
}

// ── Structured job read/search (Jobs Reconstruction Phase 3) ────────────
// Mirrors public.get_job_detail()'s return shape. Any field here can be
// null even for a job that otherwise has a job_postings row — that's not
// an error, it means that specific field was never structured for this
// listing, and the UI should fall back to legacy parseJobField/parseJobBlock
// against `description` for that field only, not the whole screen.
export type JobPostingDetail = {
  id: string;
  seller_id: string;
  seller_name: string | null;
  seller_phone: string | null;
  title: string;
  description: string;
  price: number | null;
  currency: string | null;
  province: string | null;
  city: string | null;
  suburb: string | null;
  photos: string[] | null;
  status: string;
  created_at: string;
  expires_at: string | null;
  views: number | null;
  custom_questions: { question: string; type?: string }[] | null;
  job_type_id: string | null;
  job_type_label: string | null;
  industry_id: string | null;
  industry_label: string | null;
  experience_level: string | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
  salary_negotiable: boolean | null;
  skills: string[] | null;
  remote_type: string | null;
  responsibilities: string | null;
  requirements: string | null;
  benefits: string | null;
  how_to_apply_email: string | null;
  how_to_apply_phone: string | null;
  accepts_in_app_applications: boolean;
  application_deadline: string | null;
  has_structured_data: boolean;
};

export async function getJobDetail(listingId: string): Promise<JobPostingDetail | null> {
  const { data, error } = await supabase.rpc("get_job_detail", { p_listing_id: listingId });
  if (error || !data?.length) return null;
  return data[0] as JobPostingDetail;
}

export type JobSearchFilters = {
  query?: string;
  jobTypeId?: string;
  industryId?: string;
  experienceLevel?: string;
  province?: string;
  city?: string;
  remoteType?: string;
  salaryMin?: number;
  salaryMax?: number;
  negotiableOnly?: boolean;
  skills?: string[];
  limit?: number;
  offset?: number;
};

export async function searchJobs(filters: JobSearchFilters): Promise<JobPostingDetail[]> {
  const legacyParams = {
    p_query: filters.query || null,
    p_job_type: null,
    p_limit: filters.limit ?? 20,
    p_offset: filters.offset ?? 0,
  };
  let { data, error } = await supabase.rpc("search_active_jobs", {
    ...legacyParams,
    p_job_type_id: filters.jobTypeId || null,
    p_industry_id: filters.industryId || null,
    p_experience_level: filters.experienceLevel || null,
    p_province: filters.province || null,
    p_city: filters.city || null,
    p_remote_type: filters.remoteType || null,
    p_salary_min: filters.salaryMin ?? null,
    p_salary_max: filters.salaryMax ?? null,
    p_salary_negotiable_only: filters.negotiableOnly ?? false,
    p_skills: filters.skills?.length ? filters.skills : null,
  });
  // Migration 3 not applied yet — the live function only has the 4 legacy
  // params, so the extended call above fails signature matching entirely
  // (not just ignores the extras). Retry with exactly that signature.
  if (error && /PGRST202|Could not find the function/i.test(error.message || "")) {
    ({ data, error } = await supabase.rpc("search_active_jobs", legacyParams));
  }
  if (error) {
    console.warn("searchJobs:", error);
    return [];
  }
  return (data as JobPostingDetail[] | null) ?? [];
}

// ── Job alerts (Jobs Reconstruction Phase 3) ─────────────────────────────
export type JobAlert = {
  id: string;
  user_id: string;
  name: string;
  keywords: string | null;
  job_type_id: string | null;
  industry_id: string | null;
  province: string | null;
  city: string | null;
  remote_type: string | null;
  experience_level: string | null;
  salary_min: number | null;
  is_active: boolean;
  created_at: string;
};

export async function fetchMyJobAlerts(): Promise<JobAlert[]> {
  const { data } = await supabase.from("job_alerts").select("*").order("created_at", { ascending: false });
  return (data as JobAlert[] | null) ?? [];
}

export async function saveJobAlert(alert: Partial<JobAlert> & { name: string }): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.from("job_alerts").insert(alert as Record<string, unknown>);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// Edits the existing row in place — never a second insert. RLS ("job_alerts:
// owner all", migration 5) already scopes every operation on this table to
// `user_id = auth.uid()`, so a plain UPDATE-by-id is enough: it's a no-op
// (0 rows touched, no error) against another user's alert id rather than a
// leak or a cross-account write, without any extra client-side ownership
// check needed — the same guarantee create/delete already rely on here.
export async function updateJobAlert(
  id: string,
  changes: Partial<Omit<JobAlert, "id" | "user_id" | "created_at">>
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.from("job_alerts").update(changes as Record<string, unknown>).eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function deleteJobAlert(id: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.from("job_alerts").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ── Recommendations (Jobs Reconstruction Phase 3, migration 5) ──────────
// Row shape of recommend_jobs_for_me() — a strict subset of the full job
// listing columns, so this is intentionally NOT typed as JobListing; the
// browse screen adapts it to that shape at the call site rather than this
// file guessing at fields the RPC doesn't actually return.
export type RecommendedJob = {
  id: string;
  title: string;
  seller_name: string | null;
  city: string | null;
  province: string | null;
  job_type_label: string | null;
  industry_label: string | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
  remote_type: string | null;
  score: number;
};

// Scoring/matching logic lives entirely in the RPC (transparent DB
// scoring against profiles.preferred_* — see migration 5's own comment);
// this is a thin fetch, not a second recommendation engine. Fails soft to
// [] for a signed-out caller, a caller with no preferences set, or before
// migration 5 is applied — the browse screen simply omits the section
// rather than showing an error for what's an enhancement, not a core flow.
export async function fetchRecommendedJobs(limit = 10): Promise<RecommendedJob[]> {
  const { data, error } = await supabase.rpc("recommend_jobs_for_me", { p_limit: limit });
  if (error) return [];
  return (data as RecommendedJob[] | null) ?? [];
}

// ── Candidate search (Hire Talent) ───────────────────────────────────────
// Row shape pulled from public.profiles for candidate browsing — mirrors the
// column list www/js/jobs.js HireTalent_after selects.
export type CandidateProfileRow = {
  id: string;
  name: string | null;
  avatar: string | null;
  phone?: string | null;
  email?: string | null;
  contact_authorized?: boolean;
  has_cv?: boolean;
  verified: boolean | null;
  job_title: string | null;
  skills: string | null;
  sector: string | null;
  exp: string | null;
  province: string | null;
  city: string | null;
  open_to_work: boolean | null;
  cv: JobSeekerCv | null;
  updated_at?: string | null;
};

export function candidateSkillsList(row: Pick<CandidateProfileRow, "skills" | "cv">): string[] {
  if (row.cv?.skills?.length) return row.cv.skills;
  return (row.skills || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export const EXP_LEVEL_LABEL: Record<string, string> = {
  entry: "Entry Level (0-2 yrs)",
  mid: "3-5 Years",
  senior: "5-10 Years",
  expert: "10+ Years",
};

// ── contact_requests (Hire Talent contact unlock) ────────────────────────
// Two gates, not one: an active recruiter_monthly subscription is required
// just to submit a request (enforced server-side in
// request_candidate_contact(), see 202608201932_recruiter_contact_
// entitlement.sql), and a separate admin approval per (requester, candidate)
// pair is what actually unlocks that candidate's identity/contact —
// payment alone never unlocks anyone.
export type ContactRequest = {
  id: string;
  candidate_id: string;
  status: "pending" | "approved" | "declined";
  created_at: string;
  // Only present from list_my_contact_requests() (not from
  // request_candidate_contact()'s minimal return), and even there
  // candidate_name is server-redacted to null unless the request is
  // approved, the caller IS the candidate, or the caller is admin/moderator
  // — see 202608211200_redact_candidate_identity_in_contact_requests.sql.
  requester_id?: string;
  requester_name?: string;
  candidate_name?: string | null;
  company?: string;
  role?: string;
  decided_at?: string | null;
};

// ── Recruiter plans (RecruiterSubscription) ──────────────────────────────
// Mirrors www/js/jobs.js H.RECRUITER_PLAN_ENTITLEMENTS / H.RECRUITER_PLANS.
// The "recruiter" plan is live via StoreKit IAP (recruiter_monthly); price
// is never hardcoded for display — recruiter-subscription.tsx always pulls
// the real price/duration from the store. `price` here is only an internal
// sentinel (0 = free tier, >0 = paid tier) used to gate UI, not shown as-is.
// Any future plan without a mapped product ID falls back to a coming-soon
// toast (see PRODUCT_ID_BY_PLAN / handleUpgrade in recruiter-subscription.tsx).
export type RecruiterPlanEntitlements = {
  name: string;
  activeJobPosts: number; // -1 = unlimited
  price: number;
  rank: number;
};

export const RECRUITER_PLAN_ENTITLEMENTS: Record<string, RecruiterPlanEntitlements> = {
  free: { name: "Free", activeJobPosts: 2, price: 0, rank: 0 },
  recruiter: { name: "Recruiter", activeJobPosts: -1, price: 12, rank: 1 },
};

export function recruiterPlanEntitlements(planId: string | null | undefined): RecruiterPlanEntitlements {
  return RECRUITER_PLAN_ENTITLEMENTS[planId || "free"] || RECRUITER_PLAN_ENTITLEMENTS.free;
}

// listings.description is capped by the listings_description_length CHECK
// constraint (char_length(description) <= 5000). A job post doesn't store the
// typed fields separately — post.tsx/edit build one combined description from
// company, job type, industry, salary, experience, skills, description,
// responsibilities, requirements and contact details, so the limit applies to
// that generated string, never to any single field. Checking it per field
// would be both too strict and unable to catch the real overflow.
export const JOB_DESCRIPTION_MAX = 5000;

// Section headings buildDescription() emits on their own line, each followed
// by a block of text rather than an inline value. parseJobField only reads the
// remainder of the matching line, so it returns "" for every one of these —
// which is why the details screen fell back to printing the whole generated
// blob as one wall of text.
const JOB_BLOCK_KEYS = [
  "DESCRIPTION",
  "RESPONSIBILITIES",
  "REQUIREMENTS",
  "HOW TO APPLY",
] as const;

// Inline `KEY: value` headers, used to know where a block ends.
const JOB_INLINE_KEYS = [
  "COMPANY",
  "JOB TYPE",
  "INDUSTRY",
  "SALARY",
  "EXPERIENCE",
  "SKILLS",
] as const;

const ALL_JOB_KEYS: string[] = [...JOB_BLOCK_KEYS, ...JOB_INLINE_KEYS];

function isSectionHeading(line: string): boolean {
  const t = line.trim().toUpperCase();
  return ALL_JOB_KEYS.some((k) => t === `${k}:` || t.startsWith(`${k}: `));
}

// Reads a multi-line section: everything after `KEY:` up to the next known
// heading. Returns "" when the section is absent, so callers can hide the
// block instead of rendering an empty card.
export function parseJobBlock(
  description: string | null | undefined,
  key: string
): string {
  if (!description) return "";
  const lines = description.split("\n");
  const upper = key.toUpperCase();
  const start = lines.findIndex((l) => {
    const t = l.trim().toUpperCase();
    return t === `${upper}:` || t.startsWith(`${upper}:`);
  });
  if (start === -1) return "";
  const first = lines[start].slice(lines[start].indexOf(":") + 1).trim();
  const rest: string[] = [];
  for (let i = start + 1; i < lines.length; i++) {
    if (isSectionHeading(lines[i])) break;
    rest.push(lines[i]);
  }
  return [first, ...rest].join("\n").trim();
}

// Splits a block into display lines, tolerating the bullet characters and
// numbering people paste in from job boards. Legacy posts written as one
// paragraph come back as a single item, which still renders correctly.
export function parseJobList(block: string): string[] {
  if (!block) return [];
  return block
    .split("\n")
    .map((l) => l.replace(/^\s*(?:[-•*▪]|\d+[.)])\s*/, "").trim())
    .filter(Boolean);
}

// Strips the `KEY: value` metadata lines buildDescription() writes at the top.
// Those are storage markers, not prose: a job saved with inline metadata but
// no DESCRIPTION: block (older posts, or one saved with an empty summary)
// would otherwise render "COMPANY: Acme / JOB TYPE: Full-time / SALARY: …"
// as the visible body. The values are already shown as their own labelled
// rows, so showing them again as raw text is both duplicated and wrong.
export function stripJobMetadataLines(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .split("\n")
    .filter((line) => !isSectionHeading(line))
    .join("\n")
    .trim();
}

// True when the text still looks like the raw generated blob — used to decide
// between structured sections and a plain "About the role" fallback for
// legacy or hand-edited posts that never had the generated headings.
export function hasStructuredJobSections(
  description: string | null | undefined
): boolean {
  if (!description) return false;
  return JOB_BLOCK_KEYS.some((k) => parseJobBlock(description, k).length > 0);
}

// How many characters over the limit, or 0 when it fits. Callers use this both
// for the live counter and to block the request before it reaches Postgres.
export function jobDescriptionOverflow(fullDescription: string): number {
  return Math.max(0, fullDescription.length - JOB_DESCRIPTION_MAX);
}
