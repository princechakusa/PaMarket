import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { BRAND_BLUE } from "../lib/constants";
import { toast } from "../components/ui/Toast";
import { EmptyState } from "../components/ui/EmptyState";

// Mirrors www/js/settings.js pages.BlockedUsers / H._blockedUsers.unblock.
// Blocks are enforced server-side via the real blocked_users table + RLS +
// check_message_block trigger (see supabase/migrations/add_blocked_users.sql).
type BlockedRow = { blocked_id: string; name: string | null; phone: string | null };

export default function BlockedUsersScreen() {
  const { session } = useAuth();
  const [rows, setRows] = useState<BlockedRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    if (!session?.user) return;
    const { data: blocks } = await supabase
      .from("blocked_users")
      .select("blocked_id")
      .eq("blocker_id", session.user.id);
    const ids = (blocks ?? []).map((b) => b.blocked_id);
    if (!ids.length) {
      setRows([]);
      return;
    }
    const { data: profiles } = await supabase.from("profiles").select("id,name,phone").in("id", ids);
    setRows(
      ids.map((id) => {
        const p = profiles?.find((pr) => pr.id === id);
        return { blocked_id: id, name: p?.name ?? null, phone: p?.phone ?? null };
      })
    );
  }, [session]);

  useEffect(() => {
    setIsLoading(true);
    load().finally(() => setIsLoading(false));
  }, [load]);

  async function unblock(userId: string) {
    if (!session?.user) return;
    const { error } = await supabase
      .from("blocked_users")
      .delete()
      .eq("blocker_id", session.user.id)
      .eq("blocked_id", userId);
    if (error) {
      toast("Could not unblock. Try again.", 3000, true);
      return;
    }
    setRows((prev) => prev.filter((r) => r.blocked_id !== userId));
    toast("User unblocked");
  }

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={BRAND_BLUE} />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={{ padding: 16, flexGrow: 1 }}
      data={rows}
      keyExtractor={(item) => item.blocked_id}
      ListEmptyComponent={
        <EmptyState title="No blocked users" subtitle="Users you block won't be able to contact you" />
      }
      renderItem={({ item }) => (
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{item.name || "Unknown User"}</Text>
            <Text style={styles.detail}>{item.phone || "N/A"}</Text>
          </View>
          <Pressable style={styles.unblockButton} onPress={() => unblock(item.blocked_id)}>
            <Text style={styles.unblockButtonText}>Unblock</Text>
          </Pressable>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F6F9" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#F5F6F9" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 10,
  },
  name: { fontSize: 14, fontWeight: "700", color: "#111827" },
  detail: { fontSize: 12, color: "#8A93A6", marginTop: 2 },
  unblockButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#D8DCE5",
  },
  unblockButtonText: { fontSize: 12.5, fontWeight: "700", color: "#111827" },
});
