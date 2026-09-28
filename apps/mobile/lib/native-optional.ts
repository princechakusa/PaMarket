// Native modules that are NOT part of Expo Go (the store app used for quick
// testing): React Native Firebase (push) and expo-iap (in-app purchases).
// Importing them statically crashes the app at launch inside Expo Go, so
// they're loaded through these helpers instead. In Expo Go (and on web for
// Firebase) the helpers return null and the caller skips that feature —
// push notifications and purchases simply aren't available there, while
// everything else in the app works. Real builds (EAS / store) load them
// exactly as before.
import { Platform } from "react-native";
import { isRunningInExpoGo } from "expo";

export const IN_EXPO_GO = isRunningInExpoGo();

type FirebaseMessaging = typeof import("@react-native-firebase/messaging");
type ExpoIap = typeof import("expo-iap");

let messagingModule: FirebaseMessaging | null | undefined;
let iapModule: ExpoIap | null | undefined;

export function loadFirebaseMessaging(): FirebaseMessaging | null {
  if (messagingModule !== undefined) return messagingModule;
  if (IN_EXPO_GO || Platform.OS === "web") return (messagingModule = null);
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    messagingModule = require("@react-native-firebase/messaging") as FirebaseMessaging;
  } catch {
    messagingModule = null;
  }
  return messagingModule;
}

export function loadExpoIap(): ExpoIap | null {
  if (iapModule !== undefined) return iapModule;
  if (IN_EXPO_GO) return (iapModule = null);
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    iapModule = require("expo-iap") as ExpoIap;
  } catch {
    iapModule = null;
  }
  return iapModule;
}
