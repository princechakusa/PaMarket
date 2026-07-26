import { useMemo, useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { TERMS, PRIVACY, type LegalDoc } from "../lib/legal";
import { LegalDocSheet } from "../components/LegalDocSheet";
import { color, type ColorPalette } from "../lib/theme";
import { useThemedStyles } from "../lib/theme-provider";

const WHATSAPP_URL = "https://wa.me/971589772645";
const EMAIL_URL = "mailto:support@pamarketzw.com";
const PHONE_URL = "tel:+971589772645";

type Faq = { group: string; q: string; a: string };

// Ported verbatim from www/js/help.js HELP_FAQS — keep wording identical.
const HELP_FAQS: Faq[] = [
  {
    group: "Getting started",
    q: "How do I post an ad on PaMarket?",
    a: 'Tap the "Post" button at the bottom of the screen. Choose your category, add clear photos, write a title and description, set your price, and select your location. Your listing goes live instantly — no waiting for review.',
  },
  {
    group: "Getting started",
    q: "Is PaMarket free to use?",
    a: "Yes — completely free. Posting ads, browsing listings, sending messages, applying for jobs, and getting verified are all 100% free. No subscriptions, no commission on sales, no hidden charges.",
  },
  {
    group: "Getting started",
    q: "How do I get my account verified?",
    a: "Go to Account → Verify Identity. Enter your ID number, take a selfie, and upload a photo of your National ID or passport. Our team reviews your submission within 24 hours and your blue verified badge appears automatically when approved.",
  },
  {
    group: "Managing listings",
    q: "How long do my listings stay active?",
    a: "Listings stay active for 30 days. You can renew any listing anytime by going to My Listings and tapping Renew. Renewing resets the 30-day timer and bumps your listing back to the top.",
  },
  {
    group: "Managing listings",
    q: "Can I edit or delete a listing after posting?",
    a: "Yes. Go to Account → My Listings, tap the listing you want to change, then tap Edit to update photos, price, or description. To remove a listing, tap Delete. Deleted listings are permanently removed and cannot be recovered.",
  },
  {
    group: "Managing listings",
    q: "Why is my listing not showing up?",
    a: 'Make sure your listing is set to "Active" in My Listings. Check that it was saved successfully — you should have received a confirmation. If your listing was removed by our moderation team, you will receive a notification with the reason. Contact support if you believe this was an error.',
  },
  {
    group: "Buying & safety",
    q: "How do payments work?",
    a: "PaMarket does not process or hold any payments. All payments are arranged directly between the buyer and seller — cash on collection, EcoCash, OneMoney, or bank transfer. Always inspect the item in person before paying, and never send money upfront for something you have not seen.",
  },
  {
    group: "Buying & safety",
    q: "How do I stay safe from scams?",
    a: "Never pay in advance without seeing the item. Avoid sellers who refuse to meet in person or who ask you to pay via gift cards or Western Union. If a deal feels too good to be true, it probably is. Use the in-app Report button to flag suspicious listings immediately.",
  },
  {
    group: "Buying & safety",
    q: "How do I contact a seller?",
    a: 'Tap any listing, then tap "Send Message" to chat in-app, or tap "Call" or "WhatsApp" to contact the seller directly. All messages are stored in your Messages tab so you never lose a conversation.',
  },
  {
    group: "Buying & safety",
    q: "How do I report a listing or block a user?",
    a: 'To report a listing: open the listing and tap the flag icon or scroll to the bottom and tap "Report". To block a user: tap their name on a listing or in Messages, then tap "Block User". Blocked users cannot see your listings or message you.',
  },
  {
    group: "Jobs & account",
    q: "How do I post a job as a company?",
    a: "Your company must be verified before you can post jobs on PaMarket. Go to Post → Jobs and follow the Company Verification steps. You will need your Certificate of Incorporation, Tax Clearance Certificate from ZIMRA, owner ID, and a photo of your premises. Verification takes up to 2 business days.",
  },
  {
    group: "Jobs & account",
    q: "How do I delete my account?",
    a: "Go to Settings → Security → Delete Account. Type DELETE to confirm. Your account, listings, and messages are permanently removed within 30 days. This action cannot be undone — download any data you need before proceeding.",
  },
];

const HELP_GROUPS = ["Getting started", "Managing listings", "Buying & safety", "Jobs & account"];

type Styles = ReturnType<typeof buildStyles>;

function FaqItem({ faq, styles }: { faq: Faq; styles: Styles }) {
  const [open, setOpen] = useState(false);
  return (
    <Pressable style={styles.faqItem} onPress={() => setOpen((o) => !o)}>
      <View style={styles.faqQuestionRow}>
        <Text style={styles.faqQuestion}>{faq.q}</Text>
        <Text style={[styles.faqChevron, open && styles.faqChevronOpen]}>{"⌄"}</Text>
      </View>
      {open ? <Text style={styles.faqAnswer}>{faq.a}</Text> : null}
    </Pressable>
  );
}

export default function HelpScreen() {
  const styles = useThemedStyles(buildStyles);
  const router = useRouter();
  const [legalDoc, setLegalDoc] = useState<LegalDoc | null>(null);
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("All");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return HELP_FAQS.filter((faq) => {
      const matchesGroup = group === "All" || faq.group === group;
      const matchesQuery = !q || (faq.q + " " + faq.a).toLowerCase().includes(q);
      return matchesGroup && matchesQuery;
    });
  }, [query, group]);

  const groupedFiltered = useMemo(() => {
    return HELP_GROUPS.map((g) => ({
      group: g,
      items: filtered.filter((f) => f.group === g),
    })).filter((g) => g.items.length > 0);
  }, [filtered]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={styles.hero}>
        <View style={styles.onlineBadge}>
          <View style={styles.onlineDot} />
          <Text style={styles.onlineText}>Support is online</Text>
        </View>
        <Text style={styles.heroTitle}>What can we help you solve?</Text>
        <Text style={styles.heroSubtitle}>
          Search practical answers about buying, selling, safety and your account.
        </Text>
        <TextInput
          style={styles.search}
          placeholder="Search help articles"
          placeholderTextColor={color.textMuted}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      <View style={styles.humanCard}>
        <Text style={styles.humanTitle}>Need a human?</Text>
        <Text style={styles.humanSubtitle}>Talk to support or send a detailed bug report.</Text>
        <View style={styles.humanActions}>
          <Pressable
            style={[styles.humanButton, styles.humanButtonPrimary]}
            onPress={() => router.push("/report-problem")}
          >
            <Text style={styles.humanButtonPrimaryText}>Talk to a human</Text>
          </Pressable>
          <Pressable style={styles.humanButton} onPress={() => router.push("/report-problem")}>
            <Text style={styles.humanButtonText}>Submit a bug report</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.faqHeadingRow}>
        <Text style={styles.faqHeading}>Popular questions</Text>
        <Text style={styles.faqCount}>
          {filtered.length} {filtered.length === 1 ? "answer" : "answers"}
        </Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
        {["All", ...HELP_GROUPS].map((g) => (
          <Pressable
            key={g}
            style={[styles.filterChip, group === g && styles.filterChipActive]}
            onPress={() => setGroup(g)}
          >
            <Text style={[styles.filterChipText, group === g && styles.filterChipTextActive]}>{g}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {groupedFiltered.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No matching answer yet</Text>
          <Text style={styles.emptySubtitle}>Try a shorter search, or contact the support team.</Text>
        </View>
      ) : (
        groupedFiltered.map(({ group: g, items }) => (
          <View key={g} style={styles.faqGroup}>
            <Text style={styles.faqGroupLabel}>{g}</Text>
            <View style={styles.faqStack}>
              {items.map((faq) => (
                <FaqItem key={faq.q} faq={faq} styles={styles} />
              ))}
            </View>
          </View>
        ))
      )}

      <View style={styles.group}>
        <Row label="Terms of Service" onPress={() => setLegalDoc(TERMS)} styles={styles} />
        <Row label="Privacy Policy" onPress={() => setLegalDoc(PRIVACY)} styles={styles} />
      </View>

      <View style={styles.contactDock}>
        <Pressable style={styles.contactRow} onPress={() => Linking.openURL(WHATSAPP_URL)}>
          <Text style={styles.contactLabel}>WhatsApp</Text>
          <Text style={styles.contactValue}>Usually replies in minutes</Text>
        </Pressable>
        <Pressable style={styles.contactRow} onPress={() => Linking.openURL(EMAIL_URL)}>
          <Text style={styles.contactLabel}>Email</Text>
          <Text style={styles.contactValue}>Send details</Text>
        </Pressable>
        <Pressable style={styles.contactRow} onPress={() => Linking.openURL(PHONE_URL)}>
          <Text style={styles.contactLabel}>Call</Text>
          <Text style={styles.contactValue}>Phone support</Text>
        </Pressable>
      </View>

      <LegalDocSheet doc={legalDoc} visible={legalDoc != null} onClose={() => setLegalDoc(null)} />
    </ScrollView>
  );
}

