import { useCallback, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../security/auth-context';
import { normalizeQrSource } from '../../security/qr-source';
import { challengeAndVerifyTotp, enrollTotpFactor, unenrollFactor } from '../../services/supabase/mfa';

type Stage = 'start' | 'enrolling' | 'awaiting_code' | 'verifying' | 'cancelling' | 'done';

/**
 * Real TOTP enrollment against supabase.auth.mfa.enroll(). The QR code and
 * setup secret returned by Supabase live only in this component's React
 * state (never localStorage/sessionStorage/URL) and are rendered directly
 * to the DOM — never passed to console.*, normalizeError, or any audit/
 * analytics call. Cancelling removes the still-unverified factor via
 * unenroll() on a best-effort basis.
 */
export function MfaEnrollPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [stage, setStage] = useState<Stage>('start');
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qrDataUri, setQrDataUri] = useState<string | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [copyLabel, setCopyLabel] = useState('Copy setup key');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  // Belt-and-braces duplicate-submit guard alongside the `stage` checks —
  // survives even a rapid double-invocation within the same render.
  const submittingRef = useRef(false);

  const startEnrollment = useCallback(async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setStage('enrolling');
    setError(null);
    const friendlyName = `PaMarket Admin — ${new Date().toISOString().slice(0, 10)}`;
    const result = await enrollTotpFactor(friendlyName);
    submittingRef.current = false;
    if (result.error || !result.data) {
      setStage('start');
      setError(result.error?.message ?? 'Enrollment could not be started.');
      return;
    }
    setFactorId(result.data.id);
    const safeQr = normalizeQrSource(result.data.totp.qrCode);
    setQrDataUri(safeQr);
    setQrError(safeQr ? null : 'The QR code could not be displayed safely. Use the setup key below instead.');
    setSecret(result.data.totp.secret);
    setStage('awaiting_code');
  }, []);

  const cancelEnrollment = useCallback(async () => {
    if (!factorId || submittingRef.current) return;
    submittingRef.current = true;
    setStage('cancelling');
    await unenrollFactor(factorId); // best-effort cleanup; the factor was never verified either way
    submittingRef.current = false;
    setFactorId(null);
    setQrDataUri(null);
    setQrError(null);
    setSecret(null);
    setCode('');
    setError(null);
    setStage('start');
  }, [factorId]);

  const submitCode = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      if (submittingRef.current || !factorId) return;
      const normalized = code.replace(/\D/g, '').slice(0, 6);
      if (normalized.length !== 6) { setError('Enter the current 6-digit code.'); return; }
      submittingRef.current = true;
      setStage('verifying');
      setError(null);
      const result = await challengeAndVerifyTotp(factorId, normalized);
      if (result.error) {
        submittingRef.current = false;
        setStage('awaiting_code');
        setError('That code was not accepted. Enter the current code and try again.');
        setCode('');
        return;
      }
      await auth.refreshAssurance();
      submittingRef.current = false;
      setStage('done');
    },
    [code, factorId, auth],
  );

  async function copySecret() {
    if (!secret) return;
    try {
      await navigator.clipboard.writeText(secret);
      setCopyLabel('Copied');
      window.setTimeout(() => setCopyLabel('Copy setup key'), 2000);
    } catch {
      setCopyLabel('Copy failed — select the key manually');
    }
  }

  if (auth.mode !== 'live') {
    return (
      <main className="standalone-state" role="status">
        <p className="eyebrow">Mock mode</p>
        <h1>Enrollment is not available</h1>
        <p>Connect a live Supabase project to enrol a real authenticator.</p>
      </main>
    );
  }

  if (stage === 'done') {
    return (
      <main className="standalone-state" role="status">
        <p className="eyebrow">Enrollment complete</p>
        <h1>Authenticator verified</h1>
        <p>This session now reports {auth.assuranceLevel ?? 'an updated'} assurance level.</p>
        <button type="button" className="primary-button" onClick={() => navigate('/settings/security')}>Return to security settings</button>
      </main>
    );
  }

  return (
    <>
      <div className="page-heading">
        <div><p className="eyebrow">Security</p><h1>Add an authenticator</h1><p>Enrol a TOTP authenticator app (e.g. Google Authenticator, 1Password, Authy).</p></div>
      </div>

      {stage === 'start' && (
        <section className="panel">
          <p>Enrollment starts a real Supabase authenticator factor. Have your phone or authenticator app ready before you continue.</p>
          {error && <p role="alert" className="form-error">{error}</p>}
          <button type="button" className="primary-button" onClick={() => void startEnrollment()}>Start enrollment</button>
        </section>
      )}

      {stage === 'enrolling' && <section className="panel" aria-busy="true" role="status"><p>Starting enrollment…</p></section>}

      {(stage === 'awaiting_code' || stage === 'verifying' || stage === 'cancelling') && secret && (
        <section className="panel enroll-panel">
          <h2>1. Scan this QR code</h2>
          {qrDataUri ? (
            <img className="mfa-qr" src={qrDataUri} alt="Authenticator QR code — scan with your authenticator app" width={220} height={220} />
          ) : (
            <p role="alert" className="form-error">{qrError}</p>
          )}
          <h2>2. Or enter this setup key manually</h2>
          <div className="secret-row">
            <code className="secret-value">{secret}</code>
            <button type="button" onClick={() => void copySecret()}>{copyLabel}</button>
          </div>
          <h2>3. Enter the 6-digit code from your app</h2>
          <form onSubmit={submitCode} noValidate>
            <label htmlFor="enroll-code" className="sr-only">Verification code</label>
            <input
              id="enroll-code"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              required
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              disabled={stage === 'verifying' || stage === 'cancelling'}
            />
            {error && <p role="alert" className="form-error">{error}</p>}
            <div className="enroll-actions">
              <button type="submit" className="primary-button" disabled={stage === 'verifying' || stage === 'cancelling' || code.length !== 6}>{stage === 'verifying' ? 'Verifying…' : 'Verify and finish'}</button>
              <button type="button" onClick={() => void cancelEnrollment()} disabled={stage === 'verifying' || stage === 'cancelling'}>{stage === 'cancelling' ? 'Cancelling…' : 'Cancel enrollment'}</button>
            </div>
          </form>
        </section>
      )}
    </>
  );
}
