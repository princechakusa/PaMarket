import { createContext, useContext } from 'react';
import type { AdminMode } from '../services/supabase/env';
import type { AdminRole, Permission } from './permissions';

export type AuthStatus = 'loading' | 'authenticated' | 'mfa_required' | 'anonymous' | 'forbidden' | 'configuration_error';
export type AdminIdentity = {
  id: string;
  name: string;
  email?: string;
  displayEmail?: string;
  role: AdminRole;
  permissions: readonly Permission[];
};

export type SignInResult = { error: string | null };

export type AuthContextValue = {
  mode: AdminMode;
  status: AuthStatus;
  identity: AdminIdentity | null;
  accessToken: string | null;
  /** Current Supabase authenticator assurance level for this session. */
  assuranceLevel: 'aal1' | 'aal2' | null;
  /**
   * The next assurance level Supabase would grant after a successful MFA
   * step. Equal to `assuranceLevel` when the account has no verified
   * factor — that is what keeps an unenrolled admin from ever being routed
   * to /mfa/challenge (there would be nothing to challenge).
   */
  nextAssuranceLevel: 'aal1' | 'aal2' | null;
  error: string | null;
  signOut: () => Promise<void>;
  /** Password sign-in for /login. No-ops with a clear error in mock mode. */
  signInWithPassword: (email: string, password: string) => Promise<SignInResult>;
  /** Re-checks assurance level after a successful MFA verify/unenroll. */
  refreshAssurance: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider.');
  return value;
}
