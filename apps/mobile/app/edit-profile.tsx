import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { uploadImageUriToR2 } from "../lib/uploadToR2";
import { BRAND_BLUE } from "../lib/constants";
import { sellerInitials } from "../lib/sellers";

export default function EditProfileScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [bio, setBio] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    if (!session?.user) return;
    const { data } = await supabase
      .from("profiles")
      .select("name,phone,bio,avatar")
      .eq("id", session.user.id)
      .maybeSingle();
    if (data) {
      setName(data.name ?? "");
      setPhone(data.phone ?? "");
      setBio(data.bio ?? "");
      setAvatar(data.avatar ?? null);
    }
  }, [session]);

  useEffect(() => {
    setIsLoading(true);
    load().finally(() => setIsLoading(false));
  }, [load]);

  async function changePhoto() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted || !session?.user) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (result.canceled || !result.assets?.length) return;
    try {
      const key = `profiles/${session.user.id}/avatar_${Date.now()}.jpg`;
      const url = await uploadImageUriToR2(result.assets[0].uri, key);
      setAvatar(url);
    } catch {
      setError("Could not upload photo. Please try again.");
    }
  }

  async function save() {
    if (!session?.user) return;
    if (name.trim().length < 2) {
      setError("Enter your full name.");
      return;
    }
    if (phone.trim() && !/^\+?[0-9\s-]{7,16}$/.test(phone.trim())) {
      setError("Enter a valid phone number.");
      return;
    }
    setError(null);
    setIsSaving(true);
    const safeAvatar = avatar && avatar.startsWith("https://") ? avatar : undefined;
    const { error: updateError } = await supabase
      .from("profiles")
      .upsert({
        id: session.user.id,
        name: name.trim(),
        phone: phone.trim() || null,
        bio: bio.trim() || null,
        ...(safeAvatar ? { avatar: safeAvatar } : {}),
        updated_at: new Date().toISOString(),
      });
    setIsSaving(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={BRAND_BLUE} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            {avatar ? (
              <Image source={{ uri: avatar }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarInitial}>{sellerInitials(name)}</Text>
            )}
          </View>
          <Text style={styles.avatarLabel}>Profile Photo</Text>
          <Pressable onPress={changePhoto}>
            <Text style={styles.changePhotoLink}>Change Photo</Text>
          </Pressable>
        </View>

        <Text style={styles.fieldLabel}>Full Name</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} maxLength={60} />

        <Text style={styles.fieldLabel}>Phone Number</Text>
        <TextInput
          style={styles.input}
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          placeholder="+263 77 123 4567"
          placeholderTextColor="#8A93A6"
          maxLength={16}
        />

        <Text style={styles.fieldLabel}>Bio</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={bio}
          onChangeText={setBio}
          multiline
          maxLength={200}
        />

        <Text style={styles.fieldLabel}>Email</Text>
        <View style={[styles.input, styles.disabledInput]}>
          <Text style={styles.disabledInputText}>{session?.user?.email}</Text>
        </View>
        <Text style={styles.helperText}>Login email is locked for security. Contact support to change.</Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {saved ? <Text style={styles.saved}>Saved!</Text> : null}

        <Pressable style={styles.saveButton} onPress={save} disabled={isSaving}>
          {isSaving ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.saveButtonText}>Save Changes</Text>}
        </Pressable>
        <Pressable style={styles.cancelButton} onPress={() => router.back()}>
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  avatarSection: {
    alignItems: "center",
    marginBottom: 24,
  },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: "#EEF0F4",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    marginBottom: 8,
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  avatarInitial: {
    fontSize: 26,
    fontWeight: "700",
    color: BRAND_BLUE,
  },
  avatarLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#111827",
  },
  changePhotoLink: {
    fontSize: 13,
    fontWeight: "700",
    color: BRAND_BLUE,
    marginTop: 4,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: "#D8DCE5",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: "#111827",
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  disabledInput: {
    backgroundColor: "#F5F6F9",
  },
  disabledInputText: {
    fontSize: 14,
    color: "#8A93A6",
  },
  helperText: {
    fontSize: 11,
    color: "#8A93A6",
    marginTop: 6,
  },
  error: {
    color: "#C0392B",
    fontSize: 13,
    marginTop: 16,
    textAlign: "center",
  },
  saved: {
    color: "#0f7a3d",
    fontSize: 13,
    marginTop: 16,
    textAlign: "center",
    fontWeight: "700",
  },
  saveButton: {
    backgroundColor: BRAND_BLUE,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 24,
  },
  saveButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
  cancelButton: {
    alignItems: "center",
    marginTop: 12,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#8A93A6",
  },
});
