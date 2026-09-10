import { createContext, useContext } from 'react';
import type { AdminMode } from '../services/supabase/env';
import type { AdminRole, Permission } from './permissions';

export type AuthStatus = 'loading' | 'authenticated' | 'anonymous' | 'forbidden' | 'configuration_error';
export type AdminIdentity = {
  id: string;
  name: string;
  email?: string;
  displayEmail?: string;
  role: AdminRole;
  permissions: readonly Permission[];
};

export type AuthContextValue = {
  mode: AdminMode;
  status: AuthStatus;
  identity: AdminIdentity | null;
  accessToken: string | null;
  assuranceLevel: 'aal1' | 'aal2' | null;
  error: string | null;
  signOut: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider.');
  return value;
}
