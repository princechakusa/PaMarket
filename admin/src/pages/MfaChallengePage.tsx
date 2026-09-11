import { useEffect, useState, type FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import type { Factor } from '@supabase/supabase-js';
import { useAuth } from '../security/auth-context';
import { sanitizeReturnTo } from '../security/return-to';
import { challengeAndVerifyTotp, listMfaFactors } from '../services/supabase/mfa';

/**
 * Reached only when Supabase reports aal1 with a verified factor available
 * (see AuthProvider's needsMfaChallenge). Never logs the entered code;
 * only ever sends it straight to challengeAndVerify().
 */
export function MfaChallengePage() {
  const auth = useAuth();
  const location = useLocation();
  const returnTo = sanitizeReturnTo(new URLSearchParams(location.search).get('returnTo'));

  const [factors, setFactors] = useState<Factor[] | null>(null);
  const [selectedFactorId, setSelectedFactorId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (auth.status !== 'mfa_required') return;
    let active = true;
    void listMfaFactors().then((result) => {
      if (!active) return;
      if (result.error) { setLoadError(result.error.message); return; }
      const verifiedTotp = result.data.all.filter((factor) => factor.factor_type === 'totp' && factor.status === 'verified');
      setFactors(verifiedTotp);
      setSelectedFactorId(verifiedTotp[0]?.id ?? null);
    });
    return () => { active = false; };
  }, [auth.status]);

  if (auth.status === 'anonymous') return <Navigate to={`/login?returnTo=${encodeURIComponent(returnTo)}`} replace />;
  if (auth.status === 'authenticated') return <Navigate to={returnTo} replace />;
  if (auth.status === 'loading') return <main className="standalone-state" role="status" aria-busy="true"><p className="eyebrow">Checking session</p><h1>One moment</h1></main>;
  if (auth.status === 'configuration_error' || auth.status === 'forbidden') {
    return <main className="standalone-state" role="alert"><p className="eyebrow">Access issue</p><h1>{auth.status === 'forbidden' ? 'Admin role required' : 'Configuration error'}</h1><p>{auth.error}</p></main>;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitting || !selectedFactorId) return; // duplicate-submit guard
    const normalized = code.replace(/\D/g, '').slice(0, 6);
    if (normalized.length !== 6) { setError('Enter the current 6-digit code from your authenticator app.'); return; }
    setSubmitting(true);
    setError(null);
    const result = await challengeAndVerifyTotp(selectedFactorId, normalized);
    if (result.error) {
      setSubmitting(false);
      setError('That code was not accepted. Enter the current code from your authenticator app.');
      setCode('');
      return;
    }
    await auth.refreshAssurance();
    setSubmitting(false);
    // Once assurance reaches aal2, the status === 'authenticated' branch
    // above takes over on the next render and returns the admin to returnTo.
  }

  if (factors && factors.length === 0) {
    return (
      <main className="standalone-state" role="alert">
        <p className="eyebrow">Verification required</p>
        <h1>No verified authenticator found</h1>
        <p>Supabase reports a second factor is required, but no verified authenticator remains on this account. Sign in again, or ask an operator to check Security settings.</p>
      </main>
    );
  }

  return (
    <main className="standalone-state auth-card" role="main">
      <p className="eyebrow">Verification required</p>
      <h1>Enter your authentication code</h1>
      <p>Open your authenticator app and enter the current 6-digit code.</p>
      {loadError && <p role="alert" className="form-error">{loadError}</p>}
      <form onSubmit={handleSubmit} noValidate>
        <label htmlFor="mfa-code">Authentication code</label>
        <input
          id="mfa-code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          required
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
          disabled={submitting || !factors}
        />
        {error && <p role="alert" className="form-error">{error}</p>}
        <button type="submit" className="primary-button" disabled={submitting || !factors || code.length !== 6}>{submitting ? 'Verifying…' : 'Verify'}</button>
      </form>
    </main>
  );
}
