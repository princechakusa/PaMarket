import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { toast } from "../components/ui/Toast";
import type { ColorPalette } from "../lib/theme";
import { useThemedStyles } from "../lib/theme-provider";

// The RPC this used to call (`delete_my_account`) has never actually
// existed in the database — every call silently fell through to a
// client-side fallback that deleted rows from a handful of tables but
// never touched the real auth.users row, so a "deleted" account's email/
// password/OAuth identity kept working forever (the account itself was
// never gone, just some of its data). delete-my-account is the real fix:
// a server-side function (using the service-role key, since deleting
// another table's rows via RLS-scoped client calls can't reach auth.users
// at all) that cleans up non-cascading data (conversations.members is a
// uuid[], not a real FK) and then actually deletes the Supabase Auth user
// — cascading FKs on auth.users(id) take care of profiles, listings,
// businesses, reviews, etc. automatically from there.
async function purgeMyAccount(): Promise<{ ok: boolean; error?: string }> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) return { ok: false, error: "Not signed in" };

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
  const res = await fetch(`${supabaseUrl}/functions/v1/delete-my-account`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body?.success) return { ok: false, error: body?.error || `Server error (${res.status})` };

  await supabase.auth.signOut();
  return { ok: true };
}

const DELETED_ITEMS = [
  "Profile & personal details",
  "Your listings",
  "Messages you sent",
  "Reviews you wrote",
  "Saved items & searches",
  "Job applications",
  "Verification documents",
];

export default function DeleteAccountScreen() {
  const styles = useThemedStyles(buildStyles);
  const { session } = useAuth();
  const router = useRouter();
  const [confirmText, setConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  async function confirm() {
    if (confirmText.trim() !== "DELETE") {
      toast("Type DELETE to confirm", 3000, true);
      return;
    }
    if (!session?.user) return;
    setIsDeleting(true);
    try {
      const result = await purgeMyAccount();
      if (!result.ok) {
        setIsDeleting(false);
        toast(result.error || "Something went wrong — try again", 3000, true);
        return;
      }
      toast("Your account and data have been deleted");
      router.replace("/(auth)/sign-in");
    } catch {
      setIsDeleting(false);
      toast("Something went wrong — try again", 3000, true);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <View style={styles.warnBox}>
        <Text style={styles.warnTitle}>Delete Account</Text>
        <Text style={styles.warnSub}>This permanently deletes your account, listings and messages. Cannot be undone.</Text>
      </View>

      <View style={styles.box}>
        <Text style={styles.boxTitle}>What will be deleted</Text>
        {DELETED_ITEMS.map((item) => (
          <View key={item} style={styles.itemRow}>
            <Text style={styles.itemLabel}>{item}</Text>
            <Text style={styles.itemValue}>Permanently removed</Text>
          </View>
        ))}
      </View>

      <Text style={styles.label}>Type DELETE to confirm</Text>
      <TextInput
        style={styles.input}
        placeholder="Type DELETE"
        autoCapitalize="characters"
        value={confirmText}
        onChangeText={setConfirmText}
      />

      <Pressable style={[styles.deleteButton, isDeleting && styles.buttonDisabled]} onPress={confirm} disabled={isDeleting}>
        {isDeleting ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.deleteButtonText}>Permanently Delete Account</Text>}
      </Pressable>
      <Pressable style={styles.cancelButton} onPress={() => router.back()}>
        <Text style={styles.cancelButtonText}>Cancel · Keep Account</Text>
      </Pressable>
    </ScrollView>
  );
}

function buildStyles(color: ColorPalette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: color.bg },
    warnBox: {
      backgroundColor: color.surface,
      borderWidth: 1.5,
      borderColor: color.dangerTint,
      borderRadius: 14,
      padding: 24,
      alignItems: "center",
      marginBottom: 16,
    },
    warnTitle: { fontSize: 18, fontWeight: "800", color: color.danger, marginBottom: 8 },
    warnSub: { fontSize: 13, color: color.textSub, textAlign: "center", lineHeight: 19 },
    box: {
      backgroundColor: color.surface,
      borderRadius: 14,
      padding: 16,
      marginBottom: 16,
    },
    boxTitle: { fontSize: 14, fontWeight: "700", color: color.text, marginBottom: 10 },
    itemRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: color.divider,
    },
    itemLabel: { fontSize: 13, color: color.textSub },
    itemValue: { fontSize: 12, fontWeight: "700", color: color.danger },
    label: { fontSize: 13, fontWeight: "600", color: color.text, marginBottom: 6 },
    input: {
      backgroundColor: color.surface,
      borderWidth: 1,
      borderColor: color.borderStrong,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 15,
      color: color.text,
    },
    deleteButton: {
      backgroundColor: color.danger,
      borderRadius: 10,
      paddingVertical: 14,
      alignItems: "center",
      marginTop: 20,
    },
    buttonDisabled: { opacity: 0.6 },
    deleteButtonText: { color: "#ffffff", fontSize: 15, fontWeight: "700" },
    cancelButton: { alignItems: "center", paddingVertical: 14 },
    cancelButtonText: { fontSize: 14, fontWeight: "700", color: color.textSub },
  });
}
