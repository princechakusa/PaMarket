import type { ExpoConfig, ConfigContext } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "PaMarket",
  slug: "pamarket",
  version: "1.29.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "light",
  scheme: "com.pamarket.app",
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.pamarket.app",
  },
  android: {
    package: "com.pamarket.app",
    versionCode: 110,
    googleServicesFile: "./google-services.json",
    adaptiveIcon: {
      backgroundColor: "#1A3A8F",
      foregroundImage: "./assets/android-icon-foreground.png",
      backgroundImage: "./assets/android-icon-background.png",
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
        backgroundColor: "#1A3A8F",
        image: "./assets/splash-icon.png",
        resizeMode: "contain",
      },
    ],
    [
      "expo-notifications",
      {
        icon: "./assets/android-icon-foreground.png",
        color: "#1A3A8F",
      },
    ],
    "expo-image",
  ],
  extra: {
    router: {},
  },
});
