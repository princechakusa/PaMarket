// Sentry's Expo config plugin (@sentry/react-native/expo) only wires up
// build-time integration (source map / dSYM upload build phases) — it never
// calls SentrySDK.start() natively. The JS-side Sentry.init() (lib/sentry.ts)
// can only run once the JS bundle starts executing, which happens well after
// AppDelegate's didFinishLaunchingWithOptions. Build 9/10/11 all crash with
// an uncaught native TurboModule exception within ~1s of process launch and
// Sentry never captured any of them — even after moving Sentry.init() to the
// very first JS import (build 11), confirming the crash can fire before JS
// itself gets a chance to run. This plugin inserts a native SentrySDK.start()
// call as the very first line of didFinishLaunchingWithOptions, which runs
// before React Native/JS initializes at all — the earliest point in the app's
// lifecycle where a crash handler can possibly install.
const { withAppDelegate } = require("@expo/config-plugins");

const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;

function withSentryNativeInit(config) {
  return withAppDelegate(config, (config) => {
    if (!SENTRY_DSN) {
      console.warn(
        "[withSentryNativeInit] EXPO_PUBLIC_SENTRY_DSN not set at prebuild time — skipping native Sentry init."
      );
      return config;
    }

    let contents = config.modResults.contents;

    if (contents.includes("SentrySDK.start")) {
      return config; // Already patched (e.g. re-running prebuild without --clean).
    }

    if (!contents.includes("import Sentry")) {
      contents = contents.replace(
        /^import UIKit/m,
        `import UIKit\nimport Sentry`
      );
    }

    const initSnippet = `    SentrySDK.start { options in\n      options.dsn = "${SENTRY_DSN}"\n      options.debug = false\n    }\n`;

    const didFinishLaunchingPattern =
      /(func application\(\s*_\s*application:\s*UIApplication,\s*didFinishLaunchingWithOptions[\s\S]*?\)\s*->\s*Bool\s*\{\n)/;

    if (!didFinishLaunchingPattern.test(contents)) {
      console.warn(
        "[withSentryNativeInit] Could not find didFinishLaunchingWithOptions in AppDelegate.swift — native Sentry init NOT inserted. Check the generated file."
      );
      return config;
    }

    contents = contents.replace(
      didFinishLaunchingPattern,
      `$1${initSnippet}`
    );

    config.modResults.contents = contents;
    return config;
  });
}

module.exports = withSentryNativeInit;
