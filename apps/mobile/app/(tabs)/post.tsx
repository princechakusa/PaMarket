import { useState } from "react";
import {
  ActivityIndicator,
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
import Svg, { Polyline } from "react-native-svg";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../lib/auth";
import { supabase } from "../../lib/supabase";
import { uploadImageUriToR2 } from "../../lib/uploadToR2";
import { friendlyError } from "../../lib/safety";
import { CATEGORIES, PROVINCES, CITIES_BY_PROVINCE } from "../../lib/constants";
import { formatPrice } from "../../lib/listings";
import { CONDITION_OPTIONS, categoryHasCondition, type ListingCondition } from "../../lib/listing-form";
import { CategoryPicker } from "../../components/post/CategoryPicker";
import { AttrFields, type AttrValues } from "../../components/post/AttrFields";
import { PhotoGrid } from "../../components/post/PhotoGrid";
import { Button, Card, Chip } from "../../components/ui";
import { DARK_COLORS, LIGHT_COLORS, font, radius, space, type ColorPalette } from "../../lib/theme";
import { useThemedStyles, useThemePreference } from "../../lib/theme-provider";

const TITLE_PLACEHOLDERS: Record<string, string> = {
  property: "e.g. 3 Bedroom House in Borrowdale",
  vehicles: "e.g. 2015 Toyota Hilux D4D",
  rooms: "e.g. Single room to rent in Avondale",
  electronics: "e.g. iPhone 13 Pro 128GB",
  furniture: "e.g. 3-Seater Leather Sofa",
  fashion: "e.g. Men's Nike Air Max UK 9",
  services: "e.g. Professional Plumbing Services",
  agriculture: "e.g. 50 Bales of Quality Hay",
  pets: "e.g. Boerboel Puppies for Sale",
  kids: "e.g. Baby Stroller / Pram",
  other: "e.g. What are you selling?",
};

type PostState = {
  step: 1 | 2 | 3 | 4;
  category: string | null;
  title: string;
  description: string;
  price: string;
  currency: "USD" | "ZiG";
  province: string;
  city: string;
  suburb: string;
  photos: string[];
  condition: ListingCondition | null;
  attrs: AttrValues;
};

const INITIAL_STATE: PostState = {
  step: 1,
  category: null,
  title: "",
  description: "",
  price: "",
  currency: "USD",
  province: PROVINCES[0],
  city: CITIES_BY_PROVINCE[PROVINCES[0]][0],
  suburb: "",
  photos: [],
  condition: null,
  attrs: {},
};

export default function PostScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const styles = useThemedStyles(buildStyles);
  const { resolvedScheme } = useThemePreference();
  const color = resolvedScheme === "dark" ? DARK_COLORS : LIGHT_COLORS;
  const params = useLocalSearchParams<{ businessId?: string }>();
  const [state, setState] = useState<PostState>(INITIAL_STATE);
  const [error, setError] = useState<string | null>(null);
  const [isProcessingPhotos, setIsProcessingPhotos] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!session?.user) {
    return (
      <View style={styles.centered}>
        <Text style={styles.signInTitle}>Sign In Required</Text>
        <Text style={styles.signInSub}>Sign in to post listings and reach buyers across Zimbabwe.</Text>
        <View style={{ width: 200 }}>
          <Button label="Sign In" onPress={() => router.push("/(auth)/sign-in")} />
        </View>
      </View>
    );
  }

  function update(patch: Partial<PostState>) {
    setState((s) => ({ ...s, ...patch }));
    setError(null);
  }

  async function pickPhotos(source: "gallery" | "camera") {
    if (isProcessingPhotos || state.photos.length >= 8) return;

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
    update({ photos: state.photos.filter((_, i) => i !== index) });
  }

  function setCoverPhoto(index: number) {
    if (index <= 0) return;
    const next = [...state.photos];
    const [cover] = next.splice(index, 1);
    next.unshift(cover);
    update({ photos: next });
  }

  function movePhoto(index: number, direction: "left" | "right") {
    const target = direction === "left" ? index - 1 : index + 1;
    if (target < 0 || target >= state.photos.length) return;
    const next = [...state.photos];
    [next[index], next[target]] = [next[target], next[index]];
    update({ photos: next });
  }

  const showCondition = categoryHasCondition(state.category);

  function goNext() {
    if (state.step === 1) {
      if (!state.category) return setError("Pick a category");
      if (state.title.trim().length < 5) return setError("Title needs at least 5 characters");
      if (state.description.trim().length < 10) return setError("Description needs at least 10 characters");
      if (showCondition && !state.condition) return setError("Select the item condition");
    } else if (state.step === 2) {
      if (!state.price || Number(state.price) <= 0) return setError("Enter a valid price");
    } else if (state.step === 3) {
      if (!state.photos.length) return setError("Add at least one photo");
    }
    setState((s) => ({ ...s, step: (s.step + 1) as PostState["step"] }));
  }

  function goBack() {
    if (state.step > 1) setState((s) => ({ ...s, step: (s.step - 1) as PostState["step"] }));
  }

  async function submit() {
    if (isSubmitting || !session?.user) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const photoUrls: string[] = [];
      for (const uri of state.photos) {
        const key = `listings/${session.user.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`;
        const url = await uploadImageUriToR2(uri, key);
        photoUrls.push(url);
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("name,phone")
        .eq("id", session.user.id)
        .maybeSingle();

      // condition is written to both the real column and attributes.condition
      const attributes = state.condition
        ? { ...state.attrs, condition: state.condition }
        : state.attrs;

      const { error: insertError } = await supabase.from("listings").insert({
        seller_id: session.user.id,
        seller_name: profile?.name ?? "",
        seller_phone: profile?.phone ?? "",
        title: state.title.trim(),
        description: state.description.trim(),
        price: Number(state.price) || 0,
        currency: state.currency,
        category: state.category,
        province: state.province,
        city: state.city,
        suburb: state.suburb.trim() || null,
        photos: photoUrls,
        status: "active",
        condition: state.condition,
        attributes,
        business_id: params.businessId || null,
      });

      if (insertError) throw insertError;

      setState(INITIAL_STATE);
      if (params.businessId) router.replace({ pathname: "/business-listings/[id]", params: { id: params.businessId } });
      else router.replace("/(tabs)");
    } catch (e) {
      setError(friendlyError(e).message);
    } finally {
      setIsSubmitting(false);
    }
  }

  const categoryName = CATEGORIES.find((c) => c.id === state.category)?.name ?? "Other";

  function handleHeaderBack() {
    if (state.step > 1) {
      goBack();
    } else if (state.category) {
      update({ category: null });
    } else {
      router.back();
    }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[styles.topbar, { paddingTop: insets.top + 12 }]}>
        <Pressable style={styles.topbarBack} onPress={handleHeaderBack} hitSlop={10}>
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={color.textOnBrand} strokeWidth={2.5}>
            <Polyline points="15 18 9 12 15 6" />
          </Svg>
        </Pressable>
        <Text style={styles.topbarTitle} numberOfLines={1}>
          Post a Free Ad
        </Text>
        <View style={styles.topbarSpacer} />
      </View>

      <View style={styles.stepsBar}>
        {[1, 2, 3, 4].map((n) => (
          <View
            key={n}
            style={[styles.stepDot, n < state.step && styles.stepDotDone, n === state.step && styles.stepDotCurrent]}
          />
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {state.step === 1 && !state.category ? (
          <CategoryPicker onSelect={(id) => update({ category: id })} />
        ) : state.step === 1 ? (
          <Card style={styles.card}>
            <View style={styles.categoryBar}>
              <Text style={styles.categoryBarText}>{categoryName}</Text>
              <Pressable onPress={() => update({ category: null })} hitSlop={8}>
                <Text style={styles.changeLink}>Change</Text>
              </Pressable>
            </View>

            <Text style={styles.fieldLabel}>Title</Text>
            <TextInput
              style={styles.input}
              value={state.title}
              onChangeText={(text) => update({ title: text })}
              placeholder={TITLE_PLACEHOLDERS[state.category ?? "other"]}
              placeholderTextColor={color.textMuted}
              maxLength={80}
            />

            <Text style={styles.fieldLabel}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={state.description}
              onChangeText={(text) => update({ description: text })}
              placeholder="Describe what you're selling — condition, features, why you're selling..."
              placeholderTextColor={color.textMuted}
              multiline
              numberOfLines={4}
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
        ) : null}

        {state.step === 2 ? (
          <Card style={styles.card}>
            <Text style={styles.fieldLabel}>Price</Text>
            <View style={styles.priceRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={state.price}
                onChangeText={(text) => update({ price: text })}
                placeholder="0"
                placeholderTextColor={color.textMuted}
                keyboardType="numeric"
              />
              <View style={styles.currencyToggle}>
                {(["USD", "ZiG"] as const).map((cur) => (
                  <Pressable
                    key={cur}
                    style={[styles.currencyOption, state.currency === cur && styles.currencyOptionActive]}
                    onPress={() => update({ currency: cur })}
                  >
                    <Text
                      style={[styles.currencyOptionText, state.currency === cur && styles.currencyOptionTextActive]}
                    >
                      {cur}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <Text style={styles.fieldLabel}>Province</Text>
            <View style={styles.chipWrap}>
              {PROVINCES.map((p) => (
                <Chip
                  key={p}
                  label={p}
                  active={state.province === p}
                  onPress={() => update({ province: p, city: CITIES_BY_PROVINCE[p][0] })}
                />
              ))}
            </View>

            <Text style={styles.fieldLabel}>City / Town</Text>
            <View style={styles.chipWrap}>
              {(CITIES_BY_PROVINCE[state.province] ?? []).slice(0, 20).map((c) => (
                <Chip key={c} label={c} active={state.city === c} onPress={() => update({ city: c })} />
              ))}
            </View>

            <Text style={styles.fieldLabel}>Suburb / Area (optional)</Text>
            <TextInput
              style={styles.input}
              value={state.suburb}
              onChangeText={(text) => update({ suburb: text })}
              placeholder="e.g. Avondale West"
              placeholderTextColor={color.textMuted}
            />
          </Card>
        ) : null}

        {state.step === 3 ? (
          <Card style={styles.card}>
            <Text style={styles.fieldLabel}>Photos (up to 8 · first is the cover)</Text>
            <PhotoGrid
              photos={state.photos}
              onPickGallery={() => pickPhotos("gallery")}
              onPickCamera={() => pickPhotos("camera")}
              onRemove={removePhoto}
              onSetCover={setCoverPhoto}
              onMove={movePhoto}
              isProcessing={isProcessingPhotos}
            />
            <View style={styles.tipBox}>
              <Text style={styles.tipTitle}>Photos sell 3× faster</Text>
              <Text style={styles.tipBody}>Listings with 5+ clear photos in good lighting get 3× more enquiries.</Text>
            </View>
          </Card>
        ) : null}

        {state.step === 4 ? (
          <View>
            <Card style={styles.previewCard}>
              <Text style={styles.previewLabel}>Ad Preview</Text>
              <Text style={styles.previewTitle}>{state.title || "Untitled"}</Text>
              <Text style={styles.previewPrice}>
                {formatPrice({ price: Number(state.price) || 0, currency: state.currency })}
              </Text>
              <Text style={styles.previewMeta}>
                {state.suburb || state.city}, {state.province} · {categoryName}
                {state.condition ? ` · ${CONDITION_OPTIONS.find((c) => c.value === state.condition)?.label}` : ""} ·{" "}
                {state.photos.length} photo{state.photos.length === 1 ? "" : "s"}
              </Text>
            </Card>
            <View style={styles.tipBox}>
              <Text style={styles.tipTitle}>Listing Rules</Text>
              <Text style={styles.tipBody}>
                By posting you confirm this item is legal, you own it, and the photos are real. Scam listings result
                in account suspension.
              </Text>
            </View>
          </View>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {state.step === 1 && !state.category ? null : (
          <View style={styles.stepButtons}>
            {state.step > 1 ? (
              <View style={{ flex: 1 }}>
                <Button label="← Back" variant="secondary" onPress={goBack} />
              </View>
            ) : null}
            <View style={{ flex: 2 }}>
              {state.step < 4 ? (
                <Button label={state.step === 3 ? "Preview →" : "Continue →"} onPress={goNext} />
              ) : (
                <Button label="Post Ad →" variant="gold" onPress={submit} loading={isSubmitting} />
              )}
            </View>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function buildStyles(color: ColorPalette) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: color.bg },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: space.xxxl },
  signInTitle: { ...font.h3, color: color.text, marginBottom: space.sm },
  signInSub: { ...font.body, color: color.textMuted, textAlign: "center", marginBottom: space.xl },
  topbar: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    backgroundColor: color.brand,
    paddingHorizontal: space.md,
    paddingBottom: space.md,
  },
  topbarBack: { width: 34, height: 34, alignItems: "center", justifyContent: "center" },
  topbarTitle: { flex: 1, ...font.title, color: color.textOnBrand, textAlign: "center" },
  topbarSpacer: { width: 34 },
  stepsBar: {
    flexDirection: "row",
    gap: space.xs,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    paddingBottom: space.sm,
  },
  stepDot: { flex: 1, height: 3, borderRadius: 2, backgroundColor: color.border },
  stepDotDone: { backgroundColor: color.brand },
  stepDotCurrent: { backgroundColor: color.gold },
  scrollContent: { padding: space.lg, paddingBottom: space.huge },
  card: { padding: space.lg },
  categoryBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: color.brandTint,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    marginBottom: space.sm,
  },
  categoryBarText: { ...font.bodyStrong, color: color.text },
  changeLink: { ...font.caption, color: color.brand },
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
  priceRow: { flexDirection: "row", gap: space.md },
  currencyToggle: {
    flexDirection: "row",
    borderRadius: radius.md,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: color.borderStrong,
  },
  currencyOption: { paddingHorizontal: space.lg, justifyContent: "center", backgroundColor: color.surface },
  currencyOptionActive: { backgroundColor: color.brand },
  currencyOptionText: { ...font.caption, color: color.text },
  currencyOptionTextActive: { color: color.textOnBrand },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  tipBox: { backgroundColor: color.goldTint, borderRadius: radius.md, padding: space.lg, marginTop: space.lg },
  tipTitle: { ...font.caption, color: color.text, marginBottom: space.xs },
  tipBody: { ...font.sub, color: color.textSub },
  previewCard: { padding: space.lg },
  previewLabel: { ...font.micro, color: color.textMuted, textTransform: "uppercase", marginBottom: space.sm },
  previewTitle: { ...font.title, color: color.text },
  previewPrice: { ...font.h2, color: color.brand, marginTop: space.xs },
  previewMeta: { ...font.sub, color: color.textMuted, marginTop: space.sm },
  error: { ...font.sub, color: color.danger, marginTop: space.lg, textAlign: "center" },
  stepButtons: { flexDirection: "row", gap: space.md, marginTop: space.xxl },
  });
}
