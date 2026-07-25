import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import { BRAND_BLUE } from "../../lib/constants";
import { toast } from "../../components/ui/Toast";
import { EmptyState } from "../../components/ui/EmptyState";

type QuickReply = { id: string; text: string };

// Mirrors www/js/business-messaging.js pages.BusinessQuickReplies — owner
// managed reply templates surfaced as one-tap chips in chat about this
// business's listings.
export default function BusinessQuickRepliesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();

  const [isOwner, setIsOwner] = useState<boolean | null>(null);
  const [replies, setReplies] = useState<QuickReply[]>([]);
  const [draft, setDraft] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id || !session?.user) return;
    const { data: biz } = await supabase.from("businesses").select("owner_user_id").eq("id", id).maybeSingle();
    if (!biz || biz.owner_user_id !== session.user.id) {
      setIsOwner(false);
      return;
    }
    setIsOwner(true);
    const { data } = await supabase.from("business_quick_replies").select("id,text").eq("business_id", id).order("created_at");
    setReplies((data as QuickReply[]) ?? []);
  }, [id, session]);

  useEffect(() => {
    setIsLoading(true);
    load().finally(() => setIsLoading(false));
  }, [load]);

  async function add() {
    const text = draft.trim();
    if (!text || !id) {
      toast("Type a reply first", 3000, true);
      return;
    }
    const { data, error } = await supabase.from("business_quick_replies").insert({ business_id: id, text }).select("id,text").single();
    if (error || !data) return;
    setReplies((prev) => [...prev, data as QuickReply]);
    setDraft("");
  }

  async function remove(replyId: string) {
    await supabase.from("business_quick_replies").delete().eq("id", replyId);
    setReplies((prev) => prev.filter((r) => r.id !== replyId));
  }

  if (isLoading || isOwner === null) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={BRAND_BLUE} />
      </View>
    );
  }

  if (!isOwner) {
    return (
      <View style={styles.centered}>
        <EmptyState title="Owner only" subtitle="Only the owner can manage quick replies." />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <Text style={styles.intro}>Saved replies appear as one-tap chips when you chat with buyers about this business's listings.</Text>

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="e.g. Yes, it's available!"
          maxLength={160}
          value={draft}
          onChangeText={setDraft}
        />
        <Pressable style={styles.addButton} onPress={add}>
          <Text style={styles.addButtonText}>Add</Text>
        </Pressable>
      </View>

      {replies.length ? (
        replies.map((r) => (
          <View key={r.id} style={styles.row}>
            <Text style={styles.rowText}>{r.text}</Text>
            <Pressable style={styles.deleteButton} onPress={() => remove(r.id)}>
              <Text style={styles.deleteButtonText}>Delete</Text>
            </Pressable>
          </View>
        ))
      ) : (
        <Text style={styles.emptyText}>No quick replies yet.</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F6F9" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  intro: { fontSize: 13, color: "#5A6478", lineHeight: 19, marginBottom: 14 },
  inputRow: { flexDirection: "row", gap: 8, marginBottom: 14 },
  input: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#D8DCE5",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
  },
  addButton: { backgroundColor: BRAND_BLUE, borderRadius: 10, paddingHorizontal: 18, justifyContent: "center" },
  addButtonText: { color: "#ffffff", fontSize: 13, fontWeight: "700" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#E8ECF4",
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  rowText: { flex: 1, fontSize: 13.5, color: "#111827" },
  deleteButton: { backgroundColor: "#FFF1F0", borderRadius: 9, paddingHorizontal: 10, paddingVertical: 6 },
  deleteButtonText: { fontSize: 11.5, fontWeight: "700", color: "#EF4444" },
  emptyText: { textAlign: "center", color: "#8A93A6", fontSize: 13, paddingVertical: 24 },
});
