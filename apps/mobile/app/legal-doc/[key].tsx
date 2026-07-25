import { Linking, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, Stack } from "expo-router";
import { BRAND_BLUE } from "../../lib/constants";
import { LEGAL_DOCS, type LegalDocKey } from "../../lib/legal";

export default function LegalDocScreen() {
  const { key } = useLocalSearchParams<{ key: string }>();
  const doc = LEGAL_DOCS[key as LegalDocKey];

  if (!doc) {
    return (
      <View style={styles.notFound}>
        <Text style={styles.notFoundText}>Document not found.</Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: doc.title }} />
      <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
        <View style={styles.updatedPill}>
          <Text style={styles.updatedText}>{doc.updated}</Text>
        </View>

        {doc.sections.map((section, i) => (
          <View key={i} style={styles.section}>
            {section.heading ? <Text style={styles.heading}>{section.heading}</Text> : null}
            <Text style={styles.paragraph}>{section.body}</Text>
          </View>
        ))}

        <View style={styles.contactCard}>
          <Text style={styles.contactLabel}>Questions about this document?</Text>
          <Text style={styles.contactEmail} onPress={() => Linking.openURL("mailto:support@pamarketzw.com")}>
            support@pamarketzw.com
          </Text>
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F6F9",
  },
  notFound: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F5F6F9",
    padding: 32,
  },
  notFoundText: {
    fontSize: 14,
    color: "#8A93A6",
  },
  updatedPill: {
    alignSelf: "flex-start",
    backgroundColor: "#EEF2FF",
    borderWidth: 1,
    borderColor: "#C7D7FE",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginBottom: 12,
  },
  updatedText: {
    fontSize: 11,
    fontWeight: "700",
    color: BRAND_BLUE,
  },
  section: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
  },
  heading: {
    fontSize: 14,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 8,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F1F5",
  },
  paragraph: {
    fontSize: 13,
    lineHeight: 20,
    color: "#5A6478",
  },
  contactCard: {
    marginTop: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#E4E7EE",
    alignItems: "center",
  },
  contactLabel: {
    fontSize: 12,
    color: "#8A93A6",
    marginBottom: 6,
  },
  contactEmail: {
    fontSize: 13,
    fontWeight: "700",
    color: BRAND_BLUE,
  },
});
