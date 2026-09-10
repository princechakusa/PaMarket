import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { adminEnvironment } from '../services/supabase/env';
import { getSupabaseClient } from '../services/supabase/client';
import { normalizeError } from '../services/errors/normalize-error';
import { AuthContext, type AdminIdentity, type AuthStatus } from './auth-context';
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
  error: string | null;
};

function supportedAssuranceLevel(value: unknown): 'aal1' | 'aal2' | null {
  return value === 'aal1' || value === 'aal2' ? value : null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const initial = useMemo<AuthState>(() => {
    if (adminEnvironment.configurationError) return { status: 'configuration_error', identity: null, accessToken: null, assuranceLevel: null, error: adminEnvironment.configurationError };
    if (adminEnvironment.mode === 'mock') return { status: 'authenticated', identity: mockIdentity, accessToken: null, assuranceLevel: null, error: null };
    return { status: 'loading', identity: null, accessToken: null, assuranceLevel: null, error: null };
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
        if (active) setState({ status: 'anonymous', identity: null, accessToken: null, assuranceLevel: null, error: null });
        return;
      }
      setState({ status: 'loading', identity: null, accessToken: null, assuranceLevel: null, error: null });
      try {
        const [{ data: profile, error }, { data: assurance }] = await Promise.all([
          supabase.from('profiles').select('id,name,role').eq('id', session.user.id).maybeSingle(),
          supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
        ]);
        if (!active || request !== requestNumber.current) return;
        if (error) throw error;
        if (!profile || !isAdminRole(profile.role)) {
          setState({ status: 'forbidden', identity: null, accessToken: null, assuranceLevel: supportedAssuranceLevel(assurance?.currentLevel), error: 'The authenticated account does not have a recognized admin role in profiles.' });
          return;
        }
        setState({
          status: 'authenticated',
          identity: { id: profile.id, name: profile.name?.trim() || 'PaMarket administrator', role: profile.role, permissions: permissionsForRole(profile.role) },
          accessToken: session.access_token,
          assuranceLevel: supportedAssuranceLevel(assurance?.currentLevel),
          error: null,
        });
      } catch (error) {
        if (active && request === requestNumber.current) setState({ status: 'forbidden', identity: null, accessToken: null, assuranceLevel: null, error: normalizeError(error).message });
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

  return <AuthContext.Provider value={{ mode: adminEnvironment.mode, ...state, signOut }}>{children}</AuthContext.Provider>;
}
