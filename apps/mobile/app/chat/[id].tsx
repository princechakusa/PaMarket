import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActionSheetIOS,
  Alert,
  AppState,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Image } from "expo-image";
import * as Clipboard from "expo-clipboard";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import Svg, { Circle, Path, Polyline } from "react-native-svg";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import {
  displayText,
  getLocallyHiddenIds,
  hideMessageLocally,
  lastSeenLabel,
  otherMember,
  replyQuote,
  type ConversationRow,
  type MessageRow,
} from "../../lib/messages";
import type { Profile } from "../../lib/profiles";
import { formatPrice } from "../../lib/listings";
import { chatSafetyHint, scamRisk, SCAM_CONFIRM_MESSAGE, REPORT_REASONS } from "../../lib/safety";
import { uploadImageUriToR2 } from "../../lib/uploadToR2";
import { initPresence, isUserOnline, joinChatChannel } from "../../lib/chat-realtime";
import { font, radius, space, type ColorPalette } from "../../lib/theme";
import { useThemedStyles } from "../../lib/theme-provider";
import { Avatar, ErrorState, GlassBackButton, ListSkeleton, toast } from "../../components/ui";
import { useIOSNativeHeader } from "../../lib/useIOSNativeHeader";

const EDIT_WINDOW_MS = 7 * 60 * 1000;

type ForwardCandidate = {
  conversationId: string;
  otherId: string;
  name: string;
  avatar: string | null;
};

type ListingContext = {
  id: string;
  title: string | null;
  price: number | null;
  currency: string | null;
  photos: string[] | null;
};

function MoreIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill={color}>
      <Circle cx={5} cy={12} r={2} />
      <Circle cx={12} cy={12} r={2} />
      <Circle cx={19} cy={12} r={2} />
    </Svg>
  );
}

function AttachIcon({ color }: { color: ColorPalette }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={color.textSub} strokeWidth={2}>
      <Path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" strokeLinecap="round" />
      <Polyline points="17 8 12 3 7 8" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M12 3v13" strokeLinecap="round" />
    </Svg>
  );
}

function SendIcon({ color }: { color: ColorPalette }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill={color.textOnBrand}>
      <Path d="M2 21l21-9L2 3v7l15 2-15 2z" />
    </Svg>
  );
}

