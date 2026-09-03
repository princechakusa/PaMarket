// Native app-store review prompt — replaces the old custom star-rating
// modal (components/RatingPromptModal.tsx + the old lib/rating-prompt.ts),
// which just deep-linked straight to the store page and fired on a timer at
// app launch. This uses the real native review sheet: Google Play's In-App
// Review API on Android, Apple's StoreKit SKStoreReviewController on iOS —
// via expo-store-review, which wraps both. Falls back to the store listing
// URL only when the native sheet genuinely isn't available (old Android,
// TestFlight build, web).
//
// Storage: plain expo-file-system JSON, NOT expo-secure-store. This app has
// had prior SecureStore/Keychain issues, and none of this data (a
// timestamp, two small counters) is sensitive — a review-state read/write
// failure must never be able to block launch, a listing view, a save, a
// post, or sending a message. Every read/write here is try/caught and
// resolves to a safe default on failure (see readState/writeState).
//
// Design:
// - Never triggered on app launch/login/signup/payment/error screens — it's
//   only ever called imperatively from a genuine positive-action success
//   path (see call sites: post.tsx, lib/saves.ts, chat/[id].tsx,
//   listing/[id].tsx).
// - Two independent counters feed the same gate: a handful of strong
//   positive actions (posted a listing, saved one, sent a message), or
//   passively viewing several listings. Either can trigger it once its
//   threshold is reached.
// - A single 90-day cooldown (from the last time we asked, native or
//   fallback) governs both paths, so crossing both thresholds around the
//   same time still only prompts once.
import { Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as StoreReview from "expo-store-review";
import * as Linking from "expo-linking";

const STATE_PATH = `${FileSystem.documentDirectory}pamarket-review-state.json`;

type ReviewState = {
  lastPromptAt: number;
  positiveActions: number;
  listingsViewed: number;
};

const DEFAULT_STATE: ReviewState = { lastPromptAt: 0, positiveActions: 0, listingsViewed: 0 };

const REPROMPT_INTERVAL_MS = 90 * 24 * 60 * 60 * 1000; // 90 days
const POSITIVE_ACTIONS_THRESHOLD = 3;
const LISTINGS_VIEWED_THRESHOLD = 6;

const FALLBACK_URL =
  Platform.OS === "ios"
    ? "https://apps.apple.com/app/id6794616959"
    : "https://play.google.com/store/apps/details?id=com.pamarket.app";

// Every call site treats this module as fire-and-forget best-effort — a
// storage hiccup here must degrade to "don't show the prompt this time",
// never throw out to the caller's success path.
async function readState(): Promise<ReviewState> {
  try {
    const info = await FileSystem.getInfoAsync(STATE_PATH);
    if (!info.exists) return DEFAULT_STATE;
    const raw = await FileSystem.readAsStringAsync(STATE_PATH);
    const parsed = JSON.parse(raw);
    return {
      lastPromptAt: Number(parsed?.lastPromptAt) || 0,
      positiveActions: Number(parsed?.positiveActions) || 0,
      listingsViewed: Number(parsed?.listingsViewed) || 0,
    };
  } catch {
    return DEFAULT_STATE;
  }
}

async function writeState(state: ReviewState): Promise<void> {
  try {
    await FileSystem.writeAsStringAsync(STATE_PATH, JSON.stringify(state));
  } catch {
    // best-effort — a failed write just means this counter/gate resets
  }
}

// In-memory guard only — prevents two triggers firing back to back (e.g. a
// save + a listing view landing in the same tick) from both racing past the
// async cooldown check before either has written the new state.
let promptInFlight = false;

async function showNativeReviewPrompt(state: ReviewState): Promise<void> {
  if (promptInFlight) return;
  promptInFlight = true;
  try {
    if (state.lastPromptAt > 0 && Date.now() - state.lastPromptAt < REPROMPT_INTERVAL_MS) return;
    // Record the attempt before requesting — Apple/Google's own OS-level
    // throttling means requestReview() can silently no-op even when we
    // think we're eligible, and there is no way to detect that from here.
    // Marking the cooldown regardless is what actually keeps this to at
    // most once per 90 days from the user's perspective.
    await writeState({ ...state, lastPromptAt: Date.now() });
    try {
      if (await StoreReview.hasAction()) {
        await StoreReview.requestReview();
      } else {
        await Linking.openURL(FALLBACK_URL).catch(() => {});
      }
    } catch {
      // Never let a native-module hiccup here surface to the caller.
    }
  } finally {
    promptInFlight = false;
  }
}

// Bumps `key` in the loaded state and reports whether `threshold` was just
// reached, resetting that counter so the next batch starts fresh (otherwise,
// once a threshold is crossed, every subsequent action would re-check
// eligibility for as long as the 90-day cooldown already blocks it —
// harmless, but wasted storage writes forever).
async function bumpAndCheckThreshold(
  key: "positiveActions" | "listingsViewed",
  threshold: number
): Promise<{ reached: boolean; state: ReviewState }> {
  const state = await readState();
  const next = state[key] + 1;
  if (next >= threshold) {
    const updated = { ...state, [key]: 0 };
    await writeState(updated);
    return { reached: true, state: updated };
  }
  const updated = { ...state, [key]: next };
  await writeState(updated);
  return { reached: false, state: updated };
}

// Call after a genuinely positive, successful action: posting a listing,
// saving one, or sending a chat message. Fire-and-forget — never await this
// in a way that could delay or block the calling flow.
export async function notifyPositiveAction(): Promise<void> {
  try {
    const { reached, state } = await bumpAndCheckThreshold("positiveActions", POSITIVE_ACTIONS_THRESHOLD);
    if (reached) await showNativeReviewPrompt(state);
  } catch {
    // A review-prompt failure must never affect the action that just
    // succeeded (post/save/send) — swallow anything unexpected here too.
  }
}

// Call after a listing detail screen finishes loading (a "view"). Passive
// signal — needs more occurrences than notifyPositiveAction before it can
// trigger the prompt.
export async function notifyListingViewed(): Promise<void> {
  try {
    const { reached, state } = await bumpAndCheckThreshold("listingsViewed", LISTINGS_VIEWED_THRESHOLD);
    if (reached) await showNativeReviewPrompt(state);
  } catch {
    // Same as above — never let this affect the listing screen.
  }
}
