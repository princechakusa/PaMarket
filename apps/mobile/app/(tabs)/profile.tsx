import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path, Polyline } from "react-native-svg";
import { useAuth } from "../../lib/auth";
import { supabase } from "../../lib/supabase";
import { DARK_COLORS, LIGHT_COLORS, font, radius, shadow, space, type ColorPalette } from "../../lib/theme";
import { useThemedStyles, useThemePreference } from "../../lib/theme-provider";
import type { Profile } from "../../lib/profiles";
import { fetchSellerRatingSummary } from "../../lib/sellers";
import { fetchValidSavedCount } from "../../lib/saves";
import { clearPushToken } from "../../lib/push";
import { businessInitials, type Business } from "../../lib/businesses";
import { Avatar, Badge, Card, SectionHeader, VerifiedBadge } from "../../components/ui";
import { BrandWordmark } from "../../components/BrandLogo";
import type { EdgeInsets } from "react-native-safe-area-context";

function ChevronRight({ color }: { color: ColorPalette }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={color.borderStrong} strokeWidth={2.5}>
      <Polyline points="9 18 15 12 9 6" />
    </Svg>
  );
}

function StarIcon({ color }: { color: ColorPalette }) {
  return (
    <Svg width={13} height={13} viewBox="0 0 24 24" fill={color.star} stroke="none">
      <Path d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.8 5.9 20.6l1.4-6.8L2.2 9.1l6.9-.8z" />
    </Svg>
  );
}

function memberSince(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `Member since ${d.toLocaleDateString("en-US", { month: "short", year: "numeric" })}`;
}

function MenuRow({
  label,
  badge,
  last,
  onPress,
  color,
  styles,
}: {
  label: string;
  badge?: number;
  last?: boolean;
  onPress: () => void;
  color: ColorPalette;
  styles: ReturnType<typeof buildStyles>;
}) {
  return (
    <Pressable style={({ pressed }) => [styles.menuRow, !last && styles.menuRowBorder, pressed && styles.rowPressed]} onPress={onPress}>
      <Text style={styles.menuRowLabel}>{label}</Text>
      <View style={styles.menuRowRight}>
        {badge ? (
          <View style={styles.menuBadge}>
            <Text style={styles.menuBadgeText}>{badge}</Text>
          </View>
        ) : null}
        <ChevronRight color={color} />
      </View>
    </Pressable>
  );
}

function BizCard({
  businesses,
  productCount,
  router,
  color,
  styles,
}: {
  businesses: Business[];
  productCount: number;
  router: ReturnType<typeof useRouter>;
  color: ColorPalette;
  styles: ReturnType<typeof buildStyles>;
}) {
  const activeBiz = businesses.find((b) => b.status === "active");
  const pendingBiz = businesses.find((b) => b.status === "pending_activation");
  const draftBiz = businesses.find((b) => b.status === "draft");

  const goToBusiness = () => {
    if (activeBiz) router.push(`/business-manage/${activeBiz.id}`);
    else if (pendingBiz) router.push(`/business-manage/${pendingBiz.id}`);
    else router.push("/business-onboarding");
  };

  if (activeBiz) {
    const plan = ((activeBiz as any).plan_id || "Free") as string;
    const planLabel = plan.charAt(0).toUpperCase() + plan.slice(1);
    return (
      <View style={styles.sidePad}>
        <Pressable onPress={goToBusiness}>
          <Card style={styles.bizRow}>
            <View style={styles.bizLogo}>
              {activeBiz.logo ? (
                <Image source={{ uri: activeBiz.logo }} style={styles.bizLogoImage} contentFit="cover" cachePolicy="memory-disk" />
              ) : (
                <Text style={styles.bizLogoInitial}>{businessInitials(activeBiz.name)}</Text>
              )}
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.bizTitle} numberOfLines={1}>
                {activeBiz.name}
              </Text>
              <Text style={styles.bizSub}>
                {productCount} product{productCount === 1 ? "" : "s"} · {planLabel} plan
              </Text>
            </View>
            <ChevronRight color={color} />
          </Card>
        </Pressable>
      </View>
    );
  }

  const title = pendingBiz ? "Under Review" : draftBiz ? "Finish Business Setup" : "Open a Business";
  const sub = pendingBiz
    ? "Submitted for review. You will be notified once approved."
    : "Create your shop and reach more customers";

  return (
    <View style={styles.sidePad}>
      <Pressable onPress={goToBusiness}>
        <Card style={styles.bizRow}>
          <View style={styles.bizIcon}>
            <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={color.brand} strokeWidth={2}>
              <Path d="M3 9l1.5-5h15L21 9M4 9v10a1 1 0 001 1h14a1 1 0 001-1V9M3 9h18" />
            </Svg>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.bizTitle}>{title}</Text>
            <Text style={styles.bizSub}>{sub}</Text>
          </View>
          <ChevronRight color={color} />
        </Card>
      </Pressable>
    </View>
  );
}

