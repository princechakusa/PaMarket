// Lightweight, on-device scam pattern check for chat messages from the
// OTHER person. It never blocks or hides anything — it only decides whether
// to show a safety warning above the conversation. Patterns are the ones
// Zimbabwean marketplace scams actually use: paying a deposit / "booking fee"
// before viewing, EcoCash/InnBucks "send first", asking for an OTP/PIN,
// moving the deal off-platform, and courier/customs fee stories.

export type ScamSignal = "upfront_payment" | "code_request" | "off_platform" | "courier_fee";

const PATTERNS: { signal: ScamSignal; re: RegExp }[] = [
  {
    signal: "code_request",
    re: /\b(otp|one[\s-]?time (pin|code)|verification code|the code (i|we) sent|your (pin|password)|send (me )?(the )?code)\b/i,
  },
  {
    signal: "upfront_payment",
    re: /\b(deposit|booking fee|reservation fee|holding fee|pay (first|upfront|before)|send (the )?(money|payment|cash|ecocash|innbucks|onemoney)( first)?|ecocash (me|first|to)|transfer (first|before)|advance payment)\b/i,
  },
  {
    signal: "courier_fee",
    re: /\b(courier|customs|clearance|shipping|delivery) (fee|charge|cost)s?\b.*\b(pay|send)\b|\b(pay|send)\b.*\b(courier|customs|clearance) (fee|charge)s?\b/i,
  },
  {
    signal: "off_platform",
    re: /\b(chat|talk|continue|move) (on|to) (whatsapp|telegram|signal|facebook)\b|\bt\.me\/|\bbit\.ly\/|\btinyurl\.com\//i,
  },
];

export function detectScamSignal(text: string | null | undefined): ScamSignal | null {
  if (!text) return null;
  for (const { signal, re } of PATTERNS) {
    if (re.test(text)) return signal;
  }
  return null;
}

export const SCAM_SIGNAL_COPY: Record<ScamSignal, { title: string; body: string }> = {
  upfront_payment: {
    title: "Careful: payment before viewing",
    body: "Never pay a deposit, booking fee or send EcoCash before you have seen the item in person. This is the most common scam.",
  },
  code_request: {
    title: "Never share codes or PINs",
    body: "Nobody genuine needs your OTP, EcoCash PIN or password. Sharing it lets someone take over your account or money.",
  },
  courier_fee: {
    title: "Watch out for courier or customs fees",
    body: "Sellers asking you to pay a courier, clearance or customs fee first is a known scam. Buy locally and inspect before paying.",
  },
  off_platform: {
    title: "Keep the chat on PaMarket",
    body: "Scammers move chats elsewhere so we can't help you. Links from strangers can steal your details.",
  },
};
