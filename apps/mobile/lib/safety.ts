import { supabase } from "./supabase";

// Mirrors www/js/safety.js: a display/translation-only layer over backend
// moderation decisions (Supabase RLS + triggers are the real gate — see
// supabase/migrations/moderation_backend_phase_a.sql). This never decides
// anything on its own; it only turns backend responses into UI-friendly text.

type FriendlyError = { code: string | null; message: string; blocked: boolean; label: string | null };

const ERROR_MAP: Record<string, { message: string; blocked?: boolean }> = {
  content_blocked: {
    message:
      "This ad can't be posted because it contains prohibited content. Please review our community guidelines and edit your listing.",
  },
  account_banned: {
    message: "Your account has been banned and can no longer post on PaMarket. Contact support if you believe this is a mistake.",
  },
  account_suspended: {
    message: "Your account is temporarily suspended, so you can't post right now. Please try again after the suspension ends.",
  },
  rate_limited: {
    message: "You've reached today's posting limit. Please try again later — this keeps PaMarket free of spam.",
  },
  company_verification_required: {
    message: "Employer verification is required before you can post a job. Complete verification to continue.",
  },
  // Not a moderation decision — a CHECK constraint on listings.description
  // (max 5000 characters). The screens validate before submitting, so this is
  // the backstop for anything that slips through; without it the raw
  // "violates check constraint" text was shown to the user verbatim.
  listings_description_length: {
    message: "Your job description is too long. Please shorten it and try again.",
    blocked: false,
  },
};

export function friendlyError(err: unknown): FriendlyError {
  let raw = "";
  if (typeof err === "string") raw = err;
  else if (err && typeof err === "object" && "message" in err) raw = String((err as { message: unknown }).message ?? "");
  else if (err) raw = String(err);

  const lower = raw.toLowerCase();
  for (const code of Object.keys(ERROR_MAP)) {
    if (lower.includes(code)) {
      const match = raw.match(/\(([^)]+)\)\s*$/);
      return {
        code,
        message: ERROR_MAP[code].message,
        blocked: ERROR_MAP[code].blocked ?? true,
        label: match ? match[1] : null,
      };
    }
  }
  // Anything that still looks like raw Postgres gets a generic message. The
  // listings_description_length case above is mapped explicitly; this stops
  // any *other* constraint, trigger or driver error from being shown verbatim
  // — users were seeing text like 'new row for relation "listings" violates
  // check constraint'.
  if (/violates|constraint|relation |sqlstate|duplicate key|null value in column|permission denied/i.test(raw)) {
    return {
      code: null,
      message: "We couldn't save that. Please check your details and try again.",
      blocked: false,
      label: null,
    };
  }
  return { code: null, message: raw || "Something went wrong. Please try again.", blocked: false, label: null };
}

export function isModerationBlock(err: unknown): boolean {
  return friendlyError(err).blocked === true;
}

export type ListingStatusInfo = {
  label: string;
  color: string;
  bg: string;
  border: string;
  message: string;
  publiclyVisible: boolean;
};

const STATUS: Record<string, ListingStatusInfo> = {
  active: {
    label: "Live",
    color: "#16a34a",
    bg: "#dcfce7",
    border: "#bbf7d0",
    message: "Your ad is live and visible to buyers.",
    publiclyVisible: true,
  },
  pending: {
    label: "Pending review",
    color: "#D97706",
    bg: "#FFFBEB",
    border: "#FDE68A",
    message: "Your ad is waiting to be reviewed before it goes live.",
    publiclyVisible: false,
  },
  under_review: {
    label: "Under review",
    color: "#D97706",
    bg: "#FFFBEB",
    border: "#FDE68A",
    message: "A moderator is reviewing this ad. It is temporarily hidden from buyers.",
    publiclyVisible: false,
  },
  flagged: {
    label: "Flagged",
    color: "#EA580C",
    bg: "#FFF7ED",
    border: "#FED7AA",
    message: "This ad was flagged and is being checked. It may be hidden from buyers until it is cleared.",
    publiclyVisible: false,
  },
  paused: {
    label: "Paused",
    color: "#475569",
    bg: "#F1F5F9",
    border: "#E2E8F0",
    message: "This ad is paused and hidden from buyers. Reactivate it any time.",
    publiclyVisible: false,
  },
  sold: {
    label: "Sold / Filled",
    color: "#64748b",
    bg: "#f1f5f9",
    border: "#e2e8f0",
    message: "This item is marked as sold.",
    publiclyVisible: false,
  },
  removed: {
    label: "Removed",
    color: "#ef4444",
    bg: "#fef2f2",
    border: "#fecaca",
    message: "This ad was removed for breaking our community guidelines.",
    publiclyVisible: false,
  },
  deleted: {
    label: "Deleted",
    color: "#ef4444",
    bg: "#fef2f2",
    border: "#fecaca",
    message: "This ad has been deleted.",
    publiclyVisible: false,
  },
  rejected: {
    label: "Rejected",
    color: "#ef4444",
    bg: "#fef2f2",
    border: "#fecaca",
    message: "This ad was not approved. Edit it to fix the problem and resubmit.",
    publiclyVisible: false,
  },
};

export function listingStatus(status: string | null | undefined): ListingStatusInfo {
  return STATUS[(status || "active").toLowerCase()] || STATUS.active;
}

export function isPubliclyVisible(status: string | null | undefined): boolean {
  return listingStatus(status).publiclyVisible;
}

export type Sanction = {
  type: "none" | "warning" | "suspension" | "ban";
  active: boolean;
  message: string;
  canPost: boolean;
  canMessage: boolean;
  until: string | null;
  ok: boolean;
};

