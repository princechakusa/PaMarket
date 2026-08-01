import { useCallback, useEffect, useState } from "react";
import * as ImagePicker from "expo-image-picker";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import { GlassBackButton } from "../../components/ui";
import { toast } from "../../components/ui/Toast";
import { uploadImageUriToR2 } from "../../lib/uploadToR2";
import { RENTAL_DRIVE_TYPES, RENTAL_FUEL_TYPES, RENTAL_TRANSMISSIONS } from "../../lib/rentals";
import type { ColorPalette } from "../../lib/theme";
import { useThemedStyles } from "../../lib/theme-provider";

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

// Mirrors www/js/rentals-business.js H.pages.RentalEditVehicle — pricing,
// specs, availability toggle, description, and photo upload for one vehicle.
export default function RentalEditVehicleScreen() {
  const styles = useThemedStyles(buildStyles);
  const tones = useThemedStyles(buildTones);
  const { id, bizId } = useLocalSearchParams<{ id: string; bizId: string }>();
  const router = useRouter();
  const { session } = useAuth();

  const [isLoading, setIsLoading] = useState(true);
  const [canWrite, setCanWrite] = useState(true);
  const [photos, setPhotos] = useState<{ id: string; url: string; is_cover: boolean }[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const [dailyRate, setDailyRate] = useState("");
  const [weeklyRate, setWeeklyRate] = useState("");
  const [monthlyRate, setMonthlyRate] = useState("");
  const [deposit, setDeposit] = useState("");
  const [minDays, setMinDays] = useState("1");
  const [driverRate, setDriverRate] = useState("");
  const [transmission, setTransmission] = useState<string | null>(null);
  const [fuelType, setFuelType] = useState<string | null>(null);
  const [driveType, setDriveType] = useState<string | null>(null);
  const [seats, setSeats] = useState("");
  const [mileage, setMileage] = useState("");
  const [description, setDescription] = useState("");
  const [isAvailable, setIsAvailable] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const { data: accessData } = await supabase.rpc("get_user_rental_access");
    setCanWrite(!!accessData?.can_create_vehicle);

    const [{ data: listing }, { data: specs }, { data: media }] = await Promise.all([
      supabase
        .from("rental_vehicle_listings")
        .select("daily_rate,weekly_rate,monthly_rate,deposit,min_rental_days,driver_rate,description,is_available")
        .eq("id", id)
        .maybeSingle(),
      supabase
        .from("rental_vehicle_specs")
        .select("transmission,fuel_type,drive_type,seats,mileage_km")
        .eq("listing_id", id)
        .maybeSingle(),
      supabase.from("rental_vehicle_media").select("id,url,is_cover").eq("listing_id", id).order("sort_order"),
    ]);
    if (listing) {
      setDailyRate(listing.daily_rate != null ? String(listing.daily_rate) : "");
      setWeeklyRate(listing.weekly_rate != null ? String(listing.weekly_rate) : "");
      setMonthlyRate(listing.monthly_rate != null ? String(listing.monthly_rate) : "");
      setDeposit(listing.deposit != null ? String(listing.deposit) : "");
      setMinDays(listing.min_rental_days != null ? String(listing.min_rental_days) : "1");
      setDriverRate(listing.driver_rate != null ? String(listing.driver_rate) : "");
      setDescription(listing.description ?? "");
      setIsAvailable(!!listing.is_available);
    }
    if (specs) {
      setTransmission(specs.transmission ?? null);
      setFuelType(specs.fuel_type ?? null);
      setDriveType(specs.drive_type ?? null);
      setSeats(specs.seats != null ? String(specs.seats) : "");
      setMileage(specs.mileage_km != null ? String(specs.mileage_km) : "");
    }
    setPhotos((media as any[]) ?? []);
  }, [id]);

  useEffect(() => {
    setIsLoading(true);
    load().finally(() => setIsLoading(false));
  }, [load]);

  async function save() {
    if (!id) return;
    const daily = parseFloat(dailyRate);
    if (!daily || daily <= 0) {
      toast("Daily rate is required.");
      return;
    }
    setIsSaving(true);
    try {
      const listingUpdate = {
        daily_rate: daily,
        weekly_rate: weeklyRate ? parseFloat(weeklyRate) : null,
        monthly_rate: monthlyRate ? parseFloat(monthlyRate) : null,
        deposit: deposit ? parseFloat(deposit) : null,
        min_rental_days: minDays ? parseInt(minDays, 10) : 1,
        driver_rate: driverRate ? parseFloat(driverRate) : null,
        description: description.trim() || null,
        is_available: isAvailable,
      };
      const specsUpdate = {
        transmission,
        fuel_type: fuelType,
        drive_type: driveType,
        seats: seats ? parseInt(seats, 10) : null,
        mileage_km: mileage ? parseInt(mileage, 10) : null,
      };
      const [lstRes] = await Promise.all([
        supabase.from("rental_vehicle_listings").update(listingUpdate).eq("id", id).select("id"),
        supabase.from("rental_vehicle_specs").upsert({ listing_id: id, ...specsUpdate }, { onConflict: "listing_id" }),
      ]);
      if (lstRes.error) throw lstRes.error;
      if (!lstRes.data?.length) throw new Error("Update matched 0 rows — your company must be active to edit vehicles.");
      toast("Vehicle updated.");
      router.back();
    } catch (e: any) {
      console.warn("rental edit:", e);
      if (e?.code === "42501") toast("Access denied. Your company account is not active.", 4000, true);
      else toast(e?.message || "Could not save changes.", 4000, true);
    } finally {
      setIsSaving(false);
    }
  }

  async function pickAndUploadPhoto() {
    if (!id || !session?.user) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.length) return;
    setIsUploading(true);
    try {
      const uri = result.assets[0].uri;
      const key = `rentals/${session.user.id}/${id}/${Date.now()}.jpg`;
      const url = await uploadImageUriToR2(uri, key);
      const { count } = await supabase
        .from("rental_vehicle_media")
        .select("id", { count: "exact", head: true })
        .eq("listing_id", id);
      const willBeCover = count === 0;
      if (willBeCover) {
        await supabase.from("rental_vehicle_media").update({ is_cover: false }).eq("listing_id", id).eq("is_cover", true);
      }
      const { data: inserted, error } = await supabase
        .from("rental_vehicle_media")
        .insert({ listing_id: id, url, is_cover: willBeCover, sort_order: count || 0 })
        .select("id,url,is_cover")
        .single();
      if (error) throw error;
      setPhotos((prev) => [...prev, inserted as any]);
      toast("Photo uploaded.");
    } catch (e) {
      console.warn("rental photo upload:", e);
      toast("Upload failed. Please try again.", 4000, true);
    } finally {
      setIsUploading(false);
    }
  }

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={tones.brand} />
      </View>
    );
  }

  if (!canWrite) {
    return (
      <View style={styles.centered}>
        <Text style={styles.blockedTitle}>Editing locked</Text>
        <Text style={styles.blockedBody}>Your company must be active to edit vehicles.</Text>
        <GlassBackButton onPress={() => router.back()} flat />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
      <Text style={styles.sectionLabel}>Photos</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
        {photos.map((p) => (
          <Image key={p.id} source={{ uri: p.url }} style={styles.photoThumb} />
        ))}
        <Pressable style={styles.addPhotoBtn} onPress={pickAndUploadPhoto} disabled={isUploading}>
          {isUploading ? <ActivityIndicator color={tones.brand} /> : <Text style={styles.addPhotoText}>+ Photo</Text>}
        </Pressable>
      </ScrollView>

      <Text style={styles.sectionLabel}>Pricing</Text>
      <Text style={styles.label}>Daily Rate</Text>
      <TextInput style={styles.input} value={dailyRate} onChangeText={setDailyRate} keyboardType="decimal-pad" placeholderTextColor={tones.textMuted} />
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Weekly Rate</Text>
          <TextInput style={styles.input} value={weeklyRate} onChangeText={setWeeklyRate} keyboardType="decimal-pad" placeholderTextColor={tones.textMuted} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Monthly Rate</Text>
          <TextInput style={styles.input} value={monthlyRate} onChangeText={setMonthlyRate} keyboardType="decimal-pad" placeholderTextColor={tones.textMuted} />
        </View>
      </View>
      <Text style={styles.label}>Security Deposit</Text>
      <TextInput style={styles.input} value={deposit} onChangeText={setDeposit} keyboardType="decimal-pad" placeholderTextColor={tones.textMuted} />
      <Text style={styles.label}>Minimum Rental Days</Text>
      <TextInput style={styles.input} value={minDays} onChangeText={setMinDays} keyboardType="number-pad" placeholderTextColor={tones.textMuted} />
      <Text style={styles.label}>Driver Rate / Day</Text>
      <TextInput style={styles.input} value={driverRate} onChangeText={setDriverRate} keyboardType="decimal-pad" placeholderTextColor={tones.textMuted} />

      <Text style={styles.sectionLabel}>Specs</Text>
      <Text style={styles.label}>Transmission</Text>
      <View style={styles.chipRow}>
        {RENTAL_TRANSMISSIONS.map((t) => (
          <Chip key={t} label={t[0].toUpperCase() + t.slice(1)} selected={transmission === t} onPress={() => setTransmission(t)} styles={styles} />
        ))}
      </View>
      <Text style={styles.label}>Fuel Type</Text>
      <View style={styles.chipRow}>
        {RENTAL_FUEL_TYPES.map((f) => (
          <Chip key={f} label={f[0].toUpperCase() + f.slice(1)} selected={fuelType === f} onPress={() => setFuelType(f)} styles={styles} />
        ))}
      </View>
      <Text style={styles.label}>Drive Type</Text>
      <View style={styles.chipRow}>
        {RENTAL_DRIVE_TYPES.map((d) => (
          <Chip key={d} label={d.toUpperCase()} selected={driveType === d} onPress={() => setDriveType(d)} styles={styles} />
        ))}
      </View>
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Seats</Text>
          <TextInput style={styles.input} value={seats} onChangeText={setSeats} keyboardType="number-pad" placeholderTextColor={tones.textMuted} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Mileage (km)</Text>
          <TextInput style={styles.input} value={mileage} onChangeText={setMileage} keyboardType="number-pad" placeholderTextColor={tones.textMuted} />
        </View>
      </View>

      <Text style={styles.sectionLabel}>Description</Text>
      <TextInput style={styles.textarea} value={description} onChangeText={setDescription} multiline numberOfLines={4} placeholderTextColor={tones.textMuted} />

      <Text style={styles.sectionLabel}>Availability</Text>
      <View style={styles.availRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.availTitle}>Mark as available</Text>
          <Text style={styles.availSub}>Customers can see and enquire about this vehicle</Text>
        </View>
        <Switch value={isAvailable} onValueChange={setIsAvailable} trackColor={{ true: tones.brand }} />
      </View>

      <View style={styles.row}>
        <Pressable style={[styles.secondaryBtn, { flex: 1 }]} onPress={() => router.back()}>
          <Text style={styles.secondaryBtnText}>Cancel</Text>
        </Pressable>
        <Pressable style={[styles.primaryBtn, { flex: 2 }, isSaving && styles.disabled]} onPress={save} disabled={isSaving}>
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
    blockedTitle: { fontSize: 14, fontWeight: "700", color: color.textSub, marginBottom: 6, textAlign: "center" },
    blockedBody: { fontSize: 12.5, color: color.textMuted, textAlign: "center", lineHeight: 18, marginBottom: 16 },
    sectionLabel: { fontSize: 13, fontWeight: "700", color: color.textSub, textTransform: "uppercase", letterSpacing: 0.4, marginTop: 16, marginBottom: 10 },
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
    photoThumb: { width: 90, height: 66, borderRadius: 10, marginRight: 8, backgroundColor: color.skeleton },
    addPhotoBtn: {
      width: 90,
      height: 66,
      borderRadius: 10,
      borderWidth: 1.5,
      borderColor: color.brand,
      borderStyle: "dashed",
      alignItems: "center",
      justifyContent: "center",
    },
    addPhotoText: { fontSize: 11, fontWeight: "700", color: color.brand },
    availRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: color.surface,
      borderWidth: 1,
      borderColor: color.border,
      borderRadius: 14,
      padding: 14,
    },
    availTitle: { fontSize: 14, fontWeight: "700", color: color.text },
    availSub: { fontSize: 12, color: color.textMuted, marginTop: 2 },
    primaryBtn: { backgroundColor: color.brand, borderRadius: 14, paddingVertical: 15, alignItems: "center" },
    primaryBtnText: { color: color.textOnBrand, fontSize: 14, fontWeight: "700" },
    secondaryBtn: { borderWidth: 1.5, borderColor: color.brand, borderRadius: 14, paddingVertical: 14, alignItems: "center" },
    secondaryBtnText: { color: color.brand, fontSize: 14, fontWeight: "700" },
    disabled: { opacity: 0.6 },
  });
}
