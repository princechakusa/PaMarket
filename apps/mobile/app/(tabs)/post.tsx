import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  BackHandler,
  InteractionManager,
  Keyboard,
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
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../lib/auth";
import { supabase } from "../../lib/supabase";
import { uploadImageUriToR2 } from "../../lib/uploadToR2";
import { friendlyError } from "../../lib/safety";
import { notifyPositiveAction } from "../../lib/store-review";
import { useTaxonomy } from "../../lib/taxonomy";
import { reverseGeocode, roundApproxCoord } from "../../lib/useCurrentLocation";
import { formatPrice } from "../../lib/listings";
import {
  INSTITUTION_VISIBILITY_ATTR_KEY,
  INSTITUTION_VISIBILITY_LABEL,
  type InstitutionVisibility,
} from "../../lib/institutions";
import { CONDITION_OPTIONS, categoryHasCondition, type ListingCondition } from "../../lib/listing-form";
import { CategoryPicker } from "../../components/post/CategoryPicker";
import { AttrFields, type AttrValues } from "../../components/post/AttrFields";
import { PhotoGrid } from "../../components/post/PhotoGrid";
import { MapLocationPicker } from "../../components/post/MapLocationPicker";
import { LocationMap } from "../../components/listing/LocationMap";
import { Button, Card, Chip, GlassBackButton, ProvinceCityFields, UseCurrentLocationButton } from "../../components/ui";
import { DARK_COLORS, LIGHT_COLORS, font, radius, space, type ColorPalette } from "../../lib/theme";
import { useThemedStyles, useThemePreference } from "../../lib/theme-provider";
import { useIOSNativeHeader } from "../../lib/useIOSNativeHeader";

type InstitutionContext = { id: string; official_name: string };

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
  latitude: number | null;
  longitude: number | null;
  photos: string[];
  condition: ListingCondition | null;
  attrs: AttrValues;
  institutionVisibility: InstitutionVisibility;
};

const INITIAL_STATE: PostState = {
  step: 1,
  category: null,
  title: "",
  description: "",
  price: "",
  currency: "USD",
  province: "",
  city: "",
  suburb: "",
  latitude: null,
  longitude: null,
  photos: [],
  condition: null,
  attrs: {},
  institutionVisibility: "public",
};

