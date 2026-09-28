// Invite Friends — "invite a friend, get a free boost". A friend who joins
// with your code and posts their first ad earns you a free 7-day boost
// (supabase/migrations/20260928140000_referrals.sql). Rewards are applied to
// any of your own active listings from this screen.
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "../lib/keyboard";
import { useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { SITE_ORIGIN } from "../lib/site-urls";
import { openExternalUrl } from "../lib/open-url";
import { Button, Card, EmptyState, toast } from "../components/ui";
import { font, radius, space, type ColorPalette } from "../lib/theme";
import { useThemedStyles } from "../lib/theme-provider";

type Summary = {
  joined: number;
  qualified: number;
  rewards_available: number;
  rewards_used: number;
  invited_by_code: string | null;
  can_claim: boolean;
};

type MyListing = { id: string; title: string; featured_until: string | null };

export function inviteLink(code: string): string {
  return `${SITE_ORIGIN}/download?ref=${encodeURIComponent(code)}`;
}

function inviteMessage(code: string): string {
  return (
    "Join me on PaMarket, Zimbabwe's marketplace. Buy and sell anything, find jobs and rentals, free to post.\n\n" +
    `Use my invite code ${code} when you sign up:\n${inviteLink(code)}`
  );
}

export default function InviteScreen() {
  const styles = useThemedStyles(buildStyles);
  const tones = useThemedStyles((c: ColorPalette) => ({ brand: c.brand }));
  const router = useRouter();
  const { session } = useAuth();
  const [code, setCode] = useState<string | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [claimInput, setClaimInput] = useState("");
  const [claiming, setClaiming] = useState(false);
  const [listings, setListings] = useState<MyListing[]>([]);
  const [redeemingId, setRedeemingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session?.user) return;
    const [codeRes, sumRes] = await Promise.all([
      supabase.rpc("get_my_referral_code"),
      supabase.rpc("my_referral_summary"),
    ]);
    // A database that hasn't run the referrals migration yet → friendly
    // "coming soon" instead of a broken screen.
    if (codeRes.error || sumRes.error) {
      setUnavailable(true);
      return;
    }
    setCode(codeRes.data as string);
    const s = sumRes.data as Summary;
    setSummary(s);
    if (s.rewards_available > 0) {
      const { data } = await supabase
        .from("listings")
        .select("id,title,featured_until")
        .eq("seller_id", session.user.id)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(50);
      setListings((data as MyListing[]) ?? []);
    }
  }, [session?.user]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  if (!session?.user) {
    return (
      <View style={styles.center}>
        <EmptyState title="Sign in to invite friends" subtitle="Get a free boost for every friend who joins and posts an ad." />
        <View style={{ marginTop: space.lg, alignSelf: "stretch" }}>
          <Button label="Sign in" onPress={() => router.push("/(auth)/sign-in")} />
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={tones.brand} />
      </View>
    );
  }

  if (unavailable || !code || !summary) {
    return (
      <View style={styles.center}>
        <EmptyState title="Invites are coming soon" subtitle="Check back shortly to invite friends and earn free boosts." />
      </View>
    );
  }

  async function copyCode() {
    await Clipboard.setStringAsync(code!);
    toast("Invite code copied.");
  }

  async function inviteOnWhatsApp() {
    const opened = await openExternalUrl(`https://wa.me/?text=${encodeURIComponent(inviteMessage(code!))}`, "WhatsApp isn't installed on this device.");
    if (!opened) await shareInvite();
  }

  async function shareInvite() {
    try {
      await Share.share({ message: inviteMessage(code!) });
    } catch {
      // cancelled
    }
  }

  async function claim() {
    const value = claimInput.trim();
    if (value.length < 4) return;
    setClaiming(true);
    const { data, error } = await supabase.rpc("claim_referral", { p_code: value });
    setClaiming(false);
    const result = data as { ok?: boolean; code?: string } | null;
    if (error || !result?.ok) {
      const reason = result?.code;
      toast(
        reason === "invalid_code"
          ? "That invite code doesn't exist. Check it and try again."
          : reason === "self_referral"
            ? "You can't use your own invite code."
            : reason === "too_late"
              ? "Invite codes can only be added in your first 14 days."
              : reason === "already_linked"
                ? "You've already used an invite code."
                : "Could not add that code. Please try again.",
        4500,
        true
      );
      return;
    }
    toast("Invite code added. Your friend gets a free boost when you post your first ad.");
    setClaimInput("");
    void load();
  }

  async function redeem(listingId: string) {
    setRedeemingId(listingId);
    const { data, error } = await supabase.rpc("redeem_referral_boost", { p_listing_id: listingId });
    setRedeemingId(null);
    const result = data as { ok?: boolean; code?: string } | null;
    if (error || !result?.ok) {
      toast(result?.code === "listing_unavailable" ? "That ad isn't active any more." : "Could not apply the boost. Please try again.", 4000, true);
      return;
    }
    toast("Boost applied. Your ad is featured for 7 days.");
    void load();
  }

  return (
    <KeyboardAwareScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>Invite friends, get free boosts</Text>
        <Text style={styles.heroSub}>
          When a friend joins with your code and posts their first ad, you get a free 7-day boost for any of your ads.
        </Text>
        <Pressable style={styles.codeBox} onPress={() => void copyCode()} accessibilityRole="button" accessibilityLabel={`Your invite code ${code}. Tap to copy.`}>
          <Text style={styles.codeLabel}>YOUR INVITE CODE</Text>
          <Text style={styles.code}>{code}</Text>
          <Text style={styles.codeHint}>Tap to copy</Text>
        </Pressable>
        <View style={styles.heroActions}>
          <Button label="Invite on WhatsApp" variant="gold" onPress={() => void inviteOnWhatsApp()} />
          <Button label="More ways to share" variant="ghost" onPress={() => void shareInvite()} />
        </View>
      </View>

      <View style={styles.stats}>
        <Stat value={summary.joined} label="Joined" styles={styles} />
        <Stat value={summary.qualified} label="Posted an ad" styles={styles} />
        <Stat value={summary.rewards_available} label="Boosts to use" styles={styles} />
      </View>

      {summary.rewards_available > 0 ? (
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Use your free boost</Text>
          <Text style={styles.sectionSub}>Pick an ad to feature for 7 days.</Text>
          {listings.length === 0 ? (
            <Text style={styles.sectionSub}>You have no active ads yet. Post one, then come back to boost it.</Text>
          ) : (
            listings.map((l) => (
              <View key={l.id} style={styles.listingRow}>
                <Text style={styles.listingTitle} numberOfLines={1}>
                  {l.title}
                </Text>
                <Button
                  label="Boost"
                  size="sm"
                  fullWidth={false}
                  loading={redeemingId === l.id}
                  disabled={!!redeemingId}
                  onPress={() => void redeem(l.id)}
                />
              </View>
            ))
          )}
        </Card>
      ) : null}

      {summary.can_claim ? (
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Were you invited?</Text>
          <Text style={styles.sectionSub}>Enter your friend's code so they get their reward.</Text>
          <View style={styles.claimRow}>
            <TextInput
              style={styles.claimInput}
              value={claimInput}
              onChangeText={(t) => setClaimInput(t.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
              placeholder="e.g. TAN7K2M"
              autoCapitalize="characters"
              maxLength={12}
              accessibilityLabel="Friend's invite code"
            />
            <Button label="Add" fullWidth={false} loading={claiming} onPress={() => void claim()} />
          </View>
        </Card>
      ) : summary.invited_by_code ? (
        <Text style={styles.footnote}>You joined with invite code {summary.invited_by_code}.</Text>
      ) : null}

      <Text style={styles.footnote}>
        Up to 10 rewards every 30 days. Rewards are only earned when an invited friend posts a real ad.
      </Text>
    </KeyboardAwareScrollView>
  );
}

function Stat({ value, label, styles }: { value: number; label: string; styles: ReturnType<typeof buildStyles> }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function buildStyles(color: ColorPalette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: color.bg },
    scroll: { padding: space.lg, paddingBottom: space.huge },
    center: { flex: 1, alignItems: "center", justifyContent: "center", padding: space.xl, backgroundColor: color.bg },
    hero: { backgroundColor: color.brand, borderRadius: radius.xl, padding: space.xl },
    heroTitle: { ...font.h2, color: color.textOnBrand },
    heroSub: { ...font.sub, color: color.textOnBrandSub, marginTop: space.xs },
    codeBox: {
      marginTop: space.lg,
      backgroundColor: "rgba(255,255,255,0.12)",
      borderRadius: radius.lg,
      borderWidth: 1,
      borderStyle: "dashed",
      borderColor: "rgba(255,255,255,0.5)",
      padding: space.lg,
      alignItems: "center",
    },
    codeLabel: { ...font.micro, color: color.textOnBrandSub },
    code: { fontSize: 30, fontWeight: "900", letterSpacing: 4, color: color.gold, marginTop: space.xs },
    codeHint: { ...font.caption, color: color.textOnBrandSub, marginTop: space.xs },
    heroActions: { marginTop: space.lg, gap: space.sm },
    stats: { flexDirection: "row", gap: space.sm, marginTop: space.lg },
    stat: { flex: 1, backgroundColor: color.surface, borderRadius: radius.lg, padding: space.md, alignItems: "center" },
    statValue: { ...font.h2, color: color.text },
    statLabel: { ...font.caption, color: color.textSub, textAlign: "center" },
    section: { marginTop: space.lg },
    sectionTitle: { ...font.title, color: color.text },
    sectionSub: { ...font.sub, color: color.textSub, marginTop: 2, marginBottom: space.sm },
    listingRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: space.md,
      paddingVertical: space.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: color.border,
    },
    listingTitle: { ...font.body, color: color.text, flex: 1 },
    claimRow: { flexDirection: "row", gap: space.sm, alignItems: "center" },
    claimInput: {
      flex: 1,
      height: 46,
      borderWidth: 1,
      borderColor: color.borderStrong,
      borderRadius: radius.md,
      paddingHorizontal: space.md,
      ...font.bodyStrong,
      letterSpacing: 2,
      color: color.text,
      backgroundColor: color.surface,
    },
    footnote: { ...font.caption, color: color.textMuted, textAlign: "center", marginTop: space.lg },
  });
}
