export const JOB_CATEGORIES = [
  "Accounting & Finance",
  "Sales & Marketing",
  "IT & Technology",
  "Construction",
  "Healthcare",
  "Education",
  "Hospitality",
  "Administration",
  "Engineering",
  "Driving & Logistics",
];

export const JOB_TYPES = ["Full-time", "Part-time", "Contract", "Freelance", "Internship"];

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
  cvFileUrl?: string;
};

export const AVAILABILITY_OPTIONS = [
  "Available immediately",
  "2 weeks notice",
  "1 month notice",
  "Not actively looking",
];

export const LANGUAGE_PROFICIENCY = ["Basic", "Conversational", "Fluent", "Native"];

export const SALARY_CURRENCIES = ["USD", "ZWL", "ZAR"];

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
  status: "pending" | "shortlisted" | "declined";
  employer_id: string;
  applied_at: string;
};

// ── Candidate search (Hire Talent) ───────────────────────────────────────
// Row shape pulled from public.profiles for candidate browsing — mirrors the
// column list www/js/jobs.js HireTalent_after selects.
export type CandidateProfileRow = {
  id: string;
  name: string | null;
  avatar: string | null;
  verified: boolean | null;
  job_title: string | null;
  skills: string | null;
  sector: string | null;
  exp: string | null;
  city: string | null;
  open_to_work: boolean | null;
  cv: JobSeekerCv | null;
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
// See supabase/migrations/add_contact_requests.sql — admin-approved unlock
// of a candidate's identity/contact for a specific employer. No money is
// stored or shown; payment (if any) is handled off-platform by admins.
export type ContactRequest = {
  id: string;
  requester_id: string;
  candidate_id: string;
  requester_name: string;
  candidate_name: string;
  company: string;
  role: string;
  note: string;
  status: "pending" | "approved" | "declined";
  created_at: string;
  decided_at: string | null;
};

// ── Recruiter plans (RecruiterSubscription) ──────────────────────────────
// Mirrors www/js/jobs.js H.RECRUITER_PLAN_ENTITLEMENTS / H.RECRUITER_PLANS.
// Paid upgrades go through Google Play Billing (out of scope here, same as
// business-subscription.tsx) — "Upgrade" is a coming-soon toast.
export type RecruiterPlanEntitlements = {
  name: string;
  activeJobPosts: number; // -1 = unlimited
  candidateAccess: string;
  profileVisibility: string;
  price: number;
  rank: number;
};

export const RECRUITER_PLAN_ENTITLEMENTS: Record<string, RecruiterPlanEntitlements> = {
  free: { name: "Free", activeJobPosts: 2, candidateAccess: "limited", profileVisibility: "standard", price: 0, rank: 0 },
  recruiter: { name: "Recruiter", activeJobPosts: -1, candidateAccess: "full", profileVisibility: "featured", price: 12, rank: 1 },
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
