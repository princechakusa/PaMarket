import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "../lib/supabase";
import { BRAND_BLUE } from "../lib/constants";
import { toast } from "../components/ui/Toast";

// Mirrors www/js/security_pages.js pages.ChangePassword / H._changePassword.save.
export default function ChangePasswordScreen() {
  const router = useRouter();
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function strength(val: string) {
    if (!val) return null;
    const checks = [val.length >= 8, /[A-Z]/.test(val), /[a-z]/.test(val), /[0-9]/.test(val), /[^A-Za-z0-9]/.test(val)];
    const score = checks.filter(Boolean).length;
    const labels = ["", "Very weak", "Weak", "Fair", "Strong", "Very strong"];
    const colors = ["", "#EF4444", "#F59E0B", "#EAB308", "#22C55E", "#16A34A"];
    return { label: labels[score] || "", color: colors[score] || "#8A93A6" };
  }

  const strengthInfo = strength(newPass);

  async function save() {
    if (!newPass || !confirmPass) {
      setError("Please fill in both password fields");
      return;
    }
    if (newPass.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (!/[A-Z]/.test(newPass)) {
      setError("Password must include at least one uppercase letter");
      return;
    }
    if (!/[a-z]/.test(newPass)) {
      setError("Password must include at least one lowercase letter");
      return;
    }
    if (!/[0-9]/.test(newPass)) {
      setError("Password must include at least one number");
      return;
    }
    if (!/[^A-Za-z0-9]/.test(newPass)) {
      setError("Password must include at least one symbol (e.g. !@#$)");
      return;
    }
    if (newPass !== confirmPass) {
      setError("Passwords do not match");
      return;
    }
    setError(null);
    setIsSubmitting(true);
    const { error: updateError } = await supabase.auth.updateUser({ password: newPass });
    setIsSubmitting(false);
    if (updateError) {
      setError(updateError.message || "Password update failed. Try again.");
      return;
    }
    toast("Password updated successfully!");
    router.back();
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <View style={styles.infoBanner}>
        <Text style={styles.infoBannerText}>
          Password must be at least 8 characters and include uppercase, lowercase, a number, and a symbol.
        </Text>
      </View>

      <Text style={styles.label}>New Password</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter new password"
        secureTextEntry
        value={newPass}
        onChangeText={setNewPass}
      />
      {strengthInfo?.label ? <Text style={[styles.strength, { color: strengthInfo.color }]}>{strengthInfo.label}</Text> : null}

      <Text style={styles.label}>Confirm New Password</Text>
      <TextInput
        style={styles.input}
        placeholder="Re-enter new password"
        secureTextEntry
        value={confirmPass}
        onChangeText={setConfirmPass}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable style={[styles.button, isSubmitting && styles.buttonDisabled]} onPress={save} disabled={isSubmitting}>
        {isSubmitting ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.buttonText}>Update Password</Text>}
      </Pressable>
      <Pressable style={styles.cancelButton} onPress={() => router.back()}>
        <Text style={styles.cancelButtonText}>Cancel</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F6F9" },
  infoBanner: {
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  infoBannerText: { fontSize: 13, color: "#1E40AF", lineHeight: 19 },
  label: { fontSize: 13, fontWeight: "600", color: "#111827", marginBottom: 6, marginTop: 12 },
  input: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#D8DCE5",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: "#111827",
  },
  strength: { fontSize: 12, fontWeight: "600", marginTop: 6 },
  error: { color: "#EF4444", fontSize: 13, fontWeight: "600", marginTop: 14 },
  button: {
    backgroundColor: BRAND_BLUE,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 22,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#ffffff", fontSize: 15, fontWeight: "700" },
  cancelButton: { alignItems: "center", paddingVertical: 14 },
  cancelButtonText: { fontSize: 14, fontWeight: "700", color: "#5A6478" },
});
