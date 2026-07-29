import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import * as Linking from "expo-linking";

const KEY_DONE = "pm_rate_done";
const KEY_SNOOZE = "pm_rate_snooze";
const KEY_OPENS = "pm_rate_opens";
const SNOOZE_MS = 5 * 86400000;
const ANDROID_PACKAGE = "com.pamarket.app";
const IOS_STORE_SEARCH_URL = "https://apps.apple.com/search?term=PaMarket%20Zimbabwe";

let checkedThisSession = false;

async function get(key: string) {
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

async function set(key: string, value: string) {
  try {
    await SecureStore.setItemAsync(key, value);
  } catch {
    // ignore
  }
}

// Mirrors www/js/app.js H.maybeShowRatingPrompt: shows once per session, only
// after the 3rd app open, and snoozes 5 days if the user picks "Maybe later".
export async function shouldShowRatingPrompt(): Promise<boolean> {
  if (checkedThisSession) return false;
  checkedThisSession = true;

  if ((await get(KEY_DONE)) === "1") return false;

  const opens = (parseInt((await get(KEY_OPENS)) || "0", 10) || 0) + 1;
  await set(KEY_OPENS, String(opens));
  if (opens < 3) return false;

  const snooze = parseInt((await get(KEY_SNOOZE)) || "0", 10) || 0;
  if (snooze && Date.now() - snooze < SNOOZE_MS) return false;

  return true;
}

export async function snoozeRatingPrompt() {
  await set(KEY_SNOOZE, String(Date.now()));
}

export async function openAppRating() {
  await set(KEY_DONE, "1");
  if (Platform.OS === "android") {
    const marketUrl = `market://details?id=${ANDROID_PACKAGE}`;
    const webUrl = `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`;
    const canOpenMarket = await Linking.canOpenURL(marketUrl).catch(() => false);
    await Linking.openURL(canOpenMarket ? marketUrl : webUrl).catch(() => {});
    return;
  }

  // Use search until the live App Store numeric ID is available.
  await Linking.openURL(IOS_STORE_SEARCH_URL).catch(() => {});
}
