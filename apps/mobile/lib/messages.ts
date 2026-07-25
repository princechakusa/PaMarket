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

export function messagePreview(message: MessageRow | undefined): string {
  if (!message) return "";
  if (message.deleted) return "This message was deleted";
  if (message.image) return "📷 Photo";
  return displayText(message.text);
}

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
