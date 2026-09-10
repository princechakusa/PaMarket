import type { ReactNode } from 'react';
import { AuthProvider } from '../security/AuthProvider';

export function AppProviders({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
