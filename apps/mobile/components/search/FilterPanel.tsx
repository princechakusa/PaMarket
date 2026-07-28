import { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { CATEGORIES } from "../../lib/constants";
import type { BrowseFilters, Condition } from "../../lib/listings";
import { Button, Chip } from "../ui";
import { LocationSheet } from "./LocationSheet";
import { font, radius, space, type ColorPalette } from "../../lib/theme";
import { useThemedStyles } from "../../lib/theme-provider";

const CONDITIONS: { value: Condition; label: string }[] = [
  { value: "all", label: "Any" },
  { value: "new", label: "New" },
  { value: "like-new", label: "Like New" },
  { value: "used", label: "Used" },
  { value: "refurbished", label: "Refurbished" },
];

const PRICE_QUICK_PICKS: { label: string; min: number; max: number }[] = [
  { label: "Under $100", min: 0, max: 100 },
  { label: "$100 – $500", min: 100, max: 500 },
  { label: "$500 – $2,000", min: 500, max: 2000 },
  { label: "$2,000+", min: 2000, max: Infinity },
];

function PinIcon({ color }: { color: ColorPalette }) {
  return (
    <Svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke={color.brand} strokeWidth={2.2}>
      <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <Path d="M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
    </Svg>
  );
}

export function countActiveFilters(filters: BrowseFilters): number {
  let n = 0;
  if (filters.categories.length) n += 1;
  if (filters.priceMin > 0 || (filters.priceMax !== Infinity && filters.priceMax != null)) n += 1;
  if (filters.currency !== "all") n += 1;
  if (filters.location && filters.location !== "all") n += 1;
  if (filters.condition !== "all") n += 1;
  if (filters.verifiedOnly) n += 1;
  if (filters.rentalType && filters.rentalType !== "all") n += 1;
  return n;
}

export function FilterPanel({
  visible,
  filters,
  locations,
  onChange,
  onApply,
  onReset,
  onClose,
}: {
  visible: boolean;
  filters: BrowseFilters;
  locations: string[];
  onChange: (next: BrowseFilters) => void;
  onApply: () => void;
  onReset: () => void;
  onClose: () => void;
}) {
  const styles = useThemedStyles(buildStyles);
  const themeColor = useThemedStyles((c) => c);
  const [locationSheetVisible, setLocationSheetVisible] = useState(false);
  const activeCount = useMemo(() => countActiveFilters(filters), [filters]);

  function toggleCategory(id: string) {
    const next = filters.categories.includes(id)
      ? filters.categories.filter((c) => c !== id)
      : [...filters.categories, id];
    onChange({ ...filters, categories: next });
  }

  const isQuickPickActive = (qp: (typeof PRICE_QUICK_PICKS)[number]) =>
    filters.priceMin === qp.min && (filters.priceMax === qp.max || (qp.max === Infinity && filters.priceMax === Infinity));

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropTouch} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.grabber} />
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <Text style={styles.headerTitle}>Filters</Text>
              {activeCount ? (
                <View style={styles.countBadge}>
                  <Text style={styles.countBadgeText}>{activeCount}</Text>
                </View>
              ) : null}
            </View>
            <Pressable onPress={onClose} hitSlop={12}>
              <Text style={styles.closeLink}>Close</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            <Text style={styles.sectionTitle}>Categories</Text>
            <View style={styles.chipWrap}>
              {CATEGORIES.filter((c) => c.id !== "jobs").map((c) => (
                <Chip
                  key={c.id}
                  label={c.name}
                  active={filters.categories.includes(c.id)}
                  onPress={() => toggleCategory(c.id)}
                />
              ))}
            </View>

            {filters.categories.length === 1 && filters.categories[0] === "property" ? (
              <>
                <Text style={styles.sectionTitle}>Sale or Rent</Text>
                <View style={styles.chipWrap}>
                  {(
                    [
                      { value: "all", label: "All" },
                      { value: "For Sale", label: "For Sale" },
                      { value: "For Rent", label: "For Rent" },
                    ] as const
                  ).map((opt) => (
                    <Chip
                      key={opt.value}
                      label={opt.label}
                      active={(filters.rentalType ?? "all") === opt.value}
                      onPress={() => onChange({ ...filters, rentalType: opt.value })}
                    />
                  ))}
                </View>
              </>
            ) : null}

            <View style={styles.divider} />

            <Text style={styles.sectionTitle}>Price Range</Text>
            <View style={styles.chipWrap}>
              {PRICE_QUICK_PICKS.map((qp) => (
                <Chip
                  key={qp.label}
                  label={qp.label}
                  active={isQuickPickActive(qp)}
                  onPress={() =>
                    onChange({
                      ...filters,
                      priceMin: isQuickPickActive(qp) ? 0 : qp.min,
                      priceMax: isQuickPickActive(qp) ? Infinity : qp.max,
                    })
                  }
                />
              ))}
            </View>
            <View style={styles.priceRow}>
              <View style={styles.priceField}>
                <Text style={styles.priceFieldLabel}>Min</Text>
                <TextInput
                  style={styles.priceInput}
                  placeholder="0"
                  placeholderTextColor={themeColor.textMuted}
                  keyboardType="numeric"
                  value={filters.priceMin ? String(filters.priceMin) : ""}
                  onChangeText={(t) => onChange({ ...filters, priceMin: parseFloat(t) || 0 })}
                />
              </View>
              <View style={styles.priceTo}>
                <View style={styles.priceToLine} />
              </View>
              <View style={styles.priceField}>
                <Text style={styles.priceFieldLabel}>Max</Text>
                <TextInput
                  style={styles.priceInput}
                  placeholder="Any"
                  placeholderTextColor={themeColor.textMuted}
                  keyboardType="numeric"
                  value={filters.priceMax && filters.priceMax !== Infinity ? String(filters.priceMax) : ""}
                  onChangeText={(t) => onChange({ ...filters, priceMax: parseFloat(t) || Infinity })}
                />
              </View>
            </View>
            <View style={styles.chipWrap}>
              {(["all", "USD", "ZiG"] as const).map((cur) => (
                <Chip
                  key={cur}
                  label={cur === "all" ? "Any currency" : cur}
                  active={filters.currency === cur}
                  onPress={() => onChange({ ...filters, currency: cur })}
                />
              ))}
            </View>

            <View style={styles.divider} />

            <Text style={styles.sectionTitle}>Location</Text>
            <Pressable style={styles.locationTrigger} onPress={() => setLocationSheetVisible(true)}>
              <PinIcon color={themeColor} />
              <Text style={styles.locationTriggerText}>
                {filters.location === "all" ? "All Zimbabwe" : filters.location}
              </Text>
              <Text style={styles.locationChangeLink}>Change</Text>
            </Pressable>
            {locations.length ? (
              <View style={[styles.chipWrap, { marginTop: space.sm }]}>
                <Text style={styles.suggestedLabel}>In your results:</Text>
                {locations.slice(0, 8).map((loc) => (
                  <Chip
                    key={loc}
                    label={loc}
                    active={filters.location === loc}
                    onPress={() => onChange({ ...filters, location: loc })}
                  />
                ))}
              </View>
            ) : null}

            <View style={styles.divider} />

            <Text style={styles.sectionTitle}>Condition</Text>
            <View style={styles.chipWrap}>
              {CONDITIONS.map((c) => (
                <Chip
                  key={c.value}
                  label={c.label}
                  active={filters.condition === c.value}
                  onPress={() => onChange({ ...filters, condition: c.value })}
                />
              ))}
            </View>

            <View style={styles.switchRow}>
              <View>
                <Text style={styles.switchLabel}>Verified Sellers Only</Text>
                <Text style={styles.switchSub}>Show listings from ID-verified sellers</Text>
              </View>
              <Switch
                value={filters.verifiedOnly}
                onValueChange={(v) => onChange({ ...filters, verifiedOnly: v })}
                trackColor={{ true: themeColor.brand }}
              />
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <View style={{ flex: 1 }}>
              <Button label={activeCount ? `Apply (${activeCount})` : "Apply Filters"} onPress={onApply} variant="primary" />
            </View>
            <Button label="Reset" onPress={onReset} variant="secondary" fullWidth={false} />
          </View>
        </View>
      </View>

      <LocationSheet
        visible={locationSheetVisible}
        selected={filters.location}
        onSelect={(loc) => onChange({ ...filters, location: loc })}
        onClose={() => setLocationSheetVisible(false)}
      />
    </Modal>
  );
}

