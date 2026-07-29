import type { ExpoConfig, ConfigContext } from "expo/config";
import { withAndroidManifest, type ConfigPlugin } from "expo/config-plugins";

const withFirebaseNotificationColorOverride: ConfigPlugin = (expoConfig) =>
  withAndroidManifest(expoConfig, (modConfig) => {
    const application = modConfig.modResults.manifest.application?.[0];
    const metaData = application?.["meta-data"];
    const colorMeta = metaData?.find(
      (item) => item.$["android:name"] === "com.google.firebase.messaging.default_notification_color"
    );

    if (colorMeta) {
      (colorMeta.$ as Record<string, string>)["tools:replace"] = "android:resource";
    }

    return modConfig;
  });

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "PaMarket",
  slug: "pamarket",
  owner: "princechakusa",
  version: "1.29.0",
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
    },
  },
  android: {
    package: "com.pamarket.app",
    versionCode: 110,
    googleServicesFile: "./google-services.json",
    adaptiveIcon: {
      backgroundColor: "#030303",
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
    [
      "expo-build-properties",
      {
        // Firebase's Swift pods (GoogleUtilities, via FirebaseCoreInternal)
        // can't be integrated as static libraries — pod install fails with
        // "The following Swift pods cannot yet be integrated as static
        // libraries" the moment @react-native-firebase/messaging is added.
        // useModularHeaders is NOT a real option on this plugin (silently
        // ignored, confirmed by reading pluginConfig.js's schema) — the
        // actual documented fix for this exact error is switching to
        // dynamic frameworks, which don't have this restriction.
        ios: { useFrameworks: "dynamic" },
      },
    ],
    "expo-apple-authentication",
    "expo-iap",
    "expo-router",
    "expo-secure-store",
    "expo-status-bar",
    [
      "expo-splash-screen",
      {
        backgroundColor: "#030303",
        image: "./assets/splash-icon-dark.png",
        dark: {
          backgroundColor: "#030303",
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
        color: "#D6A12A",
      },
    ],
    withFirebaseNotificationColorOverride,
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
        organization: "pamarket",
        project: "react-native",
        // Auth token is deliberately NOT here — never commit it. It comes
        // from the SENTRY_AUTH_TOKEN EAS environment variable at build time
        // (same pattern as EXPO_PUBLIC_SUPABASE_URL etc.), which is what
        // actually lets the build upload de-minified source maps so crashes
        // show real file/line stack traces in the Sentry dashboard instead
        // of unreadable minified JS.
      },
    ],
  ] as any,
  extra: {
    router: {},
    eas: {
      projectId: "d3ca5977-65b4-4690-b686-198e1a83ffd1",
    },
  },
});
