// Sentry.init() (in lib/sentry.ts) must run before any other import that has
// its own module-level side effects — ES module imports execute top-to-bottom
// in file order, so this is the earliest point in the whole app where JS
// runs at all. Build 9/10's cold-launch crash (an uncaught native TurboModule
// exception, SIGABRT within ~1s of process launch) went unreported to Sentry
// even after the upload pipeline was fixed, because Sentry's native crash
// handler only installs when JS calls Sentry.init() (it's itself a native
// module method) — every millisecond this import sat below other modules'
// side effects was a chance for the crash to fire before Sentry could catch
// it.
import { Sentry } from "../lib/sentry";
import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import { Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as Notifications from "expo-notifications";
import messaging from "@react-native-firebase/messaging";
import * as SplashScreen from "expo-splash-screen";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { AuthProvider, useAuth } from "../lib/auth";
import { ThemeProvider, useThemePreference, useThemedStyles } from "../lib/theme-provider";
import { ToastHost } from "../components/ui/Toast";
import { AnnouncementModal } from "../components/AnnouncementModal";
import { RatingPromptModal } from "../components/RatingPromptModal";
import { initTelemetry } from "../lib/telemetry";
import { initIAP, teardownIAP } from "../lib/iap";
import { registerForPushNotifications } from "../lib/push";
import { resolveNotifRoute } from "../lib/notifications";
import { diagStart, diagOk, diagFail, STARTUP_FLAGS } from "../lib/startup-diag";
import TwoFactorVerifyScreen from "./two-factor-verify";

// Nothing was ever calling SplashScreen.hideAsync() — the native splash's
// pre-draw listener kept returning `false` on every single frame
// indefinitely (visible in logcat as endless "onPreDraw return false
// SplashScreenManager" lines), which is exactly what was making the app
// feel stuck/slow to open: the real UI was ready long before the splash
// let it paint. preventAutoHideAsync() must run at import time, before any
// component mounts, or the OS may already have auto-hidden (or failed to
// hide) the splash before our own hideAsync() call below ever runs.
SplashScreen.preventAutoHideAsync().catch(() => {});

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
    if (!STARTUP_FLAGS.pushRegistrationEnabled) {
      console.log("SKIP push-registration (diagnostic flag)");
      return;
    }
    diagStart("push-registration");
    registerForPushNotifications(userId)
      .then(() => diagOk("push-registration"))
      .catch((error) => diagFail("push-registration", error));
  }, [session?.user?.id]);

  useEffect(() => {
    if (!STARTUP_FLAGS.expoNotificationsEnabled) {
      console.log("SKIP expo-notifications-listeners (diagnostic flag)");
      return;
    }
    diagStart("expo-notifications-listeners");
    // Cold start: app opened by tapping a push notification. The root
    // navigator may not have finished mounting yet at this point — calling
    // router.push() synchronously here is a known source of "navigate
    // before mounting the Root Layout" crashes. Deferring to the next tick
    // lets the navigator finish mounting first.
    Notifications.getLastNotificationResponseAsync().then((response) => {
      const data = response?.notification.request.content.data;
      if (data) setTimeout(() => navigateFromNotificationData(router, data), 0);
    }).catch((error) => diagFail("expo-notifications-listeners:getLastNotificationResponseAsync", error));

    // Warm/background: app already running, user taps a push notification.
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      if (data) navigateFromNotificationData(router, data);
    });
    diagOk("expo-notifications-listeners");

    // iOS-only: @react-native-firebase/messaging and expo-notifications both
    // try to become UNUserNotificationCenterDelegate on iOS, and only one
    // wins — so the listener above can silently stop receiving tap events
    // for the FCM-delivered pushes lib/push.ts registers for (this app uses
    // native FCM tokens, not Expo's push service). RNFB's own tap-detection
    // APIs work independently of that delegate, so they're the reliable
    // path on iOS. Android's intent-based handling isn't affected by this
    // conflict, so the listener above already covers it there.
    let unsubscribeOnOpen: (() => void) | undefined;
    if (Platform.OS === "ios" && STARTUP_FLAGS.firebaseMessagingEnabled) {
      diagStart("firebase-messaging-listeners");
      try {
        messaging()
          .getInitialNotification()
          .then((remoteMessage) => {
            const data = remoteMessage?.data;
            if (data) setTimeout(() => navigateFromNotificationData(router, data), 0);
          })
          .catch((error) => diagFail("firebase-messaging-listeners:getInitialNotification", error));
        unsubscribeOnOpen = messaging().onNotificationOpenedApp((remoteMessage) => {
          if (remoteMessage?.data) navigateFromNotificationData(router, remoteMessage.data);
        });
        diagOk("firebase-messaging-listeners");
      } catch (error) {
        diagFail("firebase-messaging-listeners", error);
      }
    } else if (Platform.OS === "ios") {
      console.log("SKIP firebase-messaging-listeners (diagnostic flag)");
    }

    return () => {
      subscription.remove();
      unsubscribeOnOpen?.();
    };
  }, [router]);
}

