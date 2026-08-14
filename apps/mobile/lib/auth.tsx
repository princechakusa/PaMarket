import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { AUTH_STORAGE_KEY, SecureStoreAdapter, supabase } from "./supabase";
import { verifyTotpCode } from "./totp";
import { diagStart, diagOk, diagFail } from "./startup-diag";

// supabase-js returns NO session from getSession() when the stored access
// token has expired and it can't reach the auth server to refresh it —
// which is exactly what happens with no connectivity. Every screen that
// gates on `session` (Account and Messages hard-gate on it, showing a
// "sign in required" screen) then behaves as if the user were signed out,
// so offline the app looked like those tabs simply wouldn't open.
//
// The session is still sitting in SecureStore in that case — supabase only
// clears it when the refresh is genuinely REJECTED (revoked/invalid refresh
// token), not when the request merely fails to reach the network. So if
// getSession() comes back empty but a stored session is still present, it's
// a connectivity failure rather than a real sign-out, and honouring the
// cached session keeps the app usable offline. autoRefreshToken picks up a
// real refresh as soon as connectivity returns.
async function readCachedSession(): Promise<Session | null> {
  try {
    const raw = await SecureStoreAdapter.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const cached = parsed?.currentSession ?? parsed;
    if (cached?.access_token && cached?.user) return cached as Session;
    return null;
  } catch {
    return null;
  }
}

type AuthContextValue = {
  session: Session | null;
  isLoading: boolean;
  // Mirrors www/js/auth.js's _pendingTwoFactorUserId gate: the Supabase
  // session exists, but the app must not treat the user as signed in until a
  // TOTP code is verified (two_factor_enabled on profiles).
  pendingTwoFactor: boolean;
  verifyPendingTwoFactor: (code: string) => Promise<boolean>;
  cancelPendingTwoFactor: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue>({
  session: null,
  isLoading: true,
  pendingTwoFactor: false,
  verifyPendingTwoFactor: async () => false,
  cancelPendingTwoFactor: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingTwoFactor, setPendingTwoFactor] = useState(false);
  const [pendingSecret, setPendingSecret] = useState<string | null>(null);

  async function checkTwoFactor(nextSession: Session | null) {
    if (!nextSession?.user) {
      setPendingTwoFactor(false);
      setPendingSecret(null);
      setSession(nextSession);
      return;
    }
    const { data } = await supabase
      .from("profiles")
      .select("two_factor_enabled,two_factor_secret")
      .eq("id", nextSession.user.id)
      .maybeSingle();
    if (data?.two_factor_enabled && data?.two_factor_secret) {
      setPendingSecret(data.two_factor_secret);
      setPendingTwoFactor(true);
      setSession(null);
    } else {
      setPendingTwoFactor(false);
      setPendingSecret(null);
      setSession(nextSession);
    }
  }

  useEffect(() => {
    // getSession() can internally attempt a token-refresh network call when
    // the stored session is near/past expiry — on a poor/no connection
    // (a real scenario this app has to work on) that call can reject, or on
    // some networks hang far longer than a launch should ever wait. Either
    // way, isLoading must resolve regardless: the splash screen is gated on
    // !isLoading in app/_layout.tsx, so previously a failed/hung refresh
    // left the app stuck behind the splash screen forever — it looked like
    // the app simply never opened. settled + the timeout below guarantee
    // this unblocks within 6s no matter what the network does; worst case
    // the user opens signed-out and can retry once online.
    let settled = false;
    const finishLoading = () => {
      if (settled) return;
      settled = true;
      setIsLoading(false);
    };
    const timeout = setTimeout(finishLoading, 6000);

    diagStart("secure-store-session-bootstrap");
    supabase.auth.getSession().then(async ({ data }) => {
      clearTimeout(timeout);
      // Empty session + a session still in storage means the refresh
      // couldn't reach the network, not a real sign-out — see
      // readCachedSession() above.
      const resolved = data.session ?? (await readCachedSession());
      setSession(resolved);
      finishLoading();
      checkTwoFactor(resolved);
      diagOk("secure-store-session-bootstrap");
    }).catch(async (e) => {
      clearTimeout(timeout);
      console.warn("[auth] getSession failed (offline?):", e);
      diagFail("secure-store-session-bootstrap", e);
      setSession(await readCachedSession());
      finishLoading();
    });

    const { data: subscription } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      // A null session here only means "signed out" for an actual
      // SIGNED_OUT event. A failed token refresh (offline) also reports a
      // null session, and treating that as a sign-out would undo the
      // cached-session restore above and lock the user out of Account /
      // Messages again the moment the refresh timer fired.
      if (!newSession && event !== "SIGNED_OUT") {
        checkTwoFactor(await readCachedSession());
        return;
      }
      checkTwoFactor(newSession);
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

  async function verifyPendingTwoFactor(code: string): Promise<boolean> {
    if (!pendingSecret) return false;
    const ok = await verifyTotpCode(pendingSecret, code);
    if (ok) {
      const { data } = await supabase.auth.getSession();
      setPendingTwoFactor(false);
      setPendingSecret(null);
      setSession(data.session);
    }
    return ok;
  }

  async function cancelPendingTwoFactor() {
    setPendingTwoFactor(false);
    setPendingSecret(null);
    await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider
      value={{ session, isLoading, pendingTwoFactor, verifyPendingTwoFactor, cancelPendingTwoFactor }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
