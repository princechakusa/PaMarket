import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import { toast } from "../../components/ui/Toast";
import type { RentalLookupOption } from "../../lib/rentals";
import { RENTAL_DRIVE_TYPES, RENTAL_FUEL_TYPES, RENTAL_TRANSMISSIONS } from "../../lib/rentals";
import { uploadImageUriToR2 } from "../../lib/uploadToR2";
import type { ColorPalette } from "../../lib/theme";
import { useThemedStyles } from "../../lib/theme-provider";

// Mirrors www/js/rentals-business.js H.pages.RentalAddVehicle — a single
// scrollable form (RN chip/picker style) instead of the web's 4-step wizard,
// covering the same required fields before an insert into
// rental_vehicle_listings + rental_vehicle_specs.
function Chip({
  label,
  selected,
  onPress,
  styles,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  styles: ReturnType<typeof buildStyles>;
}) {
  return (
    <Pressable style={[styles.chip, selected && styles.chipSelected]} onPress={onPress}>
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

export default function RentalAddVehicleScreen() {
  const styles = useThemedStyles(buildStyles);
  const tones = useThemedStyles(buildTones);
  const { bizId } = useLocalSearchParams<{ bizId: string }>();
  const router = useRouter();
  const { session } = useAuth();

  const [canCreate, setCanCreate] = useState<boolean | null>(null);
  const [categories, setCategories] = useState<RentalLookupOption[]>([]);
  const [brands, setBrands] = useState<RentalLookupOption[]>([]);
  const [cities, setCities] = useState<RentalLookupOption[]>([]);

  const [categorySlug, setCategorySlug] = useState<string | null>(null);
  const [brandSlug, setBrandSlug] = useState<string | null>(null);
  const [citySlug, setCitySlug] = useState<string | null>(null);
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");
  const [seats, setSeats] = useState("");
  const [transmission, setTransmission] = useState<string | null>(null);
  const [fuelType, setFuelType] = useState<string | null>(null);
  const [driveType, setDriveType] = useState<string | null>(null);
  const [dailyRate, setDailyRate] = useState("");
  const [weeklyRate, setWeeklyRate] = useState("");
  const [monthlyRate, setMonthlyRate] = useState("");
  const [deposit, setDeposit] = useState("");
  const [minDays, setMinDays] = useState("1");
  const [driverRate, setDriverRate] = useState("");
  const [description, setDescription] = useState("");
  const [photoUris, setPhotoUris] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: accessData } = await supabase.rpc("get_user_rental_access");
      setCanCreate(!!accessData?.can_create_vehicle);
      const [catRes, brandRes, locRes] = await Promise.all([
        supabase.from("rental_categories").select("slug,label").order("label"),
        supabase.from("rental_brands").select("slug,label").order("label"),
        supabase.from("rental_locations").select("city").order("sort_order"),
      ]);
      setCategories((catRes.data as RentalLookupOption[]) ?? []);
      setBrands((brandRes.data as RentalLookupOption[]) ?? []);
      // rental_locations has no `slug` column — the city text itself is the value
      const cityRows = ((locRes.data as any[]) ?? []).map((r) => ({ slug: r.city as string, label: r.city as string }));
      setCities(cityRows);
    })();
  }, []);

  async function pickPhotos() {
    const remaining = Math.max(0, 5 - photoUris.length);
    if (!remaining) {
      toast("You can add up to 5 photos.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      quality: 0.82,
    });
    if (result.canceled || !result.assets?.length) return;
    setPhotoUris((prev) => [...prev, ...result.assets.map((a) => a.uri)].slice(0, 5));
  }

  async function submit() {
    if (!bizId) return;
    if (!categorySlug || !brandSlug || !model.trim() || !citySlug) {
      toast("Please fill in all required fields.");
      return;
    }
    if (!transmission || !fuelType) {
      toast("Please select transmission and fuel type.");
      return;
    }
    const daily = parseFloat(dailyRate);
    if (!daily || daily <= 0) {
      toast("Please enter a daily rate.");
      return;
    }
    setIsSubmitting(true);
    try {
      const [catRes, brandRes, locRes, compRes] = await Promise.all([
        supabase.from("rental_categories").select("id").eq("slug", categorySlug).maybeSingle(),
        supabase.from("rental_brands").select("id").eq("slug", brandSlug).maybeSingle(),
        supabase.from("rental_locations").select("id").eq("city", citySlug).maybeSingle(),
        supabase.from("rental_companies").select("id").eq("business_id", bizId).maybeSingle(),
      ]);
      if (!compRes.data) {
        toast("Rental company not set up. Please complete setup first.", 5000, true);
        router.replace(`/rental-fleet/setup?bizId=${bizId}`);
        return;
      }
      if (!catRes.data || !brandRes.data) {
        toast("Selected category or brand is no longer available. Please reselect.", 5000, true);
        return;
      }

      const { data: listing, error: lstErr } = await supabase
        .from("rental_vehicle_listings")
        .insert({
          company_id: compRes.data.id,
          category_id: catRes.data.id,
          brand_id: brandRes.data.id,
          location_id: locRes.data ? locRes.data.id : null,
          model: model.trim(),
          year: year ? parseInt(year, 10) : null,
          daily_rate: daily,
          weekly_rate: weeklyRate ? parseFloat(weeklyRate) : null,
          monthly_rate: monthlyRate ? parseFloat(monthlyRate) : null,
          deposit: deposit ? parseFloat(deposit) : 0,
          min_rental_days: minDays ? Math.max(1, parseInt(minDays, 10) || 1) : 1,
          driver_rate: driverRate ? parseFloat(driverRate) : null,
          description: description.trim() || null,
          status: "active",
          admin_status: "pending_review",
          is_available: true,
        })
        .select("id")
        .single();
      if (lstErr) throw lstErr;

      await supabase.from("rental_vehicle_specs").insert({
        listing_id: listing.id,
        transmission,
        fuel_type: fuelType,
        drive_type: driveType,
        seats: seats ? parseInt(seats, 10) : null,
      });

      if (session?.user && photoUris.length) {
        for (let index = 0; index < photoUris.length; index++) {
          const uri = photoUris[index];
          const key = `rentals/${session.user.id}/${listing.id}/${Date.now()}_${index}.jpg`;
          const url = await uploadImageUriToR2(uri, key);
          await supabase.from("rental_vehicle_media").insert({
            listing_id: listing.id,
            url,
            is_cover: index === 0,
            sort_order: index,
          });
        }
      }

      toast("Vehicle created! It will appear in the marketplace once approved.");
      router.replace(`/rental-fleet/manage?bizId=${bizId}`);
    } catch (e: any) {
      console.warn("vehicle create:", e);
      if (e?.code === "42501") toast("Access denied. Your company must be active to add vehicles.", 5000, true);
      else toast("Could not create vehicle. Check your details and try again.", 5000, true);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (canCreate === false) {
    return (
      <View style={styles.centered}>
        <Text style={styles.blockedTitle}>Vehicle creation locked</Text>
        <Text style={styles.blockedBody}>
          Your company must be active before you can add vehicles. If pending, this unlocks once approved.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
      <Text style={styles.sectionLabel}>Photos</Text>
      <Text style={styles.helperText}>Add clear real photos now. The first photo becomes the cover image.</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoRow}>
        {photoUris.map((uri, index) => (
          <View key={`${uri}-${index}`} style={styles.photoThumbWrap}>
            <Image source={{ uri }} style={styles.photoThumb} contentFit="cover" />
            {index === 0 ? (
              <View style={styles.coverPill}>
                <Text style={styles.coverPillText}>Cover</Text>
              </View>
            ) : null}
            <Pressable style={styles.removePhotoBtn} onPress={() => setPhotoUris((prev) => prev.filter((_, i) => i !== index))}>
              <Text style={styles.removePhotoText}>×</Text>
            </Pressable>
          </View>
        ))}
        {photoUris.length < 5 ? (
          <Pressable style={styles.addPhotoBtn} onPress={pickPhotos}>
            <Text style={styles.addPhotoText}>+ Add Photos</Text>
          </Pressable>
        ) : null}
      </ScrollView>

      <Text style={styles.sectionLabel}>Category *</Text>
      <View style={styles.chipRow}>
        {categories.map((c) => (
          <Chip key={c.slug} label={c.label} selected={categorySlug === c.slug} onPress={() => setCategorySlug(c.slug)} styles={styles} />
        ))}
      </View>

      <Text style={styles.sectionLabel}>Brand *</Text>
      <View style={styles.chipRow}>
        {brands.map((b) => (
          <Chip key={b.slug} label={b.label} selected={brandSlug === b.slug} onPress={() => setBrandSlug(b.slug)} styles={styles} />
        ))}
      </View>

      <Text style={styles.label}>Model *</Text>
      <TextInput style={styles.input} value={model} onChangeText={setModel} placeholder="e.g. Fortuner, Aqua, Hilux" placeholderTextColor={tones.textMuted} />

      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Year</Text>
          <TextInput style={styles.input} value={year} onChangeText={setYear} placeholder="2022" keyboardType="number-pad" placeholderTextColor={tones.textMuted} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Seats</Text>
          <TextInput style={styles.input} value={seats} onChangeText={setSeats} placeholder="5" keyboardType="number-pad" placeholderTextColor={tones.textMuted} />
        </View>
      </View>

      <Text style={styles.sectionLabel}>Transmission *</Text>
      <View style={styles.chipRow}>
        {RENTAL_TRANSMISSIONS.map((t) => (
          <Chip key={t} label={t[0].toUpperCase() + t.slice(1)} selected={transmission === t} onPress={() => setTransmission(t)} styles={styles} />
        ))}
      </View>

      <Text style={styles.sectionLabel}>Fuel Type *</Text>
      <View style={styles.chipRow}>
        {RENTAL_FUEL_TYPES.map((f) => (
          <Chip key={f} label={f[0].toUpperCase() + f.slice(1)} selected={fuelType === f} onPress={() => setFuelType(f)} styles={styles} />
        ))}
      </View>

      <Text style={styles.sectionLabel}>Drive Type</Text>
      <View style={styles.chipRow}>
        {RENTAL_DRIVE_TYPES.map((d) => (
          <Chip key={d} label={d.toUpperCase()} selected={driveType === d} onPress={() => setDriveType(d)} styles={styles} />
        ))}
      </View>

      <Text style={styles.sectionLabel}>City / Location *</Text>
      <View style={styles.chipRow}>
        {cities.map((c) => (
          <Chip key={c.slug} label={c.label} selected={citySlug === c.slug} onPress={() => setCitySlug(c.slug)} styles={styles} />
        ))}
      </View>

      <Text style={styles.sectionLabel}>Pricing</Text>
      <Text style={styles.label}>Daily Rate (USD) *</Text>
      <TextInput style={styles.input} value={dailyRate} onChangeText={setDailyRate} placeholder="0.00" keyboardType="decimal-pad" placeholderTextColor={tones.textMuted} />
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Weekly Rate</Text>
          <TextInput style={styles.input} value={weeklyRate} onChangeText={setWeeklyRate} placeholder="0.00" keyboardType="decimal-pad" placeholderTextColor={tones.textMuted} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Monthly Rate</Text>
          <TextInput style={styles.input} value={monthlyRate} onChangeText={setMonthlyRate} placeholder="0.00" keyboardType="decimal-pad" placeholderTextColor={tones.textMuted} />
        </View>
      </View>
      <Text style={styles.label}>Security Deposit</Text>
      <TextInput style={styles.input} value={deposit} onChangeText={setDeposit} placeholder="0.00" keyboardType="decimal-pad" placeholderTextColor={tones.textMuted} />
      <Text style={styles.label}>Minimum Rental Days</Text>
      <TextInput style={styles.input} value={minDays} onChangeText={setMinDays} placeholder="1" keyboardType="number-pad" placeholderTextColor={tones.textMuted} />
      <Text style={styles.label}>Driver Rate / Day (leave blank for self-drive only)</Text>
      <TextInput style={styles.input} value={driverRate} onChangeText={setDriverRate} placeholder="0.00" keyboardType="decimal-pad" placeholderTextColor={tones.textMuted} />

      <Text style={styles.label}>Description</Text>
      <TextInput
        style={styles.textarea}
        value={description}
        onChangeText={setDescription}
        placeholder="Describe the vehicle condition, included accessories, rental terms..."
        placeholderTextColor={tones.textMuted}
        multiline
        numberOfLines={4}
      />

      <Pressable style={[styles.primaryBtn, isSubmitting && styles.disabled]} onPress={submit} disabled={isSubmitting}>
        {isSubmitting ? <ActivityIndicator color={tones.textOnBrand} /> : <Text style={styles.primaryBtnText}>Create Vehicle</Text>}
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
    centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
    blockedTitle: { fontSize: 14, fontWeight: "700", color: color.textSub, marginBottom: 6, textAlign: "center" },
    blockedBody: { fontSize: 12.5, color: color.textMuted, textAlign: "center", lineHeight: 18 },
    sectionLabel: { fontSize: 13, fontWeight: "700", color: color.textSub, marginTop: 16, marginBottom: 8 },
    helperText: { fontSize: 12.5, color: color.textMuted, lineHeight: 18, marginBottom: 10 },
    label: { fontSize: 12, fontWeight: "700", color: color.textSub, marginBottom: 6, marginTop: 12 },
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
    photoRow: { gap: 10, paddingBottom: 4 },
    photoThumbWrap: { width: 104, height: 84, borderRadius: 14, overflow: "hidden", backgroundColor: color.skeleton },
    photoThumb: { width: "100%", height: "100%" },
    coverPill: {
      position: "absolute",
      left: 6,
      bottom: 6,
      backgroundColor: color.brand,
      borderRadius: 999,
      paddingHorizontal: 7,
      paddingVertical: 3,
    },
    coverPillText: { color: color.textOnBrand, fontSize: 10, fontWeight: "800" },
    removePhotoBtn: {
      position: "absolute",
      right: 5,
      top: 5,
      width: 24,
      height: 24,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: color.overlay,
    },
    removePhotoText: { color: color.textOnBrand, fontSize: 17, fontWeight: "800", lineHeight: 20 },
    addPhotoBtn: {
      width: 112,
      height: 84,
      borderRadius: 14,
      borderWidth: 1.5,
      borderStyle: "dashed",
      borderColor: color.border,
      backgroundColor: color.surface,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 8,
    },
    addPhotoText: { color: color.brand, fontSize: 12.5, fontWeight: "800", textAlign: "center" },
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
    chipText: { fontSize: 13, fontWeight: "600", color: color.textSub },
    chipTextSelected: { color: color.brand },
    primaryBtn: { marginTop: 24, backgroundColor: color.brand, borderRadius: 14, paddingVertical: 15, alignItems: "center" },
    primaryBtnText: { color: color.textOnBrand, fontSize: 14, fontWeight: "700" },
    disabled: { opacity: 0.6 },
  });
}
