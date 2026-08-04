import { useEffect, useState } from "react";
import { AppState, Keyboard } from "react-native";

// Returns a value to pass as `key` to a KeyboardAvoidingView.
//
// Backgrounding the app (locking the phone, switching apps) while the
// keyboard is open desyncs KeyboardAvoidingView's internal keyboard-height
// tracking from the real keyboard. On returning, it keeps applying an inset
// for a keyboard that is no longer where it thinks it is — collapsing the
// screen's content to a sliver or, on the auth screens, leaving it
// completely blank and unusable until the app is force-quit.
//
// Dismissing the keyboard on the way out and forcing a fresh mount (via a
// changing `key`) on the way back in resets that state cleanly. This was
// already worked around by hand in chat/[id].tsx and (tabs)/post.tsx; this
// hook is that same fix, shared, so every screen with a
// KeyboardAvoidingView gets it rather than only the two where it happened
// to be noticed.
export function useKeyboardAvoidingReset(): number {
  const [resetKey, setResetKey] = useState(0);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") {
        Keyboard.dismiss();
      } else {
        setResetKey((key) => key + 1);
      }
    });
    return () => subscription.remove();
  }, []);

  return resetKey;
}
