// Native app-store review prompt — replaces the old custom star-rating
// modal (components/RatingPromptModal.tsx + the old lib/rating-prompt.ts),
// which just deep-linked straight to the store page and fired on a timer at
// app launch. This uses the real native review sheet: Google Play's In-App
// Review API on Android, Apple's StoreKit SKStoreReviewController on iOS —
// via expo-store-review, which wraps both. Falls back to the store listing
// URL only when the native sheet genuinely isn't available (old Android,
// TestFlight build, web).
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
import * as SecureStore from "expo-secure-store";
import * as StoreReview from "expo-store-review";
import * as Linking from "expo-linking";

const KEY_LAST_PROMPT_AT = "pm_review_last_prompt_at";
const KEY_POSITIVE_ACTIONS = "pm_review_positive_actions";
const KEY_LISTINGS_VIEWED = "pm_review_listings_viewed";

const REPROMPT_INTERVAL_MS = 90 * 24 * 60 * 60 * 1000; // 90 days
const POSITIVE_ACTIONS_THRESHOLD = 3;
const LISTINGS_VIEWED_THRESHOLD = 6;

const FALLBACK_URL =
  Platform.OS === "ios"
    ? "https://apps.apple.com/app/id6794616959"
    : "https://play.google.com/store/apps/details?id=com.pamarket.app";

async function getItem(key: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

async function setItem(key: string, value: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(key, value);
  } catch {
    // best-effort — a failed write just means this counter/gate resets
  }
}

async function getCount(key: string): Promise<number> {
  return parseInt((await getItem(key)) || "0", 10) || 0;
}

// In-memory guard only — prevents two triggers firing back to back (e.g. a
// save + a listing view landing in the same tick) from both racing past the
// async cooldown check before either has written the new timestamp.
let promptInFlight = false;

async function isWithinCooldown(): Promise<boolean> {
  const lastPromptAt = await getCount(KEY_LAST_PROMPT_AT);
  return lastPromptAt > 0 && Date.now() - lastPromptAt < REPROMPT_INTERVAL_MS;
}

async function showNativeReviewPrompt(): Promise<void> {
  if (promptInFlight) return;
  promptInFlight = true;
  try {
    if (await isWithinCooldown()) return;
    // Record the attempt before requesting — Apple/Google's own OS-level
    // throttling means requestReview() can silently no-op even when we
    // think we're eligible, and there is no way to detect that from here.
    // Marking the cooldown regardless is what actually keeps this to at
    // most once per 90 days from the user's perspective.
    await setItem(KEY_LAST_PROMPT_AT, String(Date.now()));
    if (await StoreReview.hasAction()) {
      await StoreReview.requestReview();
    } else {
      await Linking.openURL(FALLBACK_URL).catch(() => {});
    }
  } finally {
    promptInFlight = false;
  }
}

// Increments `key` and reports whether `threshold` was just reached,
// resetting the counter so the next batch starts fresh (otherwise, once a
// threshold is crossed, every single subsequent action would re-trigger the
// eligibility check for as long as the 90-day cooldown already blocks it —
// harmless, but wasted counter growth and storage writes forever).
async function bumpAndCheckThreshold(key: string, threshold: number): Promise<boolean> {
  const next = (await getCount(key)) + 1;
  if (next >= threshold) {
    await setItem(key, "0");
    return true;
  }
  await setItem(key, String(next));
  return false;
}

// Call after a genuinely positive, successful action: posting a listing,
// saving one, or sending a chat message. Fire-and-forget — never await this
// in a way that could delay or block the calling flow.
export async function notifyPositiveAction(): Promise<void> {
  const reached = await bumpAndCheckThreshold(KEY_POSITIVE_ACTIONS, POSITIVE_ACTIONS_THRESHOLD);
  if (reached) await showNativeReviewPrompt();
}

// Call after a listing detail screen finishes loading (a "view"). Passive
// signal — needs more occurrences than notifyPositiveAction before it can
// trigger the prompt.
export async function notifyListingViewed(): Promise<void> {
  const reached = await bumpAndCheckThreshold(KEY_LISTINGS_VIEWED, LISTINGS_VIEWED_THRESHOLD);
  if (reached) await showNativeReviewPrompt();
}
