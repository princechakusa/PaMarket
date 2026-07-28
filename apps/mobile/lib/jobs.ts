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
