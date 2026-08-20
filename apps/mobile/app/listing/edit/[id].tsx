import { useCallback, useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAuth } from "../../../lib/auth";
import { supabase } from "../../../lib/supabase";
import { uploadImageUriToR2 } from "../../../lib/uploadToR2";
import { friendlyError } from "../../../lib/safety";
import { CATEGORIES, PROVINCES, CITIES_BY_PROVINCE } from "../../../lib/constants";
import type { Listing } from "../../../lib/listings";
import { CONDITION_OPTIONS, categoryHasCondition, type ListingCondition } from "../../../lib/listing-form";
import { AttrFields, type AttrValues } from "../../../components/post/AttrFields";
import { PhotoGrid } from "../../../components/post/PhotoGrid";
import { Button, Card, Chip, ErrorState, ProvinceCityFields, Skeleton, toast } from "../../../components/ui";
import { DARK_COLORS, LIGHT_COLORS, font, radius, space, type ColorPalette } from "../../../lib/theme";
import { useThemedStyles, useThemePreference } from "../../../lib/theme-provider";
import { useKeyboardAvoidingReset } from "../../../lib/useKeyboardAvoidingReset";

type EditState = {
  category: string | null;
  title: string;
  description: string;
  price: string;
  currency: "USD" | "ZiG";
  province: string;
  city: string;
  suburb: string;
  photos: string[]; // mix of existing R2 urls and new local uris
  condition: ListingCondition | null;
  attrs: AttrValues;
};

