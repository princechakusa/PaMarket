import type { ExpoConfig, ConfigContext } from "expo/config";

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
    icon: {
      light: "./assets/icon.png",
      dark: "./assets/icon-dark.png",
      tinted: "./assets/icon-tinted.png",
    },
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: "com.pamarket.app",
    versionCode: 110,
    googleServicesFile: "./google-services.json",
    adaptiveIcon: {
      backgroundColor: "#F4F6FA",
      foregroundImage: "./assets/android-icon-foreground.png",
      monochromeImage: "./assets/android-icon-monochrome.png",
    },
    predictiveBackGestureEnabled: false,
  },
  web: {
    favicon: "./assets/favicon.png",
  },
  plugins: [
    "expo-router",
    "expo-secure-store",
    "expo-status-bar",
    [
      "expo-splash-screen",
      {
        backgroundColor: "#FFFFFF",
        image: "./assets/splash-icon.png",
        dark: {
          backgroundColor: "#0B0D12",
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
        color: "#1A3A8F",
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
  ],
  extra: {
    router: {},
    eas: {
      projectId: "d3ca5977-65b4-4690-b686-198e1a83ffd1",
    },
  },
});
