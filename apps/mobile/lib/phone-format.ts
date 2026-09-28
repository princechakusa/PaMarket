// Pure Zimbabwe phone-number helpers (no Supabase / React Native imports, so
// they can be unit-tested in plain Node). lib/phone.ts re-exports these.
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
