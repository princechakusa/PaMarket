import { useState, type FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../security/auth-context';
import { sanitizeReturnTo } from '../security/return-to';
import { HoneypotField } from '../security/HoneypotField';
import { reportLoginSecurityEvent } from '../services/security-events/report';
import { getSupabaseClient } from '../services/supabase/client';

const GENERIC_LOGIN_FAILURE = 'That email or password was not accepted.';

/** Maps a Supabase auth error message to one of the Edge Function's fixed,
 * allowlisted reason codes — never the raw message itself, which is never
 * sent anywhere from here either (see report()). */
function reasonCodeFor(message: string): string {
  if (/invalid login credentials/i.test(message)) return 'invalid_credentials';
  if (/email not confirmed/i.test(message)) return 'unexpected_error';
  return 'unexpected_error';
}

/**
 * Public route — reachable while anonymous. Once a session exists it
 * redirects onward (to the sanitized returnTo, or to /mfa/challenge if a
 * second factor is still required) rather than showing the form again.
 */
export function LoginPage() {
  const auth = useAuth();
  const location = useLocation();
  const returnTo = sanitizeReturnTo(new URLSearchParams(location.search).get('returnTo'));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [companyWebsite, setCompanyWebsite] = useState(''); // honeypot — never sent anywhere
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (auth.status === 'authenticated') return <Navigate to={returnTo} replace />;
  if (auth.status === 'mfa_required') return <Navigate to={`/mfa/challenge?returnTo=${encodeURIComponent(returnTo)}`} replace />;

  if (auth.status === 'configuration_error') {
    return (
      <main className="standalone-state" role="alert">
        <p className="eyebrow">Configuration error</p>
        <h1>Live mode is not configured</h1>
        <p>{auth.error}</p>
      </main>
    );
  }

  if (auth.mode !== 'live') {
    return (
      <main className="standalone-state" role="status">
        <p className="eyebrow">Mock mode</p>
        <h1>Sign-in is not available</h1>
        <p>This preview runs on static mock data. Configure VITE_ADMIN_MODE=live and Supabase credentials to exercise real authentication.</p>
      </main>
    );
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return; // duplicate-submit guard — also covers the honeypot path

    // A filled honeypot field never reaches signInWithPassword(). Only a
    // fixed signal is sent (no email/password/honeypot value), and the
    // operator sees the exact same generic failure as a real bad password
    // — the honeypot trigger is never revealed.
    if (companyWebsite.trim().length > 0) {
      setSubmitting(true);
      await reportLoginSecurityEvent('admin_login_honeypot');
      setSubmitting(false);
      setError(GENERIC_LOGIN_FAILURE);
      return;
    }

    setSubmitting(true);
    setError(null);
    const result = await auth.signInWithPassword(email.trim(), password);
    if (result.error) {
      setSubmitting(false);
      setError(GENERIC_LOGIN_FAILURE);
      void reportLoginSecurityEvent('admin_login_failed', { reasonCode: reasonCodeFor(result.error) });
      return;
    }

    // Success: report using the session's own fresh access token (the
    // AuthProvider context may not have re-resolved yet on this render).
    const client = getSupabaseClient();
    const { data } = client ? await client.auth.getSession() : { data: { session: null } };
    void reportLoginSecurityEvent('admin_login_succeeded', { accessToken: data.session?.access_token });
    setSubmitting(false);
    // The Supabase auth listener resolves the new session and this
    // component re-renders into one of the Navigate branches above.
  }

  return (
    <main className="standalone-state auth-card" role="main">
      <p className="eyebrow">PaMarket Admin</p>
      <h1>Sign in</h1>
      <p>Use your administrator credentials. A verification step may follow.</p>
      <form onSubmit={handleSubmit} noValidate>
        <label htmlFor="login-email">Email</label>
        <input id="login-email" name="email" type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} disabled={submitting} />
        <label htmlFor="login-password">Password</label>
        <input id="login-password" name="password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} disabled={submitting} />
        <HoneypotField value={companyWebsite} onChange={setCompanyWebsite} />
        {error && <p role="alert" className="form-error">{error}</p>}
        <button type="submit" className="primary-button" disabled={submitting || !email || !password}>{submitting ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </main>
  );
}
