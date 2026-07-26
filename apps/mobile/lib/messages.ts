import * as SecureStore from "expo-secure-store";

// "Delete for me" only hides a message on THIS device/account — the other
// party and the server-side row are untouched (unlike "delete for everyone",
// which soft-deletes the shared row). There's no per-user visibility column
// on `messages`, and adding one is a backend schema change outside this
// screen's scope, so the hidden-id set is tracked locally instead.
function hiddenIdsKey(conversationId: string): string {
  return `pamarket.chat-hidden.${conversationId}`;
}

export async function getLocallyHiddenIds(conversationId: string): Promise<Set<string>> {
  try {
    const raw = await SecureStore.getItemAsync(hiddenIdsKey(conversationId));
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

export async function hideMessageLocally(conversationId: string, messageId: string): Promise<Set<string>> {
  const current = await getLocallyHiddenIds(conversationId);
  current.add(messageId);
  await SecureStore.setItemAsync(hiddenIdsKey(conversationId), JSON.stringify([...current]));
  return current;
}

export type ConversationRow = {
  id: string;
  members: string[];
  listing_id: string | null;
};

export type MessageRow = {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_name: string | null;
  text: string | null;
  image: string | null;
  read: boolean;
  created_at: string;
  edited?: boolean;
  deleted?: boolean;
};

// Deterministic 1:1 conversation id, matching www/js/messages.js H.startChatWith:
// conv_<last8(idA)>_<last8(idB)> with member ids sorted so both sides compute
// the same id independently.
export function conversationIdFor(userIdA: string, userIdB: string): string {
  const [a, b] = [userIdA, userIdB].sort();
  const frag = (id: string) => id.slice(-8);
  return `conv_${frag(a)}_${frag(b)}`;
}

export function otherMember(conversation: ConversationRow, myUserId: string): string | undefined {
  return conversation.members.find((m) => m !== myUserId);
}

// WhatsApp-style "last seen" text for a chat header subtitle when the other
// user is currently offline.
export function lastSeenLabel(iso: string | null | undefined): string {
  if (!iso) return "Offline";
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return "Offline";
  const now = new Date();
  const diffMs = now.getTime() - then.getTime();
  if (diffMs < 60_000) return "Last seen just now";
  const time = then.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (sameDay(then, now)) return `Last seen today at ${time}`;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (sameDay(then, yesterday)) return `Last seen yesterday at ${time}`;
  const dateLabel = then.toLocaleDateString(undefined, { day: "numeric", month: "short" });
  return `Last seen ${dateLabel} at ${time}`;
}

export function messagePreview(message: MessageRow | undefined): string {
  if (!message) return "";
  if (message.deleted) return "This message was deleted";
  if (message.image) return "📷 Photo";
  return displayText(message.text);
}

// Mobile has no "make an offer" composer yet — offers only ever arrive from
// the web client — so chat/list rendering only needs to unwrap them safely,
// not render an interactive accept/decline card. Tracked as a follow-up.

type ReplyEnvelope = { _reply: { i: string; n: string; t: string }; t: string };

function isReplyEnvelope(value: unknown): value is ReplyEnvelope {
  return (
    !!value &&
    typeof value === "object" &&
    "_reply" in value &&
    "t" in value &&
    typeof (value as ReplyEnvelope).t === "string"
  );
}

type OfferEnvelope = {
  _offer: { k: "offer" | "counter" | "accept" | "decline"; price?: number; cur?: string; listingTitle?: string };
};

function isOfferEnvelope(value: unknown): value is OfferEnvelope {
  return !!value && typeof value === "object" && "_offer" in value;
}

// Matches the web client's offer summary wording (www/js/messages.js previewBody).
function offerSummary(offer: OfferEnvelope["_offer"]): string {
  if (offer.k === "accept") return "Offer accepted";
  if (offer.k === "decline") return "Offer declined";
  const amount = Number(offer.price || 0).toLocaleString();
  const label = offer.k === "counter" ? "Counter-offer" : "Offer";
  return `💰 ${label}: $${amount}`;
}

// Messages can be JSON-encoded envelopes (reply quotes, offer cards — see
// www/js/messages.js parseReply/parseOffer) rather than plain text. Unwrap to
// the actual message body for display; falls back to the raw text if it
// isn't one of the known envelope shapes.
export function displayText(text: string | null | undefined): string {
  if (!text) return "";
  if (!text.startsWith("{")) return text;
  try {
    const parsed = JSON.parse(text);
    if (isReplyEnvelope(parsed)) return parsed.t;
    if (isOfferEnvelope(parsed)) return offerSummary(parsed._offer);
  } catch {
    // not JSON — fall through to raw text
  }
  return text;
}

export function replyQuote(text: string | null | undefined): { name: string; text: string } | null {
  if (!text || !text.startsWith("{")) return null;
  try {
    const parsed = JSON.parse(text);
    if (isReplyEnvelope(parsed)) return { name: parsed._reply.n, text: parsed._reply.t };
  } catch {
    // not JSON
  }
  return null;
}
