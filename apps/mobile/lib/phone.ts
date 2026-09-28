// Zimbabwe phone numbers for phone / WhatsApp sign-in and verification.
// Supabase Auth expects E.164 ("+263771234567"); people type "0771 234 567",
// "771234567", "+263 77 123 4567" or "263771234567" — all normalise here.
import { supabase } from "./supabase";

export type OtpChannel = "whatsapp" | "sms";

// Econet (77/78), NetOne (71), Telecel (73) mobile ranges.
const ZW_MOBILE_E164 = /^\+2637[1378]\d{7}$/;

export function normalizeZwPhone(input: string): string | null {
  let digits = input.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) digits = digits.slice(1);
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("263")) digits = digits.slice(3);
  if (digits.startsWith("0")) digits = digits.slice(1);
  const e164 = `+263${digits}`;
  return ZW_MOBILE_E164.test(e164) ? e164 : null;
}

// "+263771234567" → "+263 77 123 4567"
export function formatZwPhone(e164: string): string {
  const m = e164.match(/^\+263(\d{2})(\d{3})(\d{4})$/);
  return m ? `+263 ${m[1]} ${m[2]} ${m[3]}` : e164;
}

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
