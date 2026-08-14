// Temporary cold-launch instrumentation for isolating the build-9 TurboModule
// startup crash (ObjCTurboModule::performVoidMethodInvocation -> RCTFatal).
// Logs START/OK/FAIL around each native startup call so a device console
// capture shows exactly which one the process dies inside of. Remove once
// the crash is confirmed fixed.
export function diagStart(module: string) {
  console.log(`START ${module}`);
}

export function diagOk(module: string) {
  console.log(`OK ${module}`);
}

export function diagFail(module: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.log(`FAIL ${module}: ${message}`);
}

export async function diagWrap<T>(module: string, fn: () => Promise<T> | T): Promise<T | undefined> {
  diagStart(module);
  try {
    const result = await fn();
    diagOk(module);
    return result;
  } catch (error) {
    diagFail(module, error);
    return undefined;
  }
}

// Independent kill-switches for the startup isolation investigation — each
// defaults to enabled (normal behavior) and is flipped off one at a time via
// EXPO_PUBLIC_DIAG_DISABLE_* build-time env vars to test whether disabling
// that one subsystem stops the build-9 cold-launch TurboModule crash. Not a
// runtime user-facing setting; set only via the GitHub Actions workflow
// dispatch for a specific diagnostic build.
export const STARTUP_FLAGS = {
  iapEnabled: process.env.EXPO_PUBLIC_DIAG_DISABLE_IAP !== "1",
  firebaseMessagingEnabled: process.env.EXPO_PUBLIC_DIAG_DISABLE_FIREBASE_MESSAGING !== "1",
  expoNotificationsEnabled: process.env.EXPO_PUBLIC_DIAG_DISABLE_EXPO_NOTIFICATIONS !== "1",
  pushRegistrationEnabled: process.env.EXPO_PUBLIC_DIAG_DISABLE_PUSH_REGISTRATION !== "1",
};
