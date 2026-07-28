import { useEffect, useRef } from "react";
import { Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as Notifications from "expo-notifications";
import { Sentry } from "../lib/sentry";
import { AuthProvider, useAuth } from "../lib/auth";
import { ThemeProvider, useThemePreference } from "../lib/theme-provider";
import { ToastHost } from "../components/ui/Toast";
import { AnnouncementModal } from "../components/AnnouncementModal";
import { RatingPromptModal } from "../components/RatingPromptModal";
import { initTelemetry } from "../lib/telemetry";
import { initIAP, teardownIAP } from "../lib/iap";
import { registerForPushNotifications } from "../lib/push";
import { resolveNotifRoute } from "../lib/notifications";
import TwoFactorVerifyScreen from "./two-factor-verify";

// Navigate using the same deep-link mapper the in-app notifications list
// uses, so a push tap (cold start or backgrounded) and an in-app tap always
// land on the same real route — never "page not found". Wrapped in try/catch
// because a malformed/unexpected notification payload must never crash the
// app — worst case is staying on the current screen instead of navigating.
function navigateFromNotificationData(router: ReturnType<typeof useRouter>, data: Record<string, unknown>) {
  try {
    const route = resolveNotifRoute(data as any);
    router.push(route.params ? ({ pathname: route.pathname as any, params: route.params } as any) : (route.pathname as any));
  } catch (e) {
    console.warn("push notification navigation failed:", e);
  }
}

function usePushNotifications() {
  const { session } = useAuth();
  const router = useRouter();
  const registeredForRef = useRef<string | null>(null);

  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId || registeredForRef.current === userId) return;
    registeredForRef.current = userId;
    registerForPushNotifications(userId);
  }, [session?.user?.id]);

  useEffect(() => {
    // Cold start: app opened by tapping a push notification. The root
    // navigator may not have finished mounting yet at this point — calling
    // router.push() synchronously here is a known source of "navigate
    // before mounting the Root Layout" crashes. Deferring to the next tick
    // lets the navigator finish mounting first.
    Notifications.getLastNotificationResponseAsync().then((response) => {
      const data = response?.notification.request.content.data;
      if (data) setTimeout(() => navigateFromNotificationData(router, data), 0);
    });

    // Warm/background: app already running, user taps a push notification.
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      if (data) navigateFromNotificationData(router, data);
    });
    return () => subscription.remove();
  }, [router]);
}