function none(ok: boolean): Sanction {
  return { type: "none", active: false, message: "", canPost: true, canMessage: true, until: null, ok };
}

// Read-only: sanctions are created only from the admin panel. Returns
// ok:false on a failed/unavailable lookup so callers never silently
// un-ban someone from a transient error — only ok:true + type:'none'
// means "definitely no active sanction".
export async function checkSanction(userId: string | null | undefined): Promise<Sanction> {
  try {
    if (!userId) return none(false);
    const { data, error } = await supabase
      .from("user_sanctions")
      .select("sanction_type,reason,expires_at,active")
      .eq("user_id", userId)
      .eq("active", true)
      .order("issued_at", { ascending: false })
      .limit(1);
    if (error) return none(false);
    if (!data || !data.length) return none(true);

    const row = data[0];
    const type = (row.sanction_type || "").toLowerCase();
    const until = row.expires_at || null;
    if (until && new Date(until).getTime() < Date.now()) return none(true);

    if (type === "permanent_ban" || type === "ban") {
      return {
        type: "ban",
        active: true,
        until,
        message: "Your account has been banned for breaking PaMarket's rules. You can no longer post or message. Contact support to appeal.",
        canPost: false,
        canMessage: false,
        ok: true,
      };
    }
    if (type === "suspension" || type === "suspend") {
      return {
        type: "suspension",
        active: true,
        until,
        message: `Your account is suspended${until ? ` until ${new Date(until).toLocaleDateString()}` : ""}. You can't post or send messages during this time.`,
        canPost: false,
        canMessage: false,
        ok: true,
      };
    }
    if (type === "warning" || type === "warn") {
      return {
        type: "warning",
        active: true,
        until,
        message: `You've received a warning from our moderators${row.reason ? `: ${row.reason}` : ""}. Please follow the community guidelines to avoid further action.`,
        canPost: true,
        canMessage: true,
        ok: true,
      };
    }
    return none(true);
  } catch {
    return none(false);
  }
}

export const REPORT_REASONS = {
  listing: ["Scam or fraud", "Fake or counterfeit", "Incorrect information", "Prohibited item", "Spam", "Offensive content", "Duplicate", "Other"],
  user: ["Scammer", "Harassment", "Spam", "Fake account", "Impersonation", "Other"],
  message: ["Scam or fraud", "Harassment", "Spam", "Offensive content", "Sharing off-platform contact", "Other"],
} as const;

const CONTACT_PATTERNS = [
  /\bwhats\s?app\b/i,
  /\btelegram\b/i,
  /\b(?:\+?263|0)7\d{2}[\s-]?\d{3}[\s-]?\d{3}\b/,
  /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/i,
  /\bebank(?:ing)?\b|\becocash\b|\bmukuru\b/i,
];

export function chatSafetyHint(text: string | null | undefined): string | null {
  if (!text) return null;
  for (const pattern of CONTACT_PATTERNS) {
    if (pattern.test(text)) {
      return "For your safety, keep conversations and payments inside PaMarket. Be cautious about sharing phone numbers, email or paying before you meet.";
    }
  }
  return null;
}

// Keyword/pattern layer for the scam categories the product spec calls out
// explicitly (advance-fee/loan scams, OTP & credential phishing, fake
// investment/giveaway schemes, illegal goods). This is one layer, not the
// whole system — it flags for review and warns; it deliberately does not try
// to silently block a message outright (false positives on a wording match
// would be worse than a flagged-for-review false positive), except for the
// credential-phishing category, which is unambiguous enough and dangerous
// enough to warrant an explicit confirm step before sending.
export type ScamRisk = "none" | "flag" | "high";

const CREDENTIAL_PHISHING_PATTERNS = [
  /\b(?:send|share|give|forward)\s+(?:me\s+)?(?:your\s+)?(?:otp|one[\s-]?time[\s-]?pin|verification\s+code|pin\s+code)\b/i,
  /\b(?:your\s+)?(?:bank\s+)?(?:pin|password|login|account)\s+(?:number|code|details?)\b.{0,20}\b(?:send|share|give)\b/i,
  /\bwhat'?s\s+your\s+(?:otp|pin|password)\b/i,
];

const ADVANCE_FEE_PATTERNS = [
  /\b(?:pay|send|transfer)\s+(?:a\s+)?(?:small\s+)?(?:registration|processing|clearance|delivery|customs|advance|upfront)\s+fee\b/i,
  /\bloan\s+(?:guaranteed|approved)\s+(?:without|no)\s+(?:collateral|credit\s+check)\b/i,
  /\b(?:100%|guaranteed)\s+(?:returns?|profit)\b/i,
  /\bdouble\s+your\s+(?:money|investment)\b/i,
  /\byou(?:'ve| have)\s+won\b.{0,20}\bclaim\b/i,
];

const ILLEGAL_GOODS_PATTERNS = [/\b(?:cocaine|heroin|crystal\s+meth|mbanje\b.{0,10}\bsale)\b/i];

export function scamRisk(text: string | null | undefined): ScamRisk {
  if (!text) return "none";
  if (CREDENTIAL_PHISHING_PATTERNS.some((p) => p.test(text)) || ILLEGAL_GOODS_PATTERNS.some((p) => p.test(text))) {
    return "high";
  }
  if (ADVANCE_FEE_PATTERNS.some((p) => p.test(text))) return "flag";
  return "none";
}

export const SCAM_CONFIRM_MESSAGE =
  "This message looks like it's asking for a one-time code or password. PaMarket never needs your OTP or password, and neither does a legitimate buyer or seller. Send anyway?";
