import { AppState } from "react-native";
import { supabase } from "./supabase";

// Mirrors www/js/telemetry.js: fire-and-forget product analytics for the
// admin Operations Center. Never blocks, never throws, self-disables
// permanently on the first schema error (migration not run yet is fine).
let cachedUid: string | null = null;
let presenceOff = false;
let lastTouch = 0;
const PRESENCE_THROTTLE_MS = 5 * 60 * 1000;

supabase.auth.onAuthStateChange(() => {
  cachedUid = null;
});

async function authUid(): Promise<string | null> {
  if (cachedUid) return cachedUid;
  try {
    const { data } = await supabase.auth.getUser();
    cachedUid = data.user?.id ?? null;
  } catch {
    cachedUid = null;
  }
  return cachedUid;
}

export async function touchPresence() {
  if (presenceOff) return;
  const now = Date.now();
  if (now - lastTouch < PRESENCE_THROTTLE_MS) return;
  lastTouch = now;
  try {
    const uid = await authUid();
    if (!uid) return;
    const { error } = await supabase.from("profiles").update({ last_seen_at: new Date().toISOString() }).eq("id", uid);
    if (error) {
      const m = (error.message || "").toLowerCase();
      if (m.includes("last_seen_at") || m.includes("column")) presenceOff = true;
    }
  } catch {
    // never surface
  }
}

let searchOff = false;
let lastTerm = "";
let lastTermAt = 0;
const SEARCH_DEDUPE_MS = 3000;

export async function logSearch(term: string, results?: number) {
  if (searchOff) return;
  const trimmed = (term ?? "").trim();
  if (trimmed.length < 2) return;
  const clipped = trimmed.length > 120 ? trimmed.slice(0, 120) : trimmed;

  const now = Date.now();
  if (
    now - lastTermAt < SEARCH_DEDUPE_MS &&
    (clipped === lastTerm || lastTerm.indexOf(clipped) === 0 || clipped.indexOf(lastTerm) === 0)
  ) {
    lastTerm = clipped;
    lastTermAt = now;
    return;
  }
  lastTerm = clipped;
  lastTermAt = now;

  try {
    const uid = await authUid();
    const { error } = await supabase.from("search_logs").insert({
      term: clipped.toLowerCase(),
      results: typeof results === "number" && results >= 0 ? results : null,
      user_id: uid,
    });
    if (error) {
      const m = (error.message || "").toLowerCase();
      if (m.includes("search_logs") || m.includes("does not exist") || m.includes("relation") || error.code === "42P01") {
        searchOff = true;
      }
    }
  } catch {
    // never surface
  }
}

// Wired once at app start (see app/_layout.tsx) — mirrors lifecycle.js's
// foreground/online -> touchPresence() hookup, plus a slow keepalive beat.
export function initTelemetry() {
  setTimeout(() => touchPresence(), 4000);
  const interval = setInterval(() => {
    if (AppState.currentState === "active") touchPresence();
  }, PRESENCE_THROTTLE_MS);

  const subscription = AppState.addEventListener("change", (state) => {
    if (state === "active") touchPresence();
  });

  return () => {
    clearInterval(interval);
    subscription.remove();
  };
}
