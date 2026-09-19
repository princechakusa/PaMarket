import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
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
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import { uploadImageUriToR2 } from "../../lib/uploadToR2";
import { toast } from "../../components/ui/Toast";
import { ProvinceCityFields, UseCurrentLocationButton } from "../../components/ui";
import { useTaxonomy, withSelectedValue } from "../../lib/taxonomy";
import type { Business } from "../../lib/businesses";
import { businessInitials } from "../../lib/businesses";
import { institutionAbbreviation, type Institution } from "../../lib/institutions";
import type { ColorPalette } from "../../lib/theme";
import { useThemedStyles } from "../../lib/theme-provider";
import { useKeyboardAvoidingReset } from "../../lib/useKeyboardAvoidingReset";

// Owner/staff edit form for identity, media, contact, and location. Mirrors
// www/js/business-profile.js pages.BusinessEditProfile. Shop-thumbnail
// featuring (featured_listing_ids) and staff link at the bottom.
export default function BusinessEditScreen() {
  const kavResetKey = useKeyboardAvoidingReset();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const styles = useThemedStyles(buildStyles);
  const tones = useThemedStyles(buildTones);

  const [business, setBusiness] = useState<Business | null>(null);
  const [name, setName] = useState("");
  const [bizType, setBizType] = useState("individual");
  const [description, setDescription] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [province, setProvince] = useState("");
  const [city, setCity] = useState("");
  const [suburb, setSuburb] = useState("");
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [logo, setLogo] = useState<string | null>(null);
  const [cover, setCover] = useState<string | null>(null);
  const [institutionId, setInstitutionId] = useState<string | null>(null);
  const [institutionOptions, setInstitutionOptions] = useState<Institution[]>([]);
  const [institutionPickerOpen, setInstitutionPickerOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  // Stage 5: keeps this business's existing category selections/province/
  // city valid even if since deactivated — editing must never fail
  // validation over a value the record itself already has.
  const { categories: baseTaxCategories, provinces, citiesByProvince } = useTaxonomy({ province, city });
  const taxCategories = categories.reduce(
    (list, id) => withSelectedValue(list, id, (v) => ({ id: v, name: v })),
    baseTaxCategories
  );

  const load = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase
      .from("businesses")
      .select(
        "id,owner_user_id,name,logo,cover,description,biz_type,category,phone,whatsapp,email,province,city,suburb,latitude,longitude,institution_id,status"
      )
      .eq("id", id)
      .maybeSingle();
    if (!data) return;
    const b = data as Business;
    setBusiness(b);
    setName(b.name ?? "");
    setBizType(b.biz_type ?? "individual");
    setDescription(b.description ?? "");
    setCategories((b.category ?? "").split("|").filter(Boolean));
    setPhone(b.phone ?? "");
    setWhatsapp(b.whatsapp ?? "");
    setEmail(b.email ?? "");
    setProvince(b.province ?? "");
    setCity(b.city ?? "");
    setSuburb(b.suburb ?? "");
    setLatitude(b.latitude ?? null);
    setLongitude(b.longitude ?? null);
    setLogo(b.logo ?? null);
    setCover(b.cover ?? null);
    setInstitutionId(b.institution_id ?? null);
  }, [id]);

  useEffect(() => {
    setIsLoading(true);
    load().finally(() => setIsLoading(false));
  }, [load]);

  // Optional institution/campus tag -- lets an org appear on that
  // institution's hub page (see institutions/[id].tsx's Organizations
  // section) independent of whether it has posted any listings there.
  useEffect(() => {
    supabase
      .from("institutions")
      .select("id,type,official_name,short_name,province_id,city_id,is_active")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .then(({ data }) => setInstitutionOptions((data as Institution[]) ?? []));
  }, []);

  const selectedInstitution = institutionOptions.find((i) => i.id === institutionId) ?? null;

  const isOwner = session?.user?.id === business?.owner_user_id;

  function toggleCategory(catId: string) {
    setCategories((cats) => (cats.includes(catId) ? cats.filter((c) => c !== catId) : [...cats, catId]));
  }

  async function pickImage(which: "logo" | "cover") {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted || !session?.user) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.82,
      allowsEditing: true,
      aspect: which === "logo" ? [1, 1] : [16, 9],
    });
    if (result.canceled || !result.assets?.length) return;
    try {
      const key = `businesses/${id}/${which}_${Date.now()}.jpg`;
      const url = await uploadImageUriToR2(result.assets[0].uri, key);
      if (which === "logo") setLogo(url);
      else setCover(url);
    } catch {
      toast("Could not upload photo. Please try again.", 4000, true);
    }
  }

  async function save() {
    if (!id || isSaving) return;
    if (!name.trim()) { toast("Business name is required"); return; }
    if (!categories.length || categories.some((category) => !taxCategories.some((valid) => valid.id === category))) {
      toast("Select at least one valid business category");
      return;
    }
    if (!provinces.includes(province)) { toast("Select a valid Province"); return; }
    if (!(citiesByProvince[province] ?? []).includes(city)) {
      toast("Select a valid City / Town for that Province");
      return;
    }
    if (phone.trim() && !/^(\+263|0)[0-9]{9}$/.test(phone.trim())) { toast("Enter a valid Zimbabwe phone"); return; }
    setIsSaving(true);
    const { error } = await supabase
      .from("businesses")
      .update({
        name: name.trim(),
        description: description.trim() || null,
        biz_type: bizType,
        category: categories.join("|") || null,
        phone: phone.trim() || null,
        whatsapp: whatsapp.trim() || null,
        email: email.trim() || null,
        province: province || null,
        city: city || null,
        suburb: suburb.trim() || null,
        latitude,
        longitude,
        logo,
        cover,
        institution_id: institutionId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) {
      setIsSaving(false);
      toast("Could not save profile. Please try again.", 4000, true);
      return;
    }
    // Not resetting isSaving here — router.replace below unmounts this
    // screen; see project_fabric_navigation_crash memory.
    toast("Profile saved");
    router.replace(`/business-manage/${id}`);
  }

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={tones.brand} />
      </View>
    );
  }

  if (!business) {
    return (
      <View style={styles.centered}>
        <Text style={styles.notFoundTitle}>Business not found</Text>
      </View>
    );
  }

  if (!isOwner) {
    return (
      <View style={styles.centered}>
        <Text style={styles.notFoundTitle}>No access</Text>
        <Text style={styles.notFoundSub}>Only the owner or staff can edit this business.</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView key={kavResetKey} style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.coverWrap}>
          <Pressable style={styles.cover} onPress={() => pickImage("cover")}>
            {cover ? <Image source={{ uri: cover }} style={styles.coverImage} /> : null}
            <View style={styles.coverButton}>
              <Text style={styles.coverButtonText}>Change cover</Text>
            </View>
          </Pressable>
          <Pressable style={styles.logoWrap} onPress={() => pickImage("logo")}>
            {logo ? (
              <Image source={{ uri: logo }} style={styles.logoImage} />
            ) : (
              <Text style={styles.logoInitial}>{businessInitials(name)}</Text>
            )}
          </Pressable>
        </View>

        <Field label="Business name" styles={styles}>
          <TextInput style={styles.input} value={name} onChangeText={setName} maxLength={60} />
        </Field>

        <Field label="Business type" styles={styles}>
          <View style={styles.rowGap}>
            {[
              { id: "individual", label: "Individual" },
              { id: "company", label: "Company" },
              { id: "agency", label: "Agency" },
            ].map((t) => (
              <Pressable key={t.id} style={[styles.typeButton, bizType === t.id && styles.typeButtonActive]} onPress={() => setBizType(t.id)}>
                <Text style={[styles.typeButtonText, bizType === t.id && styles.typeButtonTextActive]}>{t.label}</Text>
              </Pressable>
            ))}
          </View>
        </Field>

        <Field label="Description" styles={styles}>
          <TextInput style={[styles.input, styles.textArea]} value={description} onChangeText={setDescription} multiline maxLength={300} />
        </Field>

        <Field label="Categories" styles={styles}>
          <View style={styles.chipsWrap}>
            {taxCategories.map((c) => {
              const active = categories.includes(c.id);
              return (
                <Pressable key={c.id} style={[styles.chip, active && styles.chipActive]} onPress={() => toggleCategory(c.id)}>
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{c.name}</Text>
                </Pressable>
              );
            })}
          </View>
        </Field>

        <Field label="Contact phone" styles={styles}>
          <TextInput style={styles.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        </Field>
        <Field label="WhatsApp" styles={styles}>
          <TextInput style={styles.input} value={whatsapp} onChangeText={setWhatsapp} keyboardType="phone-pad" />
        </Field>
        <Field label="Email" styles={styles}>
          <TextInput style={styles.input} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
        </Field>

        <ProvinceCityFields
          provinces={provinces}
          citiesByProvince={citiesByProvince}
          province={province}
          city={city}
          onChange={(next) => {
            setProvince(next.province);
            setCity(next.city);
          }}
        />
        <Field label="Suburb / Area" styles={styles}>
          <TextInput style={styles.input} value={suburb} onChangeText={setSuburb} />
        </Field>
        <Field label="Institution / Campus (optional)" styles={styles}>
          <Pressable style={styles.input} onPress={() => setInstitutionPickerOpen(true)}>
            <Text style={{ color: selectedInstitution ? tones.text : tones.textMuted }}>
              {selectedInstitution ? selectedInstitution.official_name : "None"}
            </Text>
          </Pressable>
        </Field>

        <Modal visible={institutionPickerOpen} transparent animationType="fade" onRequestClose={() => setInstitutionPickerOpen(false)}>
          <Pressable style={styles.institutionOverlay} onPress={() => setInstitutionPickerOpen(false)}>
            <View style={styles.institutionSheet}>
              <Text style={styles.dropdownTitle}>Institution / Campus</Text>
              <ScrollView style={{ maxHeight: 360 }}>
                <Pressable
                  style={styles.institutionOption}
                  onPress={() => {
                    setInstitutionId(null);
                    setInstitutionPickerOpen(false);
                  }}
                >
                  <Text style={styles.institutionOptionText}>None</Text>
                  {institutionId === null ? <Text style={styles.dropdownCheck}>✓</Text> : null}
                </Pressable>
                {institutionOptions.map((inst) => (
                  <Pressable
                    key={inst.id}
                    style={styles.institutionOption}
                    onPress={() => {
                      setInstitutionId(inst.id);
                      setInstitutionPickerOpen(false);
                    }}
                  >
                    <Text style={styles.institutionOptionText}>
                      {inst.official_name}
                      {inst.short_name ? ` (${institutionAbbreviation(inst)})` : ""}
                    </Text>
                    {institutionId === inst.id ? <Text style={styles.dropdownCheck}>✓</Text> : null}
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          </Pressable>
        </Modal>

        <UseCurrentLocationButton
          provinces={provinces}
          citiesByProvince={citiesByProvince}
          onResolved={(loc) => {
            setLatitude(loc.latitude);
            setLongitude(loc.longitude);
            if (loc.province) setProvince(loc.province);
            if (loc.city) setCity(loc.city);
            if (loc.suburb) setSuburb(loc.suburb);
          }}
        />

        <Pressable style={styles.primaryButton} onPress={save} disabled={isSaving}>
          {isSaving ? <ActivityIndicator color={tones.textOnBrand} /> : <Text style={styles.primaryButtonText}>Save Profile</Text>}
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={() => router.push(`/business-staff/${id}`)}>
          <Text style={styles.secondaryButtonText}>Manage Staff</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

type Styles = ReturnType<typeof buildStyles>;

function Field({ label, children, styles }: { label: string; children: React.ReactNode; styles: Styles }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

function buildTones(color: ColorPalette) {
  return { brand: color.brand, textOnBrand: color.textOnBrand, text: color.text, textMuted: color.textMuted };
}

function buildStyles(color: ColorPalette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: color.surface },
    centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
    notFoundTitle: { fontSize: 16, fontWeight: "700", color: color.text, marginBottom: 8, textAlign: "center" },
    notFoundSub: { fontSize: 13, color: color.textMuted, textAlign: "center" },
    scrollContent: { padding: 16, paddingBottom: 40 },
    coverWrap: { marginBottom: 58 },
    cover: { height: 120, borderRadius: 16, overflow: "hidden", backgroundColor: color.brand },
    coverImage: { width: "100%", height: "100%" },
    coverButton: { position: "absolute", top: 10, right: 10, backgroundColor: "rgba(0,0,0,0.45)", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 },
    coverButtonText: { color: color.textOnBrand, fontSize: 12, fontWeight: "700" },
    logoWrap: { position: "absolute", left: 16, bottom: -44, width: 88, height: 88, borderRadius: 20, borderWidth: 3, borderColor: color.surface, backgroundColor: color.brandTint, overflow: "hidden", alignItems: "center", justifyContent: "center" },
    logoImage: { width: "100%", height: "100%" },
    logoInitial: { fontSize: 26, fontWeight: "800", color: color.brand },
    field: { marginBottom: 14 },
    fieldLabel: { fontSize: 13, fontWeight: "700", color: color.text, marginBottom: 8 },
    input: { borderWidth: 1, borderColor: color.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: color.text },
    textArea: { minHeight: 80, textAlignVertical: "top" },
    rowGap: { flexDirection: "row", gap: 8 },
    typeButton: { flex: 1, paddingVertical: 10, borderRadius: 12, borderWidth: 1.5, borderColor: color.border, alignItems: "center" },
    typeButtonActive: { borderColor: color.brand, backgroundColor: color.brandTint },
    typeButtonText: { fontSize: 13, fontWeight: "700", color: color.text },
    typeButtonTextActive: { color: color.brand },
    chipsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1.5, borderColor: color.border, backgroundColor: color.surface },
    chipActive: { borderColor: color.brand, backgroundColor: color.brandTint },
    chipText: { fontSize: 12.5, fontWeight: "700", color: color.text },
    chipTextActive: { color: color.brand },
    primaryButton: { backgroundColor: color.brand, borderRadius: 10, paddingVertical: 14, alignItems: "center", marginTop: 6 },
    primaryButtonText: { color: color.textOnBrand, fontSize: 14, fontWeight: "700" },
    secondaryButton: { borderRadius: 10, paddingVertical: 13, alignItems: "center", marginTop: 10, backgroundColor: color.surfaceAlt },
    secondaryButtonText: { fontSize: 14, fontWeight: "700", color: color.text },
    institutionOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "flex-end" },
    institutionSheet: {
      backgroundColor: color.surface, borderTopLeftRadius: 16, borderTopRightRadius: 16,
      paddingHorizontal: 16, paddingTop: 14, paddingBottom: 32,
    },
    dropdownTitle: { fontSize: 16, fontWeight: "700", color: color.text, marginBottom: 8 },
    institutionOption: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: color.border,
    },
    institutionOptionText: { fontSize: 14, color: color.text, flexShrink: 1 },
    dropdownCheck: { color: color.brand, fontWeight: "800" },
  });
}
