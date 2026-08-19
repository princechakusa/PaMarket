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
    // Connect, so it can never be reused. 9-14 were built by the retired
    // manual GitHub/Xcode pipeline; every one that reached a device crashed
    // on cold launch. 15 was an A/B diagnostic that rebuilt build 8's exact
    // application source through that same GitHub pipeline — it crashed too,
    // which isolated the GitHub build environment (not application code) as
    // the cause and is why production builds are back on EAS. 15 was still
    // uploaded to App Store Connect, so the next usable number is 16.
    //
    // 16 is the first EAS production build since 8 (the last known-good
    // launch) and carries the current production work: the iOS subscription
    // readiness pass, live StoreKit/Play pricing, account deletion,
    // reporting/blocking, and the Apple 2.1.1 review fixes.
    //
    // 17 adds the Featured Listings product correction (a slot is reusable
    // capacity, not a duration currency — the 7/14-day options are gone and
    // activation is a flat 30 days), the promotion-badge fix (public surfaces
    // say PROMOTED and expire with featured_until instead of hanging around
    // forever on listings.boost), and ships against the server-side fix that
    // stopped Featured Slot purchases failing verification.
    // 19 rebuilds the Jobs screens to the approved design — Post a Job as
    // collapsible cards with per-field counters, and the candidate Job details
    // view with icon metadata rows, a collapsible summary, checkmark
    // responsibilities and Save job — plus a fix for generated-description
    // storage markers leaking into the job body on posts with no DESCRIPTION
    // block. Carries everything in 18.
    //
    // 18 was the previous release candidate. It carries the fix for the locked-Keychain
    // startup crash (the SecureStore adapter behind Supabase auth had no error
    // handling and used WHEN_UNLOCKED accessibility, so a background wake or a
    // launch from the lock screen threw "User interaction is not allowed"),
    // two IAP paths that could leave a purchase promise unresolved until the
    // 120s timeout, server-side job entitlement via create_job_listing with
    // atomic credit spend, and the business-subscription expiry correction.
    //
    // 20 is the final TestFlight candidate for the App Store resubmission. It
    // carries everything in 19 plus the Sentry-reported production fixes: the
    // business reviews screen read and wrote a `text` column that does not
    // exist (the column is `comment`), guests hit a 401 on the business_leads
    // analytics insert before their Call/WhatsApp tap could go through, and
    // every external link now opens through lib/open-url.ts so a device with
    // no WhatsApp, no dialer or no mail client shows an explanation instead of
    // an uncaught "Unable to open URL" rejection.
    // 21 carries everything in 20 plus the fixes discovered after 20 was
    // already compiled: listing Share/Save/Report were only reachable in the
    // loading-skeleton copy of the top-action bar, not the real content bar,
    // so they sat under the transparent iOS header and never actually
    // rendered tappable; the search filter row's horizontal ScrollView was
    // missing its own style (defaulting to flex:1), stretching to fill the
    // screen and leaving empty bands above and below the Filters/Latest/
    // Price/Trending chips; Vehicles now opens a small screen offering
    // "All Vehicles" or "Car Rentals" instead of a stray 13th category tile
    // on Home; posting a marketplace listing now requires a phone number on
    // the seller's profile, since a missing one silently hid Call/WhatsApp
    // from buyers with no warning; the bottom tab bar was rebuilt to a
    // correct 58pt height with the floating Post button fully clearing the
    // bar instead of being clipped by it; and three more raw Postgres error
    // messages were routed through the existing friendly-error translator.
    buildNumber: "22",
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
        organization: "pamrk",
        project: "react-native",
        // Auth token is deliberately NOT here — never commit it. It comes
        // from the SENTRY_AUTH_TOKEN CI environment variable at build time,
        // which is what
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