// Mirrors the legacy web app's guestAccountPage() (www/js/app.js): guests
// see a real Account tab, not a hard wall — a sign-in prompt card up top,
// then a menu where only account-specific rows are gated.
function GuestAccountScreen({
  styles,
  color,
  insets,
  router,
}: {
  styles: ReturnType<typeof buildStyles>;
  color: ColorPalette;
  insets: EdgeInsets;
  router: ReturnType<typeof useRouter>;
}) {
  function goToSignIn() {
    router.push({ pathname: "/(auth)/sign-in", params: { message: "Login to continue" } });
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 64 + insets.bottom + space.xxxl }}>
      <View style={[styles.guestHeader, { paddingTop: insets.top + space.xl }]}>
        <BrandWordmark size={22} />
      </View>

      <View style={styles.sidePad}>
        <Card style={styles.guestSignInCard}>
          <Text style={styles.guestSignInTitle}>Login to continue</Text>
          <Pressable style={styles.signInButton} onPress={goToSignIn}>
            <Text style={styles.signInButtonText}>Sign In / Sign Up</Text>
          </Pressable>
        </Card>
      </View>

      <View style={styles.sidePad}>
        <Card padded={false} style={styles.menuGroup}>
          <MenuRow label="My Activity" last onPress={goToSignIn} color={color} styles={styles} />
        </Card>
      </View>

      <View style={styles.sectionSpace}>
        <SectionHeader title="More on PaMarket" />
      </View>
      <View style={styles.sidePad}>
        <Card padded={false} style={styles.menuGroup}>
          <MenuRow label="Advertisements" onPress={goToSignIn} color={color} styles={styles} />
          <MenuRow label="Favourites" onPress={goToSignIn} color={color} styles={styles} />
          <MenuRow label="Saved Searches" onPress={goToSignIn} color={color} styles={styles} />
          <MenuRow label="Find Jobs" onPress={() => router.push("/jobs")} color={color} styles={styles} />
          <MenuRow label="Notification Center" onPress={() => router.push("/notifications")} color={color} styles={styles} />
          <MenuRow label="Language" onPress={() => router.push("/language-settings")} color={color} styles={styles} />
          <MenuRow label="Help & Support" onPress={() => router.push("/help")} color={color} styles={styles} />
          <MenuRow label="About Us" onPress={() => router.push("/about")} color={color} styles={styles} />
          <MenuRow label="Privacy Policy" onPress={() => router.push("/legal-hub")} color={color} styles={styles} />
          <MenuRow label="Legal Hub" last onPress={() => router.push("/legal-hub")} color={color} styles={styles} />
        </Card>
      </View>

      <Text style={styles.footer}>© {new Date().getFullYear()} PaMarket Zimbabwe · Made in Zimbabwe</Text>
    </ScrollView>
  );
}

