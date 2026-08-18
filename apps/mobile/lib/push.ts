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
    // Omitting `sound` uses the system default notification sound. Passing
    // the literal string "default" makes expo-notifications look for a
    // bundled file named "default" in the app's sounds config and warn when
    // it can't find one — it isn't a real sound file, it's the whole point
    // of leaving this unset.
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#F5A623",
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
    if (!granted) {
      console.warn("[push] permission not granted — skipping token registration");
      return;
    }

    // Firebase Cloud Messaging token. The backend sends via FCM HTTP v1 and
    // reads these values from public.push_tokens.
    const token = await getFirebaseMessagingToken();
    if (!token || typeof token !== "string") {
      console.warn("[push] getFirebaseMessagingToken() returned no token");
      return;
    }

    const { error } = await supabase.from("push_tokens").upsert(
      {
        user_id: userId,
        token,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );
    if (error) {
      console.warn("[push] push_tokens upsert failed:", error.message);
    } else {
      console.log("[push] token registered:", token.slice(0, 12) + "...");
    }
  } catch (e) {
    // Push registration is best-effort — never block app usage on failure
    // (e.g. emulator without Play Services, permission denial, etc) — but
    // log it so this isn't a silent, undiagnosable failure.
    console.warn("[push] registerForPushNotifications threw:", (e as Error)?.message || e);
  }
}

// Called when Firebase rotates the device token while the app is running.
// The current user is read from Supabase at call time rather than captured in
// a closure: a rotation that lands just after sign-out must not resurrect a
// token row for the user who has already left. Same upsert/onConflict as
// registration, so a rotation updates the existing row instead of adding one.
export async function saveRotatedPushToken(token: string): Promise<void> {
  try {
    if (!token || typeof token !== "string") return;
    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user?.id;
    if (!userId) return; // signed out — nothing to attach the token to
    const { error } = await supabase.from("push_tokens").upsert(
      {
        user_id: userId,
        token,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );
    if (error) console.warn("[push] rotated token upsert failed:", error.message);
  } catch (e) {
    // Best-effort, exactly like registration.
    console.warn("[push] saveRotatedPushToken threw:", (e as Error)?.message || e);
  }
}

export async function clearPushToken(userId: string): Promise<void> {
  try {
    await supabase.from("push_tokens").delete().eq("user_id", userId);
  } catch {
    // best-effort
  }
}
