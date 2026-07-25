import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { supabase } from "../../lib/supabase";
import { BRAND_BLUE } from "../../lib/constants";
import { toast } from "../../components/ui/Toast";
import type { RentalLookupOption } from "../../lib/rentals";
import { RENTAL_DRIVE_TYPES, RENTAL_FUEL_TYPES, RENTAL_TRANSMISSIONS } from "../../lib/rentals";

// Mirrors www/js/rentals-business.js H.pages.RentalAddVehicle — a single
// scrollable form (RN chip/picker style) instead of the web's 4-step wizard,
// covering the same required fields before an insert into
// rental_vehicle_listings + rental_vehicle_specs.
function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.chip, selected && styles.chipSelected]} onPress={onPress}>
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

export default function RentalAddVehicleScreen() {
  const { bizId } = useLocalSearchParams<{ bizId: string }>();
  const router = useRouter();

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
  const [driverRate, setDriverRate] = useState("");
  const [description, setDescription] = useState("");
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
          min_rental_days: 1,
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
      <Text style={styles.sectionLabel}>Category *</Text>
      <View style={styles.chipRow}>
        {categories.map((c) => (
          <Chip key={c.slug} label={c.label} selected={categorySlug === c.slug} onPress={() => setCategorySlug(c.slug)} />
        ))}
      </View>

      <Text style={styles.sectionLabel}>Brand *</Text>
      <View style={styles.chipRow}>
        {brands.map((b) => (
          <Chip key={b.slug} label={b.label} selected={brandSlug === b.slug} onPress={() => setBrandSlug(b.slug)} />
        ))}
      </View>

      <Text style={styles.label}>Model *</Text>
      <TextInput style={styles.input} value={model} onChangeText={setModel} placeholder="e.g. Fortuner, Aqua, Hilux" placeholderTextColor="#A1A1AA" />

      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Year</Text>
          <TextInput style={styles.input} value={year} onChangeText={setYear} placeholder="2022" keyboardType="number-pad" placeholderTextColor="#A1A1AA" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Seats</Text>
          <TextInput style={styles.input} value={seats} onChangeText={setSeats} placeholder="5" keyboardType="number-pad" placeholderTextColor="#A1A1AA" />
        </View>
      </View>

      <Text style={styles.sectionLabel}>Transmission *</Text>
      <View style={styles.chipRow}>
        {RENTAL_TRANSMISSIONS.map((t) => (
          <Chip key={t} label={t[0].toUpperCase() + t.slice(1)} selected={transmission === t} onPress={() => setTransmission(t)} />
        ))}
      </View>

      <Text style={styles.sectionLabel}>Fuel Type *</Text>
      <View style={styles.chipRow}>
        {RENTAL_FUEL_TYPES.map((f) => (
          <Chip key={f} label={f[0].toUpperCase() + f.slice(1)} selected={fuelType === f} onPress={() => setFuelType(f)} />
        ))}
      </View>

      <Text style={styles.sectionLabel}>Drive Type</Text>
      <View style={styles.chipRow}>
        {RENTAL_DRIVE_TYPES.map((d) => (
          <Chip key={d} label={d.toUpperCase()} selected={driveType === d} onPress={() => setDriveType(d)} />
        ))}
      </View>

      <Text style={styles.sectionLabel}>City / Location *</Text>
      <View style={styles.chipRow}>
        {cities.map((c) => (
          <Chip key={c.slug} label={c.label} selected={citySlug === c.slug} onPress={() => setCitySlug(c.slug)} />
        ))}
      </View>

      <Text style={styles.sectionLabel}>Pricing</Text>
      <Text style={styles.label}>Daily Rate (USD) *</Text>
      <TextInput style={styles.input} value={dailyRate} onChangeText={setDailyRate} placeholder="0.00" keyboardType="decimal-pad" placeholderTextColor="#A1A1AA" />
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Weekly Rate</Text>
          <TextInput style={styles.input} value={weeklyRate} onChangeText={setWeeklyRate} placeholder="0.00" keyboardType="decimal-pad" placeholderTextColor="#A1A1AA" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Monthly Rate</Text>
          <TextInput style={styles.input} value={monthlyRate} onChangeText={setMonthlyRate} placeholder="0.00" keyboardType="decimal-pad" placeholderTextColor="#A1A1AA" />
        </View>
      </View>
      <Text style={styles.label}>Security Deposit</Text>
      <TextInput style={styles.input} value={deposit} onChangeText={setDeposit} placeholder="0.00" keyboardType="decimal-pad" placeholderTextColor="#A1A1AA" />
      <Text style={styles.label}>Driver Rate / Day (leave blank for self-drive only)</Text>
      <TextInput style={styles.input} value={driverRate} onChangeText={setDriverRate} placeholder="0.00" keyboardType="decimal-pad" placeholderTextColor="#A1A1AA" />

      <Text style={styles.label}>Description</Text>
      <TextInput
        style={styles.textarea}
        value={description}
        onChangeText={setDescription}
        placeholder="Describe the vehicle condition, included accessories, rental terms..."
        placeholderTextColor="#A1A1AA"
        multiline
        numberOfLines={4}
      />

      <Pressable style={[styles.primaryBtn, isSubmitting && styles.disabled]} onPress={submit} disabled={isSubmitting}>
        {isSubmitting ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.primaryBtnText}>Create Vehicle</Text>}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F6F9" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  blockedTitle: { fontSize: 14, fontWeight: "700", color: "#52525B", marginBottom: 6, textAlign: "center" },
  blockedBody: { fontSize: 12.5, color: "#A1A1AA", textAlign: "center", lineHeight: 18 },
  sectionLabel: { fontSize: 13, fontWeight: "700", color: "#52525B", marginTop: 16, marginBottom: 8 },
  label: { fontSize: 12, fontWeight: "700", color: "#52525B", marginBottom: 6, marginTop: 12 },
  input: {
    height: 46,
    borderWidth: 1.5,
    borderColor: "#E4E4E7",
    borderRadius: 14,
    paddingHorizontal: 14,
    fontSize: 14,
    color: "#18181B",
    backgroundColor: "#ffffff",
  },
  textarea: {
    minHeight: 90,
    borderWidth: 1.5,
    borderColor: "#E4E4E7",
    borderRadius: 14,
    padding: 12,
    fontSize: 14,
    color: "#18181B",
    backgroundColor: "#ffffff",
    textAlignVertical: "top",
  },
  row: { flexDirection: "row", gap: 10 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: "#E4E4E7",
    backgroundColor: "#ffffff",
  },
  chipSelected: { borderColor: BRAND_BLUE, backgroundColor: "#EEF2FF" },
  chipText: { fontSize: 13, fontWeight: "600", color: "#52525B" },
  chipTextSelected: { color: BRAND_BLUE },
  primaryBtn: { marginTop: 24, backgroundColor: BRAND_BLUE, borderRadius: 14, paddingVertical: 15, alignItems: "center" },
  primaryBtnText: { color: "#ffffff", fontSize: 14, fontWeight: "700" },
  disabled: { opacity: 0.6 },
});
