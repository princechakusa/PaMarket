import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './auth-context';

export function RequireSession({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const location = useLocation();
  const returnTo = encodeURIComponent(`${location.pathname}${location.search}`);

  if (auth.status === 'authenticated') return children;
  if (auth.status === 'anonymous') return <Navigate to={`/login?returnTo=${returnTo}`} replace />;
  if (auth.status === 'mfa_required') return <Navigate to={`/mfa/challenge?returnTo=${returnTo}`} replace />;
  if (auth.status === 'loading') return <main className="standalone-state" role="status" aria-busy="true"><p className="eyebrow">Session check</p><h1>Confirming admin access</h1><p>The shell is waiting for Supabase Auth and a verified role from the profiles table.</p></main>;
  if (auth.status === 'configuration_error') return <main className="standalone-state" role="alert"><p className="eyebrow">Configuration error</p><h1>Live mode is not configured</h1><p>{auth.error}</p></main>;
  return <main className="standalone-state" role="alert"><p className="eyebrow">Access denied</p><h1>Admin role required</h1><p>{auth.error}</p></main>;
}
