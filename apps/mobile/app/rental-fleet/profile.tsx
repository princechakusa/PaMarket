import { useCallback, useEffect, useState } from "react";
import * as ImagePicker from "expo-image-picker";
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import { toast } from "../../components/ui/Toast";
import { uploadImageUriToR2 } from "../../lib/uploadToR2";
import { businessInitials } from "../../lib/businesses";
import type { ColorPalette } from "../../lib/theme";
import { useThemedStyles } from "../../lib/theme-provider";

const DAYS_OF_WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// Mirrors www/js/rentals-business.js H.pages.RentalCompanyProfileSelf — the
// owner's editable company profile: logo/cover (R2 upload), bio, hours,
// service locations, verification badge.
export default function RentalCompanyProfileScreen() {
  const styles = useThemedStyles(buildStyles);
  const tones = useThemedStyles(buildTones);
  const router = useRouter();
  const { session } = useAuth();

  const [isLoading, setIsLoading] = useState(true);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState("");
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("pending");
  const [fleetCount, setFleetCount] = useState(0);
  const [avgRating, setAvgRating] = useState<number | null>(null);
  const [reviewCount, setReviewCount] = useState(0);

  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [about, setAbout] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [opensAt, setOpensAt] = useState("");
  const [closesAt, setClosesAt] = useState("");
  const [days, setDays] = useState<string[]>([]);
  const [locations, setLocations] = useState<{ id: string; city: string }[]>([]);
  const [locationIds, setLocationIds] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isUploadingCover, setIsUploadingCover] = useState(false);

  const load = useCallback(async () => {
    if (!session?.user) return;
    const { data: bizRows } = await supabase.from("businesses").select("id,name,phone,whatsapp").eq("owner_user_id", session.user.id);
    const biz = (bizRows as any[] | null) ?? [];
    if (!biz.length) return;

    const { data: rc } = await supabase
      .from("rental_companies")
      .select("id,status,fleet_count,avg_rating,review_count,business_id,days_open,opens_at,closes_at")
      .in(
        "business_id",
        biz.map((b) => b.id)
      )
      .limit(1)
      .maybeSingle();
    if (!rc) return;

    const owningBiz = biz.find((b) => b.id === rc.business_id) || biz[0];
    setBusinessId(owningBiz.id);
    setBusinessName(owningBiz.name);
    setPhone(owningBiz.phone || "");
    setWhatsapp(owningBiz.whatsapp || "");
    setCompanyId(rc.id);
    setStatus(rc.status);
    setFleetCount(rc.fleet_count ?? 0);
    setAvgRating(rc.avg_rating);
    setReviewCount(rc.review_count ?? 0);
    setDays(rc.days_open ?? []);
    setOpensAt(rc.opens_at ?? "");
    setClosesAt(rc.closes_at ?? "");

    const [{ data: locRows }, { data: profRow }] = await Promise.all([
      supabase.from("rental_locations").select("id,city").order("sort_order"),
      supabase.from("rental_company_profiles").select("about,logo_url,cover_url,service_location_ids").eq("company_id", rc.id).maybeSingle(),
    ]);
    setLocations((locRows as any[]) ?? []);
    if (profRow) {
      setAbout(profRow.about ?? "");
      setLogoUrl(profRow.logo_url ?? null);
      setCoverUrl(profRow.cover_url ?? null);
      setLocationIds(profRow.service_location_ids ?? []);
    }
  }, [session]);

  useEffect(() => {
    setIsLoading(true);
    load().finally(() => setIsLoading(false));
  }, [load]);

  function toggleDay(d: string) {
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  }
  function toggleLocation(id: string) {
    setLocationIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function uploadImage(kind: "logo" | "cover") {
    if (!companyId || !session?.user) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.82,
    });
    if (result.canceled || !result.assets?.length) return;
    const setUploading = kind === "logo" ? setIsUploadingLogo : setIsUploadingCover;
    setUploading(true);
    try {
      const uri = result.assets[0].uri;
      const key = `rentals/${session.user.id}/profile/${kind}_${Date.now()}.jpg`;
      const url = await uploadImageUriToR2(uri, key);
      const field = kind === "cover" ? "cover_url" : "logo_url";
      const { error } = await supabase.from("rental_company_profiles").upsert({ company_id: companyId, [field]: url }, { onConflict: "company_id" });
      if (error) throw error;
      if (kind === "cover") setCoverUrl(url);
      else setLogoUrl(url);
      toast(kind === "cover" ? "Cover image updated." : "Logo updated.");
    } catch (e) {
      console.warn("profile image upload:", e);
      toast("Upload failed. Please try again.", 4000, true);
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    if (!companyId || !businessId) return;
    setIsSaving(true);
    try {
      const [profRes, coRes, bizRes] = await Promise.all([
        supabase
          .from("rental_company_profiles")
          .upsert({ company_id: companyId, about: about.trim() || null, service_location_ids: locationIds }, { onConflict: "company_id" })
          .select("id"),
        supabase.from("rental_companies").update({ days_open: days, opens_at: opensAt || null, closes_at: closesAt || null }).eq("id", companyId).select("id"),
        phone || whatsapp
          ? supabase.from("businesses").update({ phone: phone || undefined, whatsapp: whatsapp || undefined }).eq("id", businessId).select("id")
          : Promise.resolve({ data: [{}], error: null }),
      ]);
      if (profRes.error) throw profRes.error;
      if (coRes.error) throw coRes.error;
      if ((bizRes as any).error) throw (bizRes as any).error;
      if (!coRes.data?.length) throw new Error("Update matched 0 rows — your company must be active to save changes.");
      toast("Company profile updated.");
      router.back();
    } catch (e: any) {
      console.warn("save company profile:", e);
      toast(e?.message || "Could not save changes.", 5000, true);
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={tones.brand} />
      </View>
    );
  }

  if (!companyId) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>No rental company found. Complete setup first.</Text>
      </View>
    );
  }

  const isActive = status === "active";

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={styles.coverWrap}>
        {coverUrl ? <Image source={{ uri: coverUrl }} style={styles.coverImage} /> : <View style={styles.coverPlaceholder} />}
        <Pressable style={styles.coverBtn} onPress={() => uploadImage("cover")} disabled={isUploadingCover}>
          {isUploadingCover ? <ActivityIndicator size="small" color={tones.textOnBrand} /> : <Text style={styles.coverBtnText}>Change Cover</Text>}
        </Pressable>
      </View>

      <View style={styles.identityRow}>
        <View style={styles.logoWrap}>
          {logoUrl ? <Image source={{ uri: logoUrl }} style={styles.logoImage} /> : <Text style={styles.logoInitial}>{businessInitials(businessName)}</Text>}
          <Pressable style={styles.logoEditBtn} onPress={() => uploadImage("logo")} disabled={isUploadingLogo}>
            {isUploadingLogo ? <ActivityIndicator size="small" color={tones.textOnBrand} /> : <Text style={styles.logoEditText}>+</Text>}
          </Pressable>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={styles.nameRow}>
            <Text style={styles.bizName} numberOfLines={1}>
              {businessName}
            </Text>
            <View style={[styles.badge, isActive ? styles.badgeVerified : styles.badgePending]}>
              <Text style={[styles.badgeText, isActive ? styles.badgeTextVerified : styles.badgeTextPending]}>
                {isActive ? "Verified" : "Pending"}
              </Text>
            </View>
          </View>
          <Text style={styles.bizSub}>Rental Company</Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statNum}>{fleetCount}</Text>
          <Text style={styles.statLabel}>Vehicles</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statNum}>{avgRating ? Number(avgRating).toFixed(1) : "—"}</Text>
          <Text style={styles.statLabel}>Rating</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statNum}>{reviewCount}</Text>
          <Text style={styles.statLabel}>Reviews</Text>
        </View>
      </View>

      <View style={{ padding: 16 }}>
        <Text style={styles.label}>Company Description</Text>
        <TextInput
          style={styles.textarea}
          value={about}
          onChangeText={setAbout}
          placeholder="Tell customers about your rental services, coverage areas, and fleet..."
          placeholderTextColor={tones.textMuted}
          multiline
          numberOfLines={4}
        />
        <Text style={styles.label}>Contact Phone</Text>
        <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="+263 77 000 0000" placeholderTextColor={tones.textMuted} keyboardType="phone-pad" />
        <Text style={styles.label}>WhatsApp Number</Text>
        <TextInput style={styles.input} value={whatsapp} onChangeText={setWhatsapp} placeholder="+263 77 000 0000" placeholderTextColor={tones.textMuted} keyboardType="phone-pad" />

        <Text style={styles.label}>Operating Days</Text>
        <View style={styles.chipRow}>
          {DAYS_OF_WEEK.map((d) => (
            <Pressable key={d} style={[styles.chip, days.includes(d) && styles.chipSelectedDark]} onPress={() => toggleDay(d)}>
              <Text style={[styles.chipText, days.includes(d) && styles.chipTextDark]}>{d}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Opens At</Text>
            <TextInput style={styles.input} value={opensAt} onChangeText={setOpensAt} placeholder="08:00" placeholderTextColor={tones.textMuted} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Closes At</Text>
            <TextInput style={styles.input} value={closesAt} onChangeText={setClosesAt} placeholder="17:00" placeholderTextColor={tones.textMuted} />
          </View>
        </View>

        <Text style={styles.label}>Service Locations</Text>
        <View style={styles.chipRow}>
          {locations.map((loc) => (
            <Pressable key={loc.id} style={[styles.chip, locationIds.includes(loc.id) && styles.chipSelected]} onPress={() => toggleLocation(loc.id)}>
              <Text style={[styles.chipText, locationIds.includes(loc.id) && styles.chipTextSelected]}>{loc.city}</Text>
            </Pressable>
          ))}
        </View>

        <Pressable style={[styles.primaryBtn, isSaving && styles.disabled]} onPress={save} disabled={isSaving}>
          {isSaving ? <ActivityIndicator color={tones.textOnBrand} /> : <Text style={styles.primaryBtnText}>Save Changes</Text>}
        </Pressable>
      </View>
    </ScrollView>
  );
}

function buildTones(color: ColorPalette) {
  return { brand: color.brand, textMuted: color.textMuted, textOnBrand: color.textOnBrand };
}

function buildStyles(color: ColorPalette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: color.bg },
    centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
    emptyText: { fontSize: 13, color: color.textMuted, textAlign: "center" },
    coverWrap: { width: "100%", aspectRatio: 3.1, backgroundColor: color.brand },
    coverImage: { width: "100%", height: "100%" },
    coverPlaceholder: { width: "100%", height: "100%", backgroundColor: color.brand },
    coverBtn: {
      position: "absolute",
      bottom: 10,
      right: 10,
      backgroundColor: "rgba(0,0,0,0.45)",
      borderRadius: 20,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    coverBtnText: { color: color.textOnBrand, fontSize: 11, fontWeight: "700" },
    identityRow: { flexDirection: "row", gap: 14, alignItems: "center", padding: 16, backgroundColor: color.surface, borderBottomWidth: 1, borderBottomColor: color.border },
    logoWrap: { width: 64, height: 64, borderRadius: 16, backgroundColor: color.brandTint, alignItems: "center", justifyContent: "center", overflow: "visible" },
    logoImage: { width: 64, height: 64, borderRadius: 16 },
    logoInitial: { fontSize: 22, fontWeight: "800", color: color.brand },
    logoEditBtn: {
      position: "absolute",
      bottom: -4,
      right: -4,
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: color.brand,
      borderWidth: 2,
      borderColor: color.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    logoEditText: { color: color.textOnBrand, fontSize: 13, fontWeight: "800" },
    nameRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6 },
    bizName: { fontSize: 17, fontWeight: "800", color: color.text },
    bizSub: { fontSize: 12, color: color.textMuted, marginTop: 2 },
    badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
    badgeVerified: { backgroundColor: color.successTint },
    badgePending: { backgroundColor: color.warningTint },
    badgeText: { fontSize: 11, fontWeight: "800" },
    badgeTextVerified: { color: color.success },
    badgeTextPending: { color: color.warning },
    statsRow: { flexDirection: "row", paddingVertical: 14, backgroundColor: color.surface, borderBottomWidth: 1, borderBottomColor: color.border },
    statItem: { flex: 1, alignItems: "center" },
    statDivider: { width: 1, backgroundColor: color.border },
    statNum: { fontSize: 20, fontWeight: "800", color: color.brand },
    statLabel: { fontSize: 11, color: color.textMuted, marginTop: 2 },
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
    row: { flexDirection: "row", gap: 10 },
    chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    chip: {
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: 999,
      borderWidth: 1.5,
      borderColor: color.border,
      backgroundColor: color.surface,
    },
    chipSelected: { borderColor: color.brand, backgroundColor: color.brandTint },
    chipSelectedDark: { borderColor: color.brand, backgroundColor: color.brand },
    chipText: { fontSize: 12.5, fontWeight: "700", color: color.text },
    chipTextSelected: { color: color.brand },
    chipTextDark: { color: color.textOnBrand },
    primaryBtn: { marginTop: 20, backgroundColor: color.brand, borderRadius: 14, paddingVertical: 15, alignItems: "center" },
    primaryBtnText: { color: color.textOnBrand, fontSize: 14, fontWeight: "700" },
    disabled: { opacity: 0.6 },
  });
}
