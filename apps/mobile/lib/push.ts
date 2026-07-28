import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { supabase } from "./supabase";

// PaMarket's backend push pipeline (supabase/functions/send-push,
// notify-message, notify-application) sends via raw FCM (Firebase Cloud
// Messaging) HTTP v1, targeting the token stored in profiles.push_token —
// NOT an Expo push token. So we register the native FCM device token
// (getDevicePushTokenAsync), not Expo's push token service.

const ANDROID_CHANNEL_ID = "pamarket_default";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function ensureAndroidChannel() {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: "PaMarket",
    importance: Notifications.AndroidImportance.HIGH,
    sound: "default",
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#1A3A8F",
  });
}

export async function registerForPushNotifications(userId: string): Promise<void> {
  try {
    await ensureAndroidChannel();

    const existing = await Notifications.getPermissionsAsync();
    let granted = existing.granted;
    if (!granted) {
      const requested = await Notifications.requestPermissionsAsync();
      granted = requested.granted;
    }
    if (!granted) return;

    // Raw FCM device token (Android). This is what the backend's FCM sender expects.
    const tokenResponse = await Notifications.getDevicePushTokenAsync();
    const token = tokenResponse?.data;
    if (!token || typeof token !== "string") return;

    await supabase.from("profiles").update({ push_token: token }).eq("id", userId);
  } catch {
    // Push registration is best-effort — never block app usage on failure
    // (e.g. emulator without Play Services, permission denial, etc).
  }
}

export async function clearPushToken(userId: string): Promise<void> {
  try {
    await supabase.from("profiles").update({ push_token: null }).eq("id", userId);
  } catch {
    // best-effort
  }
}
