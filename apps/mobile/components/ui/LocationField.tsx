import { useMemo, useState } from "react";
import { FlatList, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { glass, radius, space, font, type ColorPalette } from "../../lib/theme";
import { useThemedStyles } from "../../lib/theme-provider";
import { GlassBackButton } from "./GlassBackButton";

// One tappable field ("Province ▾ Harare") that opens a full-screen searchable
// list to pick a single value. This is the shared "acts like a dropdown"
// primitive every location input in the app should use — RN has no native
// <select>, so a tap-to-open modal list is the closest equivalent that still
// reads as "structured choice" rather than free text.
export function SelectField({
  label,
  value,
  placeholder,
  options,
  onSelect,
  disabled,
  disabledHint,
}: {
  label: string;
  value: string;
  placeholder: string;
  options: string[];
  onSelect: (value: string) => void;
  disabled?: boolean;
  disabledHint?: string;
}) {
  const styles = useThemedStyles(buildStyles);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const insets = useSafeAreaInsets();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.toLowerCase().includes(q));
  }, [options, query]);

  function openPicker() {
    if (disabled) return;
    setQuery("");
    setOpen(true);
  }

  function pick(v: string) {
    onSelect(v);
    setOpen(false);
  }

  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        style={[styles.field, disabled && styles.fieldDisabled]}
        onPress={openPicker}
        accessibilityRole="button"
      >
        <Text style={[styles.fieldValue, !value && styles.fieldPlaceholder]} numberOfLines={1}>
          {value || (disabled && disabledHint ? disabledHint : placeholder)}
        </Text>
        <ChevronDown disabled={!!disabled} />
      </Pressable>

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <View style={styles.backdrop}>
          <BlurView
            intensity={glass.intensity.strong}
            tint="dark"
            blurMethod={Platform.OS === "android" ? glass.androidBlurMethod : undefined}
            style={StyleSheet.absoluteFill}
          />
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} />
          <View style={[styles.sheet, { paddingBottom: insets.bottom + space.lg }]}>
            <View style={styles.sheetHeader}>
              <GlassBackButton onPress={() => setOpen(false)} flat label="Close" />
              <Text style={styles.sheetTitle}>{label}</Text>
              <View style={{ width: 52 }} />
            </View>
            <TextInput
              style={styles.search}
              value={query}
              onChangeText={setQuery}
              placeholder={`Search ${label.toLowerCase()}…`}
              autoFocus
              returnKeyType="search"
            />
            <FlatList
              data={filtered}
              keyExtractor={(item) => item}
              keyboardShouldPersistTaps="handled"
              style={styles.list}
              renderItem={({ item }) => (
                <Pressable style={styles.optionRow} onPress={() => pick(item)}>
                  <Text style={[styles.optionText, item === value && styles.optionTextActive]}>{item}</Text>
                  {item === value ? <Text style={styles.optionCheck}>✓</Text> : null}
                </Pressable>
              )}
              ListEmptyComponent={<Text style={styles.emptyText}>No matches</Text>}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

function ChevronDown({ disabled }: { disabled: boolean }) {
  const styles = useThemedStyles(buildStyles);
  return <Text style={[styles.chevron, disabled && styles.chevronDisabled]}>▾</Text>;
}

// Province → City pair, the current backbone of PaMarket's location data
// (Zimbabwe only — see lib/constants.ts). Deliberately kept to this shape
// rather than baking in a fixed "Country / Area" tier: when multi-country
// data exists, this is the one place that needs to grow a Country level and
// change what feeds `cities`, not every screen that uses it.
export function ProvinceCityFields({
  provinces,
  citiesByProvince,
  province,
  city,
  onChange,
  cityLimit,
}: {
  provinces: readonly string[];
  citiesByProvince: Record<string, readonly string[]>;
  province: string;
  city: string;
  onChange: (next: { province: string; city: string }) => void;
  cityLimit?: number;
}) {
  const cityOptions = useMemo(() => {
    const all = citiesByProvince[province] ?? [];
    return cityLimit ? all.slice(0, cityLimit) : all;
  }, [citiesByProvince, province, cityLimit]);

  return (
    <View style={{ gap: space.md }}>
      <SelectField
        label="Province"
        value={province}
        placeholder="Select province"
        options={provinces as string[]}
        onSelect={(p) => {
          const cityStillValid = p === province || (citiesByProvince[p] ?? []).includes(city);
          onChange({ province: p, city: cityStillValid ? city : "" });
        }}
      />
      <SelectField
        label="City / Town"
        value={city}
        placeholder="Select city"
        options={cityOptions as string[]}
        onSelect={(c) => onChange({ province, city: c })}
        disabled={!province}
        disabledHint="Select a province first"
      />
    </View>
  );
}

function buildStyles(color: ColorPalette) {
  return StyleSheet.create({
    label: { ...font.caption, color: color.text, marginBottom: space.xs, fontSize: 13, fontWeight: "700" },
    field: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderWidth: 1,
      borderColor: color.borderStrong,
      borderRadius: radius.md,
      paddingHorizontal: space.md,
      paddingVertical: 12,
      backgroundColor: color.surface,
    },
    fieldDisabled: { opacity: 0.5 },
    fieldValue: { ...font.body, color: color.text, flex: 1 },
    fieldPlaceholder: { color: color.textMuted },
    chevron: { color: color.textSub, fontSize: 14, marginLeft: space.sm },
    chevronDisabled: { opacity: 0.5 },
    backdrop: { flex: 1, justifyContent: "flex-end" },
    sheet: {
      backgroundColor: color.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: "80%",
      paddingHorizontal: space.lg,
      paddingTop: space.md,
    },
    sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: space.md },
    sheetTitle: { ...font.bodyStrong, color: color.text },
    search: {
      borderWidth: 1,
      borderColor: color.borderStrong,
      borderRadius: radius.md,
      paddingHorizontal: space.md,
      paddingVertical: 10,
      color: color.text,
      marginBottom: space.sm,
    },
    list: { flexGrow: 0 },
    optionRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 13,
      borderBottomWidth: 1,
      borderBottomColor: color.divider,
    },
    optionText: { ...font.body, color: color.text },
    optionTextActive: { color: color.brand, fontWeight: "700" },
    optionCheck: { color: color.brand, fontWeight: "700" },
    emptyText: { ...font.body, color: color.textMuted, textAlign: "center", paddingVertical: space.xl },
  });
}
