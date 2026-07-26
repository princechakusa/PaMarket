import { useEffect, useRef, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as SecureStore from "expo-secure-store";
import { toast } from "../components/ui/Toast";
import { bestMatch, CHIP_MAP, INIT_CHIPS } from "../lib/support-bot-kb";
import { color, type ColorPalette } from "../lib/theme";
import { useThemedStyles } from "../lib/theme-provider";

const HKEY = "pm_bot_h3";
const WA = "https://wa.me/971589772645";
const ML = "mailto:support@pamarketzw.com";
const PH = "tel:+971589772645";

type ChatMessage = {
  id: string;
  text: string;
  isUser: boolean;
  ts: string;
  kind?: "text" | "contact" | "ticket";
  feedback?: "helpful" | "not-helpful";
};

function timeStr() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

async function loadHistory(): Promise<ChatMessage[] | null> {
  try {
    const raw = await SecureStore.getItemAsync(HKEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function saveHistory(history: ChatMessage[]) {
  try {
    await SecureStore.setItemAsync(HKEY, JSON.stringify(history.slice(-80)));
  } catch {
    // ignore
  }
}

async function clearHistory() {
  try {
    await SecureStore.deleteItemAsync(HKEY);
  } catch {
    // ignore
  }
}

export default function ReportProblemScreen() {
  const styles = useThemedStyles(buildStyles);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chips, setChips] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [ticketPrompt, setTicketPrompt] = useState<string | null>(null);
  const [ticketText, setTicketText] = useState("");
  const [ticketVisible, setTicketVisible] = useState(false);
  const listRef = useRef<FlatList>(null);
  const historyRef = useRef<ChatMessage[]>([]);

  useEffect(() => {
    (async () => {
      const saved = await loadHistory();
      if (saved && saved.length > 0) {
        historyRef.current = saved;
        const greeting: ChatMessage = {
          id: uid(),
          text: "Welcome back! How can I help you today?",
          isUser: false,
          ts: timeStr(),
        };
        setMessages([...saved, greeting]);
        setChips(INIT_CHIPS);
      } else {
        const greeting: ChatMessage = {
          id: uid(),
          text:
            "Hi! I am the PaMarket Support Bot.\n\nI can answer questions instantly across 37 topics. Tap a topic below or type your question.",
          isUser: false,
          ts: timeStr(),
        };
        historyRef.current = [greeting];
        setMessages([greeting]);
        setChips(INIT_CHIPS);
        saveHistory([greeting]);
      }
    })();
  }, []);

  function scrollDown() {
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 70);
  }

  function pushMessage(msg: ChatMessage, persist = true) {
    setMessages((prev) => {
      const next = [...prev, msg];
      if (persist) {
        historyRef.current = next;
        saveHistory(next);
      }
      return next;
    });
    scrollDown();
  }

  function addContactCard() {
    pushMessage({ id: uid(), text: "", isUser: false, ts: timeStr(), kind: "contact" });
  }

  function addTicketForm(prefill?: string) {
    setTicketPrompt(prefill || "Describe your issue in detail...");
    setTicketVisible(true);
    setTicketText("");
    scrollDown();
  }

  function respond(query: string) {
    setTyping(false);
    const match = bestMatch(query);
    if (match) {
      pushMessage({ id: uid(), text: match.answer, isUser: false, ts: timeStr() });
      const nextChips = [...match.chips];
      if (!nextChips.includes("Ask Another Question")) nextChips.push("Ask Another Question");
      setChips(nextChips);
    } else {
      pushMessage({
        id: uid(),
        text: "I could not find a specific answer for that. Let me connect you with our support team:",
        isUser: false,
        ts: timeStr(),
      });
      addContactCard();
      setChips(["Submit a Bug Report", "Ask Another Question"]);
    }
  }

  function handleInput(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    setInput("");

    if (trimmed === "Ask Another Question") {
      pushMessage({ id: uid(), text: trimmed, isUser: true, ts: timeStr() });
      pushMessage({ id: uid(), text: "Of course! What can I help you with?", isUser: false, ts: timeStr() });
      setChips(INIT_CHIPS);
      return;
    }
    if (trimmed === "Talk to a Human") {
      pushMessage({ id: uid(), text: trimmed, isUser: true, ts: timeStr() });
      pushMessage({
        id: uid(),
        text: "No problem. You can reach our team directly below, or leave us a message and we will get back to you.",
        isUser: false,
        ts: timeStr(),
      });
      addContactCard();
      setTimeout(() => {
        addTicketForm();
        setChips(["Ask Another Question"]);
      }, 400);
      return;
    }
    if (trimmed === "Submit a Bug Report") {
      pushMessage({ id: uid(), text: trimmed, isUser: true, ts: timeStr() });
      pushMessage({
        id: uid(),
        text: "Please describe what happened. Include what page you were on and what you expected to happen:",
        isUser: false,
        ts: timeStr(),
      });
      setTimeout(() => {
        addTicketForm("e.g. The app crashes when I open Messages on Android...");
        setChips(["Ask Another Question"]);
      }, 300);
      return;
    }

    pushMessage({ id: uid(), text: trimmed, isUser: true, ts: timeStr() });
    const query = CHIP_MAP[trimmed] || trimmed;
    setTyping(true);
    scrollDown();
    setTimeout(() => respond(query), 680);
  }

  function handleSend() {
    if (input.trim()) handleInput(input);
  }

  function handleFeedback(id: string, kind: "helpful" | "not-helpful") {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, feedback: kind } : m)));
    if (kind === "helpful") {
      setChips(INIT_CHIPS);
    } else {
      setTimeout(() => {
        pushMessage({ id: uid(), text: "Let me connect you with a real person.", isUser: false, ts: timeStr() });
        addContactCard();
        setTimeout(() => {
          addTicketForm();
          setChips(["Ask Another Question"]);
        }, 350);
      }, 300);
    }
  }

  function submitTicket() {
    const desc = ticketText.trim();
    if (!desc) {
      toast("Please describe your issue first");
      return;
    }
    setTicketVisible(false);
    pushMessage({
      id: uid(),
      text: "Message sent. We will follow up on WhatsApp or email.",
      isUser: false,
      ts: timeStr(),
    });
    setChips(["Ask Another Question", "Talk to a Human"]);
  }

  async function handleClearChat() {
    await clearHistory();
    historyRef.current = [];
    const greeting: ChatMessage = {
      id: uid(),
      text: "Chat cleared. What can I help you with?",
      isUser: false,
      ts: timeStr(),
    };
    setMessages([greeting]);
    setChips(INIT_CHIPS);
    setTicketVisible(false);
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>{"‹"}</Text>
        </Pressable>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>P</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>PaMarket Support</Text>
          <View style={styles.onlineRow}>
            <View style={styles.onlineDot} />
            <Text style={styles.onlineText}>Online · Usually replies instantly</Text>
          </View>
        </View>
        <Pressable style={styles.clearButton} onPress={handleClearChat}>
          <Text style={styles.clearButtonText}>Clear</Text>
        </Pressable>
      </View>

      <FlatList
        ref={listRef}
        style={styles.chat}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: 14, gap: 14 }}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        renderItem={({ item }) => {
          if (item.kind === "contact") {
            return (
              <View style={styles.botRow}>
                <View style={styles.avatarSmall}>
                  <Text style={styles.avatarSmallText}>P</Text>
                </View>
                <View style={{ flex: 1, gap: 8 }}>
                  <Text style={styles.contactHeading}>CONTACT OUR TEAM DIRECTLY</Text>
                  <Pressable style={[styles.contactCard, styles.contactCardGreen]} onPress={() => Linking.openURL(WA)}>
                    <Text style={styles.contactCardTitleGreen}>WhatsApp</Text>
                    <Text style={styles.contactCardSubtitle}>+971 589 772 645 · Fastest reply</Text>
                  </Pressable>
                  <Pressable style={[styles.contactCard, styles.contactCardBlue]} onPress={() => Linking.openURL(ML)}>
                    <Text style={styles.contactCardTitleBlue}>Email</Text>
                    <Text style={styles.contactCardSubtitle}>support@pamarketzw.com</Text>
                  </Pressable>
                  <Pressable style={[styles.contactCard, styles.contactCardGreen]} onPress={() => Linking.openURL(PH)}>
                    <Text style={styles.contactCardTitleGreen}>Call / WhatsApp</Text>
                    <Text style={styles.contactCardSubtitle}>+971 589 772 645</Text>
                  </Pressable>
                </View>
              </View>
            );
          }

          if (item.isUser) {
            return (
              <View style={styles.userRow}>
                <View style={styles.bubbleUser}>
                  <Text style={styles.bubbleUserText}>{item.text}</Text>
                </View>
              </View>
            );
          }

          return (
            <View style={styles.botRow}>
              <View style={styles.avatarSmall}>
                <Text style={styles.avatarSmallText}>P</Text>
              </View>
              <View style={{ flex: 1, maxWidth: "88%" }}>
                <View style={styles.bubbleBot}>
                  <Text style={styles.bubbleBotText}>{item.text}</Text>
                </View>
                {item.feedback ? (
                  <Text style={styles.feedbackDone}>
                    {item.feedback === "helpful" ? "Thanks — glad that helped!" : "Let me get our team to help..."}
                  </Text>
                ) : (
                  <View style={styles.feedbackRow}>
                    <Pressable style={styles.feedbackButton} onPress={() => handleFeedback(item.id, "helpful")}>
                      <Text style={styles.feedbackButtonText}>Helpful</Text>
                    </Pressable>
                    <Pressable style={styles.feedbackButton} onPress={() => handleFeedback(item.id, "not-helpful")}>
                      <Text style={styles.feedbackButtonText}>Not helpful</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            </View>
          );
        }}
        ListFooterComponent={
          typing ? (
            <View style={styles.botRow}>
              <View style={styles.avatarSmall}>
                <Text style={styles.avatarSmallText}>P</Text>
              </View>
              <View style={styles.typingBubble}>
                <Text style={styles.typingDots}>• • •</Text>
              </View>
            </View>
          ) : null
        }
      />

      {ticketVisible ? (
        <View style={styles.ticketForm}>
          <Text style={styles.ticketLabel}>Send us a message</Text>
          <TextInput
            style={styles.ticketInput}
            placeholder={ticketPrompt || undefined}
            placeholderTextColor={color.textMuted}
            value={ticketText}
            onChangeText={setTicketText}
            multiline
          />
          <Pressable style={styles.ticketSubmit} onPress={submitTicket}>
            <Text style={styles.ticketSubmitText}>Send to Support Team</Text>
          </Pressable>
        </View>
      ) : null}

      <FlatList
        horizontal
        data={chips}
        keyExtractor={(c) => c}
        showsHorizontalScrollIndicator={false}
        style={styles.chipRow}
        contentContainerStyle={{ paddingHorizontal: 10, gap: 7 }}
        renderItem={({ item }) => {
          const highlight = item === "Talk to a Human" || item === "Submit a Bug Report";
          return (
            <Pressable
              style={[styles.chip, highlight && styles.chipHighlight]}
              onPress={() => handleInput(item)}
            >
              <Text style={[styles.chipText, highlight && styles.chipTextHighlight]}>{item}</Text>
            </Pressable>
          );
        }}
      />

      <View style={styles.inputBar}>
        <TextInput
          style={styles.textInput}
          placeholder="Type your question..."
          placeholderTextColor={color.textMuted}
          value={input}
          onChangeText={setInput}
          onSubmitEditing={handleSend}
          returnKeyType="send"
        />
        <Pressable style={styles.sendButton} onPress={handleSend}>
          <Text style={styles.sendButtonText}>{"➤"}</Text>
        </Pressable>
      </View>
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
    backgroundColor: color.brand,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  backButtonText: {
    color: color.textOnBrand,
    fontSize: 22,
    lineHeight: 22,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: color.brand,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.25)",
  },
  avatarText: {
    color: color.textOnBrand,
    fontWeight: "900",
    fontSize: 16,
  },
  headerTitle: {
    color: color.textOnBrand,
    fontSize: 15,
    fontWeight: "800",
  },
  onlineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 2,
  },
  onlineDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: color.online,
  },
  onlineText: {
    color: color.textOnBrandSub,
    fontSize: 11,
    fontWeight: "500",
  },
  clearButton: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  clearButtonText: {
    color: color.textOnBrandSub,
    fontSize: 11,
    fontWeight: "600",
  },
  chat: {
    flex: 1,
  },
  userRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  botRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  avatarSmall: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: color.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarSmallText: {
    color: color.textOnBrand,
    fontWeight: "900",
    fontSize: 12,
  },
  bubbleUser: {
    backgroundColor: color.brand,
    borderRadius: 18,
    borderBottomRightRadius: 4,
    paddingHorizontal: 15,
    paddingVertical: 11,
    maxWidth: "82%",
  },
  bubbleUserText: {
    color: color.textOnBrand,
    fontSize: 14,
    lineHeight: 21,
  },
  bubbleBot: {
    backgroundColor: color.surface,
    borderWidth: 1.5,
    borderColor: color.border,
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 15,
    paddingVertical: 11,
  },
  bubbleBotText: {
    color: color.text,
    fontSize: 14,
    lineHeight: 21,
  },
  feedbackRow: {
    flexDirection: "row",
    gap: 6,
    marginTop: 6,
  },
  feedbackButton: {
    backgroundColor: color.surface,
    borderWidth: 1.5,
    borderColor: color.border,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  feedbackButtonText: {
    fontSize: 11,
    fontWeight: "600",
    color: color.textSub,
  },
  feedbackDone: {
    marginTop: 6,
    fontSize: 11,
    color: color.textSub,
    fontWeight: "600",
  },
  typingBubble: {
    backgroundColor: color.surface,
    borderWidth: 1.5,
    borderColor: color.border,
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 18,
    paddingVertical: 13,
  },
  typingDots: {
    color: color.textMuted,
    fontSize: 14,
  },
  contactHeading: {
    fontSize: 12,
    color: color.textMuted,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  contactCard: {
    borderRadius: 14,
    padding: 12,
    borderWidth: 1.5,
  },
  contactCardGreen: {
    backgroundColor: color.successTint,
    borderColor: color.success,
  },
  contactCardBlue: {
    backgroundColor: color.infoTint,
    borderColor: color.info,
  },
  contactCardTitleGreen: {
    fontSize: 13,
    fontWeight: "700",
    color: color.success,
  },
  contactCardTitleBlue: {
    fontSize: 13,
    fontWeight: "700",
    color: color.brand,
  },
  contactCardSubtitle: {
    fontSize: 11,
    color: color.textSub,
    marginTop: 2,
  },
  ticketForm: {
    backgroundColor: color.surface,
    marginHorizontal: 14,
    marginBottom: 8,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: color.border,
  },
  ticketLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: color.text,
    marginBottom: 10,
  },
  ticketInput: {
    minHeight: 90,
    borderWidth: 1.5,
    borderColor: color.border,
    borderRadius: 10,
    padding: 12,
    fontSize: 13,
    color: color.text,
    backgroundColor: color.surfaceAlt,
    textAlignVertical: "top",
  },
  ticketSubmit: {
    marginTop: 10,
    backgroundColor: color.brand,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  ticketSubmitText: {
    color: color.textOnBrand,
    fontSize: 14,
    fontWeight: "700",
  },
  chipRow: {
    backgroundColor: color.surface,
    borderTopWidth: 1,
    borderTopColor: color.border,
    paddingVertical: 8,
    maxHeight: 52,
  },
  chip: {
    backgroundColor: color.surface,
    borderWidth: 1.5,
    borderColor: color.border,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    justifyContent: "center",
  },
  chipHighlight: {
    backgroundColor: color.infoTint,
    borderColor: color.info,
  },
  chipText: {
    fontSize: 12,
    fontWeight: "600",
    color: color.textSub,
  },
  chipTextHighlight: {
    color: color.brand,
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 22,
    backgroundColor: color.surface,
    borderTopWidth: 1,
    borderTopColor: color.border,
  },
  textInput: {
    flex: 1,
    backgroundColor: color.surfaceAlt,
    borderWidth: 1.5,
    borderColor: color.border,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: color.text,
  },
  sendButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: color.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  sendButtonText: {
    color: color.textOnBrand,
    fontSize: 16,
  },
  });
}
