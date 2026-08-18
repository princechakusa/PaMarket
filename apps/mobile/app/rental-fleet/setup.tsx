import { useState } from "react";
import { openExternalUrl } from "../../lib/open-url";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import { toast } from "../../components/ui/Toast";
import type { ColorPalette } from "../../lib/theme";
import { useThemedStyles } from "../../lib/theme-provider";

// Mirrors www/js/rentals-business.js H.pages.RentalCompanySetup — creates the
// pending rental_companies row via the rental_setup_company() RPC (verified
// signature in supabase/migrations/fix_rental_setup_rpc_v4.sql).
export default function RentalCompanySetupScreen() {
  const styles = useThemedStyles(buildStyles);
  const tones = useThemedStyles(buildTones);
  const { bizId } = useLocalSearchParams<{ bizId: string }>();
  const router = useRouter();
  const { session } = useAuth();

  const [bio, setBio] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit() {
    if (!bizId || !session?.user) return;
    setIsSubmitting(true);
    try {
      const { error } = await supabase.rpc("rental_setup_company", {
        p_business_id: bizId,
        p_bio: bio.trim() || null,
        p_phone: phone.trim() || null,
        p_whatsapp: whatsapp.trim() || null,
      });
      if (error) throw error;
      toast("Submitted! Email your documents so we can approve you.", 5000);
      router.replace("/rental-fleet");
    } catch (e: any) {
      console.warn("rental setup:", e);
      toast("Setup failed. Please sign out, sign back in, and try again.", 5000, true);
    } finally {
      setIsSubmitting(false);
    }
  }

  function emailDocuments() {
    const subject = encodeURIComponent("Rental Verification Documents");
    const body = encodeURIComponent(
      `Business ID: ${bizId || ""}\n\nPlease attach the following before sending:\n  1. Company registration certificate\n  2. Vehicle registration book(s)\n  3. Owner's national ID\n`
    );
    openExternalUrl(`mailto:support@pamarketzw.com?subject=${subject}&body=${body}`, "No mail app is set up on this device.");
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <View style={styles.introBox}>
        <Text style={styles.introText}>
          Connect your business to the PaMarket rental marketplace. Customers can browse your fleet and contact you
          directly.
        </Text>
      </View>

      <Text style={styles.label}>Company Description</Text>
      <TextInput
        style={styles.textarea}
        value={bio}
        onChangeText={setBio}
        placeholder="Tell customers about your rental services, coverage areas, and fleet..."
        placeholderTextColor={tones.textMuted}
        multiline
        numberOfLines={4}
      />

      <Text style={styles.label}>Contact Phone</Text>
      <TextInput
        style={styles.input}
        value={phone}
        onChangeText={setPhone}
        placeholder="+263 77 000 0000"
        placeholderTextColor={tones.textMuted}
        keyboardType="phone-pad"
      />

      <Text style={styles.label}>WhatsApp Number</Text>
      <TextInput
        style={styles.input}
        value={whatsapp}
        onChangeText={setWhatsapp}
        placeholder="+263 77 000 0000"
        placeholderTextColor={tones.textMuted}
        keyboardType="phone-pad"
      />

      <View style={styles.docsBox}>
        <Text style={styles.docsTitle}>Verification Documents</Text>
        <Text style={styles.docsBody}>
          To be approved, email us clear photos or PDFs of your:
          {"\n"}• Company registration certificate
          {"\n"}• Vehicle registration book(s)
          {"\n"}• Owner's national ID
        </Text>
        <Pressable style={styles.secondaryBtn} onPress={emailDocuments}>
          <Text style={styles.secondaryBtnText}>Email Documents</Text>
        </Pressable>
      </View>

      <Pressable style={[styles.primaryBtn, isSubmitting && styles.disabled]} onPress={submit} disabled={isSubmitting}>
        {isSubmitting ? <ActivityIndicator color={tones.textOnBrand} /> : <Text style={styles.primaryBtnText}>Submit for Approval</Text>}
      </Pressable>
    </ScrollView>
  );
}

function buildTones(color: ColorPalette) {
  return { textMuted: color.textMuted, textOnBrand: color.textOnBrand };
}

function buildStyles(color: ColorPalette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: color.bg },
    introBox: {
      backgroundColor: color.brandTint,
      borderLeftWidth: 3,
      borderLeftColor: color.brand,
      borderRadius: 10,
      padding: 14,
      marginBottom: 20,
    },
    introText: { fontSize: 13, color: color.brand, fontWeight: "600", lineHeight: 19 },
    label: { fontSize: 12, fontWeight: "700", color: color.textSub, marginBottom: 6, marginTop: 14 },
    input: {
      height: 46,
      borderWidth: 1.5,
      borderColor: color.border,
      borderRadius: 14,
      paddingHorizontal: 14,
      fontSize: 14,
      color: color.text,
      backgroundColor: color.surface,
    },
    textarea: {
      minHeight: 90,
      borderWidth: 1.5,
      borderColor: color.border,
      borderRadius: 14,
      padding: 12,
      fontSize: 14,
      color: color.text,
      backgroundColor: color.surface,
      textAlignVertical: "top",
    },
    docsBox: {
      marginTop: 20,
      backgroundColor: color.surfaceAlt,
      borderWidth: 1.5,
      borderColor: color.border,
      borderRadius: 14,
      padding: 14,
    },
    docsTitle: { fontSize: 13, fontWeight: "800", color: color.text, marginBottom: 6 },
    docsBody: { fontSize: 12.5, color: color.textSub, lineHeight: 19, marginBottom: 12 },
    secondaryBtn: {
      borderWidth: 1.5,
      borderColor: color.brand,
      borderRadius: 12,
      paddingVertical: 12,
      alignItems: "center",
    },
    secondaryBtnText: { color: color.brand, fontSize: 14, fontWeight: "700" },
    primaryBtn: { marginTop: 20, backgroundColor: color.brand, borderRadius: 14, paddingVertical: 15, alignItems: "center" },
    primaryBtnText: { color: color.textOnBrand, fontSize: 14, fontWeight: "700" },
    disabled: { opacity: 0.6 },
  });
}
