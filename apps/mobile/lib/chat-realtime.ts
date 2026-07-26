import { supabase } from "./supabase";

// Mirrors www/js/realtime-extras.js: online presence (Supabase Presence, no
// schema needed), per-conversation typing indicators (broadcast), and read
// receipts (existing messages.read column). All best-effort — chat already
// works via polling/realtime INSERT, so these only enhance it.

let presenceChannel: ReturnType<typeof supabase.channel> | null = null;
let onlineUserIds = new Set<string>();
// React Navigation keeps previous screens mounted underneath the active one,
// so more than one screen (e.g. the Messages list AND an open chat thread)
// can call initPresence() at the same time. A single shared channel is
// correct, but every subscriber's onChange must still fire — a single
// "first caller owns it" guard silently drops every later screen's updates.
const subscribers = new Set<(online: Set<string>) => void>();

export function initPresence(userId: string, onChange: (online: Set<string>) => void) {
  subscribers.add(onChange);
  if (!presenceChannel) {
    presenceChannel = supabase.channel("online-users", { config: { presence: { key: userId } } });
    presenceChannel
      .on("presence", { event: "sync" }, () => {
        const state = presenceChannel!.presenceState();
        onlineUserIds = new Set(Object.keys(state));
        subscribers.forEach((fn) => fn(onlineUserIds));
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          presenceChannel!.track({ online_at: new Date().toISOString() });
        }
      });
  } else {
    // Channel already live — hand the new subscriber the current state immediately.
    onChange(onlineUserIds);
  }
  return () => {
    subscribers.delete(onChange);
    if (subscribers.size === 0 && presenceChannel) {
      supabase.removeChannel(presenceChannel);
      presenceChannel = null;
      onlineUserIds = new Set();
    }
  };
}

export function isUserOnline(userId: string | null | undefined): boolean {
  return !!userId && onlineUserIds.has(userId);
}

export function joinChatChannel(conversationId: string, myUserId: string, onTypingChange: (typing: boolean) => void) {
  const channel = supabase.channel(`chat-${conversationId}`, { config: { broadcast: { self: false } } });
  let clearTimer: ReturnType<typeof setTimeout> | null = null;

  channel
    .on("broadcast", { event: "typing" }, (payload: any) => {
      const p = payload.payload || {};
      if (String(p.userId) === String(myUserId)) return;
      onTypingChange(!!p.typing);
      if (clearTimer) clearTimeout(clearTimer);
      if (p.typing) {
        clearTimer = setTimeout(() => onTypingChange(false), 5000);
      }
    })
    .subscribe();

  let lastSent = 0;
  let stopTimer: ReturnType<typeof setTimeout> | null = null;

  function notifyTyping() {
    const now = Date.now();
    if (now - lastSent > 1500) {
      lastSent = now;
      channel.send({ type: "broadcast", event: "typing", payload: { userId: myUserId, typing: true } });
    }
    if (stopTimer) clearTimeout(stopTimer);
    stopTimer = setTimeout(stopTyping, 2500);
  }

  function stopTyping() {
    if (stopTimer) clearTimeout(stopTimer);
    lastSent = 0;
    channel.send({ type: "broadcast", event: "typing", payload: { userId: myUserId, typing: false } });
  }

  function leave() {
    if (clearTimer) clearTimeout(clearTimer);
    if (stopTimer) clearTimeout(stopTimer);
    supabase.removeChannel(channel);
  }

  return { notifyTyping, stopTyping, leave };
}

export async function markConversationReadInCloud(conversationId: string, otherUserId: string) {
  await supabase
    .from("messages")
    .update({ read: true })
    .eq("conversation_id", conversationId)
    .eq("sender_id", otherUserId)
    .eq("read", false);
}

export function subscribeToReadReceipts(myUserId: string, onRead: (messageId: string, conversationId: string) => void) {
  const channel = supabase
    .channel("msg-reads")
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages" }, (payload: any) => {
      const row = payload.new;
      if (!row?.read || String(row.sender_id) !== String(myUserId)) return;
      onRead(row.id, row.conversation_id);
    })
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}