export default function AccountScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const styles = useThemedStyles(buildStyles);
  const { resolvedScheme } = useThemePreference();
  const color = resolvedScheme === "dark" ? DARK_COLORS : LIGHT_COLORS;
  const [profile, setProfile] = useState<Profile | null>(null);
  const [activeCount, setActiveCount] = useState(0);
  const [savedCount, setSavedCount] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [applicationsCount, setApplicationsCount] = useState(0);
  const [reviewCount, setReviewCount] = useState(0);
  const [rating, setRating] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [bizProductCount, setBizProductCount] = useState(0);
  const [companyVerified, setCompanyVerified] = useState(false);

  const load = useCallback(async () => {
    if (!session?.user) return;
    const myId = session.user.id;
    // Unread-messages is handled entirely by the useFocusEffect below (it
    // also fires on this same initial mount) -- fetching it here too fired
    // the same count query twice back to back on every first visit.
    const [profileRes, activeRes, bizRes, applicationsRes, ratingSummary, savedCountRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("id,name,email,phone,avatar,verified,bio,city,created_at,company_verified")
        .eq("id", myId)
        .maybeSingle(),
      supabase.from("listings").select("id", { count: "exact", head: true }).eq("seller_id", myId).eq("status", "active"),
      supabase.from("businesses").select("*").eq("owner_user_id", myId),
      supabase.from("applications").select("id", { count: "exact", head: true }).eq("applicant_id", myId),
      fetchSellerRatingSummary(myId),
      fetchValidSavedCount(myId),
    ]);
    if (profileRes.data) setProfile(profileRes.data as Profile);
    setCompanyVerified(!!(profileRes.data as any)?.company_verified);
    setActiveCount(activeRes.count ?? 0);
    setApplicationsCount(applicationsRes.count ?? 0);
    setSavedCount(savedCountRes);

    setReviewCount(ratingSummary.count);
    setRating(ratingSummary.average);

    const biz = (bizRes.data as Business[] | null) ?? [];
    setBusinesses(biz);
    const activeBiz = biz.find((b) => b.status === "active");
    if (activeBiz) {
      const { count } = await supabase
        .from("listings")
        .select("id", { count: "exact", head: true })
        .eq("business_id", activeBiz.id)
        .eq("status", "active");
      setBizProductCount(count ?? 0);
    } else {
      setBizProductCount(0);
    }
  }, [session]);

  useEffect(() => {
    setIsLoading(true);
    load().finally(() => setIsLoading(false));
  }, [load]);

  // The unread-messages stat was only ever fetched once on mount — reading
  // your messages elsewhere and coming back to Profile left this stat
  // showing a stale count. Refresh just this lightweight count on every
  // focus instead of re-running the full profile load.
  useFocusEffect(
    useCallback(() => {
      if (!session?.user) return;
      supabase
        .rpc("get_unread_message_count")
        .then(({ data }) => setUnreadMessages(data ?? 0), () => {});
    }, [session])
  );

  async function onRefresh() {
    setIsRefreshing(true);
    await load();
    setIsRefreshing(false);
  }

  function signOut() {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          const userId = session?.user?.id;
          if (userId) await clearPushToken(userId);
          await supabase.auth.signOut();
        },
      },
    ]);
  }

  if (!session?.user) {
    return <GuestAccountScreen styles={styles} color={color} insets={insets} router={router} />;
  }

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={color.brand} />
      </View>
    );
  }

  const location = profile?.city?.trim();
  const since = memberSince(profile?.created_at);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 64 + insets.bottom + space.xxxl }}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
    >
      {/* Brand-tinted profile header */}
      <View style={[styles.hero, { paddingTop: insets.top + space.xl }]}>
        <Pressable style={[styles.gear, { top: insets.top + space.sm }]} onPress={() => router.push("/settings")} hitSlop={10}>
          <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={color.textOnBrandSub} strokeWidth={2}>
            <Path d="M12 15a3 3 0 100-6 3 3 0 000 6z" />
            <Path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 008 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H2a2 2 0 110-4h.09A1.65 1.65 0 004.6 8a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V2a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H22a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z" />
          </Svg>
        </Pressable>

        <Avatar uri={profile?.avatar} name={profile?.name} size={84} ring />
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>
            {profile?.name || "PaMarket User"}
          </Text>
          {profile?.verified ? <VerifiedBadge compact /> : null}
        </View>
        <Text style={styles.email} numberOfLines={1}>
          {profile?.email ?? session.user.email}
        </Text>

        <View style={styles.metaRow}>
          {reviewCount > 0 ? (
            <View style={styles.metaChip}>
              <StarIcon color={color} />
              <Text style={styles.metaText}>
                {rating.toFixed(1)} ({reviewCount})
              </Text>
            </View>
          ) : null}
          {location ? (
            <View style={styles.metaChip}>
              <Svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke={color.textOnBrandSub} strokeWidth={2}>
                <Path d="M12 21s-7-6.3-7-11a7 7 0 1114 0c0 4.7-7 11-7 11z" />
                <Path d="M12 12a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
              </Svg>
              <Text style={styles.metaText}>{location}</Text>
            </View>
          ) : null}
        </View>
        {since ? <Text style={styles.since}>{since}</Text> : null}
      </View>

      {/* Stat row */}
      <View style={styles.statsRow}>
        <Pressable style={[styles.statBox, shadow.sm]} onPress={() => router.push("/my-listings")}>
          <Text style={styles.statValue}>{activeCount}</Text>
          <Text style={styles.statLabel}>Active Ads</Text>
        </Pressable>
        <Pressable style={[styles.statBox, shadow.sm]} onPress={() => router.push("/favourites")}>
          <Text style={styles.statValue}>{savedCount}</Text>
          <Text style={styles.statLabel}>Saved</Text>
        </Pressable>
        <Pressable style={[styles.statBox, shadow.sm]} onPress={() => router.push("/(tabs)/messages")}>
          <Text style={styles.statValue}>{unreadMessages}</Text>
          <Text style={styles.statLabel}>Messages</Text>
        </Pressable>
      </View>

      <View style={styles.sectionSpace}>
        <SectionHeader title="My Business" />
      </View>
      <BizCard businesses={businesses} productCount={bizProductCount} router={router} color={color} styles={styles} />
      {businesses.length ? (
        <View style={[styles.sidePad, { marginTop: space.sm }]}>
          <Card padded={false} style={styles.menuGroup}>
            <MenuRow label="My Rental Fleet" last onPress={() => router.push("/rental-fleet")}  color={color} styles={styles} />
          </Card>
        </View>
      ) : null}

      <View style={styles.sectionSpace}>
        <SectionHeader title="Selling" />
      </View>
      <View style={styles.sidePad}>
        <Card padded={false} style={styles.menuGroup}>
          <MenuRow label="My Listings" badge={activeCount || undefined} onPress={() => router.push("/my-listings")}  color={color} styles={styles} />
          <MenuRow label="Browse Rentals" onPress={() => router.push("/rentals")}  color={color} styles={styles} />
          <MenuRow label="Saved & Favourites" badge={savedCount || undefined} onPress={() => router.push("/favourites")}  color={color} styles={styles} />
          <MenuRow label="Saved Searches" last onPress={() => router.push("/saved-searches")}  color={color} styles={styles} />
        </Card>
      </View>

      <View style={styles.sectionSpace}>
        <SectionHeader title="Jobs" />
      </View>
      <View style={styles.sidePad}>
        <Card padded={false} style={styles.menuGroup}>
          <MenuRow
            label="My Applications"
            badge={applicationsCount || undefined}
            onPress={() => router.push("/jobs/applications")}
           color={color} styles={styles} />
          <MenuRow label="My Job Profile / CV" onPress={() => router.push("/jobs/cv-profile")}  color={color} styles={styles} />
          {companyVerified ? (
            <>
              <MenuRow label="Post a Job" onPress={() => router.push("/jobs/post")}  color={color} styles={styles} />
              <MenuRow label="Hire Talent" onPress={() => router.push("/jobs/hire-talent")}  color={color} styles={styles} />
              <MenuRow label="My Contact Requests" onPress={() => router.push("/jobs/contact-requests")}  color={color} styles={styles} />
              <MenuRow label="Recruiter Plan" last onPress={() => router.push("/jobs/recruiter-subscription")}  color={color} styles={styles} />
            </>
          ) : (
            <MenuRow label="Post a Job (Get Verified)" last onPress={() => router.push("/company-verify")}  color={color} styles={styles} />
          )}
        </Card>
      </View>

      <View style={styles.sectionSpace}>
        <SectionHeader title="Account" />
      </View>
      <View style={styles.sidePad}>
        <Card padded={false} style={styles.menuGroup}>
          <MenuRow label="My Profile" onPress={() => router.push(`/profile/${session.user.id}`)}  color={color} styles={styles} />
          <MenuRow label="Edit Profile" onPress={() => router.push("/edit-profile")}  color={color} styles={styles} />
          <MenuRow label="Verify Identity" onPress={() => router.push("/verify")}  color={color} styles={styles} />
          <MenuRow label="My Activity" last onPress={() => router.push("/my-activity")}  color={color} styles={styles} />
        </Card>
      </View>

      <View style={styles.sectionSpace}>
        <SectionHeader title="More" />
      </View>
      <View style={styles.sidePad}>
        <Card padded={false} style={styles.menuGroup}>
          <MenuRow label="Notifications" onPress={() => router.push("/notifications")}  color={color} styles={styles} />
          <MenuRow label="Settings" onPress={() => router.push("/settings")}  color={color} styles={styles} />
          <MenuRow label="Security & Password" onPress={() => router.push("/change-password")}  color={color} styles={styles} />
          <MenuRow label="Help & Support" onPress={() => router.push("/help")}  color={color} styles={styles} />
          <MenuRow label="Legal Hub" last onPress={() => router.push("/legal-hub")}  color={color} styles={styles} />
        </Card>
      </View>

      <View style={styles.sidePad}>
        <Pressable style={styles.signOutButton} onPress={signOut}>
          <Text style={styles.signOutButtonText}>Sign Out</Text>
        </Pressable>
      </View>

      <Text style={styles.footer}>
        © {new Date().getFullYear()} PaMarket Zimbabwe · Made in Zimbabwe
      </Text>
    </ScrollView>
  );
}

