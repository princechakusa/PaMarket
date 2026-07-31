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

// expo-image-picker's CAMERA permission makes Android (and Play Console's
// device catalog) assume camera hardware is REQUIRED to install the app,
// excluding every camera-less device (some tablets, Android TV boxes,
// etc.) even though camera capture is just one optional way to attach a
// photo — gallery picking always works without one. Explicitly marking
// these features as not-required overrides that implied requirement.
const CAMERA_FEATURES = [
  "android.hardware.camera",
  "android.hardware.camera.any",
  "android.hardware.camera.autofocus",
  "android.hardware.camera.flash",
  "android.hardware.camera.front",
];
for (const feature of CAMERA_FEATURES) {
  const tag = `<uses-feature android:name="${feature}" android:required="false"/>`;
  if (!xml.includes(tag)) {
    xml = xml.replace("</manifest>", `    ${tag}\n</manifest>`);
  }
}

// Android implicitly REQUIRES a touchscreen for every app unless told
// otherwise — this alone excludes every Android TV box and Android Auto
// head unit (neither has a touchscreen), and many Chromebooks. The legacy
// Capacitor app must have declared this override; the native app's default
// manifest doesn't, which is why Play Console reported Car -100%, TV -67%,
// Chromebook -86% device support after the first native upload. Microphone
// is optional for the same reason (RECORD_AUDIO is requested but voice
// input/recording is never the only way to do anything in this app).
const OPTIONAL_FEATURES = ["android.hardware.touchscreen", "android.hardware.microphone"];
for (const feature of OPTIONAL_FEATURES) {
  const tag = `<uses-feature android:name="${feature}" android:required="false"/>`;
  if (!xml.includes(tag)) {
    xml = xml.replace("</manifest>", `    ${tag}\n</manifest>`);
  }
}

fs.writeFileSync(manifestPath, xml);
console.log("[fix-android-manifest] patched default_notification_color merge conflict.");
console.log("[fix-android-manifest] marked camera/touchscreen/microphone hardware as not-required.");
