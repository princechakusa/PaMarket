const { AndroidConfig, withAndroidManifest } = require("expo/config-plugins");

const FIREBASE_NOTIFICATION_COLOR =
  "com.google.firebase.messaging.default_notification_color";
const SYSTEM_ALERT_WINDOW = "android.permission.SYSTEM_ALERT_WINDOW";

/**
 * Keeps release-only Android manifest authority in tracked Expo configuration.
 * Generated native folders remain disposable and must not be edited by hand.
 */
module.exports = function withAndroidReleaseManifest(config) {
  return withAndroidManifest(config, (androidConfig) => {
    const manifest = androidConfig.modResults.manifest;
    const application =
      AndroidConfig.Manifest.getMainApplicationOrThrow(androidConfig.modResults);

    application["meta-data"] = application["meta-data"] || [];
    let notificationColor = application["meta-data"].find(
      (item) => item.$?.["android:name"] === FIREBASE_NOTIFICATION_COLOR
    );
    if (!notificationColor) {
      notificationColor = {
        $: {
          "android:name": FIREBASE_NOTIFICATION_COLOR,
          "android:resource": "@color/notification_icon_color",
        },
      };
      application["meta-data"].push(notificationColor);
    }
    notificationColor.$["android:resource"] = "@color/notification_icon_color";
    notificationColor.$["tools:replace"] = "android:resource";

    manifest["uses-permission"] = (manifest["uses-permission"] || []).filter(
      (item) => item.$?.["android:name"] !== SYSTEM_ALERT_WINDOW
    );
    manifest["uses-permission"].push({
      $: {
        "android:name": SYSTEM_ALERT_WINDOW,
        "tools:node": "remove",
      },
    });

    return androidConfig;
  });
};
