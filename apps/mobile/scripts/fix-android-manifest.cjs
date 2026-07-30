#!/usr/bin/env node
// Run after `npx expo prebuild --platform android` (or `--clean`), before
// building. @react-native-firebase/messaging's bundled AndroidManifest
// declares default_notification_color=@color/white, which collides with
// the notification_icon_color expo-notifications generates from this
// app's `color` option (#F5A623) — Gradle's manifest merger refuses to
// pick a winner and fails the whole build without tools:replace. This has
// to run as a plain post-prebuild step (not an app.config.ts plugin)
// because expo-notifications injects that meta-data late enough in its
// own build that no config-plugin mod hook in this app's plugin list runs
// reliably after it.
const fs = require("fs");
const path = require("path");

const manifestPath = path.join(__dirname, "..", "android", "app", "src", "main", "AndroidManifest.xml");

if (!fs.existsSync(manifestPath)) {
  console.error(`[fix-android-manifest] not found: ${manifestPath} — run expo prebuild first.`);
  process.exit(1);
}

let xml = fs.readFileSync(manifestPath, "utf8");

if (!xml.includes('xmlns:tools="http://schemas.android.com/tools"')) {
  xml = xml.replace(
    '<manifest xmlns:android="http://schemas.android.com/apk/res/android"',
    '<manifest xmlns:android="http://schemas.android.com/apk/res/android" xmlns:tools="http://schemas.android.com/tools"'
  );
}

const before = xml;
xml = xml.replace(
  /<meta-data android:name="com\.google\.firebase\.messaging\.default_notification_color" android:resource="@color\/notification_icon_color"\/>/,
  '<meta-data android:name="com.google.firebase.messaging.default_notification_color" android:resource="@color/notification_icon_color" tools:replace="android:resource"/>'
);

if (xml === before && !xml.includes('tools:replace="android:resource"')) {
  console.error("[fix-android-manifest] target meta-data not found — manifest shape may have changed.");
  process.exit(1);
}

fs.writeFileSync(manifestPath, xml);
console.log("[fix-android-manifest] patched default_notification_color merge conflict.");
