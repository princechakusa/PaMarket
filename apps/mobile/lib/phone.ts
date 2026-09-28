// Zimbabwe phone numbers for phone / WhatsApp sign-in and verification.
// Supabase Auth expects E.164 ("+263771234567"); people type "0771 234 567",
// "771234567", "+263 77 123 4567" or "263771234567" — all normalise here.
import { supabase } from "./supabase";
import type { OtpChannel } from "./phone-format";

export { formatZwPhone, normalizeZwPhone, type OtpChannel } from "./phone-format";

// Sends a sign-in / sign-up code. A first-time number creates the account
// (the sign-up pause trigger still applies).
export async function sendPhoneLoginCode(phone: string, channel: OtpChannel) {
  return supabase.auth.signInWithOtp({ phone, options: { channel, shouldCreateUser: true } });
}

// Adds / changes the phone on the signed-in account; Supabase texts a code
// that is confirmed with verifyOtp({ type: "phone_change" }).
export async function sendPhoneChangeCode(phone: string) {
  return supabase.auth.updateUser({ phone });
}

export async function verifyPhoneCode(phone: string, token: string, mode: "login" | "phone_change") {
  return supabase.auth.verifyOtp({ phone, token, type: mode === "login" ? "sms" : "phone_change" });
}
