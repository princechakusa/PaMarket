import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../security/auth-context';
import { getOperationalSettings, updateOperationalSettings } from '../services/platform/query';

function Icon({ name }: { name: string }) { return <span className="material-symbols-outlined" aria-hidden="true">{name}</span>; }

export function MaintenancePage() {
  const auth = useAuth();
  const [signupPaused, setSignupPaused] = useState(false);
  const [freeOnly, setFreeOnly] = useState(false);
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (auth.mode !== 'live') { setPhase('ready'); return; }
    setPhase('loading');
    const result = await getOperationalSettings();
    if (result.error) { setError(result.error.message); setPhase('error'); return; }
    setSignupPaused(result.data.signupPaused);
    setFreeOnly(result.data.freeOnly);
    setPhase('ready');
  }, [auth.mode]);

  useEffect(() => { void load(); }, [load]);

  async function toggle(key: 'signupPaused' | 'freeOnly', value: boolean) {
    setSaving(true);
    setMessage(null);
    const result = await updateOperationalSettings({ [key]: value });
    setSaving(false);
    if (result.error) { setMessage(`Failed: ${result.error.message}`); return; }
    if (key === 'signupPaused') setSignupPaused(value); else setFreeOnly(value);
    setMessage('Applied to production.');
  }

  return <div className="jobs-page policy-page">
    {auth.mode === 'mock' && <div className="jobs-reference" role="note"><Icon name="science" /><b>REFERENCE DATA MODE</b><span>Live Supabase is not configured in this environment.</span></div>}
    <div className="jobs-breadcrumb">PAMARKET OPS / SECURITY & PLATFORM / <b>MAINTENANCE</b></div>
    <header className="jobs-hero"><div><small>PLATFORM CIRCUIT BREAKERS</small><h1>Maintenance</h1><p>Real production flags read by the mobile/website auth flow — not a simulated maintenance system. There is no "restart server" or "clear cache" capability in the backend, so none is shown here.</p></div></header>

    {phase === 'error' && <div className="jobs-reference" role="alert"><Icon name="error" /><b>Could not load state</b><span>{error}</span></div>}

    {phase === 'ready' && <section className="policy-panel">
      <header><h2><Icon name="crisis_alert" />Circuit Breakers</h2><b>app_settings</b></header>
      <div className="policy-controls">
        <label className="policy-switch"><span>Pause new signups<small>signupPaused — blocks new account creation platform-wide</small></span><input type="checkbox" role="switch" disabled={saving} checked={signupPaused} onChange={(e) => void toggle('signupPaused', e.target.checked)} /></label>
        <label className="policy-switch"><span>Free listings only<small>freeOnly — disables paid listing tiers platform-wide</small></span><input type="checkbox" role="switch" disabled={saving} checked={freeOnly} onChange={(e) => void toggle('freeOnly', e.target.checked)} /></label>
      </div>
      {message && <p role="status">{message}</p>}
      <p><small>No other maintenance controls (server restart, cache clear, forced logout) exist in the production backend. This page does not fabricate them.</small></p>
    </section>}
  </div>;
}
