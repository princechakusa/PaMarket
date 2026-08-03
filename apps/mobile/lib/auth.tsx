import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { verifyTotpCode } from "./totp";

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

    supabase.auth.getSession().then(({ data }) => {
      clearTimeout(timeout);
      setSession(data.session);
      finishLoading();
      checkTwoFactor(data.session);
    }).catch((e) => {
      clearTimeout(timeout);
      console.warn("[auth] getSession failed (offline?):", e);
      finishLoading();
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
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