function RootNavigator() {
  const { pendingTwoFactor, isLoading } = useAuth();
  usePushNotifications();
  const bg = useThemedStyles((c) => c.bg);
  const headerColors = useThemedStyles((c) => ({ bg: c.bg, text: c.text }));

  useEffect(() => {
    if (!isLoading) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [isLoading]);

  if (pendingTwoFactor) {
    return <TwoFactorVerifyScreen />;
  }

  return (
    // contentStyle backgroundColor matters more than it looks: without it,
    // the native push/pop transition briefly shows iOS's default white
    // background before this screen's own themed background paints over
    // it — the classic cause of a "flicker" during back navigation,
    // especially visible in dark mode or moving between differently
    // colored screens (e.g. Account -> a native-header settings screen).
    // Every screen below that uses plain `headerShown: true` (i.e. doesn't
    // call useIOSNativeHeader to set its own header colors) was inheriting
    // React Navigation's native-stack default header styling, which follows
    // the OS-level light/dark appearance — NOT PaMarket's own in-app theme
    // toggle (lib/theme-provider.tsx). Someone with the phone set to Light
    // Mode but PaMarket set to Dark saw a light header bar sitting above an
    // otherwise-dark screen. These defaults make the header follow the
    // app's own resolved theme like everything else does, while any screen
    // that explicitly sets its own header options (useIOSNativeHeader, or a
    // per-screen headerStyle below) still overrides this as before.
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: bg },
        headerStyle: { backgroundColor: headerColors.bg },
        headerTintColor: headerColors.text,
        headerTitleStyle: { color: headerColors.text },
      }}
    >
      {/* The tabs group is a single stack node covering all 5 tabs (Home,
          Search, Post, Messages, Account) — a static title here would show
          on the back button regardless of which tab was actually active
          when the user navigated away (e.g. "Home" showing even when they
          came from Account), which is actively misleading. Empty title
          means a bare chevron with no label, correct from any tab. */}
      <Stack.Screen name="(tabs)" options={{ title: "" }} />
      <Stack.Screen name="(auth)" options={{ title: "Sign In" }} />
      <Stack.Screen name="login-callback" options={{ title: "Sign In" }} />
      <Stack.Screen name="listing/[id]" options={{ headerShown: Platform.OS === "ios", title: "Listing" }} />
      <Stack.Screen name="listing/edit/[id]" options={{ headerShown: true, title: "Edit Listing" }} />
      <Stack.Screen name="business/[id]" options={{ headerShown: Platform.OS === "ios", title: "Shop" }} />
      <Stack.Screen name="business-onboarding" options={{ headerShown: true, title: "Create Business" }} />
      <Stack.Screen name="business-manage/[id]" options={{ headerShown: true, title: "Seller Center" }} />
      <Stack.Screen name="business-edit/[id]" options={{ headerShown: true, title: "Edit Business" }} />
      <Stack.Screen name="business-staff/[id]" options={{ headerShown: true, title: "Staff" }} />
      <Stack.Screen name="profile/[id]" options={{ headerShown: Platform.OS === "ios", title: "Profile" }} />
      <Stack.Screen name="notifications" options={{ headerShown: true, title: "Notifications" }} />
      <Stack.Screen name="chat/[id]" options={{ headerShown: Platform.OS === "ios", title: "Chat" }} />
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
      <Stack.Screen name="report-problem" options={{ headerShown: Platform.OS === "ios", title: "Report a Problem" }} />
      <Stack.Screen name="jobs/index" options={{ headerShown: Platform.OS === "ios", title: "Jobs" }} />
      <Stack.Screen name="jobs/browse" options={{ headerShown: Platform.OS === "ios", title: "Jobs" }} />
      <Stack.Screen name="jobs/[id]" options={{ headerShown: Platform.OS === "ios", title: "Job" }} />
      <Stack.Screen name="jobs/apply/[id]" options={{ headerShown: Platform.OS === "ios", title: "Apply" }} />
      <Stack.Screen name="jobs/applicants/[jobId]" options={{ headerShown: Platform.OS === "ios", title: "Applicants" }} />
      <Stack.Screen name="jobs/applications" options={{ headerShown: Platform.OS === "ios", title: "My Applications" }} />
      <Stack.Screen name="jobs/cv-profile" options={{ headerShown: Platform.OS === "ios", title: "CV Profile" }} />
      <Stack.Screen name="jobs/post" options={{ headerShown: Platform.OS === "ios", title: "Post a Job" }} />
      <Stack.Screen name="jobs/edit/[id]" options={{ headerShown: Platform.OS === "ios", title: "Edit Job" }} />
      <Stack.Screen name="jobs/hire-talent" options={{ headerShown: Platform.OS === "ios", title: "Hire Talent" }} />
      <Stack.Screen name="jobs/candidate/[id]" options={{ headerShown: Platform.OS === "ios", title: "Candidate" }} />
      <Stack.Screen name="jobs/contact-requests" options={{ headerShown: Platform.OS === "ios", title: "Contact Requests" }} />
      <Stack.Screen name="jobs/recruiter-subscription" options={{ headerShown: Platform.OS === "ios", title: "Subscription" }} />
      <Stack.Screen name="rentals/index" options={{ headerShown: Platform.OS === "ios", title: "Rentals" }} />
      <Stack.Screen name="rentals/[id]" options={{ headerShown: Platform.OS === "ios", title: "Rental" }} />
      <Stack.Screen name="rental-fleet/index" options={{ headerShown: Platform.OS === "ios", title: "Fleet Dashboard" }} />
      <Stack.Screen name="rental-fleet/setup" options={{ headerShown: true, title: "Company Profile" }} />
      <Stack.Screen name="rental-fleet/manage" options={{ headerShown: true, title: "Manage Fleet" }} />
      <Stack.Screen name="rental-fleet/add-vehicle" options={{ headerShown: true, title: "Add Rental Vehicle" }} />
      <Stack.Screen name="rental-fleet/edit-vehicle" options={{ headerShown: true, title: "Edit Vehicle" }} />
      <Stack.Screen name="rental-fleet/availability" options={{ headerShown: true, title: "Availability" }} />
      <Stack.Screen name="rental-fleet/analytics" options={{ headerShown: true, title: "Fleet Analytics" }} />
      <Stack.Screen name="rental-fleet/leads" options={{ headerShown: true, title: "Inquiries" }} />
      <Stack.Screen name="rental-fleet/profile" options={{ headerShown: true, title: "Company Profile" }} />
      <Stack.Screen name="reviews/[id]" options={{ headerShown: Platform.OS === "ios", title: "Reviews" }} />
      <Stack.Screen name="shops/index" options={{ headerShown: Platform.OS === "ios", title: "Shops" }} />
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
// Android is edge-to-edge from SDK 54 onwards (expo-status-bar dropped its
// backgroundColor prop entirely), so the status bar is transparent and app
// content draws behind it — there is no bar colour to set on either
// platform. Only the icon style is ours to control, and it follows the
// app's own resolved theme rather than the OS appearance.
function ThemedStatusBar() {
  const { resolvedScheme } = useThemePreference();
  return <StatusBar style={resolvedScheme === "dark" ? "light" : "dark"} />;
}

function RootLayout() {
  useEffect(() => {
    diagStart("telemetry");
    try {
      initTelemetry();
      diagOk("telemetry");
    } catch (error) {
      diagFail("telemetry", error);
    }
  }, []);
  useEffect(() => {
    if (!STARTUP_FLAGS.iapEnabled) {
      console.log("SKIP initIAP (diagnostic flag)");
      return;
    }
    diagStart("initIAP");
    initIAP()
      .then(() => diagOk("initIAP"))
      .catch((error) => diagFail("initIAP", error));
    return () => {
      teardownIAP();
    };
  }, []);

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <ThemedStatusBar />
          <ToastHost />
          <AnnouncementModal />
          <RatingPromptModal />
          <RootNavigator />
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default Sentry.wrap(RootLayout);
