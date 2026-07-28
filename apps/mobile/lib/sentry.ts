import * as Sentry from "@sentry/react-native";

// Captures the actual JS error/stack for crashes that would otherwise only
// show up as a bare native "SIGABRT / RCTFatal" in Apple's crash log, with
// no indication of which line of app code threw. No-ops safely if the DSN
// isn't configured (e.g. local dev without EXPO_PUBLIC_SENTRY_DSN set).
const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.2,
    environment: __DEV__ ? "development" : "production",
  });
}

export { Sentry };