function Row({ label, onPress, styles }: { label: string; onPress: () => void; styles: Styles }) {
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowChevron}>{"›"}</Text>
    </Pressable>
  );
}

function buildStyles(color: ColorPalette) {
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: color.bg,
  },
  hero: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  onlineBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  onlineDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: color.online,
  },
  onlineText: {
    fontSize: 12,
    fontWeight: "600",
    color: color.success,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: color.text,
    marginBottom: 6,
  },
  heroSubtitle: {
    fontSize: 13,
    color: color.textSub,
    lineHeight: 19,
    marginBottom: 14,
  },
  search: {
    backgroundColor: color.surface,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: color.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: color.text,
  },
  humanCard: {
    backgroundColor: color.brand,
    marginHorizontal: 16,
    marginTop: 18,
    borderRadius: 16,
    padding: 18,
  },
  humanTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: color.textOnBrand,
  },
  humanSubtitle: {
    fontSize: 12.5,
    color: color.textOnBrandSub,
    marginTop: 4,
    marginBottom: 14,
  },
  humanActions: {
    flexDirection: "row",
    gap: 10,
  },
  humanButton: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 10,
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  humanButtonPrimary: {
    backgroundColor: color.surface,
  },
  humanButtonPrimaryText: {
    fontSize: 13,
    fontWeight: "700",
    color: color.brand,
  },
  humanButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: color.textOnBrand,
  },
  faqHeadingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingHorizontal: 16,
    marginTop: 24,
    marginBottom: 10,
  },
  faqHeading: {
    fontSize: 17,
    fontWeight: "800",
    color: color.text,
  },
  faqCount: {
    fontSize: 12,
    color: color.textMuted,
  },
  filterRow: {
    marginBottom: 14,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: color.surface,
    borderWidth: 1.5,
    borderColor: color.border,
  },
  filterChipActive: {
    backgroundColor: color.brand,
    borderColor: color.brand,
  },
  filterChipText: {
    fontSize: 12.5,
    fontWeight: "600",
    color: color.textSub,
  },
  filterChipTextActive: {
    color: color.textOnBrand,
  },
  faqGroup: {
    marginBottom: 18,
  },
  faqGroupLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: color.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  faqStack: {
    backgroundColor: color.surface,
    marginHorizontal: 16,
    borderRadius: 14,
    overflow: "hidden",
  },
  faqItem: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: color.divider,
  },
  faqQuestionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  faqQuestion: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: "600",
    color: color.text,
  },
  faqChevron: {
    fontSize: 16,
    color: color.textMuted,
  },
  faqChevronOpen: {
    color: color.brand,
  },
  faqAnswer: {
    marginTop: 10,
    fontSize: 13,
    color: color.textSub,
    lineHeight: 20,
  },
  emptyState: {
    marginHorizontal: 16,
    padding: 24,
    alignItems: "center",
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: color.text,
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 12.5,
    color: color.textMuted,
    textAlign: "center",
  },
  group: {
    backgroundColor: color.surface,
    marginHorizontal: 16,
    marginTop: 16,
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
    borderBottomColor: color.divider,
  },
  rowLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: color.text,
  },
  rowChevron: {
    fontSize: 18,
    color: color.textMuted,
  },
  contactDock: {
    backgroundColor: color.surface,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 14,
    overflow: "hidden",
  },
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: color.divider,
  },
  contactLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: color.brand,
  },
  contactValue: {
    fontSize: 12,
    color: color.textMuted,
  },
  });
}
