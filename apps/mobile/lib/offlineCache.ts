// Generic "last good snapshot" cache — persists whatever JSON-serializable
// data a screen last successfully loaded, so reopening the app with no
// connection shows what was there before instead of an empty/error state
// (matches how Dubizzle and other classifieds apps behave). This is
// deliberately simple: one file per cache key, fully overwritten on every
// successful load, never merged/diffed/expired. Not a general offline queue
// or a source of truth — just a screen's most recent rendering of it.
import * as FileSystem from "expo-file-system/legacy";

const CACHE_DIR = `${FileSystem.documentDirectory}pamarket-cache/`;

function pathFor(key: string): string {
  return `${CACHE_DIR}${key}.json`;
}

export async function saveCache<T>(key: string, data: T): Promise<void> {
  try {
    const dirInfo = await FileSystem.getInfoAsync(CACHE_DIR);
    if (!dirInfo.exists) await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
    await FileSystem.writeAsStringAsync(pathFor(key), JSON.stringify(data));
  } catch {
    // Best-effort — a failed cache write should never block the screen.
  }
}

export async function loadCache<T>(key: string): Promise<T | null> {
  try {
    const info = await FileSystem.getInfoAsync(pathFor(key));
    if (!info.exists) return null;
    const raw = await FileSystem.readAsStringAsync(pathFor(key));
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}
