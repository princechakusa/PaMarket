import { Linking } from "react-native";
import { supabase } from "./supabase";

// CV files are private documents stored in the private cv-files Supabase
// Storage bucket (see 202608190005_lock_down_cv_files_bucket.sql), never a
// public/permanent URL. The only way to read one is get-cv-url, which
// checks authorization (self, an employer with a real application
// relationship, or admin/moderator) before returning a short-lived signed
// URL — the caller never supplies a storage path directly.

export const ALLOWED_CV_MIME_TYPES = ["application/pdf"];
export const MAX_CV_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
export const CV_VALIDATION_ERROR =
  "CV files must be PDF and no larger than 5 MB.";

const EXT_BY_MIME: Record<string, string> = {
  "application/pdf": "pdf",
};

export function extForCvMime(mime: string): string {
  return EXT_BY_MIME[mime] || "pdf";
}

export function randomCvFileName(mime: string): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `${Date.now()}-${rand}.${extForCvMime(mime)}`;
}

/**
 * Request a short-lived signed URL for a candidate's CV.
 * - Omit candidateId (or pass the caller's own id) to view your own CV.
 * - Pass candidateId + jobId to view an applicant's CV as their employer —
 *   only succeeds if a real applications row links that candidate to that
 *   job under the caller's employer_id.
 */
export async function getCvSignedUrl(opts?: {
  candidateId?: string;
  jobId?: string;
}): Promise<{ ok: true; url: string } | { ok: false; reason: "no_cv" | "forbidden" | "error"; message?: string }> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) return { ok: false, reason: "error", message: "Not signed in" };

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/get-cv-url`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ candidateId: opts?.candidateId, jobId: opts?.jobId }),
    });
    const body = await res.json().catch(() => ({}));
    if (res.status === 403) return { ok: false, reason: "forbidden" };
    if (!res.ok) return { ok: false, reason: "error", message: body?.error };
    if (body?.reason === "no_cv") return { ok: false, reason: "no_cv" };
    if (body?.ok && body?.url) return { ok: true, url: body.url as string };
    return { ok: false, reason: "error", message: body?.error };
  } catch (e) {
    return { ok: false, reason: "error", message: (e as Error)?.message };
  }
}

/** Opens a signed CV URL, failing gracefully — never throws, never crashes. */
export async function openCvUrl(url: string): Promise<boolean> {
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}
