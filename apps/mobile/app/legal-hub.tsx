import { useMemo, useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import Svg, { Polyline, Circle, Line } from "react-native-svg";
import { BRAND_BLUE } from "../lib/constants";
import { LEGAL_DOCS, LEGAL_SECTIONS, type LegalDocKey } from "../lib/legal";

function ChevronRight() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#C4C9D4" strokeWidth={2.5}>
      <Polyline points="9 18 15 12 9 6" />
    </Svg>
  );
}

function SearchIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#8A93A6" strokeWidth={2}>
      <Circle cx={11} cy={11} r={8} />
      <Line x1={21} y1={21} x2={16.65} y2={16.65} />
    </Svg>
  );
}

function DocRow({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <Text style={styles.rowLabel}>{label}</Text>
      <ChevronRight />
    </Pressable>
  );
}

export default function LegalHubScreen() {
  const router = useRouter();
  const [query, setQuery] = useState("");

  const docCount = Object.keys(LEGAL_DOCS).length;

  const filteredSections = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return LEGAL_SECTIONS;
    return LEGAL_SECTIONS.map((sec) => ({
      ...sec,
      docs: sec.docs.filter((key) => LEGAL_DOCS[key].title.toLowerCase().includes(q)),
    })).filter((sec) => sec.docs.length > 0);
  }, [query]);

  function openDoc(key: LegalDocKey) {
    router.push(`/legal-doc/${key}`);
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>PaMarket Zimbabwe</Text>
        <Text style={styles.title}>Legal Hub</Text>
        <Text style={styles.subtitle}>
          All our policies, terms, and safety guidelines in one place. Transparency is the foundation of trust.
        </Text>
        <View style={styles.countPill}>
          <View style={styles.countDot} />
          <Text style={styles.countText}>{docCount} documents · Updated June 2026</Text>
        </View>
      </View>

      <View style={styles.searchBar}>
        <SearchIcon />
        <TextInput
          style={styles.searchInput}
          placeholder="Search legal documents..."
          placeholderTextColor="#8A93A6"
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
        />
      </View>

      {filteredSections.length === 0 ? (
        <Text style={styles.noResults}>No documents match your search.</Text>
      ) : (
        filteredSections.map((sec) => (
          <View key={sec.id}>
            <Text style={styles.sectionLabel}>{sec.title}</Text>
            <View style={styles.group}>
              {sec.docs.map((key) => (
                <DocRow key={key} label={LEGAL_DOCS[key].title} onPress={() => openDoc(key)} />
              ))}
            </View>
          </View>
        ))
      )}

      <Text style={styles.sectionLabel}>Contact</Text>
      <View style={styles.group}>
        <Pressable style={styles.row} onPress={() => Linking.openURL("mailto:support@pamarketzw.com")}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.rowLabel, { color: BRAND_BLUE }]}>support@pamarketzw.com</Text>
            <Text style={styles.rowSub}>General &amp; Terms</Text>
          </View>
          <ChevronRight />
        </Pressable>
        <Pressable style={styles.row} onPress={() => Linking.openURL("mailto:info@pamarketzw.com")}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.rowLabel, { color: BRAND_BLUE }]}>info@pamarketzw.com</Text>
            <Text style={styles.rowSub}>Privacy &amp; Data</Text>
          </View>
          <ChevronRight />
        </Pressable>
        <DocRow label="Report a Problem" onPress={() => router.push("/report-problem")} />
      </View>

      <Text style={styles.sectionLabel}>Company</Text>
      <View style={styles.group}>
        <DocRow label="Help Center" onPress={() => router.push("/help")} />
      </View>

      <Text style={styles.footer}>© {new Date().getFullYear()} PaMarket Zimbabwe · Made in Zimbabwe</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F6F9",
  },
  hero: {
    backgroundColor: "#ffffff",
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F1F5",
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: "700",
    color: "#8A93A6",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: "900",
    color: "#111827",
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    color: "#5A6478",
    lineHeight: 19,
  },
  countPill: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    backgroundColor: "#EEF2FF",
    borderWidth: 1,
    borderColor: "#C7D7FE",
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  countDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: BRAND_BLUE,
  },
  countText: {
    fontSize: 11,
    fontWeight: "700",
    color: BRAND_BLUE,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#ffffff",
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E4E7EE",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: "#111827",
    padding: 0,
  },
  noResults: {
    textAlign: "center",
    fontSize: 13,
    color: "#8A93A6",
    marginTop: 32,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#8A93A6",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginTop: 20,
    marginBottom: 8,
    marginHorizontal: 16,
  },
  group: {
    backgroundColor: "#ffffff",
    marginHorizontal: 16,
    borderRadius: 14,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F1F5",
  },
  rowLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
  },
  rowSub: {
    fontSize: 12,
    color: "#8A93A6",
    marginTop: 2,
  },
  footer: {
    textAlign: "center",
    fontSize: 11,
    color: "#8A93A6",
    marginTop: 24,
  },
});
