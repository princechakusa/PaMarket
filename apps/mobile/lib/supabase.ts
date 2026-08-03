import "react-native-url-polyfill/auto";
import { AppState } from "react-native";
import * as SecureStore from "expo-secure-store";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    "Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY — check apps/mobile/.env"
  );
}

// Android's SecureStore backs onto EncryptedSharedPreferences, which caps
// individual values at ~2048 bytes. A Supabase session (access + refresh
// token + user object) regularly exceeds that, so large values are split
// into numbered chunks under sibling keys.
const CHUNK_SIZE = 1800;

function chunkKey(key: string, index: number) {
  return `${key}_chunk_${index}`;
}

export const SecureStoreAdapter = {
  async getItem(key: string) {
    const chunkCountRaw = await SecureStore.getItemAsync(`${key}_chunks`);
    if (!chunkCountRaw) {
      return SecureStore.getItemAsync(key);
    }
    const chunkCount = parseInt(chunkCountRaw, 10);
    const parts: string[] = [];
    for (let i = 0; i < chunkCount; i++) {
      const part = await SecureStore.getItemAsync(chunkKey(key, i));
      if (part == null) return null;
      parts.push(part);
    }
    return parts.join("");
  },
  async setItem(key: string, value: string) {
    await SecureStore.deleteItemAsync(key);
    const previousChunkCountRaw = await SecureStore.getItemAsync(`${key}_chunks`);
    if (previousChunkCountRaw) {
      const previousCount = parseInt(previousChunkCountRaw, 10);
      for (let i = 0; i < previousCount; i++) {
        await SecureStore.deleteItemAsync(chunkKey(key, i));
      }
    }

    if (value.length <= CHUNK_SIZE) {
      await SecureStore.deleteItemAsync(`${key}_chunks`);
      await SecureStore.setItemAsync(key, value);
      return;
    }

    const chunks: string[] = [];
    for (let i = 0; i < value.length; i += CHUNK_SIZE) {
      chunks.push(value.slice(i, i + CHUNK_SIZE));
    }
    await Promise.all(chunks.map((chunk, i) => SecureStore.setItemAsync(chunkKey(key, i), chunk)));
    await SecureStore.setItemAsync(`${key}_chunks`, String(chunks.length));
  },
  async removeItem(key: string) {
    const chunkCountRaw = await SecureStore.getItemAsync(`${key}_chunks`);
    if (chunkCountRaw) {
      const chunkCount = parseInt(chunkCountRaw, 10);
      for (let i = 0; i < chunkCount; i++) {
        await SecureStore.deleteItemAsync(chunkKey(key, i));
      }
      await SecureStore.deleteItemAsync(`${key}_chunks`);
    }
    await SecureStore.deleteItemAsync(key);
  },
};

// Exactly the key supabase-js derives by default (`sb-<project-ref>-auth-
// token`), just stated explicitly so lib/auth.tsx can read the persisted
// session back out when getSession() can't return one. Passing the same
// value the default would have produced means existing users' stored
// sessions still resolve — do NOT change this string, it would sign
// everyone out on their next launch.
export const AUTH_STORAGE_KEY = `sb-${new URL(SUPABASE_URL).hostname.split(".")[0]}-auth-token`;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: SecureStoreAdapter,
    storageKey: AUTH_STORAGE_KEY,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Supabase's autoRefreshToken timer only ticks while JS is running — it must
// be explicitly paused/resumed around app background/foreground transitions,
// mirroring www/js/app.js's proactive refreshSession() calls on resume.
AppState.addEventListener("change", (state) => {
  if (state === "active") supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});