export default function PostScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const styles = useThemedStyles(buildStyles);
  const { resolvedScheme } = useThemePreference();
  const color = resolvedScheme === "dark" ? DARK_COLORS : LIGHT_COLORS;
  const params = useLocalSearchParams<{
    businessId?: string;
    institutionId?: string;
    // Institution Post Setup screen (app/institutions/post-setup.tsx)
    // forwards its already-made category + visibility choices here so this
    // step 1 doesn't re-prompt for either. Absent for every other entry
    // point (normal posting, or the older bare institutionId deep link),
    // which keeps behaving exactly as before.
    category?: string;
    institutionVisibility?: string;
  }>();
  const preselectedFromSetup = !!params.category;
  const [state, setState] = useState<PostState>(INITIAL_STATE);
  const [institutionContext, setInstitutionContext] = useState<InstitutionContext | null>(null);
  // headerLeft stays custom (not the OS default) — this "back" button steps
  // back one wizard stage at a time (see handleHeaderBack below), which the
  // real native back action (pop the navigation stack) can't express. Uses
  // the same GlassBackButton (flat variant) every other screen's header
  // uses, instead of a one-off chevron, so it looks and presses like every
  // other back button in the app. Only shown once there's actually
  // somewhere for it to go — at the true first step (no category picked
  // yet), this is a tab root with nothing to go "back" to, so router.back()
  // there was a silent no-op; showing no button here matches how every
  // other tab root already behaves.
  useIOSNativeHeader({
    backgroundColor: color.brand,
    tintColor: color.textOnBrand,
    title: "Post a Free Ad",
    headerLeft:
      state.step > 1 || state.category ? () => <GlassBackButton onPress={handleHeaderBack} tone="light" flat /> : undefined,
    headerLeftKey: state.step,
  });
  const [error, setError] = useState<string | null>(null);
  const [isProcessingPhotos, setIsProcessingPhotos] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<string | null>(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [keyboardAvoidingKey, setKeyboardAvoidingKey] = useState(0);
  // A listing with no seller_phone remains chat-only. This value drives only
  // a non-blocking reminder, and is refreshed whenever the persistent Post
  // tab regains focus so an Edit Profile save appears without an app restart.
  const [hasPhone, setHasPhone] = useState<boolean | null>(null);
  const [mapPickerOpen, setMapPickerOpen] = useState(false);
  // Stage 5: bundled CATEGORIES/PROVINCES/CITIES_BY_PROVINCE shown
  // immediately, silently upgraded in the background — never blocks
  // posting. The already-selected category/province/city (if any, e.g.
  // returning to an earlier wizard step) always stays valid even if it's
  // since been deactivated.
  const { categories, provinces, citiesByProvince } = useTaxonomy({
    categoryId: state.category,
    province: state.province,
    city: state.city,
  });

  // Step 3: never trust the route param as proof the institution exists or
  // is active -- the same public.institutions row (Phase 1 RLS: public read
  // only where is_active=true) is re-fetched here. If it's missing, inactive,
  // or the fetch fails, this silently behaves exactly like "no institution
  // context" -- no error banner naming the institution, since surfacing
  // "this institution is inactive" would itself leak information about an
  // institution a non-admin isn't supposed to see, matching how
  // app/institutions/[id].tsx treats nonexistent/inactive identically.
  useEffect(() => {
    if (!params.institutionId) {
      setInstitutionContext(null);
      return;
    }
    let cancelled = false;
    supabase
      .from("institutions")
      .select("id, official_name")
      .eq("id", params.institutionId)
      .eq("is_active", true)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setInstitutionContext((data as InstitutionContext) ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [params.institutionId]);

  // Institution Post Setup's category + visibility choices, applied
  // reactively (not via a useState initializer) -- this tab screen stays
  // mounted across navigations (see the reset comment in handleSubmit
  // below), so a useState initializer only ever ran once per app session
  // and silently kept stale/default values on every subsequent visit from
  // Post Setup. This mirrors the institutionId effect above: it re-runs
  // every time the incoming route params actually change, so it applies
  // correctly whether this is the Post tab's first mount this session or
  // its hundredth.
  useEffect(() => {
    if (!params.category) return;
    setState((s) => ({
      ...s,
      // Always land on step 1 -- this tab stays mounted across navigations,
      // so if the user had previously gotten to step 2/3/4 on an earlier,
      // unfinished post (institution or not) and then came back in through
      // Institution Post Setup, state.category/institutionVisibility would
      // update correctly but the screen would silently stay on whatever
      // step it was already sitting on -- looking exactly like "Continue
      // did nothing", when the state was actually applied correctly.
      step: 1,
      category: params.category as string,
      institutionVisibility: params.institutionVisibility === "institution_only" ? "institution_only" : "public",
    }));
  }, [params.category, params.institutionVisibility]);

  useFocusEffect(
    useCallback(() => {
      if (!session?.user) {
        setHasPhone(null);
        return;
      }
      let cancelled = false;
      supabase
        .from("profiles")
        .select("phone")
        .eq("id", session.user.id)
        .maybeSingle()
        .then(({ data }) => {
          if (!cancelled) setHasPhone(!!data?.phone?.trim());
        });
      return () => {
        cancelled = true;
      };
    }, [session?.user?.id])
  );

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const showSub = Keyboard.addListener(showEvent, () => setKeyboardVisible(true));
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false));
    // Locking the phone with the keyboard open desyncs KeyboardAvoidingView's
    // internal keyboard-height tracking from the real keyboard on unlock —
    // it was previously seen collapsing this screen's content to a sliver
    // with the footer floating at the top (same root cause chat/[id].tsx's
    // keyboardAvoidingKey already works around). Dismissing on background and
    // forcing a fresh mount via `key` on foreground resets that state cleanly.
    const appStateSub = AppState.addEventListener("change", (state) => {
      if (state !== "active") {
        setKeyboardVisible(false);
        Keyboard.dismiss();
      } else {
        setKeyboardAvoidingKey((key) => key + 1);
      }
    });
    return () => {
      showSub.remove();
      hideSub.remove();
      appStateSub.remove();
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== "android") return;
      const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
        if (state.step > 1) {
          setState((s) => ({ ...s, step: (s.step - 1) as PostState["step"] }));
          return true;
        }
        if (state.category) {
          setState((s) => ({ ...s, category: null }));
          setError(null);
          return true;
        }
        return false;
      });
      return () => subscription.remove();
    }, [state.step, state.category])
  );

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
      if (!provinces.includes(state.province)) return setError("Select a valid Province");
      if (!(citiesByProvince[state.province] ?? []).includes(state.city)) {
        return setError("Select a valid City / Town for that Province");
      }
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
    setSubmitStatus("Preparing your listing...");
    setError(null);

    try {
      const photoUrls: string[] = [];
      for (let index = 0; index < state.photos.length; index += 1) {
        const uri = state.photos[index];
        setSubmitStatus(`Uploading photo ${index + 1} of ${state.photos.length}...`);
        const key = `listings/${session.user.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`;
        const url = await uploadImageUriToR2(uri, key);
        photoUrls.push(url);
      }

      setSubmitStatus("Creating your ad...");
      const { data: profile } = await supabase
        .from("profiles")
        .select("name,phone")
        .eq("id", session.user.id)
        .maybeSingle();

      // condition is written to both the real column and attributes.condition.
      // institution_visibility only ever gets written when there's a real,
      // validated institution context -- a normal listing's attributes never
      // gains this key at all (not even set to "public"), so nothing about a
      // non-institution post changes.
      const attributes = {
        ...(state.condition ? { ...state.attrs, condition: state.condition } : state.attrs),
        ...(institutionContext ? { [INSTITUTION_VISIBILITY_ATTR_KEY]: state.institutionVisibility } : {}),
      };

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
        latitude: state.latitude,
        longitude: state.longitude,
        photos: photoUrls,
        status: "active",
        condition: state.condition,
        attributes,
        business_id: params.businessId || null,
        // Step 7: exactly one listing row either way -- institution_id is
        // simply null for a normal post. The FK itself (Phase 1) is what
        // actually rejects a bogus id; institutionContext being non-null here
        // already proves it was independently re-verified active (see the
        // effect above), never trusted from the raw route param.
        institution_id: institutionContext?.id ?? null,
      });

      if (insertError) throw insertError;

      setSubmitStatus("Ad posted successfully.");
      notifyPositiveAction();
      // Reset the form now (this tab screen stays mounted in the background
      // when you navigate away via the bottom tabs, so a stale filled-in
      // form would otherwise greet you next time you open Post).
      setState(INITIAL_STATE);
      // Return to whichever context this post actually came from, matching
      // the existing businessId precedent below -- a business post already
      // returns to that business's own management screen, not Home. An
      // institution post follows the same rule: back to the institution's
      // detail page (app/institutions/[id].tsx), which works identically for
      // both University and High School since it's the one shared screen for
      // both types and institutionContext.id is already independently
      // re-verified (never the raw, untrusted route param). Anything else
      // (a normal, non-institution, non-business post) keeps the original
      // Home behavior unchanged.
      if (params.businessId) router.replace({ pathname: "/business-listings/[id]", params: { id: params.businessId } });
      else if (institutionContext) router.replace({ pathname: "/institutions/[id]", params: { id: institutionContext.id } });
      else router.replace("/(tabs)");
      // isSubmitting is reset AFTER the navigation transition finishes
      // (InteractionManager), not in this same tick — a state update
      // landing in the same tick as router.replace's own screen transition
      // is exactly the race that produced a real production crash elsewhere
      // in the app (Sentry REACT-NATIVE-7, a native Fabric
      // IllegalStateException — "child already has a parent" — see
      // business-onboarding.tsx's activate() for the full story). Since
      // this tab stays mounted, it still needs resetting eventually (unlike
      // that stack screen, which just unmounts) — just not immediately.
      InteractionManager.runAfterInteractions(() => setIsSubmitting(false));
      return;
    } catch (e) {
      setError(friendlyError(e).message);
      setSubmitStatus(null);
    }
    setIsSubmitting(false);
  }

  const categoryName = categories.find((c) => c.id === state.category)?.name ?? "Other";

  function handleHeaderBack() {
    if (state.step > 1) {
      goBack();
    } else if (state.category) {
      update({ category: null });
    } else if (router.canGoBack()) {
      // Post is a tab root, not a pushed screen — when it was reached by
      // tapping the tab bar (the common case) there's nothing on the stack
      // to pop, and router.back() was a silent no-op here. Only pop if
      // there's actually somewhere to go; otherwise fall through to the
      // Home tab so the button always does something.
      router.back();
    } else {
      router.replace("/(tabs)");
    }
  }

  return (
    <KeyboardAvoidingView
      key={keyboardAvoidingKey}
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {Platform.OS !== "ios" ? (
        <View style={[styles.topbar, { paddingTop: insets.top + 12 }]}>
          <GlassBackButton onPress={handleHeaderBack} tone="light" flat />
          <Text style={styles.topbarTitle} numberOfLines={1}>
            Post a Free Ad
          </Text>
          <View style={styles.topbarSpacer} />
        </View>
      ) : null}

      <View style={styles.stepsBar}>
        {[1, 2, 3, 4].map((n) => (
          <View
            key={n}
            style={[styles.stepDot, n < state.step && styles.stepDotDone, n === state.step && styles.stepDotCurrent]}
          />
        ))}
      </View>

      {institutionContext ? (
        <Card style={styles.institutionBanner}>
          <Text style={styles.institutionBannerLabel}>Posting to</Text>
          <Text style={styles.institutionBannerName}>{institutionContext.official_name}</Text>
          {preselectedFromSetup ? (
            // Institution Post Setup already asked for visibility -- show
            // the chosen value read-only instead of a second picker.
            <Text style={[styles.fieldLabel, { marginTop: space.sm }]}>
              {INSTITUTION_VISIBILITY_LABEL[state.institutionVisibility]}
            </Text>
          ) : (
            <>
              <Text style={[styles.fieldLabel, { marginTop: space.sm }]}>Choose visibility</Text>
              <View style={styles.currencyToggle}>
                {(
                  [
                    { value: "public" as const, label: INSTITUTION_VISIBILITY_LABEL.public },
                    { value: "institution_only" as const, label: INSTITUTION_VISIBILITY_LABEL.institution_only },
                  ]
                ).map((opt) => (
                  <Pressable
                    key={opt.value}
                    style={[styles.visibilityOption, state.institutionVisibility === opt.value && styles.currencyOptionActive]}
                    onPress={() => update({ institutionVisibility: opt.value })}
                  >
                    <Text
                      style={[styles.currencyOptionText, state.institutionVisibility === opt.value && styles.currencyOptionTextActive]}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </>
          )}
        </Card>
      ) : null}

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {state.step === 1 && !state.category ? (
          <CategoryPicker
            categories={categories}
            onSelect={(id) => {
              // Jobs is its own dedicated employer flow (job credits/boosts,
              // recruiter entitlements, company verification) — it was never
              // meant to go through the generic marketplace listing form.
              if (id === "jobs") {
                // Forwarded for forward-compatibility only -- the existing
                // Jobs posting flow (app/jobs/post.tsx) submits through its
                // own create_job_listing RPC (credits/subscription
                // entitlement logic), which this phase does not modify. See
                // the Phase 4 report's Jobs section: institution association
                // for job listings is an explicitly unresolved gap, not
                // silently implemented here.
                router.push(institutionContext ? { pathname: "/jobs/post", params: { institutionId: institutionContext.id } } : "/jobs/post");
                return;
              }
              update({ category: id });
            }}
          />
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

            {hasPhone === false ? (
              <View style={styles.phoneReminder}>
                <Text style={styles.tipBody}>
                  Add a phone number to your profile if you&apos;d like buyers to contact you by phone. You can continue
                  and use in-app chat without one.
                </Text>
              </View>
            ) : null}
          </Card>
        ) : null}

        {state.step === 2 ? (
          <Card style={styles.card}>
            {institutionContext ? (
              <View style={styles.postingContextCard}>
                <View style={styles.postingContextTopRow}>
                  <Text style={styles.postingContextEyebrow}>Posting Context</Text>
                  <View style={styles.campusPill}>
                    <Text style={styles.campusPillText}>Campus Listing</Text>
                  </View>
                </View>
                <Text style={styles.postingContextName} numberOfLines={1}>
                  {institutionContext.official_name}
                </Text>
                <Text style={styles.postingContextMeta}>{categoryName} Category</Text>
                <View style={styles.postingContextBanner}>
                  <Text style={styles.postingContextBannerTitle}>
                    {INSTITUTION_VISIBILITY_LABEL[state.institutionVisibility]}
                    {state.institutionVisibility === "public" ? " Active" : ""}
                  </Text>
                  <Text style={styles.postingContextBannerBody}>
                    {state.institutionVisibility === "institution_only"
                      ? `Only visible inside the ${institutionContext.official_name} hub.`
                      : `Visible simultaneously across the national marketplace and the ${institutionContext.official_name} campus feed.`}
                  </Text>
                </View>
              </View>
            ) : null}

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

            <ProvinceCityFields
              provinces={provinces}
              citiesByProvince={citiesByProvince}
              province={state.province}
              city={state.city}
              onChange={({ province, city }) => update({ province, city })}
            />

            <Text style={[styles.fieldLabel, { marginTop: space.md }]}>Suburb / Area (optional)</Text>
            <TextInput
              style={styles.input}
              value={state.suburb}
              onChangeText={(text) => update({ suburb: text })}
              placeholder="e.g. Avondale West"
              placeholderTextColor={color.textMuted}
            />

            <Text style={[styles.fieldLabel, { marginTop: space.lg }]}>Choose your location</Text>
            <Text style={styles.locationHelp}>Specify where you can safely hand over the item</Text>
            <View style={{ marginTop: space.sm }}>
              <UseCurrentLocationButton
                provinces={provinces}
                citiesByProvince={citiesByProvince}
                onResolved={(loc) =>
                  update({
                    // Rounded to ~100m before it ever lands in state/DB — see
                    // roundApproxCoord for why (personal listings only get an
                    // approximate point, unlike businesses).
                    latitude: roundApproxCoord(loc.latitude),
                    longitude: roundApproxCoord(loc.longitude),
                    province: loc.province ?? state.province,
                    city: loc.city ?? state.city,
                    suburb: loc.suburb ?? state.suburb,
                  })
                }
              />
              <Pressable style={styles.dropPinButton} onPress={() => setMapPickerOpen(true)}>
                <Text style={styles.dropPinButtonText}>
                  {state.latitude != null ? "Change pin on map" : "Drop a pin on map"}
                </Text>
              </Pressable>
            </View>

            {state.latitude != null && state.longitude != null ? (
              <View style={{ marginTop: space.md, gap: space.xs }}>
                <LocationMap
                  latitude={state.latitude}
                  longitude={state.longitude}
                  listingId="draft"
                  locationLabel={[state.suburb, state.city].filter(Boolean).join(", ") || state.province || null}
                />
                <Text style={styles.locationTip}>
                  This approximate area is what buyers see for your privacy. Agree on an exact handover spot in chat.
                </Text>
              </View>
            ) : null}

            <MapLocationPicker
              visible={mapPickerOpen}
              initialLatitude={state.latitude}
              initialLongitude={state.longitude}
              onCancel={() => setMapPickerOpen(false)}
              onConfirm={async (lat, lng) => {
                setMapPickerOpen(false);
                const geo = await reverseGeocode(lat, lng, provinces, citiesByProvince);
                update({
                  latitude: roundApproxCoord(lat),
                  longitude: roundApproxCoord(lng),
                  province: geo.province ?? state.province,
                  city: geo.city ?? state.city,
                  suburb: geo.suburb ?? state.suburb,
                });
              }}
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
      </ScrollView>

      {/* Fixed footer, not part of ScrollView content — Continue/Post remains
          reachable without scrolling. Wizard Back lives in the single top
          header control (and Android's system hardware Back path). */}
      {state.step === 1 && !state.category ? null : (
        // Generous fixed buffer (not just an exact-fit calculation) above the
        // floating tab bar's own footprint (64 + insets.bottom, see
        // components/BottomNav.tsx) — the tab bar is a sibling overlay
        // painted on top of this screen's content by the Tabs navigator, so
        // any small rendering discrepancy in an exact-fit gap could still
        // visually cover the button even though it exists in the tree.
        <View
          style={[
            styles.stepButtons,
            { paddingBottom: keyboardVisible ? space.md : insets.bottom + 64 + space.xxl },
          ]}
        >
          {isSubmitting && submitStatus ? <Text style={styles.submitStatus}>{submitStatus}</Text> : null}
          <View style={styles.footerActions}>
            {state.step < 4 ? (
              <Button
                label={state.step === 3 ? "Preview →" : "Continue →"}
                onPress={goNext}
                fullWidth={state.step === 1}
                style={state.step > 1 ? styles.footerPrimary : undefined}
              />
            ) : (
              <Button
                label="Post Ad →"
                variant="gold"
                onPress={submit}
                loading={isSubmitting}
                fullWidth={false}
                style={styles.footerPrimary}
              />
            )}
          </View>
        </View>
      )}
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
  topbarTitle: { flex: 1, ...font.title, color: color.textOnBrand, textAlign: "center" },
  topbarSpacer: { width: 52 },
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
  // ScrollView needs an explicit flex:1 here — without it, it sizes to its
  // own content instead of bounding itself to the space between the steps
  // bar and the fixed footer below, so it never actually scrolls and the
  // footer (a sibling, not scroll content) ends up pushed off-screen.
  scroll: { flex: 1 },
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
  visibilityOption: { flex: 1, paddingHorizontal: space.md, paddingVertical: space.sm, justifyContent: "center", alignItems: "center", backgroundColor: color.surface },
  institutionBanner: { marginHorizontal: space.lg, marginBottom: space.sm, padding: space.lg },
  institutionBannerLabel: { ...font.micro, color: color.textMuted, textTransform: "uppercase" },
  institutionBannerName: { ...font.title, color: color.text, marginTop: 2 },

  postingContextCard: {
    backgroundColor: color.brandTint, borderRadius: radius.lg, padding: space.md, marginBottom: space.lg, gap: space.xs,
  },
  postingContextTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  postingContextEyebrow: { ...font.micro, color: color.textMuted, textTransform: "uppercase" },
  campusPill: { backgroundColor: color.surface, borderRadius: radius.pill, paddingHorizontal: space.sm, paddingVertical: 2 },
  campusPillText: { ...font.micro, color: color.brand },
  postingContextName: { ...font.title, color: color.text },
  postingContextMeta: { ...font.sub, color: color.textMuted },
  postingContextBanner: { backgroundColor: color.surface, borderRadius: radius.md, padding: space.sm, marginTop: space.xs },
  postingContextBannerTitle: { ...font.caption, color: color.brand, fontWeight: "800" },
  postingContextBannerBody: { ...font.caption, color: color.textMuted, marginTop: 2 },

  locationHelp: { ...font.sub, color: color.textMuted, marginTop: -space.xs, marginBottom: space.sm },
  dropPinButton: {
    marginTop: space.sm, height: 46, borderRadius: radius.md, borderWidth: 1.5, borderColor: color.borderStrong,
    alignItems: "center", justifyContent: "center", backgroundColor: color.surface,
  },
  dropPinButtonText: { ...font.bodyStrong, color: color.brand },
  locationTip: { ...font.caption, color: color.textMuted },

  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  tipBox: { backgroundColor: color.goldTint, borderRadius: radius.md, padding: space.lg, marginTop: space.lg },
  phoneReminder: { backgroundColor: color.brandTint, borderRadius: radius.md, padding: space.md, marginTop: space.lg },
  tipTitle: { ...font.caption, color: color.text, marginBottom: space.xs },
  tipBody: { ...font.sub, color: color.textSub },
  previewCard: { padding: space.lg },
  previewLabel: { ...font.micro, color: color.textMuted, textTransform: "uppercase", marginBottom: space.sm },
  previewTitle: { ...font.title, color: color.text },
  previewPrice: { ...font.h2, color: color.brand, marginTop: space.xs },
  previewMeta: { ...font.sub, color: color.textMuted, marginTop: space.sm },
  error: { ...font.sub, color: color.danger, marginTop: space.lg, textAlign: "center" },
  stepButtons: {
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    backgroundColor: color.bg,
    borderTopWidth: 1,
    borderTopColor: color.border,
    zIndex: 20,
    elevation: 20,
  },
  footerActions: { flexDirection: "row", gap: space.md },
  footerPrimary: { flex: 2 },
  submitStatus: {
    ...font.caption,
    color: color.textSub,
    textAlign: "center",
    marginBottom: space.sm,
  },
  });
}
