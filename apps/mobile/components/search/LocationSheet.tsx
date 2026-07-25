import { useMemo, useState } from "react";
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import Svg, { Circle, Line, Path } from "react-native-svg";
import { PROVINCES, CITIES_BY_PROVINCE } from "../../lib/constants";
import { font, radius, space, type ColorPalette } from "../../lib/theme";
import { useThemedStyles } from "../../lib/theme-provider";

function SearchIcon({ color }: { color: ColorPalette }) {
  return (
    <Svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke={color.textMuted} strokeWidth={2.5}>
      <Circle cx={11} cy={11} r={8} />
      <Line x1={21} y1={21} x2="16.65" y2="16.65" />
    </Svg>
  );
}

function PinIcon({ tone }: { tone: string }) {
  return (
    <Svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke={tone} strokeWidth={2.2}>
      <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <Circle cx={12} cy={10} r={3} />
    </Svg>
  );
}

function CheckIcon({ color }: { color: ColorPalette }) {
  return (
    <Svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke={color.brand} strokeWidth={3}>
      <Path d="M20 6 9 17l-5-5" />
    </Svg>
  );
}

type Row = { kind: "province"; label: string } | { kind: "city"; label: string; province: string };

// Searchable location picker used by Search's Filters. Distinct from
// components/home/CityPicker (Home's approved inline panel, left untouched) —
// this one supports free-text search across all 324 cities/suburbs and
// groups results under their province, matching Dubizzle-style location UX.
export function LocationSheet({
  visible,
  selected,
  onSelect,
  onClose,
}: {
  visible: boolean;
  selected: string;
  onSelect: (location: string) => void;
  onClose: () => void;
}) {
  const styles = useThemedStyles(buildStyles);
  const themeColor = useThemedStyles((c) => c);
  const [query, setQuery] = useState("");

  const rows = useMemo<Row[]>(() => {
    const q = query.trim().toLowerCase();
    const out: Row[] = [];
    for (const province of PROVINCES) {
      const cities = CITIES_BY_PROVINCE[province] ?? [];
      const matchingCities = q ? cities.filter((c) => c.toLowerCase().includes(q)) : cities;
      const provinceMatches = !q || province.toLowerCase().includes(q);
      if (!matchingCities.length && !provinceMatches) continue;
      out.push({ kind: "province", label: province });
      const list = provinceMatches && !q ? cities : matchingCities;
      for (const city of list) out.push({ kind: "city", label: city, province });
    }
    return out;
  }, [query]);

  function pick(location: string) {
    onSelect(location);
    setQuery("");
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropTouch} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.grabber} />
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Location</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Text style={styles.closeLink}>Close</Text>
            </Pressable>
          </View>

          <View style={styles.searchBar}>
            <SearchIcon color={themeColor} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search city or province…"
              placeholderTextColor={themeColor.textMuted}
              value={query}
              onChangeText={setQuery}
              autoCapitalize="none"
            />
          </View>

          <Pressable style={styles.allRow} onPress={() => pick("all")}>
            <View style={[styles.pin, styles.pinAll]}>
              <PinIcon tone={themeColor.brand} />
            </View>
            <Text style={styles.allText}>All Zimbabwe</Text>
            {selected === "all" ? <CheckIcon color={themeColor} /> : null}
          </Pressable>

          <FlatList
            data={rows}
            keyExtractor={(item, i) => `${item.kind}-${item.label}-${i}`}
            style={styles.list}
            contentContainerStyle={{ paddingBottom: space.xl }}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={<Text style={styles.emptyText}>No locations match &ldquo;{query}&rdquo;</Text>}
            renderItem={({ item }) =>
              item.kind === "province" ? (
                <Text style={styles.provinceLabel}>{item.label}</Text>
              ) : (
                <Pressable style={styles.cityRow} onPress={() => pick(item.label)}>
                  <Text style={styles.cityText}>{item.label}</Text>
                  {selected === item.label ? <CheckIcon color={themeColor} /> : null}
                </Pressable>
              )
            }
          />
        </View>
      </View>
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
    height: "80%",
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
  headerTitle: { ...font.h3, color: color.text },
  closeLink: { ...font.bodyStrong, color: color.brand },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    backgroundColor: color.surfaceAlt,
    borderRadius: radius.md,
    marginHorizontal: space.xl,
    marginTop: space.md,
    paddingHorizontal: space.md,
  },
  searchInput: { flex: 1, paddingVertical: space.md, ...font.body, color: color.text },
  allRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingHorizontal: space.xl,
    paddingVertical: space.md,
    borderBottomWidth: 1,
    borderBottomColor: color.divider,
  },
  pin: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  pinAll: { backgroundColor: color.brandTint },
  allText: { ...font.bodyStrong, color: color.text, flex: 1 },
  list: { flex: 1, paddingHorizontal: space.xl },
  provinceLabel: {
    ...font.caption,
    color: color.textMuted,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginTop: space.lg,
    marginBottom: space.xs,
  },
  cityRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: space.sm,
  },
  cityText: { ...font.body, color: color.text },
  emptyText: { ...font.body, color: color.textMuted, textAlign: "center", marginTop: space.xxl },
  });
}
