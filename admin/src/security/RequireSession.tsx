import type { ReactNode } from 'react';
import { useAuth } from './auth-context';

export function RequireSession({ children }: { children: ReactNode }) {
  const auth = useAuth();
  if (auth.status === 'authenticated') return children;
  if (auth.status === 'loading') return <main className="standalone-state" role="status" aria-busy="true"><p className="eyebrow">Session check</p><h1>Confirming admin access</h1><p>The shell is waiting for Supabase Auth and a verified role from the profiles table.</p></main>;
  if (auth.status === 'configuration_error') return <main className="standalone-state" role="alert"><p className="eyebrow">Configuration error</p><h1>Live mode is not configured</h1><p>{auth.error}</p></main>;
  if (auth.status === 'forbidden') return <main className="standalone-state" role="alert"><p className="eyebrow">Access denied</p><h1>Admin role required</h1><p>{auth.error}</p></main>;
  return <main className="standalone-state" role="status"><p className="eyebrow">Session expired</p><h1>Sign in again</h1><p>No active Supabase session is available. A dedicated sign-in flow will be added in a later approved stage.</p></main>;
}