function buildStyles(color: ColorPalette) {
  return StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: color.overlay, justifyContent: "flex-end" },
  backdropTouch: { flex: 1 },
  sheet: {
    backgroundColor: color.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: "88%",
    paddingTop: space.md,
  },
  grabber: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: color.borderStrong,
    marginBottom: space.sm,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: space.xl,
    paddingBottom: space.md,
    borderBottomWidth: 1,
    borderBottomColor: color.divider,
  },
  headerTitleRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  headerTitle: { ...font.h3, color: color.text },
  countBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: radius.pill,
    backgroundColor: color.brand,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  countBadgeText: { ...font.micro, color: color.textOnBrand, fontWeight: "800" },
  closeLink: { ...font.bodyStrong, color: color.brand },
  body: { paddingHorizontal: space.xl, paddingTop: space.md, paddingBottom: space.sm },
  divider: { height: 1, backgroundColor: color.divider, marginTop: space.lg },
  sectionTitle: { ...font.bodyStrong, color: color.text, marginBottom: space.md, marginTop: space.lg },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, alignItems: "center" },
  suggestedLabel: { ...font.caption, color: color.textMuted, width: "100%", marginBottom: space.xxs },
  priceRow: { flexDirection: "row", alignItems: "flex-end", gap: space.sm, marginTop: space.md, marginBottom: space.md },
  priceField: { flex: 1 },
  priceFieldLabel: { ...font.micro, color: color.textMuted, marginBottom: space.xxs, fontWeight: "700" },
  priceInput: {
    borderWidth: 1,
    borderColor: color.borderStrong,
    borderRadius: radius.md,
    backgroundColor: color.surfaceAlt,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    ...font.body,
    color: color.text,
  },
  priceTo: { paddingBottom: space.md + 2, width: 14, alignItems: "center" },
  priceToLine: { width: 8, height: 1.5, backgroundColor: color.borderStrong },
  locationTrigger: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    backgroundColor: color.brandTint,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
  },
  locationTriggerText: { ...font.bodyStrong, color: color.text, flex: 1 },
  locationChangeLink: { ...font.caption, color: color.brand, fontWeight: "700" },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: space.xl,
    gap: space.md,
  },
  switchLabel: { ...font.bodyStrong, color: color.text },
  switchSub: { ...font.caption, color: color.textMuted, marginTop: 2 },
  footer: {
    flexDirection: "row",
    gap: space.md,
    padding: space.lg,
    borderTopWidth: 1,
    borderTopColor: color.divider,
    alignItems: "center",
  },
  });
}