function buildStyles(color: ColorPalette) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: color.bg },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: space.xxxl, backgroundColor: color.bg },
  signInTitle: { ...font.title, color: color.text, marginBottom: space.lg },
  signInButton: {
    backgroundColor: color.brand,
    borderRadius: radius.md,
    paddingHorizontal: space.xxl,
    paddingVertical: space.md,
  },
  signInButtonText: { ...font.bodyStrong, color: color.textOnBrand },

  guestHeader: {
    alignItems: "center",
    paddingBottom: space.xl,
  },
  guestSignInCard: {
    alignItems: "center",
    gap: space.md,
  },
  guestSignInTitle: { ...font.bodyStrong, color: color.text },

  hero: {
    alignItems: "center",
    backgroundColor: color.brand,
    paddingHorizontal: space.lg,
    paddingBottom: space.xxxl + space.lg,
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
  },
  // top is set inline with insets.top — do not rely on the parent hero's
  // paddingTop alone for absolutely-positioned children; RN's containing-block
  // behavior for `position: absolute` here previously left this sitting at the
  // very top edge on some devices, colliding with the status bar / battery icon.
  gear: { position: "absolute", right: space.lg, padding: space.sm },
  nameRow: { flexDirection: "row", alignItems: "center", gap: space.sm, marginTop: space.md },
  name: { ...font.h2, color: color.textOnBrand, maxWidth: 260 },
  email: { ...font.sub, color: color.textOnBrandSub, marginTop: 2 },
  metaRow: { flexDirection: "row", gap: space.sm, marginTop: space.md, flexWrap: "wrap", justifyContent: "center" },
  metaChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(255,255,255,0.14)",
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: 5,
  },
  metaText: { ...font.caption, color: color.textOnBrand },
  since: { ...font.caption, color: color.textOnBrandSub, marginTop: space.sm },

  statsRow: {
    flexDirection: "row",
    gap: space.md,
    paddingHorizontal: space.lg,
    marginTop: -space.xxl,
  },
  statBox: {
    flex: 1,
    backgroundColor: color.surface,
    borderRadius: radius.lg,
    paddingVertical: space.lg,
    alignItems: "center",
  },
  statValue: { ...font.h2, color: color.text },
  statLabel: { ...font.caption, color: color.textMuted, marginTop: 2 },

  sectionSpace: { marginTop: space.xxl, marginBottom: space.xs },
  sidePad: { paddingHorizontal: space.lg },

  menuGroup: { overflow: "hidden" },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: space.lg,
    paddingVertical: space.lg,
  },
  menuRowBorder: { borderBottomWidth: 1, borderBottomColor: color.divider },
  rowPressed: { backgroundColor: color.surfaceAlt },
  menuRowLabel: { ...font.body, fontWeight: "600", color: color.text },
  menuRowRight: { flexDirection: "row", alignItems: "center", gap: space.sm },
  menuBadge: {
    backgroundColor: color.brand,
    borderRadius: radius.pill,
    minWidth: 20,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignItems: "center",
  },
  menuBadgeText: { ...font.micro, color: color.textOnBrand },

  bizRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  bizLogo: {
    width: 46,
    height: 46,
    borderRadius: radius.md,
    backgroundColor: color.brand,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  bizLogoImage: { width: "100%", height: "100%" },
  bizLogoInitial: { ...font.title, color: color.textOnBrand },
  bizIcon: {
    width: 46,
    height: 46,
    borderRadius: radius.md,
    backgroundColor: color.brandTint,
    alignItems: "center",
    justifyContent: "center",
  },
  bizTitle: { ...font.bodyStrong, color: color.text },
  bizSub: { ...font.sub, color: color.textMuted, marginTop: 2 },

  signOutButton: {
    marginTop: space.xxl,
    paddingVertical: space.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.dangerTint,
    backgroundColor: color.surface,
    alignItems: "center",
  },
  signOutButtonText: { ...font.bodyStrong, color: color.danger },
  footer: { textAlign: "center", ...font.caption, color: color.textMuted, marginTop: space.xl },
  });
}
