import type { ExpoConfig, ConfigContext } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "PaMarket",
  slug: "pamarket",
  owner: "princechakusa",
  version: "1.29.9",
  orientation: "portrait",
  icon: "./assets/icon.png",
  // "automatic" (not "light") so the OS actually reports dark-mode changes to
  // useColorScheme() — the in-app "System Default" theme preference
  // (lib/theme-provider.tsx) relies on that to detect dark mode at all. With
  // "light" hardcoded, iOS in particular never delivers a dark appearance
  // event to an app that has opted out of dark mode support.
  userInterfaceStyle: "automatic",
  scheme: "com.pamarket.app",
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.pamarket.app",
    // eas.json's production build profile can't use autoIncrement — that
    // only works with a static app.json, not this dynamic app.config.ts —
    // so this has to be bumped by hand before each store-distribution build.
    // 7 was built but never submitted — it predated the fix for the white
    // screen after signing in. This build carries that fix plus the
    // blank-screen-after-backgrounding fix, and is the submission
    // candidate.
    //
    // DIAGNOSTIC ONLY (build 15): this worktree is build 8's exact
    // application source (commit 51ed59fc) rebuilt through the current
    // GitHub Actions pipeline, as an A/B test isolating whether the
    // post-EAS startup crash comes from application changes made after
    // build 8 or from the GitHub build environment itself. Build 8 (EAS)
    // launches correctly on device; builds 9-12 (GitHub) crash on cold
    // start. Only the build number, Sentry org slug, and workflow were
    // changed here — no application logic. Not for merge to master.
    buildNumber: "15",
    googleServicesFile: "./GoogleService-Info.plist",
    usesAppleSignIn: true,
    icon: {
      light: "./assets/icon.png",
      dark: "./assets/icon-dark.png",
      tinted: "./assets/icon-tinted.png",
    },
    infoPlist: {
      // lib/totp.ts implements HMAC-SHA1 (RFC 2104) by hand for TOTP 2FA
      // (RFC 6238) — the app's only non-HTTPS crypto usage, and it's used
      // exclusively to authenticate a user (proving identity), never to
      // encrypt/protect app content or user data. Apple's export-compliance
      // exemption for "encryption limited to authentication" turns on that
      // purpose, not on whether the algorithm runs through an Apple API —
      // so this qualifies as exempt. FALSE here (previously TRUE) fixed an
      // ITMS-90592 rejection: TRUE requires real compliance documentation
      // on file with a matching ITSEncryptionExportComplianceCode, which
      // this app has never filed.
      ITSAppUsesNonExemptEncryption: false,
      // Without this, iOS never wakes the app for a silent/data-only FCM
      // push (lib/push.ts registers for remote messages via
      // @react-native-firebase/messaging) — it's Android-only otherwise
      // since Android has no equivalent background-mode gate.
      UIBackgroundModes: ["remote-notification"],
    },
  },
  android: {
    package: "com.pamarket.app",
    versionCode: 121,
    googleServicesFile: "./google-services.json",
    adaptiveIcon: {
      backgroundColor: "#06266F",
      foregroundImage: "./assets/android-icon-foreground.png",
      monochromeImage: "./assets/android-icon-monochrome.png",
    },
    predictiveBackGestureEnabled: false,
  },
  web: {
    favicon: "./assets/favicon.png",
  },
  plugins: [
    "@react-native-firebase/app",
    "@react-native-firebase/messaging",
    "expo-apple-authentication",
    "expo-iap",
    "expo-router",
    "expo-secure-store",
    "expo-status-bar",
    [
      "expo-build-properties",
      {
        android: {
          enableMinifyInReleaseBuilds: true,
          enableShrinkResourcesInReleaseBuilds: true,
          // Reverted the armeabi-v7a/arm64-v8a-only restriction (added to
          // fix a Sentry-reported SoLoader ANR at cold start) -- Play
          // Console hard-blocked publishing over the resulting device-
          // support reduction (Car/x86 units), with Save/Publish greyed out
          // entirely and no acknowledge-and-proceed option. Shipping the
          // rest of this release took priority; the ANR fix needs a
          // different approach that doesn't drop device support.
        },
        // React Native Firebase's Swift pods (FirebaseCoreInternal ->
        // GoogleUtilities) don't define modules, so CocoaPods can't
        // integrate them as static libraries without this — static
        // framework linkage is what makes CocoaPods generate the module
        // maps they need. Without it, `pod install` fails during
        // INSTALL_PODS with "cannot yet be integrated as static libraries".
        ios: {
          useFrameworks: "static",
        },
      },
    ],
    [
      "expo-splash-screen",
      {
        backgroundColor: "#06266F",
        image: "./assets/splash-icon-dark.png",
        dark: {
          backgroundColor: "#06266F",
          image: "./assets/splash-icon-dark.png",
        },
        imageWidth: 280,
        resizeMode: "contain",
      },
    ],
    [
      "expo-notifications",
      {
        icon: "./assets/notification-icon.png",
        color: "#F5A623",
      },
    ],
    "expo-image",
    [
      "expo-image-picker",
      {
        photosPermission: "PaMarket uses your photos to add pictures to listings, profiles, and chat messages.",
        cameraPermission: "PaMarket uses your camera to take photos for listings, verification, and chat messages.",
      },
    ],
    [
      "@sentry/react-native/expo",
      {
        // Verified live against the Sentry API before changing: org slug
        // "pamrk" holds the "react-native" project (the similarly named
        // "pamrk-6n" org is empty). Build 8's original "pamarket" org is no
        // longer the active one.
        organization: "pamrk",
        project: "react-native",
        // Auth token is deliberately NOT here — never commit it. It comes
        // from the SENTRY_AUTH_TOKEN EAS environment variable at build time
        // (same pattern as EXPO_PUBLIC_SUPABASE_URL etc.), which is what
        // actually lets the build upload de-minified source maps so crashes
        // show real file/line stack traces in the Sentry dashboard instead
        // of unreadable minified JS.
      },
    ],
  ],
  extra: {
    router: {},
    eas: {
      projectId: "d3ca5977-65b4-4690-b686-198e1a83ffd1",
    },
  },
});
