import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { openExternalUrl } from "../../lib/open-url";
import { useLocalSearchParams, Stack } from "expo-router";
import { LEGAL_DOCS, type LegalDoc, type LegalDocKey } from "../../lib/legal";
import { fetchLegalDoc } from "../../lib/content";
import type { ColorPalette } from "../../lib/theme";
import { useThemedStyles } from "../../lib/theme-provider";

// Slugs already migrated to the admin-managed content_pages table (stage 1
// of the hardcoded-content migration) — every other LegalDocKey keeps
// reading straight from the static lib/legal.ts constant, unchanged.
const CONTENT_SLUG_BY_KEY: Partial<Record<LegalDocKey, string>> = {
  terms_of_use: "terms",
  privacy_policy: "privacy",
  community_guidelines: "community-guidelines",
  refund_dispute_policy: "refund-cancellation",
  fraud_prevention_policy: "public-safety",
  // Stage 2: these 12 have no competing website wording (they only ever
  // existed in this app), so their content_pages row is byte-identical to
  // the static doc below — connecting them is zero-risk. cookie_data_policy
  // is deliberately NOT here: its content_pages row was published from the
  // website's differing wording, and connecting it would silently change
  // what this screen shows — left on the static doc until an admin
  // resolves that conflict (see the admin Legal & Policies "Compare" tool).
  acceptable_use_policy: "acceptable-use-policy",
  buying_selling_terms: "buying-selling-terms",
  job_platform_terms: "job-platform-terms",
  service_platform_terms: "service-platform-terms",
  prohibited_items_policy: "prohibited-items-policy",
  account_suspension_policy: "account-suspension-policy",
  content_moderation_policy: "content-moderation-policy",
  reviews_ratings_policy: "reviews-ratings-policy",
  vehicle_listing_terms: "vehicle-listing-terms",
  property_listing_terms: "property-listing-terms",
  verified_business_rules: "verified-business-rules",
  boosted_listing_rules: "boosted-listing-rules",
};

export default function LegalDocScreen() {
  const styles = useThemedStyles(buildStyles);
  const { key } = useLocalSearchParams<{ key: string }>();
  const staticDoc = LEGAL_DOCS[key as LegalDocKey];
  const [doc, setDoc] = useState<LegalDoc | null | undefined>(staticDoc);

  useEffect(() => {
    setDoc(staticDoc);
    const slug = CONTENT_SLUG_BY_KEY[key as LegalDocKey];
    if (!slug) return; // not migrated yet — static doc above is final
    let cancelled = false;
    fetchLegalDoc(slug)
      .then((fetched) => {
        if (!cancelled && fetched) setDoc(fetched);
      })
      .catch(() => {
        // Fetch/cache both failed — the static doc already showing stays.
      });
    return () => {
      cancelled = true;
    };
  }, [key, staticDoc]);

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
          <Text style={styles.contactEmail} onPress={() => openExternalUrl("mailto:support@pamarketzw.com", "No mail app is set up on this device.")}>
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
