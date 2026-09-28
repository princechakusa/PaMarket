// Captures a rendered React view to a PNG and opens the OS share sheet with
// it (WhatsApp → My Status, Facebook, etc.).
//
// react-native-view-shot and expo-sharing are native modules added in
// v1.30.0. Over-the-air JS updates can reach an older binary that doesn't
// contain them, and expo-sharing throws at import time when its native
// module is missing — so both are required lazily and every failure falls
// back to a plain text share instead of crashing.
import type { RefObject } from "react";
import { Share, type View } from "react-native";

type ViewShot = { captureRef: (ref: RefObject<View | null>, opts: Record<string, unknown>) => Promise<string> };
type Sharing = {
  isAvailableAsync: () => Promise<boolean>;
  shareAsync: (uri: string, opts?: { mimeType?: string; dialogTitle?: string; UTI?: string }) => Promise<void>;
};

function load<T>(loader: () => T): T | null {
  try {
    return loader();
  } catch {
    return null;
  }
}

export async function imageSharingAvailable(): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const sharing = load<Sharing>(() => require("expo-sharing"));
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const viewShot = load<ViewShot>(() => require("react-native-view-shot"));
  if (!sharing || !viewShot) return false;
  try {
    return await sharing.isAvailableAsync();
  } catch {
    return false;
  }
}

export type ShareImageResult = "image" | "text";

export async function shareViewAsImage(
  ref: RefObject<View | null>,
  fallbackMessage: string,
  dialogTitle: string
): Promise<ShareImageResult> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const sharing = load<Sharing>(() => require("expo-sharing"));
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const viewShot = load<ViewShot>(() => require("react-native-view-shot"));
  if (sharing && viewShot) {
    try {
      if (await sharing.isAvailableAsync()) {
        const uri = await viewShot.captureRef(ref, { format: "png", quality: 1, result: "tmpfile" });
        await sharing.shareAsync(uri, { mimeType: "image/png", dialogTitle, UTI: "public.png" });
        return "image";
      }
    } catch {
      // fall through to text
    }
  }
  try {
    await Share.share({ message: fallbackMessage });
  } catch {
    // user cancelled
  }
  return "text";
}