// Read-receipt ticks: single check (sent), double check (delivered/read),
// blue-tinted double check when read. Rendered only on my own messages.
// Kept as literal tones (not theme tokens) since these sit on the brand-blue
// bubble background in both light/dark and must stay legible/high-contrast
// against it, independent of the resolved palette.
function Ticks({ read }: { read: boolean }) {
  const stroke = read ? "#8FC0FF" : "rgba(255,255,255,0.75)";
  return (
    <Svg width={16} height={12} viewBox="0 0 20 12" fill="none" stroke={stroke} strokeWidth={2}>
      <Polyline points="1 6.5 4.5 10 11 3" strokeLinecap="round" strokeLinejoin="round" />
      <Polyline points="8 10 14.5 3" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function timeLabel(dateString: string): string {
  return new Date(dateString).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Marking messages read used to be a single unguarded fire-and-forget
// call — on a flaky connection that request could fail with no retry,
// leaving a conversation permanently stuck "unread" in the Messages list
// even though the user had genuinely opened and read it. Retries a few
// times on failure; still best-effort (caller isn't blocked on this), but
// no longer silently gives up after one bad network blip.
async function markOtherMessagesRead(conversationId: string, otherUserId: string) {
  // Callers fire this without awaiting/catching it (best-effort, must never
  // block or crash the chat screen) — the try/catch is what makes that
  // safe, since an uncaught network error here would otherwise become an
  // unhandled promise rejection.
  try {
    for (let attempt = 1; attempt <= 3; attempt++) {
      const { error } = await supabase
        .from("messages")
        .update({ read: true })
        .eq("conversation_id", conversationId)
        .eq("sender_id", otherUserId)
        .eq("read", false);
      if (!error) return;
      if (attempt < 3) await sleep(attempt * 500);
      else console.warn("[chat] failed to mark messages read:", error.message);
    }
  } catch (e) {
    console.warn("[chat] failed to mark messages read:", e instanceof Error ? e.message : e);
  }
}

export default function ChatScreen() {
  // name/avatar are an optional hint the caller already had on hand (e.g. the
  // conversations list row, or the listing/business/profile being messaged
  // from) — shown instantly as the header while the real fetch is in flight,
  // so opening a chat never flashes "PaMarket User" first. Purely cosmetic:
  // the authoritative otherProfile/conversationBusiness fetch below still
  // always runs and overwrites this once it resolves.
  const { id, name: nameHint, avatar: avatarHint } = useLocalSearchParams<{ id: string; name?: string; avatar?: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const insets = useSafeAreaInsets();
  const myId = session?.user?.id;

  const [conversation, setConversation] = useState<ConversationRow | null>(null);
  const [otherProfile, setOtherProfile] = useState<Profile | null>(null);
  const [conversationBusiness, setConversationBusiness] = useState<{ id: string; name: string | null; logo: string | null } | null>(null);
  const [listing, setListing] = useState<ListingContext | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [inputText, setInputText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [replyTarget, setReplyTarget] = useState<MessageRow | null>(null);
  const [editTarget, setEditTarget] = useState<MessageRow | null>(null);
  const [otherOnline, setOtherOnline] = useState(false);
  const [otherTyping, setOtherTyping] = useState(false);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [forwardTarget, setForwardTarget] = useState<MessageRow | null>(null);
  const [forwardCandidates, setForwardCandidates] = useState<ForwardCandidate[]>([]);
  const [forwardLoading, setForwardLoading] = useState(false);
  const [pendingImages, setPendingImages] = useState<string[]>([]);
  const [isSendingImages, setIsSendingImages] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [keyboardAvoidingKey, setKeyboardAvoidingKey] = useState(0);
  const [isBlocked, setIsBlocked] = useState(false);
  // The composer row itself is what must clear the keyboard, so it's what
  // gets measured (see the keyboard listener below).
  const composerRef = useRef<View>(null);
  // Mirrors keyboardHeight so the keyboard listener (registered once, so it
  // closes over the initial state) can read the CURRENT padding.
  const keyboardHeightRef = useRef(0);
  keyboardHeightRef.current = keyboardHeight;
  // The composer's bottom edge in screen coordinates while NOTHING is
  // lifting it. Recorded only when the lift is 0 (see the composer's
  // onLayout), so it's always a clean reference point that can't drift.
  const composerRestingBottomRef = useRef<number | null>(null);

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    // iOS lifts the composer by the ACTUAL measured overlap between this
    // container and the keyboard, rather than trusting either
    // KeyboardAvoidingView's frame math or the raw keyboard height.
    //
    // KAV was the original bug: it measures its frame via onLayout
    // (coordinates relative to its PARENT) but compares that against the
    // keyboard's SCREEN position, so once this screen gained the native
    // iOS header it under-padded by the header height and hid the composer
    // completely. (That same bug is why jobs/post.tsx carries a hardcoded
    // keyboardVerticalOffset={90} magic number.)
    //
    // Padding by the raw endCoordinates.height then over-shot, leaving a
    // large gap between composer and keyboard — that assumes the container
    // ends exactly at the bottom of the screen, which isn't true here.
    // The lift is the gap between where the composer RESTS (its bottom edge
    // in screen coordinates with nothing lifting it — captured in the
    // composer's onLayout, see composerRestingBottomRef) and the keyboard's
    // real top edge (endCoordinates.screenY, same coordinate space). That's
    // exactly how much of the composer the keyboard would cover, and it's
    // correct regardless of header height, safe areas, or where the
    // container sits.
    //
    // Deliberately measured against a resting reference rather than
    // measuring live and adding the current lift back: locking the phone
    // with the keyboard open and unlocking fires several keyboard events in
    // quick succession, and any event landing after the lift state updated
    // but before the layout actually moved would double-count the lift and
    // leave a permanent gap above the keyboard.
    const showSub = Keyboard.addListener(showEvent, (e) => {
      setKeyboardVisible(true);
      if (Platform.OS !== "ios") return;
      const keyboardTop = e?.endCoordinates?.screenY;
      if (typeof keyboardTop !== "number") return;
      const restingBottom = composerRestingBottomRef.current;
      if (restingBottom != null) {
        setKeyboardHeight(Math.max(0, restingBottom - keyboardTop));
        return;
      }
      // No resting measurement yet (keyboard opened before the composer
      // ever laid out unlifted) — fall back to a live measurement.
      composerRef.current?.measureInWindow((_x, y, _w, h) => {
        setKeyboardHeight(Math.max(0, y + h + keyboardHeightRef.current - keyboardTop));
      });
    });
    const hideSub = Keyboard.addListener("keyboardDidHide", () => {
      setKeyboardVisible(false);
      setKeyboardHeight(0);
    });
    const willHideSub =
      Platform.OS === "ios"
        ? Keyboard.addListener("keyboardWillHide", () => {
            setKeyboardVisible(false);
            setKeyboardHeight(0);
          })
        : null;
    // The KeyboardAvoidingView correctly shrinks the visible chat area when
    // the keyboard opens, but the FlatList's own scroll offset doesn't move
    // with it — nothing re-triggers a scroll (onContentSizeChange only
    // fires when the message content itself changes, not when the
    // available viewport shrinks), so the most recent message(s) end up
    // hidden behind the keyboard until the user manually scrolls.
    // keyboardDidShow (not Will) so this runs after the show animation has
    // actually finished and the list's real height has settled.
    const didShowSub = Keyboard.addListener("keyboardDidShow", () => {
      listRef.current?.scrollToEnd({ animated: true });
    });
    const appStateSub = AppState.addEventListener("change", (state) => {
      if (state !== "active") {
        setKeyboardVisible(false);
        setKeyboardHeight(0);
        Keyboard.dismiss();
      } else {
        setKeyboardAvoidingKey((key) => key + 1);
      }
    });
    return () => {
      showSub.remove();
      hideSub.remove();
      willHideSub?.remove();
      didShowSub.remove();
      appStateSub.remove();
    };
  }, []);
  const styles = useThemedStyles(buildStyles);
  const themeColor = useThemedStyles((c) => c);
  const listRef = useRef<any>(null);
  const typingRef = useRef<{ notifyTyping: () => void; stopTyping: () => void; leave: () => void } | null>(null);

  const otherId = useMemo(
    () => (conversation && myId ? otherMember(conversation, myId) ?? null : null),
    [conversation, myId]
  );

  const visibleMessages = useMemo(
    () => (hiddenIds.size ? messages.filter((m) => !hiddenIds.has(m.id)) : messages),
    [messages, hiddenIds]
  );

  // Block status is per (me, otherId), not per-conversation — a business
  // chat has no personal "other user" to block, only the two-person case.
  useEffect(() => {
    if (!myId || !otherId) {
      setIsBlocked(false);
      return;
    }
    supabase
      .from("blocked_users")
      .select("id")
      .eq("blocker_id", myId)
      .eq("blocked_id", otherId)
      .maybeSingle()
      .then(({ data }) => setIsBlocked(!!data));
  }, [myId, otherId]);

  async function toggleBlockOther() {
    if (!myId || !otherId) return;
    if (isBlocked) {
      const { error } = await supabase.from("blocked_users").delete().eq("blocker_id", myId).eq("blocked_id", otherId);
      if (!error) {
        setIsBlocked(false);
        toast("Unblocked");
      }
    } else {
      Alert.alert(
        `Block ${displayName}?`,
        "They won't be able to message you, and you won't see messages from them. You can unblock them anytime from Settings.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Block",
            style: "destructive",
            onPress: async () => {
              const { error } = await supabase.from("blocked_users").insert({ blocker_id: myId, blocked_id: otherId });
              if (!error) {
                setIsBlocked(true);
                toast(`Blocked ${displayName}`);
              }
            },
          },
        ]
      );
    }
  }

  function openChatMenu() {
    if (!otherId || conversationBusiness) return;
    const options: { label: string; action: () => void; destructive?: boolean }[] = [
      { label: "View Profile", action: openProfile },
      { label: isBlocked ? "Unblock User" : "Block User", action: toggleBlockOther, destructive: !isBlocked },
    ];
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [...options.map((o) => o.label), "Cancel"],
          cancelButtonIndex: options.length,
          destructiveButtonIndex: options.findIndex((o) => o.destructive),
        },
        (index) => {
          if (index < options.length) options[index].action();
        }
      );
    } else {
      Alert.alert(displayName, undefined, [
        ...options.map((o) => ({
          text: o.label,
          style: o.destructive ? ("destructive" as const) : undefined,
          onPress: o.action,
        })),
        { text: "Cancel", style: "cancel" as const },
      ]);
    }
  }

  const load = useCallback(async () => {
    if (!id || !myId) return;
    const { data: conv, error: convError } = await supabase
      .from("conversations")
      .select("id,members,listing_id,business_id")
      .eq("id", id)
      .maybeSingle();
    if (convError) {
      setLoadError("Unable to load this conversation. Check your connection and try again.");
      return;
    }
    if (!conv) {
      setLoadError("This conversation no longer exists.");
      return;
    }
    setLoadError(null);
    setConversation(conv as ConversationRow);

    const oId = otherMember(conv as ConversationRow, myId);
    // Business conversation — show the shop's identity, not the owner's
    // personal profile (see supabase/migrations/add_conversation_business_id.sql).
    const businessId = (conv as ConversationRow).business_id;
    const listingId = (conv as ConversationRow).listing_id;

    // These four don't depend on each other — running them sequentially was
    // turning one screen open into 5 back-to-back network round trips.
    const [profileRes, bizRes, listingRes, msgsRes] = await Promise.all([
      oId
        ? supabase.from("profiles_public").select("id,name,avatar,verified,last_seen").eq("id", oId).maybeSingle()
        : Promise.resolve({ data: null }),
      businessId
        ? supabase.from("businesses").select("id,name,logo").eq("id", businessId).maybeSingle()
        : Promise.resolve({ data: null }),
      listingId
        ? supabase.from("listings").select("id,title,price,currency,photos").eq("id", listingId).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase
        .from("messages")
        .select("id,conversation_id,sender_id,sender_name,text,image,read,created_at,edited,deleted")
        .eq("conversation_id", id)
        .order("created_at", { ascending: true })
        .limit(200),
    ]);

    if (msgsRes.error) {
      setLoadError("Unable to load messages. Check your connection and try again.");
      return;
    }
    setOtherProfile((profileRes.data as Profile) ?? null);
    setConversationBusiness((bizRes.data as { id: string; name: string | null; logo: string | null } | null) ?? null);
    setListing((listingRes.data as ListingContext) ?? null);
    setMessages((msgsRes.data as MessageRow[]) ?? []);

    if (oId) markOtherMessagesRead(id, oId);
  }, [id, myId]);

  // Re-attempt on every focus too (not just the initial mount) — this was
  // previously a single unguarded fire-and-forget call with no error
  // handling, so on Zimbabwe's often-flaky mobile data one failed request
  // left the conversation permanently stuck "unread" in the Messages list,
  // with no retry ever happening again for that conversation.
  useFocusEffect(
    useCallback(() => {
      if (otherId && id) markOtherMessagesRead(id, otherId);
    }, [id, otherId])
  );

  useEffect(() => {
    setIsLoading(true);
    load().finally(() => setIsLoading(false));
  }, [load]);

  useEffect(() => {
    if (!id) return;
    getLocallyHiddenIds(id).then(setHiddenIds);
  }, [id]);

  async function deleteMessageForMe(target: MessageRow) {
    if (!id) return;
    const next = await hideMessageLocally(id, target.id);
    setHiddenIds(new Set(next));
  }

  // Realtime INSERT + UPDATE (read receipts / edits / deletes reflect live).
  useEffect(() => {
    if (!id) return;
    // Unique topic per call — a fixed topic can collide with a same-named
    // channel from a previous mount still mid-teardown, throwing "cannot add
    // postgres_changes callbacks after subscribe()" on remount.
    const channel = supabase
      .channel(`chat-thread-${id}-${Date.now()}-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${id}` },
        (payload) => {
          const row = payload.new as MessageRow;
          setMessages((prev) => {
            if (prev.some((m) => m.id === row.id)) return prev;
            // Replace a matching optimistic (local-) message from me if present.
            const optimisticIdx = prev.findIndex(
              (m) => m.id.startsWith("local-") && m.sender_id === row.sender_id && m.text === row.text && m.image === row.image
            );
            if (optimisticIdx >= 0) {
              const next = [...prev];
              next[optimisticIdx] = row;
              return next;
            }
            return [...prev, row];
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages", filter: `conversation_id=eq.${id}` },
        (payload) => {
          const row = payload.new as MessageRow;
          setMessages((prev) => prev.map((m) => (m.id === row.id ? { ...m, ...row } : m)));
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  useEffect(() => {
    if (!myId) return;
    return initPresence(myId, () => {
      setOtherOnline(isUserOnline(otherId));
    });
  }, [myId, otherId]);

  useEffect(() => {
    if (!id || !myId) return;
    const chat = joinChatChannel(id, myId, setOtherTyping);
    typingRef.current = chat;
    return () => chat.leave();
  }, [id, myId]);

  async function sendMessage(text: string, imageUrl?: string) {
    if (!myId || !id) return;
    const { data: profile } = await supabase.from("profiles").select("name").eq("id", myId).maybeSingle();

    // Wrap in the same _reply envelope used by www/js/messages.js so both
    // clients render/parse quoted replies identically.
    const storedText = replyTarget
      ? JSON.stringify({
          _reply: { i: replyTarget.id, n: replyTarget.sender_name ?? "", t: displayText(replyTarget.text) },
          t: text,
        })
      : text;

    const optimistic: MessageRow = {
      id: `local-${Date.now()}`,
      conversation_id: id,
      sender_id: myId,
      sender_name: profile?.name ?? "",
      text: storedText || null,
      image: imageUrl ?? null,
      read: false,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setInputText("");
    setReplyTarget(null);

    const { data: inserted, error: insertError } = await supabase
      .from("messages")
      .insert({
        conversation_id: id,
        sender_id: myId,
        sender_name: profile?.name ?? "",
        text: storedText || null,
        image: imageUrl ?? null,
        read: false,
      })
      .select("id")
      .single();

    if (insertError) {
      // The optimistic message was already shown — remove it rather than
      // leave it looking permanently "sent" when it never was (this was
      // silently swallowed before, most visibly when trg_check_message_block
      // rejects the insert because either party has blocked the other).
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      const isBlocked = /block exists between these users/i.test(insertError.message);
      toast(isBlocked ? "This message couldn't be delivered." : "Message not sent — try again.", 3000, true);
      return;
    }

    // Pattern-matched scam categories get auto-flagged for moderator review
    // regardless of whether either party reports it — see lib/safety.ts
    // scamRisk() for what this covers and why it flags rather than blocks.
    // reports has no chat_id/message_id columns (confirmed against the live
    // schema) — target_type/target_id is the only way this table records
    // what's being reported.
    if (text && inserted?.id && scamRisk(text) !== "none") {
      const { error: flagError } = await supabase.from("reports").insert({
        target_type: "message",
        target_id: inserted.id,
        reason: "Scam or fraud (auto-flagged)",
        reporter_id: myId,
      });
      if (flagError) console.warn("[report] auto-flag insert failed:", flagError.message);
    }
  }

  async function saveEdit(target: MessageRow, newText: string) {
    setMessages((prev) => prev.map((m) => (m.id === target.id ? { ...m, text: newText, edited: true } : m)));
    await supabase.from("messages").update({ text: newText, edited: true }).eq("id", target.id);
  }

  async function handleSend() {
    const trimmed = inputText.trim();
    if (trimmed && !editTarget && scamRisk(trimmed) === "high") {
      Alert.alert("Wait a moment", SCAM_CONFIRM_MESSAGE, [
        { text: "Cancel", style: "cancel" },
        { text: "Send anyway", style: "destructive", onPress: () => doSend() },
      ]);
      return;
    }
    await doSend();
  }

  async function doSend() {
    const trimmed = inputText.trim();
    if (pendingImages.length) {
      await sendPendingImages();
      if (trimmed) await sendMessage(trimmed);
      setInputText("");
      return;
    }
    if (!trimmed || isSending) return;
    typingRef.current?.stopTyping();
    setIsSending(true);
    try {
      if (editTarget) {
        await saveEdit(editTarget, trimmed);
        setEditTarget(null);
        setInputText("");
      } else {
        await sendMessage(trimmed);
      }
    } finally {
      setIsSending(false);
    }
  }

  async function deleteMessage(target: MessageRow) {
    setMessages((prev) => prev.map((m) => (m.id === target.id ? { ...m, deleted: true, text: null } : m)));
    await supabase.from("messages").update({ deleted: true, text: null }).eq("id", target.id);
  }

  async function copyMessage(target: MessageRow) {
    await Clipboard.setStringAsync(displayText(target.text));
    toast("Copied to clipboard");
  }

  async function openForwardPicker(target: MessageRow) {
    setForwardTarget(target);
    if (!myId) return;
    setForwardLoading(true);
    try {
      const { data: conversations } = await supabase
        .from("conversations")
        .select("id,members,listing_id")
        .contains("members", [myId]);
      const rows = ((conversations as ConversationRow[]) ?? []).filter((c) => c.id !== id);
      const otherIds = Array.from(
        new Set(rows.map((c) => otherMember(c, myId)).filter((oid): oid is string => !!oid))
      );
      const { data: profiles } = otherIds.length
        ? await supabase.from("profiles_public").select("id,name,avatar").in("id", otherIds)
        : { data: [] as Profile[] };
      const profilesById = new Map((profiles as Profile[] | null ?? []).map((p) => [p.id, p]));
      const candidates: ForwardCandidate[] = rows
        .map((c) => {
          const oId = otherMember(c, myId);
          if (!oId) return null;
          const profile = profilesById.get(oId);
          return { conversationId: c.id, otherId: oId, name: profile?.name || "PaMarket User", avatar: profile?.avatar ?? null };
        })
        .filter((c): c is ForwardCandidate => c !== null);
      setForwardCandidates(candidates);
    } finally {
      setForwardLoading(false);
    }
  }

  async function forwardTo(candidate: ForwardCandidate) {
    if (!forwardTarget || !myId) return;
    const { data: profile } = await supabase.from("profiles").select("name").eq("id", myId).maybeSingle();
    await supabase.from("messages").insert({
      conversation_id: candidate.conversationId,
      sender_id: myId,
      sender_name: profile?.name ?? "",
      text: forwardTarget.image ? null : displayText(forwardTarget.text),
      image: forwardTarget.image ?? null,
      read: false,
    });
    setForwardTarget(null);
    toast(`Forwarded to ${candidate.name}`);
  }

  async function reportMessage(target: MessageRow, reason: string) {
    // reports has no message_id/chat_id columns — confirmed against the
    // live schema. This insert previously always failed (unknown column)
    // and was never checked for an error, so it silently did nothing while
    // still claiming success below.
    const { error: reportError } = await supabase.from("reports").insert({
      target_type: "message",
      target_id: target.id,
      reason,
      reporter_id: myId ?? null,
    });
    if (reportError) {
      console.warn("[report] message report failed:", reportError.message);
      toast("Couldn't submit report. Please try again.", 3500, true);
      return;
    }
    toast("Report submitted. Thank you.");
  }

  function chooseReportReason(target: MessageRow) {
    const reasons = [...REPORT_REASONS.message];
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        { title: "Report message", options: [...reasons, "Cancel"], cancelButtonIndex: reasons.length },
        (index) => {
          if (index < reasons.length) reportMessage(target, reasons[index]);
        }
      );
    } else {
      Alert.alert("Report message", "Why are you reporting this?", [
        ...reasons.map((r) => ({ text: r, onPress: () => reportMessage(target, r) })),
        { text: "Cancel", style: "cancel" as const },
      ]);
    }
  }

  function handleLongPressMessage(item: MessageRow) {
    if (item.deleted) return;
    const isMine = item.sender_id === myId;
    const isRecent = Date.now() - new Date(item.created_at).getTime() < EDIT_WINDOW_MS;

    const options: { label: string; action: () => void; destructive?: boolean }[] = [
      { label: "Reply", action: () => setReplyTarget(item) },
    ];
    if (displayText(item.text)) {
      options.push({ label: "Copy", action: () => copyMessage(item) });
    }
    options.push({ label: "Forward", action: () => openForwardPicker(item) });
    if (isMine && isRecent) {
      options.push({
        label: "Edit",
        action: () => {
          setEditTarget(item);
          setReplyTarget(null);
          setInputText(displayText(item.text));
        },
      });
    }
    options.push({ label: "Delete for me", action: () => deleteMessageForMe(item), destructive: true });
    if (isMine) {
      options.push({ label: "Delete for everyone", action: () => deleteMessage(item), destructive: true });
    } else {
      options.push({ label: "Report message", action: () => chooseReportReason(item), destructive: true });
    }

    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [...options.map((o) => o.label), "Cancel"],
          cancelButtonIndex: options.length,
          destructiveButtonIndex: options.findIndex((o) => o.destructive),
        },
        (index) => {
          if (index < options.length) options[index].action();
        }
      );
    } else {
      Alert.alert("Message", undefined, [
        ...options.map((o) => ({
          text: o.label,
          style: o.destructive ? ("destructive" as const) : undefined,
          onPress: o.action,
        })),
        { text: "Cancel", style: "cancel" as const },
      ]);
    }
  }

  async function handleAttach() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted || !myId) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
      allowsMultipleSelection: true,
    });
    if (result.canceled || !result.assets?.length) return;
    setPendingImages((prev) => [...prev, ...result.assets.map((a) => a.uri)]);
  }

  function removePendingImage(uri: string) {
    setPendingImages((prev) => prev.filter((u) => u !== uri));
  }

  // Each message row holds exactly one `image` (no multi-image column), so a
  // multi-select send fans out into one message per photo, in order.
  async function sendPendingImages() {
    if (!myId || !pendingImages.length || isSendingImages) return;
    setIsSendingImages(true);
    const images = pendingImages;
    setPendingImages([]);
    try {
      for (const uri of images) {
        const key = `chat/${myId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
        const url = await uploadImageUriToR2(uri, key);
        await sendMessage("", url);
      }
    } catch {
      toast("Couldn't send one or more photos. Try again.", 4000, true);
    } finally {
      setIsSendingImages(false);
    }
  }

  const safetyHint = useMemo(() => chatSafetyHint(inputText), [inputText]);
  const canSend = (!!inputText.trim() || pendingImages.length > 0) && !isSending && !isSendingImages;

  const subtitle = conversationBusiness
    ? "Shop"
    : otherTyping
      ? "Typing…"
      : otherOnline
        ? "Online"
        : lastSeenLabel(otherProfile?.last_seen);

  const displayName = conversationBusiness?.name || otherProfile?.name || nameHint || "PaMarket User";
  const displayAvatar = conversationBusiness?.logo || otherProfile?.avatar || avatarHint;

  const openProfile = () => {
    if (conversationBusiness) {
      router.push({ pathname: "/business/[id]", params: { id: conversationBusiness.id } });
    } else if (otherId) {
      router.push({ pathname: "/profile/[id]", params: { id: otherId } });
    }
  };

  useIOSNativeHeader({
    backgroundColor: themeColor.surface,
    tintColor: themeColor.text,
    headerTitle: () => (
      <Pressable style={styles.headerIdentity} onPress={openProfile} disabled={!otherId && !conversationBusiness}>
        <Avatar uri={displayAvatar} name={displayName} size={32} online={!conversationBusiness && otherOnline} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.headerName} numberOfLines={1}>
            {displayName}
          </Text>
          <Text
            style={[styles.headerSubtitle, otherTyping ? styles.subtitleTyping : otherOnline ? styles.subtitleOnline : styles.subtitleOffline]}
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        </View>
      </Pressable>
    ),
    headerRight:
      otherId && !conversationBusiness
        ? () => (
            <Pressable onPress={openChatMenu} hitSlop={10}>
              <MoreIcon color={themeColor.text} />
            </Pressable>
          )
        : undefined,
  });

  return (
    <KeyboardAvoidingView
      key={keyboardAvoidingKey}
      // iOS: behavior is deliberately undefined (KAV renders as a plain
      // View) because its own padding math is what was broken here — the
      // measured keyboard overlap is applied directly instead. Android
      // keeps behavior="height", which works there and is unaffected by
      // this bug (no native header shown on Android for this screen).
      style={[styles.container, Platform.OS === "ios" ? { paddingBottom: keyboardHeight } : null]}
      behavior={Platform.OS === "ios" ? undefined : "height"}
    >
      {Platform.OS !== "ios" ? (
        <View style={[styles.header, { paddingTop: insets.top + space.md }]}>
          <GlassBackButton onPress={() => router.back()} flat />
          <Pressable style={styles.headerIdentity} onPress={openProfile} disabled={!otherId && !conversationBusiness}>
            <Avatar uri={displayAvatar} name={displayName} size={38} online={!conversationBusiness && otherOnline} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.headerName} numberOfLines={1}>
                {displayName}
              </Text>
              <Text
                style={[styles.headerSubtitle, otherTyping ? styles.subtitleTyping : otherOnline ? styles.subtitleOnline : styles.subtitleOffline]}
                numberOfLines={1}
              >
                {subtitle}
              </Text>
            </View>
          </Pressable>
          {otherId && !conversationBusiness ? (
            <Pressable onPress={openChatMenu} hitSlop={10}>
              <MoreIcon color={themeColor.text} />
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {listing ? (
        <Pressable
          style={styles.listingStrip}
          onPress={() => router.push({ pathname: "/listing/[id]", params: { id: listing.id } })}
        >
          {listing.photos?.[0] ? (
            <Image source={{ uri: listing.photos[0] }} style={styles.listingImage} contentFit="cover" cachePolicy="memory-disk" />
          ) : (
            <View style={[styles.listingImage, styles.listingImageEmpty]} />
          )}
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.listingTitle} numberOfLines={1}>
              {listing.title || "Listing"}
            </Text>
            <Text style={styles.listingPrice} numberOfLines={1}>
              {formatPrice({ price: listing.price, currency: listing.currency })}
            </Text>
          </View>
          <View style={styles.listingChevron}>
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={themeColor.textMuted} strokeWidth={2}>
              <Polyline points="9 18 15 12 9 6" />
            </Svg>
          </View>
        </Pressable>
      ) : null}

      {isLoading ? (
        <View style={{ padding: space.lg, flex: 1 }}>
          <ListSkeleton count={6} />
        </View>
      ) : loadError ? (
        <View style={{ flex: 1, justifyContent: "center" }}>
          <ErrorState
            title="Unable to load messages"
            subtitle={loadError}
            onRetry={() => {
              setIsLoading(true);
              load().finally(() => setIsLoading(false));
            }}
          />
        </View>
      ) : (
        <FlatList
          ref={listRef}
          style={{ flex: 1 }}
          // iOS's automatic keyboard-inset handling (default true on RN
          // 0.71+) and this screen's own manual KeyboardAvoidingView can
          // both try to make room for the keyboard at once — one already
          // reported symptom (the whole composer row disappearing, not
          // just scrolled to the wrong spot) matches the two adjustments
          // compounding and pushing content off-screen rather than just
          // under-adjusting. Disabling the automatic one leaves
          // KeyboardAvoidingView as the single source of truth.
          automaticallyAdjustKeyboardInsets={false}
          data={visibleMessages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messagesList}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          renderItem={({ item, index }) => {
            const isMine = item.sender_id === myId;
            const quote = replyQuote(item.text);
            const bodyText = displayText(item.text);
            const prev = visibleMessages[index - 1];
            const next = visibleMessages[index + 1];
            const firstOfGroup = !prev || prev.sender_id !== item.sender_id;
            const lastOfGroup = !next || next.sender_id !== item.sender_id;
            return (
              <Pressable
                style={[
                  styles.bubbleRow,
                  isMine ? styles.bubbleRowMine : styles.bubbleRowTheirs,
                  { marginTop: firstOfGroup ? space.md : space.xxs },
                ]}
                onLongPress={() => handleLongPressMessage(item)}
                delayLongPress={350}
              >
                <View
                  style={[
                    styles.bubble,
                    isMine ? styles.bubbleMine : styles.bubbleTheirs,
                    isMine && lastOfGroup && styles.bubbleMineTail,
                    !isMine && lastOfGroup && styles.bubbleTheirsTail,
                  ]}
                >
                  {item.image ? (
                    <Image source={{ uri: item.image }} style={styles.bubbleImage} contentFit="cover" cachePolicy="memory-disk" />
                  ) : null}
                  {quote ? (
                    <View style={[styles.replyQuote, isMine && styles.replyQuoteMine]}>
                      <Text style={[styles.replyQuoteName, isMine && styles.replyQuoteNameMine]} numberOfLines={1}>
                        {quote.name || "Message"}
                      </Text>
                      <Text style={[styles.replyQuoteText, isMine && styles.replyQuoteTextMine]} numberOfLines={1}>
                        {quote.text}
                      </Text>
                    </View>
                  ) : null}
                  {item.deleted ? (
                    <Text style={[styles.bubbleTextDeleted, isMine && styles.bubbleTextDeletedMine]}>
                      This message was deleted
                    </Text>
                  ) : bodyText ? (
                    <Text style={[styles.bubbleText, isMine && styles.bubbleTextMine]}>{bodyText}</Text>
                  ) : null}
                  <View style={styles.metaRow}>
                    {item.edited && !item.deleted ? (
                      <Text style={[styles.editedLabel, isMine && styles.metaMine]}>edited</Text>
                    ) : null}
                    <Text style={[styles.bubbleTime, isMine && styles.metaMine]}>{timeLabel(item.created_at)}</Text>
                    {isMine && !item.deleted && !item.id.startsWith("local-") ? <Ticks read={item.read} /> : null}
                  </View>
                </View>
              </Pressable>
            );
          }}
        />
      )}

      {replyTarget || editTarget ? (
        <View style={styles.composerPreview}>
          <View style={styles.composerPreviewBar} />
          <View style={styles.composerPreviewBody}>
            <Text style={styles.composerPreviewLabel}>
              {editTarget ? "Editing message" : `Replying to ${replyTarget?.sender_name || "message"}`}
            </Text>
            <Text style={styles.composerPreviewText} numberOfLines={1}>
              {displayText((editTarget ?? replyTarget)?.text)}
            </Text>
          </View>
          <Pressable
            style={styles.composerPreviewClose}
            hitSlop={8}
            onPress={() => {
              setReplyTarget(null);
              setEditTarget(null);
              if (editTarget) setInputText("");
            }}
          >
            <Text style={styles.composerPreviewCloseText}>×</Text>
          </Pressable>
        </View>
      ) : null}

      {pendingImages.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imagePreviewRow} contentContainerStyle={{ gap: space.sm, paddingHorizontal: space.lg }}>
          {pendingImages.map((uri) => (
            <View key={uri} style={styles.imagePreviewItem}>
              <Image source={{ uri }} style={styles.imagePreviewThumb} contentFit="cover" />
              <Pressable style={styles.imagePreviewRemove} onPress={() => removePendingImage(uri)} hitSlop={8}>
                <Text style={styles.imagePreviewRemoveText}>×</Text>
              </Pressable>
            </View>
          ))}
        </ScrollView>
      ) : null}

      {safetyHint ? (
        <View style={styles.safetyHint}>
          <Text style={styles.safetyHintText}>{safetyHint}</Text>
        </View>
      ) : null}

      <View
        ref={composerRef}
        // Capture the composer's resting bottom edge only while nothing is
        // lifting it — that's the stable reference the keyboard listener
        // measures against. Layout re-fires whenever the lift returns to 0
        // (keyboard dismissed, rotation, etc.), so it stays current.
        onLayout={() => {
          if (Platform.OS !== "ios" || keyboardHeightRef.current !== 0) return;
          composerRef.current?.measureInWindow((_x, y, _w, h) => {
            composerRestingBottomRef.current = y + h;
          });
        }}
        style={[styles.inputBar, { paddingBottom: keyboardVisible ? space.xs : Math.max(insets.bottom, space.md) }]}
      >
        <Pressable style={styles.attachButton} onPress={handleAttach} hitSlop={6}>
          <AttachIcon color={themeColor} />
        </Pressable>
        <TextInput
          style={styles.input}
          placeholder="Message..."
          placeholderTextColor={themeColor.textMuted}
          value={inputText}
          onChangeText={(t) => {
            setInputText(t);
            typingRef.current?.notifyTyping();
          }}
          multiline
        />
        <Pressable
          style={[styles.sendButton, !canSend && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!canSend}
        >
          <SendIcon color={themeColor} />
        </Pressable>
      </View>

      <Modal visible={!!forwardTarget} animationType="slide" transparent onRequestClose={() => setForwardTarget(null)}>
        <Pressable style={styles.modalScrim} onPress={() => setForwardTarget(null)}>
          <Pressable style={styles.forwardSheet} onPress={() => {}}>
            <Text style={styles.forwardTitle}>Forward to…</Text>
            {forwardLoading ? (
              <ListSkeleton count={4} />
            ) : forwardCandidates.length === 0 ? (
              <Text style={styles.forwardEmpty}>No other conversations to forward to yet.</Text>
            ) : (
              <FlatList
                data={forwardCandidates}
                keyExtractor={(c) => c.conversationId}
                style={{ maxHeight: 380 }}
                renderItem={({ item }) => (
                  <Pressable style={styles.forwardRow} onPress={() => forwardTo(item)}>
                    <Avatar uri={item.avatar} name={item.name} size={36} />
                    <Text style={styles.forwardRowName} numberOfLines={1}>
                      {item.name}
                    </Text>
                  </Pressable>
                )}
              />
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

function buildStyles(color: ColorPalette) {
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: color.bg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingBottom: space.md,
    backgroundColor: color.surface,
    borderBottomWidth: 1,
    borderBottomColor: color.border,
  },
  headerIdentity: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    minWidth: 0,
  },
  headerName: {
    ...font.title,
    color: color.text,
  },
  headerSubtitle: {
    ...font.caption,
    marginTop: 1,
  },
  subtitleTyping: { color: color.brand },
  subtitleOnline: { color: color.success },
  subtitleOffline: { color: color.textMuted },
  listingStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    backgroundColor: color.brandTint,
    borderBottomWidth: 1,
    borderBottomColor: color.border,
  },
  listingImage: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: color.brandTintStrong,
  },
  listingImageEmpty: {},
  listingTitle: {
    ...font.bodyStrong,
    color: color.text,
  },
  listingPrice: {
    ...font.caption,
    color: color.brand,
    marginTop: 1,
  },
  listingChevron: {
    marginLeft: "auto",
  },
  messagesList: {
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    paddingBottom: space.xxl,
  },
  bubbleRow: {
    flexDirection: "row",
  },
  bubbleRowMine: {
    justifyContent: "flex-end",
  },
  bubbleRowTheirs: {
    justifyContent: "flex-start",
  },
  bubble: {
    maxWidth: "78%",
    borderRadius: radius.lg,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  bubbleMine: {
    backgroundColor: color.brand,
  },
  bubbleTheirs: {
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.border,
  },
  bubbleMineTail: {
    borderBottomRightRadius: radius.sm - 4,
  },
  bubbleTheirsTail: {
    borderBottomLeftRadius: radius.sm - 4,
  },
  bubbleImage: {
    width: 210,
    height: 158,
    borderRadius: radius.md,
    marginBottom: space.xs,
  },
  bubbleText: {
    ...font.body,
    color: color.text,
  },
  bubbleTextMine: {
    color: color.textOnBrand,
  },
  bubbleTextDeleted: {
    ...font.sub,
    fontStyle: "italic",
    color: color.textMuted,
  },
  bubbleTextDeletedMine: {
    color: color.textOnBrandSub,
  },
  replyQuote: {
    borderLeftWidth: 3,
    borderLeftColor: color.borderStrong,
    backgroundColor: color.surfaceAlt,
    borderRadius: radius.sm,
    paddingLeft: space.sm,
    paddingRight: space.sm,
    paddingVertical: space.xs,
    marginBottom: space.xs,
  },
  replyQuoteMine: {
    borderLeftColor: color.gold,
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  replyQuoteName: {
    ...font.caption,
    color: color.brand,
  },
  replyQuoteNameMine: {
    color: color.gold,
  },
  replyQuoteText: {
    ...font.caption,
    fontWeight: "500",
    color: color.textSub,
  },
  replyQuoteTextMine: {
    color: color.textOnBrandSub,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: space.xs,
    marginTop: space.xxs,
  },
  editedLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: color.textMuted,
  },
  bubbleTime: {
    fontSize: 10,
    fontWeight: "600",
    color: color.textMuted,
  },
  metaMine: {
    color: color.textOnBrandSub,
  },
  composerPreview: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    backgroundColor: color.surface,
    borderTopWidth: 1,
    borderTopColor: color.border,
  },
  composerPreviewBar: {
    width: 3,
    height: 32,
    borderRadius: 2,
    backgroundColor: color.brand,
  },
  composerPreviewBody: {
    flex: 1,
  },
  composerPreviewLabel: {
    ...font.caption,
    color: color.brand,
  },
  composerPreviewText: {
    ...font.sub,
    color: color.textSub,
  },
  composerPreviewClose: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  composerPreviewCloseText: {
    fontSize: 20,
    color: color.textMuted,
  },
  imagePreviewRow: {
    backgroundColor: color.surface,
    paddingVertical: space.sm,
    borderTopWidth: 1,
    borderTopColor: color.border,
  },
  imagePreviewItem: {
    position: "relative",
  },
  imagePreviewThumb: {
    width: 64,
    height: 64,
    borderRadius: radius.md,
    backgroundColor: color.surfaceAlt,
  },
  imagePreviewRemove: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  imagePreviewRemoveText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 15,
  },
  safetyHint: {
    backgroundColor: color.warningTint,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderTopWidth: 1,
    borderTopColor: color.warning,
  },
  safetyHintText: {
    ...font.caption,
    fontWeight: "600",
    color: color.warning,
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingTop: space.sm,
    backgroundColor: color.surface,
    borderTopWidth: 1,
    borderTopColor: color.border,
  },
  attachButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    flex: 1,
    maxHeight: 110,
    minHeight: 40,
    backgroundColor: color.surfaceAlt,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.xl,
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    paddingBottom: space.sm,
    ...font.body,
    color: color.text,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: color.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  sendButtonDisabled: {
    opacity: 0.45,
  },
  modalScrim: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: color.overlay,
  },
  forwardSheet: {
    backgroundColor: color.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
    paddingBottom: space.xxl,
  },
  forwardTitle: {
    ...font.h3,
    color: color.text,
    marginBottom: space.md,
  },
  forwardEmpty: {
    ...font.body,
    color: color.textMuted,
    paddingVertical: space.lg,
    textAlign: "center",
  },
  forwardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingVertical: space.sm,
  },
  forwardRowName: {
    ...font.bodyStrong,
    color: color.text,
    flex: 1,
  },
  });
}
