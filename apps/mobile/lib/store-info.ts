import { Platform } from "react-native";

// Single source of truth for platform-specific store names/instructions used
// across legal text (lib/legal.ts) and the support bot knowledge base
// (lib/support-bot-kb.ts) — those used to hardcode "Google Play Billing"
// everywhere even though iOS purchases now go through Apple's In-App
// Purchase system instead. Platform.OS is fixed for the life of a running
// app install, so reading it once at module load here is safe.
const isIOS = Platform.OS === "ios";

export const STORE_NAME = isIOS ? "the App Store" : "Google Play";
export const BILLING_NAME = isIOS ? "Apple's In-App Purchase billing" : "Google Play Billing";
export const ACCOUNT_NAME = isIOS ? "Apple ID" : "Google account";

// How a user actually manages/cancels a subscription on each platform —
// these are genuinely different flows, not just a name swap: iOS
// subscriptions are managed from the Settings app, not from within the App
// Store app itself.
export const MANAGE_SUBSCRIPTION_PATH = isIOS
  ? "Settings app on your iPhone → your name → Subscriptions"
  : "Google Play Store → tap your profile icon → Payments & subscriptions → Subscriptions";

export const REFUND_PATH = isIOS
  ? "reportaproblem.apple.com, or Settings → your name → Subscriptions → select the purchase → Report a Problem"
  : "Google Play Store → Order history → find the purchase → Report a problem";

export const REFUND_POLICY_OWNER = isIOS ? "Apple's" : "Google Play's";
