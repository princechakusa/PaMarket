import { Linking, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, Stack } from "expo-router";
import { LEGAL_DOCS, type LegalDocKey } from "../../lib/legal";
import type { ColorPalette } from "../../lib/theme";
import { useThemedStyles } from "../../lib/theme-provider";

export default function LegalDocScreen() {
  const styles = useThemedStyles(buildStyles);
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

function buildStyles(color: ColorPalette) {
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: color.bg,
  },
  notFound: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: color.bg,
    padding: 32,
  },
  notFoundText: {
    fontSize: 14,
    color: color.textMuted,
  },
  updatedPill: {
    alignSelf: "flex-start",
    backgroundColor: color.brandTint,
    borderWidth: 1,
    borderColor: color.brandTintStrong,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginBottom: 12,
  },
  updatedText: {
    fontSize: 11,
    fontWeight: "700",
    color: color.brand,
  },
  section: {
    backgroundColor: color.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
  },
  heading: {
    fontSize: 14,
    fontWeight: "800",
    color: color.text,
    marginBottom: 8,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: color.divider,
  },
  paragraph: {
    fontSize: 13,
    lineHeight: 20,
    color: color.textSub,
  },
  contactCard: {
    marginTop: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: color.border,
    alignItems: "center",
  },
  contactLabel: {
    fontSize: 12,
    color: color.textMuted,
    marginBottom: 6,
  },
  contactEmail: {
    fontSize: 13,
    fontWeight: "700",
    color: color.brand,
  },
  });
}