function RootNavigator() {
  const { pendingTwoFactor } = useAuth();
  usePushNotifications();

  if (pendingTwoFactor) {
    return <TwoFactorVerifyScreen />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* The tabs group is a single stack node covering all 5 tabs (Home,
          Search, Post, Messages, Account) — a static title here would show
          on the back button regardless of which tab was actually active
          when the user navigated away (e.g. "Home" showing even when they
          came from Account), which is actively misleading. Empty title
          means a bare chevron with no label, correct from any tab. */}
      <Stack.Screen name="(tabs)" options={{ title: "" }} />
      <Stack.Screen name="(auth)" options={{ title: "Sign In" }} />
      <Stack.Screen name="login-callback" options={{ title: "Sign In" }} />
      <Stack.Screen name="listing/[id]" options={{ headerShown: false, title: "Listing" }} />
      <Stack.Screen name="listing/edit/[id]" options={{ headerShown: true, title: "Edit Listing" }} />
      <Stack.Screen name="business/[id]" options={{ headerShown: false, title: "Shop" }} />
      <Stack.Screen name="business-onboarding" options={{ headerShown: true, title: "Create Business" }} />
      <Stack.Screen name="business-manage/[id]" options={{ headerShown: true, title: "Seller Center" }} />
      <Stack.Screen name="business-edit/[id]" options={{ headerShown: true, title: "Edit Business" }} />
      <Stack.Screen name="business-staff/[id]" options={{ headerShown: true, title: "Staff" }} />
      <Stack.Screen name="profile/[id]" options={{ headerShown: false, title: "Profile" }} />
      <Stack.Screen name="notifications" options={{ headerShown: true, title: "Notifications" }} />
      <Stack.Screen name="chat/[id]" options={{ headerShown: false, title: "Chat" }} />
      <Stack.Screen name="my-listings" options={{ headerShown: true, title: "My Listings" }} />
      <Stack.Screen name="favourites" options={{ headerShown: true, title: "Saved & Favourites" }} />
      <Stack.Screen name="edit-profile" options={{ headerShown: true, title: "Edit Profile" }} />
      <Stack.Screen name="settings" options={{ headerShown: true, title: "Settings" }} />
      <Stack.Screen name="theme-settings" options={{ headerShown: true, title: "Theme" }} />
      <Stack.Screen name="notification-preferences" options={{ headerShown: true, title: "Notifications" }} />
      <Stack.Screen name="privacy-settings" options={{ headerShown: true, title: "Privacy Settings" }} />
      <Stack.Screen name="language-settings" options={{ headerShown: true, title: "Language" }} />
      <Stack.Screen name="blocked-users" options={{ headerShown: true, title: "Blocked Users" }} />
      <Stack.Screen name="my-activity" options={{ headerShown: true, title: "My Activity" }} />
      <Stack.Screen name="saved-searches" options={{ headerShown: true, title: "Saved Searches" }} />
      <Stack.Screen name="about" options={{ headerShown: true, title: "About PaMarket" }} />
      <Stack.Screen name="help" options={{ headerShown: true, title: "Help" }} />
      <Stack.Screen name="legal-hub" options={{ headerShown: true, title: "Legal Hub" }} />
      <Stack.Screen name="legal-doc/[key]" options={{ headerShown: true, title: "" }} />
      <Stack.Screen name="report-problem" options={{ headerShown: false, title: "Report a Problem" }} />
      <Stack.Screen name="jobs/index" options={{ headerShown: false, title: "Jobs" }} />
      <Stack.Screen name="jobs/browse" options={{ headerShown: false, title: "Jobs" }} />
      <Stack.Screen name="jobs/[id]" options={{ headerShown: false, title: "Job" }} />
      <Stack.Screen name="jobs/apply/[id]" options={{ headerShown: false, title: "Apply" }} />
      <Stack.Screen name="jobs/applications" options={{ headerShown: false, title: "My Applications" }} />
      <Stack.Screen name="jobs/cv-profile" options={{ headerShown: false, title: "CV Profile" }} />
      <Stack.Screen name="jobs/post" options={{ headerShown: false, title: "Post a Job" }} />
      <Stack.Screen name="jobs/edit/[id]" options={{ headerShown: false, title: "Edit Job" }} />
      <Stack.Screen name="jobs/hire-talent" options={{ headerShown: false, title: "Hire Talent" }} />
      <Stack.Screen name="jobs/candidate/[id]" options={{ headerShown: false, title: "Candidate" }} />
      <Stack.Screen name="jobs/contact-requests" options={{ headerShown: false, title: "Contact Requests" }} />
      <Stack.Screen name="jobs/recruiter-subscription" options={{ headerShown: false, title: "Subscription" }} />
      <Stack.Screen name="rentals/index" options={{ headerShown: false, title: "Rentals" }} />
      <Stack.Screen name="rentals/[id]" options={{ headerShown: false, title: "Rental" }} />
      <Stack.Screen name="rental-fleet/index" options={{ headerShown: false, title: "Fleet Dashboard" }} />
      <Stack.Screen name="rental-fleet/setup" options={{ headerShown: true, title: "Company Profile" }} />
      <Stack.Screen name="rental-fleet/manage" options={{ headerShown: true, title: "Manage Fleet" }} />
      <Stack.Screen name="rental-fleet/add-vehicle" options={{ headerShown: true, title: "Add Rental Vehicle" }} />
      <Stack.Screen name="rental-fleet/edit-vehicle" options={{ headerShown: true, title: "Edit Vehicle" }} />
      <Stack.Screen name="rental-fleet/availability" options={{ headerShown: true, title: "Availability" }} />
      <Stack.Screen name="rental-fleet/analytics" options={{ headerShown: true, title: "Fleet Analytics" }} />
      <Stack.Screen name="rental-fleet/leads" options={{ headerShown: true, title: "Inquiries" }} />
      <Stack.Screen name="rental-fleet/profile" options={{ headerShown: true, title: "Company Profile" }} />
      <Stack.Screen name="reviews/[id]" options={{ headerShown: false, title: "Reviews" }} />
      <Stack.Screen name="shops/index" options={{ headerShown: false, title: "Shops" }} />
      <Stack.Screen name="two-factor-setup" options={{ headerShown: true, title: "Two-Factor Authentication" }} />
      <Stack.Screen name="change-password" options={{ headerShown: true, title: "Change Password" }} />
      <Stack.Screen name="delete-account" options={{ headerShown: true, title: "Delete Account" }} />
      <Stack.Screen name="active-sessions" options={{ headerShown: true, title: "Active Sessions" }} />
      <Stack.Screen name="business-listings/[id]" options={{ headerShown: true, title: "Listings" }} />
      <Stack.Screen name="business-listings/add/[id]" options={{ headerShown: true, title: "Add Product" }} />
      <Stack.Screen name="business-listings/import/[id]" options={{ headerShown: true, title: "Import Products" }} />
      <Stack.Screen name="business-leads/[id]" options={{ headerShown: true, title: "Leads" }} />
      <Stack.Screen name="business-analytics/[id]" options={{ headerShown: true, title: "Analytics" }} />
      <Stack.Screen name="business-featured/[id]" options={{ headerShown: true, title: "Featured Listings" }} />
      <Stack.Screen name="business-messaging/[id]" options={{ headerShown: true, title: "Quick Replies" }} />
      <Stack.Screen name="business-billing/[id]" options={{ headerShown: true, title: "Billing & Invoices" }} />
      <Stack.Screen name="business-verify/[id]" options={{ headerShown: true, title: "Get Verified" }} />
      <Stack.Screen name="business-subscription/[id]" options={{ headerShown: true, title: "Subscription" }} />
      <Stack.Screen name="verify" options={{ headerShown: true, title: "Verify Identity" }} />
      <Stack.Screen name="company-verify" options={{ headerShown: true, title: "Company Verification" }} />
    </Stack>
  );
}

// Was hardcoded to `style="light"` regardless of theme — invisible white
// icons on the light theme's white/near-white surfaces. Status bar style
// now follows the resolved theme, same as every other native chrome piece.
function ThemedStatusBar() {
  const { resolvedScheme } = useThemePreference();
  return <StatusBar style={resolvedScheme === "dark" ? "light" : "dark"} />;
}

function RootLayout() {
  useEffect(() => initTelemetry(), []);
  useEffect(() => {
    initIAP();
    return () => {
      teardownIAP();
    };
  }, []);

  return (
    <ThemeProvider>
      <AuthProvider>
        <ThemedStatusBar />
        <ToastHost />
        <AnnouncementModal />
        <RatingPromptModal />
        <RootNavigator />
      </AuthProvider>
    </ThemeProvider>
  );
}

export default Sentry.wrap(RootLayout);