export default function EditListingScreen() {
  const kavResetKey = useKeyboardAvoidingReset();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const router = useRouter();
  const styles = useThemedStyles(buildStyles);
  const { resolvedScheme } = useThemePreference();
  const color = resolvedScheme === "dark" ? DARK_COLORS : LIGHT_COLORS;

  const [state, setState] = useState<EditState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isProcessingPhotos, setIsProcessingPhotos] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoadError(null);
    if (!session?.user || !id) return;
    const { data, error: qErr } = await supabase.from("listings").select("*").eq("id", id).maybeSingle();
    if (qErr) return setLoadError(qErr.message);
    if (!data) return setLoadError("Listing not found.");
    const listing = data as Listing;
    if (listing.seller_id !== session.user.id) return setLoadError("You can only edit your own listings.");

    const attrs = (listing.attributes as AttrValues) ?? {};
    const condition =
      (listing as { condition?: ListingCondition | null }).condition ??
      (attrs.condition as ListingCondition | undefined) ??
      null;
    // Never manufacture a Province for a legacy value. Unknown values remain
    // visible and save is blocked until the owner chooses a valid pair.
    const province = listing.province ?? "";
    setState({
      category: listing.category,
      title: listing.title ?? "",
      description: listing.description ?? "",
      price: listing.price != null ? String(listing.price) : "",
      currency: (listing.currency as "USD" | "ZiG") ?? "USD",
      province,
      city: listing.city ?? "",
      suburb: listing.suburb ?? "",
      photos: listing.photos ?? [],
      condition,
      attrs,
    });
  }, [id, session?.user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  function update(patch: Partial<EditState>) {
    setState((s) => (s ? { ...s, ...patch } : s));
    setError(null);
  }

  async function pickPhotos(source: "gallery" | "camera") {
    if (!state || isProcessingPhotos || state.photos.length >= 8) return;
    const permission =
      source === "gallery"
        ? await ImagePicker.requestMediaLibraryPermissionsAsync()
        : await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setError("Permission needed to access " + (source === "gallery" ? "your photos" : "the camera"));
      return;
    }
    const remaining = 8 - state.photos.length;
    const result =
      source === "gallery"
        ? await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images"],
            quality: 0.8,
            allowsMultipleSelection: true,
            selectionLimit: remaining,
          })
        : await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.8 });
    if (result.canceled || !result.assets?.length) return;
    setIsProcessingPhotos(true);
    const uris = result.assets.slice(0, remaining).map((a) => a.uri);
    update({ photos: [...state.photos, ...uris] });
    setIsProcessingPhotos(false);
  }

  function removePhoto(index: number) {
    if (!state) return;
    update({ photos: state.photos.filter((_, i) => i !== index) });
  }

  function setCoverPhoto(index: number) {
    if (!state || index <= 0) return;
    const next = [...state.photos];
    const [cover] = next.splice(index, 1);
    next.unshift(cover);
    update({ photos: next });
  }

  function movePhoto(index: number, direction: "left" | "right") {
    if (!state) return;
    const target = direction === "left" ? index - 1 : index + 1;
    if (target < 0 || target >= state.photos.length) return;
    const next = [...state.photos];
    [next[index], next[target]] = [next[target], next[index]];
    update({ photos: next });
  }

  async function save() {
    if (!state || isSubmitting || !session?.user || !id) return;
    if (!state.category) return setError("Category is required");
    if (state.title.trim().length < 5) return setError("Title needs at least 5 characters");
    if (state.description.trim().length < 10) return setError("Description needs at least 10 characters");
    if (!state.price || Number(state.price) <= 0) return setError("Enter a valid price");
    if (!state.photos.length) return setError("Add at least one photo");
    if (categoryHasCondition(state.category) && !state.condition) return setError("Select the item condition");
    if (!PROVINCES.includes(state.province)) return setError("Select a valid Province");
    if (!(CITIES_BY_PROVINCE[state.province] ?? []).includes(state.city)) {
      return setError("Select a valid City / Town for that Province");
    }

    setIsSubmitting(true);
    setError(null);
    try {
      // Upload only new local uris; keep existing R2 urls as-is (preserves order/cover).
      const photoUrls: string[] = [];
      for (const uri of state.photos) {
        if (uri.startsWith("http")) {
          photoUrls.push(uri);
        } else {
          const key = `listings/${session.user.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`;
          photoUrls.push(await uploadImageUriToR2(uri, key));
        }
      }

      const attributes = state.condition ? { ...state.attrs, condition: state.condition } : state.attrs;

      const { error: updErr } = await supabase
        .from("listings")
        .update({
          title: state.title.trim(),
          description: state.description.trim(),
          price: Number(state.price) || 0,
          currency: state.currency,
          category: state.category,
          province: state.province,
          city: state.city,
          suburb: state.suburb.trim() || null,
          photos: photoUrls,
          condition: state.condition,
          attributes,
        })
        .eq("id", id)
        .eq("seller_id", session.user.id);

      if (updErr) throw updErr;
      toast("Listing updated");
      router.back();
    } catch (e) {
      setError(friendlyError(e).message);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (loadError) {
    return <ErrorState title="Can't edit this listing" subtitle={loadError} onRetry={load} />;
  }

  if (!state) {
    return (
      <View style={styles.loading}>
        <Skeleton height={44} />
        <Skeleton height={120} style={{ marginTop: space.md }} />
        <Skeleton height={44} style={{ marginTop: space.md }} />
      </View>
    );
  }

  const showCondition = categoryHasCondition(state.category);
  const categoryName = CATEGORIES.find((c) => c.id === state.category)?.name ?? "Other";

  return (
    <KeyboardAvoidingView key={kavResetKey} style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <Card style={styles.card}>
          <View style={styles.categoryBar}>
            <Text style={styles.categoryBarText}>{categoryName}</Text>
          </View>

          <Text style={styles.fieldLabel}>Title</Text>
          <TextInput
            style={styles.input}
            value={state.title}
            onChangeText={(t) => update({ title: t })}
            placeholderTextColor={color.textMuted}
            maxLength={80}
          />

          <Text style={styles.fieldLabel}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={state.description}
            onChangeText={(t) => update({ description: t })}
            placeholderTextColor={color.textMuted}
            multiline
            maxLength={2000}
          />

          {showCondition ? (
            <>
              <Text style={styles.fieldLabel}>Condition</Text>
              <View style={styles.chipWrap}>
                {CONDITION_OPTIONS.map((c) => (
                  <Chip
                    key={c.value}
                    label={c.label}
                    active={state.condition === c.value}
                    onPress={() => update({ condition: c.value })}
                  />
                ))}
              </View>
            </>
          ) : null}

          {state.category ? (
            <AttrFields category={state.category} values={state.attrs} onChange={(attrs) => update({ attrs })} />
          ) : null}
        </Card>

        <Card style={styles.card}>
          <Text style={styles.fieldLabel}>Price</Text>
          <View style={styles.priceRow}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              value={state.price}
              onChangeText={(t) => update({ price: t })}
              placeholder="0"
              placeholderTextColor={color.textMuted}
              keyboardType="numeric"
            />
            <View style={styles.currencyToggle}>
              {(["USD", "ZiG"] as const).map((cur) => (
                <Chip key={cur} label={cur} active={state.currency === cur} onPress={() => update({ currency: cur })} />
              ))}
            </View>
          </View>

          <ProvinceCityFields
            provinces={PROVINCES}
            citiesByProvince={CITIES_BY_PROVINCE}
            province={state.province}
            city={state.city}
            onChange={({ province, city }) => update({ province, city })}
          />

          <Text style={[styles.fieldLabel, { marginTop: space.md }]}>Suburb / Area (optional)</Text>
          <TextInput
            style={styles.input}
            value={state.suburb}
            onChangeText={(t) => update({ suburb: t })}
            placeholder="e.g. Avondale West"
            placeholderTextColor={color.textMuted}
          />
        </Card>

        <Card style={styles.card}>
          <Text style={styles.fieldLabel}>Photos (first is the cover)</Text>
          <PhotoGrid
            photos={state.photos}
            onPickGallery={() => pickPhotos("gallery")}
            onPickCamera={() => pickPhotos("camera")}
            onRemove={removePhoto}
            onSetCover={setCoverPhoto}
            onMove={movePhoto}
            isProcessing={isProcessingPhotos}
          />
        </Card>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.actions}>
          <View style={{ flex: 1 }}>
            <Button label="Cancel" variant="secondary" onPress={() => router.back()} />
          </View>
          <View style={{ flex: 2 }}>
            <Button label="Save Changes" onPress={save} loading={isSubmitting} />
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function buildStyles(color: ColorPalette) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: color.bg },
  loading: { flex: 1, padding: space.lg, backgroundColor: color.bg },
  scrollContent: { padding: space.lg, paddingBottom: space.huge, gap: space.lg },
  card: { padding: space.lg },
  categoryBar: {
    backgroundColor: color.brandTint,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    marginBottom: space.sm,
  },
  categoryBarText: { ...font.bodyStrong, color: color.text },
  fieldLabel: { ...font.caption, color: color.text, marginBottom: space.sm, marginTop: space.lg },
  input: {
    borderWidth: 1,
    borderColor: color.borderStrong,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    ...font.body,
    color: color.text,
  },
  textArea: { minHeight: 100, textAlignVertical: "top" },
  priceRow: { flexDirection: "row", gap: space.md, alignItems: "center" },
  currencyToggle: { flexDirection: "row", gap: space.sm },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  error: { ...font.sub, color: color.danger, textAlign: "center" },
  actions: { flexDirection: "row", gap: space.md },
  });
}
