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
    // 7 was built but never submitted. 8 was submitted and rejected under
    // 2.1.1 (Information Needed) — confirmed already uploaded to App Store
    // Connect, so it can never be reused. 9 and 10 both crash on cold launch
    // (TurboModule void-method exception -> RCTFatal, seen in real TestFlight
    // crash reports) — NOT review candidates. 10 was a diagnostic isolation
    // build with initIAP() disabled (see lib/startup-diag.ts) — the crash
    // reproduced anyway, ruling out IAP as the cause. This build (11) moves
    // Sentry.init() to the very first line executed in the app (see
    // app/_layout.tsx's import order) so its native crash handler has the
    // best chance of installing before this very-early crash fires — still
    // a diagnostic build, not a submission candidate, until the actual
    // exception is captured and fixed.
    buildNumber: "11",
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
        organization: "pamarket-2r",
        project: "apple-ios",
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
