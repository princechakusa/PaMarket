import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import Svg, { Path, Polyline } from "react-native-svg";
import { DARK_COLORS, LIGHT_COLORS, font, radius, shadow, space, type ColorPalette } from "../lib/theme";
import { useThemedStyles, useThemePreference } from "../lib/theme-provider";
import { Card } from "../components/ui";

const SUPPORT_EMAIL = "support@pamarketzw.com";
const SUPPORT_PHONE = "+971589772645";
const WHATSAPP = "https://wa.me/971589772645";

const SOCIALS: { name: string; url: string }[] = [
  { name: "TikTok", url: "https://www.tiktok.com/@pamarketzimbabwe" },
  { name: "Facebook", url: "https://www.facebook.com/profile.php?id=61591000371129" },
  { name: "Instagram", url: "https://www.instagram.com/pamarketzim/" },
  { name: "YouTube", url: "https://www.youtube.com/@PaMarketZim" },
];

function Chevron({ color }: { color: ColorPalette }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={color.textMuted} strokeWidth={2.2}>
      <Polyline points="9 18 15 12 9 6" />
    </Svg>
  );
}

function LinkRow({
  label,
  onPress,
  color,
  styles,
}: {
  label: string;
  onPress: () => void;
  color: ColorPalette;
  styles: ReturnType<typeof buildStyles>;
}) {
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Chevron color={color} />
    </Pressable>
  );
}

export default function AboutScreen() {
  const router = useRouter();
  const version = Constants.expoConfig?.version ?? "1.29.0";
  const buildNumber = Constants.expoConfig?.android?.versionCode ?? Constants.expoConfig?.ios?.buildNumber ?? null;
  const styles = useThemedStyles(buildStyles);
  const { resolvedScheme } = useThemePreference();
  const color = resolvedScheme === "dark" ? DARK_COLORS : LIGHT_COLORS;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: space.lg, paddingBottom: space.huge }}>
      <View style={styles.hero}>
        <View style={styles.logoMark}>
          <Text style={styles.logoText}>
            Pa<Text style={styles.logoAccent}>M</Text>
          </Text>
        </View>
        <Text style={styles.brand}>
          Pa<Text style={styles.brandAccent}>Market</Text>
        </Text>
        <Text style={styles.tagline}>Zimbabwe's marketplace — buy, sell, hire, and rent.</Text>
        <Text style={styles.version}>
          Version {version}
          {buildNumber ? ` (Build ${buildNumber})` : ""}
        </Text>
      </View>

      <Card style={{ marginTop: space.xl }}>
        <Text style={styles.sectionTitle}>About PaMarket</Text>
        <Text style={styles.body}>
          PaMarket connects buyers and sellers across Zimbabwe — from cars, property and electronics to jobs, services
          and rentals. Post a free ad in minutes, chat directly with sellers, and find verified businesses you can
          trust. Built in Zimbabwe, for Zimbabwe.
        </Text>
      </Card>

      <Text style={styles.groupLabel}>Legal</Text>
      <Card padded={false} style={styles.group}>
        <LinkRow label="Terms of Use" onPress={() => router.push({ pathname: "/legal-doc/[key]", params: { key: "terms_of_use" } })} color={color} styles={styles} />
        <View style={styles.divider} />
        <LinkRow label="Privacy Policy" onPress={() => router.push({ pathname: "/legal-doc/[key]", params: { key: "privacy_policy" } })} color={color} styles={styles} />
        <View style={styles.divider} />
        <LinkRow label="Community Guidelines" onPress={() => router.push({ pathname: "/legal-doc/[key]", params: { key: "community_guidelines" } })} color={color} styles={styles} />
        <View style={styles.divider} />
        <LinkRow label="Legal Hub" onPress={() => router.push("/legal-hub")} color={color} styles={styles} />
      </Card>

      <Text style={styles.groupLabel}>Contact & Support</Text>
      <Card padded={false} style={styles.group}>
        <LinkRow label="Help Centre" onPress={() => router.push("/help")} color={color} styles={styles} />
        <View style={styles.divider} />
        <LinkRow label="Email us" onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)} color={color} styles={styles} />
        <View style={styles.divider} />
        <LinkRow label="WhatsApp" onPress={() => Linking.openURL(WHATSAPP)} color={color} styles={styles} />
        <View style={styles.divider} />
        <LinkRow label="Call support" onPress={() => Linking.openURL(`tel:${SUPPORT_PHONE}`)} color={color} styles={styles} />
      </Card>

      <Text style={styles.groupLabel}>Follow us</Text>
      <Card padded={false} style={styles.group}>
        {SOCIALS.map((s, i) => (
          <View key={s.name}>
            {i > 0 ? <View style={styles.divider} /> : null}
            <LinkRow label={s.name} onPress={() => Linking.openURL(s.url)} color={color} styles={styles} />
          </View>
        ))}
      </Card>

      <View style={styles.footer}>
        <Text style={styles.footerText}>© {new Date().getFullYear()} PaMarket Zimbabwe</Text>
        <Text style={styles.footerText}>All rights reserved · Made in Zimbabwe</Text>
      </View>
    </ScrollView>
  );
}

function buildStyles(color: ColorPalette) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: color.bg },
  hero: { alignItems: "center", paddingVertical: space.xl },
  logoMark: {
    width: 72,
    height: 72,
    borderRadius: radius.xl,
    backgroundColor: color.brand,
    alignItems: "center",
    justifyContent: "center",
    ...shadow.md,
  },
  logoText: { fontSize: 32, fontWeight: "900", color: color.textOnBrand },
  logoAccent: { color: color.gold },
  brand: { fontSize: 24, fontWeight: "900", color: color.text, marginTop: space.md, letterSpacing: -0.5 },
  brandAccent: { color: color.gold },
  tagline: { ...font.sub, color: color.textMuted, marginTop: space.xs, textAlign: "center" },
  version: { ...font.caption, color: color.textMuted, marginTop: space.sm },
  sectionTitle: { ...font.title, color: color.text, marginBottom: space.sm },
  body: { ...font.body, color: color.textSub, lineHeight: 22 },
  groupLabel: {
    ...font.micro,
    color: color.textMuted,
    textTransform: "uppercase",
    marginTop: space.xl,
    marginBottom: space.sm,
    marginLeft: space.xs,
  },
  group: { overflow: "hidden" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: space.lg,
    paddingVertical: space.lg,
  },
  rowLabel: { ...font.body, color: color.text, fontWeight: "600" },
  divider: { height: 1, backgroundColor: color.divider, marginLeft: space.lg },
  footer: { alignItems: "center", marginTop: space.xxxl, gap: 2 },
  footerText: { ...font.caption, color: color.textMuted },
  });
}
