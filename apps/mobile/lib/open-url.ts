import { Linking } from "react-native";
import { toast } from "../components/ui/Toast";
import { logClientError } from "./error-log";

/**
 * Opens an external URL without letting a missing handler crash the app.
 *
 * Linking.openURL rejects with "Unable to open URL: …" when nothing on the
 * device can handle the scheme — WhatsApp not installed for a wa.me link, no
 * dialer for tel:, no mail client for mailto:. Those rejections were unhandled
 * and surfaced in Sentry as errors while the user just saw nothing happen.
 *
 * The user gets a plain explanation instead, and the caller never has to
 * remember to catch.
 */
export async function openExternalUrl(
  url: string,
  friendlyFailure = "Couldn't open that link on this device."
): Promise<boolean> {
  try {
    await Linking.openURL(url);
    return true;
  } catch (e) {
    console.warn("[open-url] failed:", url, (e as Error)?.message || e);
    toast(friendlyFailure, 4000, true);
    // Only the scheme (wa.me/tel/mailto/https) is logged, never the full
    // URL — a wa.me link can carry a pre-filled message as a query param.
    let scheme = "unknown";
    try {
      scheme = url.split(":")[0];
    } catch {
      // ignore — scheme stays "unknown"
    }
    logClientError({ error: e, screen: "global", component: "open-url", severity: "warning", metadata: { scheme } });
    return false;
  }
}

/** WhatsApp deep link with a spoken-language failure message. */
export function openWhatsApp(digits: string, text?: string): Promise<boolean> {
  const suffix = text ? `?text=${encodeURIComponent(text)}` : "";
  return openExternalUrl(
    `https://wa.me/${digits}${suffix}`,
    "WhatsApp isn't installed on this device."
  );
}

/** tel: link. Fails on iPads and simulators, which have no dialer. */
export function openPhone(number: string): Promise<boolean> {
  return openExternalUrl(`tel:${number}`, "This device can't make calls.");
}
