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
    supabase.auth.getSession().then(({ data }) => {
      checkTwoFactor(data.session).finally(() => setIsLoading(false));
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
