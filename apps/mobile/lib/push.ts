import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import messaging, { AuthorizationStatus } from "@react-native-firebase/messaging";
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
    lightColor: "#D6A12A",
  });
}

async function getFirebaseMessagingToken(): Promise<string | null> {
  const instance = messaging();
  if (Platform.OS === "ios") {
    const authStatus = await instance.requestPermission();
    const enabled =
      authStatus === AuthorizationStatus.AUTHORIZED ||
      authStatus === AuthorizationStatus.PROVISIONAL;
    if (!enabled) return null;

    await instance.registerDeviceForRemoteMessages();
  }

  const token = await instance.getToken();
  return token || null;
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

    // Firebase Cloud Messaging token. The backend sends via FCM HTTP v1 and
    // reads these values from public.push_tokens.
    const token = await getFirebaseMessagingToken();
    if (!token || typeof token !== "string") return;

    await supabase.from("push_tokens").upsert(
      {
        user_id: userId,
        token,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );
  } catch {
    // Push registration is best-effort — never block app usage on failure
    // (e.g. emulator without Play Services, permission denial, etc).
  }
}

export async function clearPushToken(userId: string): Promise<void> {
  try {
    await supabase.from("push_tokens").delete().eq("user_id", userId);
  } catch {
    // best-effort
  }
}
