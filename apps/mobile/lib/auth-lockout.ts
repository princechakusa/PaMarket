import * as SecureStore from "expo-secure-store";

const LOCK_KEY = "pamarket_auth_lock";

type LockState = { fails: number; until: number };

async function loadLock(): Promise<LockState> {
  try {
    const raw = await SecureStore.getItemAsync(LOCK_KEY);
    return raw ? JSON.parse(raw) : { fails: 0, until: 0 };
  } catch {
    return { fails: 0, until: 0 };
  }
}

async function saveLock(state: LockState) {
  try {
    await SecureStore.setItemAsync(LOCK_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

// Mirrors www/js/auth.js isLocked/recordFailure/recordSuccess: an escalating
// client-side lockout (defense-in-depth on top of Supabase's own rate limits)
// that survives app restarts. 5 fails -> 30s, 10 -> 2m, 15 -> 10m, 20+ -> 30m.
export async function checkAuthLock(): Promise<{ locked: boolean; secondsLeft: number }> {
  const lock = await loadLock();
  if (Date.now() < lock.until) {
    return { locked: true, secondsLeft: Math.ceil((lock.until - Date.now()) / 1000) };
  }
  return { locked: false, secondsLeft: 0 };
}

export async function recordAuthFailure(): Promise<{ secondsLeft: number } | null> {
  const lock = await loadLock();
  lock.fails = (lock.fails || 0) + 1;
  if (lock.fails >= 20) lock.until = Date.now() + 30 * 60000;
  else if (lock.fails >= 15) lock.until = Date.now() + 10 * 60000;
  else if (lock.fails >= 10) lock.until = Date.now() + 2 * 60000;
  else if (lock.fails >= 5) lock.until = Date.now() + 30000;
  await saveLock(lock);
  if (lock.fails >= 5) {
    return { secondsLeft: Math.round((lock.until - Date.now()) / 1000) };
  }
  return null;
}

export async function recordAuthSuccess() {
  await saveLock({ fails: 0, until: 0 });
}
