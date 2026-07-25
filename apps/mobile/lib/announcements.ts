import * as SecureStore from "expo-secure-store";

const STORE_KEY = "pamarket_dismissed_announcements";

async function loadDismissed(): Promise<string[]> {
  try {
    const raw = await SecureStore.getItemAsync(STORE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function isAnnouncementDismissed(id: string): Promise<boolean> {
  const dismissed = await loadDismissed();
  return dismissed.includes(String(id));
}

export async function dismissAnnouncement(id: string) {
  const dismissed = await loadDismissed();
  const strId = String(id);
  if (!dismissed.includes(strId)) {
    dismissed.push(strId);
    try {
      await SecureStore.setItemAsync(STORE_KEY, JSON.stringify(dismissed));
    } catch {
      // ignore
    }
  }
}
