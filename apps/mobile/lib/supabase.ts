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

// The Keychain is not always readable. iOS throws
// `KeyChainException: User interaction is not allowed` for a WHEN_UNLOCKED
// item whenever the process runs while the device is locked — a background
// push wake, a StoreKit transaction replay, or a launch during the lock
// screen. supabase-js reads this adapter internally while constructing the
// client and on every token refresh, i.e. outside any try/catch in auth.tsx,
// so an unhandled rejection there surfaced as a startup crash:
//
//   FunctionCallException: Calling 'getValueWithKeyAsync' failed
//   → KeyChainException: User interaction is not allowed
//
// Two changes close that:
//   1. AFTER_FIRST_UNLOCK — the session token stays readable once the user has
//      unlocked the device at least once since boot, which is what background
//      wakes need. It is still not readable before first unlock, so the token
//      is not stored more permissively than necessary.
//   2. Every call is wrapped. A failed read degrades to "no stored session"
//      (the user signs in again) instead of taking the app down. Writes and
//      deletes are best-effort for the same reason.
const KEYCHAIN_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
};

async function safeGet(key: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(key, KEYCHAIN_OPTIONS);
  } catch (e) {
    console.warn("[secure-store] read failed:", (e as Error)?.message || e);
    return null;
  }
}

async function safeSet(key: string, value: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(key, value, KEYCHAIN_OPTIONS);
  } catch (e) {
    console.warn("[secure-store] write failed:", (e as Error)?.message || e);
  }
}

async function safeDelete(key: string): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(key, KEYCHAIN_OPTIONS);
  } catch {
    // Deleting a missing/locked item must never propagate.
  }
}

export const SecureStoreAdapter = {
  async getItem(key: string) {
    const chunkCountRaw = await safeGet(`${key}_chunks`);
    if (!chunkCountRaw) {
      return safeGet(key);
    }
    const chunkCount = parseInt(chunkCountRaw, 10);
    const parts: string[] = [];
    for (let i = 0; i < chunkCount; i++) {
      const part = await safeGet(chunkKey(key, i));
      if (part == null) return null;
      parts.push(part);
    }
    return parts.join("");
  },
  async setItem(key: string, value: string) {
    await safeDelete(key);
    const previousChunkCountRaw = await safeGet(`${key}_chunks`);
    if (previousChunkCountRaw) {
      const previousCount = parseInt(previousChunkCountRaw, 10);
      for (let i = 0; i < previousCount; i++) {
        await safeDelete(chunkKey(key, i));
      }
    }

    if (value.length <= CHUNK_SIZE) {
      await safeDelete(`${key}_chunks`);
      await safeSet(key, value);
      return;
    }

    const chunks: string[] = [];
    for (let i = 0; i < value.length; i += CHUNK_SIZE) {
      chunks.push(value.slice(i, i + CHUNK_SIZE));
    }
    await Promise.all(chunks.map((chunk, i) => safeSet(chunkKey(key, i), chunk)));
    await safeSet(`${key}_chunks`, String(chunks.length));
  },
  async removeItem(key: string) {
    const chunkCountRaw = await safeGet(`${key}_chunks`);
    if (chunkCountRaw) {
      const chunkCount = parseInt(chunkCountRaw, 10);
      for (let i = 0; i < chunkCount; i++) {
        await safeDelete(chunkKey(key, i));
      }
      await safeDelete(`${key}_chunks`);
    }
    await safeDelete(key);
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
