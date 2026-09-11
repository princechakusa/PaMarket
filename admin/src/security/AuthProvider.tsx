import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { adminEnvironment } from '../services/supabase/env';
import { getSupabaseClient } from '../services/supabase/client';
import { normalizeError } from '../services/errors/normalize-error';
import { AuthContext, type AdminIdentity, type AuthStatus, type SignInResult } from './auth-context';
import { isAdminRole, permissionsForRole } from './permissions';

const mockIdentity: AdminIdentity = {
  id: 'mock-admin-stage-c',
  name: 'Tariro Moyo',
  email: 'admin.preview@pamarket.invalid',
  displayEmail: 'admin.preview@pamarket.invalid',
  role: 'admin',
  permissions: permissionsForRole('admin'),
};

type AuthState = {
  status: AuthStatus;
  identity: AdminIdentity | null;
  accessToken: string | null;
  assuranceLevel: 'aal1' | 'aal2' | null;
  nextAssuranceLevel: 'aal1' | 'aal2' | null;
  error: string | null;
};

const emptyState: Omit<AuthState, 'status'> = { identity: null, accessToken: null, assuranceLevel: null, nextAssuranceLevel: null, error: null };

function supportedAssuranceLevel(value: unknown): 'aal1' | 'aal2' | null {
  return value === 'aal1' || value === 'aal2' ? value : null;
}

/**
 * A session is treated as needing the MFA challenge only when Supabase
 * itself reports that a *verified* factor exists and has not yet been
 * used this session (currentLevel aal1, nextLevel aal2). An account with
 * no verified factor keeps nextLevel === currentLevel, so it is never
 * routed to /mfa/challenge — it reaches the app normally, matching this
 * stage's "do not lock the operator out" requirement.
 */
function needsMfaChallenge(currentLevel: 'aal1' | 'aal2' | null, nextLevel: 'aal1' | 'aal2' | null): boolean {
  return currentLevel === 'aal1' && nextLevel === 'aal2';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const initial = useMemo<AuthState>(() => {
    if (adminEnvironment.configurationError) return { status: 'configuration_error', ...emptyState, error: adminEnvironment.configurationError };
    if (adminEnvironment.mode === 'mock') return { status: 'authenticated', ...emptyState, identity: mockIdentity };
    return { status: 'loading', ...emptyState };
  }, []);
  const [state, setState] = useState(initial);
  const requestNumber = useRef(0);

  useEffect(() => {
    if (adminEnvironment.mode !== 'live' || adminEnvironment.configurationError) return;
    const client = getSupabaseClient();
    if (!client) return;
    const supabase = client;
    let active = true;

    async function resolveSession(session: Session | null) {
      const request = ++requestNumber.current;
      if (!session) {
        if (active) setState({ status: 'anonymous', ...emptyState });
        return;
      }
      setState({ status: 'loading', ...emptyState });
      try {
        const [{ data: profile, error }, { data: assurance }] = await Promise.all([
          supabase.from('profiles').select('id,name,role').eq('id', session.user.id).maybeSingle(),
          supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
        ]);
        if (!active || request !== requestNumber.current) return;
        if (error) throw error;
        if (!profile || !isAdminRole(profile.role)) {
          setState({
            status: 'forbidden',
            ...emptyState,
            assuranceLevel: supportedAssuranceLevel(assurance?.currentLevel),
            error: 'The authenticated account does not have a recognized admin role in profiles.',
          });
          return;
        }
        const currentLevel = supportedAssuranceLevel(assurance?.currentLevel);
        const nextLevel = supportedAssuranceLevel(assurance?.nextLevel);
        setState({
          status: needsMfaChallenge(currentLevel, nextLevel) ? 'mfa_required' : 'authenticated',
          identity: { id: profile.id, name: profile.name?.trim() || 'PaMarket administrator', role: profile.role, permissions: permissionsForRole(profile.role) },
          accessToken: session.access_token,
          assuranceLevel: currentLevel,
          nextAssuranceLevel: nextLevel,
          error: null,
        });
      } catch (error) {
        if (active && request === requestNumber.current) setState({ status: 'forbidden', ...emptyState, error: normalizeError(error).message });
      }
    }

    void supabase.auth.getSession().then(({ data }) => resolveSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      window.setTimeout(() => void resolveSession(session), 0);
    });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, []);

  async function signOut() {
    if (adminEnvironment.mode !== 'live') return;
    const client = getSupabaseClient();
    if (!client) return;
    const { error } = await client.auth.signOut();
    if (error) setState((current) => ({ ...current, error: normalizeError(error).message }));
  }

  async function signInWithPassword(email: string, password: string): Promise<SignInResult> {
    if (adminEnvironment.mode !== 'live') return { error: 'Sign-in is not available in mock mode.' };
    const client = getSupabaseClient();
    if (!client) return { error: 'Live Supabase is not configured.' };
    // Never log email/password. Supabase's own error message is already
    // generic ("Invalid login credentials") and safe to surface as-is.
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) return { error: normalizeError(error).message };
    return { error: null };
  }

  /**
   * Re-reads assurance level after a successful MFA verify or an
   * unenrollment, per supabase-js's documented flow: refreshSession() to
   * pick up the new aal2 claim, then getAuthenticatorAssuranceLevel() to
   * confirm it. Only updates the assurance/status fields — identity and
   * access token are left to the normal onAuthStateChange listener.
   */
  async function refreshAssurance(): Promise<void> {
    if (adminEnvironment.mode !== 'live') return;
    const client = getSupabaseClient();
    if (!client) return;
    const { data: refreshed, error: refreshError } = await client.auth.refreshSession();
    if (refreshError || !refreshed.session) return;
    const { data: assurance } = await client.auth.mfa.getAuthenticatorAssuranceLevel();
    const currentLevel = supportedAssuranceLevel(assurance?.currentLevel);
    const nextLevel = supportedAssuranceLevel(assurance?.nextLevel);
    setState((current) => ({
      ...current,
      accessToken: refreshed.session!.access_token,
      assuranceLevel: currentLevel,
      nextAssuranceLevel: nextLevel,
      status: current.identity ? (needsMfaChallenge(currentLevel, nextLevel) ? 'mfa_required' : 'authenticated') : current.status,
    }));
  }

  return <AuthContext.Provider value={{ mode: adminEnvironment.mode, ...state, signOut, signInWithPassword, refreshAssurance }}>{children}</AuthContext.Provider>;
}
