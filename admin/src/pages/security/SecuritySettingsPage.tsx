import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Factor } from '@supabase/supabase-js';
import { useAuth } from '../../security/auth-context';
import { listMfaFactors, unenrollFactor } from '../../services/supabase/mfa';

function FactorRow({ factor, onRemoved }: { factor: Factor; onRemoved: () => void }) {
  const auth = useAuth();
  const [confirming, setConfirming] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [rowError, setRowError] = useState<string | null>(null);

  async function confirmRemove() {
    if (removing) return; // blocks double-click / duplicate submit
    setRemoving(true);
    setRowError(null);
    const result = await unenrollFactor(factor.id);
    setRemoving(false);
    setConfirming(false);
    if (result.error) { setRowError(result.error.message); return; }
    await auth.refreshAssurance();
    onRemoved();
  }

  return (
    <li>
      <div>
        <strong>{factor.friendly_name || 'Authenticator app'}</strong>
        <small>{factor.status === 'verified' ? 'Verified' : 'Unverified'} · added {new Date(factor.created_at).toLocaleDateString()}</small>
      </div>
      {confirming ? (
        <span className="confirm-row">
          <span>Remove this authenticator?</span>
          <button type="button" className="danger-button" disabled={removing} onClick={() => void confirmRemove()}>{removing ? 'Removing…' : 'Confirm remove'}</button>
          <button type="button" disabled={removing} onClick={() => setConfirming(false)}>Cancel</button>
        </span>
      ) : (
        <button type="button" onClick={() => setConfirming(true)}>Remove</button>
      )}
      {rowError && <p role="alert" className="form-error">{rowError}</p>}
    </li>
  );
}

export function SecuritySettingsPage() {
  const auth = useAuth();
  const [factors, setFactors] = useState<Factor[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (auth.mode !== 'live') { setFactors([]); return; }
    const result = await listMfaFactors();
    if (result.error) { setLoadError(result.error.message); return; }
    setLoadError(null);
    setFactors(result.data.all.filter((factor) => factor.factor_type === 'totp'));
  }, [auth.mode]);

  useEffect(() => { void load(); }, [load]);

  const verified = factors?.filter((factor) => factor.status === 'verified') ?? [];
  const unverified = factors?.filter((factor) => factor.status === 'unverified') ?? [];

  return (
    <>
      <div className="page-heading">
        <div><p className="eyebrow">Security</p><h1>Multi-factor authentication</h1><p>Manage the authenticator app used to reach aal2 for this account.</p></div>
        <span className={`status-pill ${auth.assuranceLevel === 'aal2' ? 'review' : 'pending'}`}>{auth.assuranceLevel ?? 'unknown'}</span>
      </div>

      <section className="notice-card" aria-labelledby="mfa-enforcement-note">
        <span className="notice-icon" aria-hidden="true">◇</span>
        <div>
          <h2 id="mfa-enforcement-note">Enforcement has not started yet</h2>
          <p>This page enrols and verifies real Supabase authenticator factors. Stronger server-side enforcement — requiring aal2 for privileged actions — begins only after enrollment has been tested and separately approved. This screen is a UI guide, not the security boundary; Postgres and server-side checks remain authoritative.</p>
        </div>
      </section>

      {auth.mode !== 'live' && <p className="form-error">Mock mode — connect a live Supabase project to manage real factors.</p>}
      {loadError && <p role="alert" className="form-error">{loadError}</p>}

      <div className="section-grid">
        <section className="panel">
          <div className="panel-heading"><h2>Verified authenticators</h2></div>
          {factors === null ? <p>Loading…</p> : verified.length === 0 ? <p>No verified authenticator yet.</p> : (
            <ul className="factor-list">{verified.map((factor) => <FactorRow key={factor.id} factor={factor} onRemoved={() => void load()} />)}</ul>
          )}
          <Link className="primary-button" to="/settings/security/mfa/enroll">Add authenticator</Link>
        </section>

        <section className="panel">
          <div className="panel-heading"><h2>Unverified authenticators</h2></div>
          {factors === null ? <p>Loading…</p> : unverified.length === 0 ? <p>None pending.</p> : (
            <ul className="factor-list">{unverified.map((factor) => <FactorRow key={factor.id} factor={factor} onRemoved={() => void load()} />)}</ul>
          )}
        </section>
      </div>
    </>
  );
}
