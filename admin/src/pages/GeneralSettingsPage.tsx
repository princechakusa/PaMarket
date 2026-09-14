import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../security/auth-context';
import { getOperationalSettings, updateOperationalSettings, type OperationalSettings } from '../services/platform/query';

function Icon({ name }: { name: string }) { return <span className="material-symbols-outlined" aria-hidden="true">{name}</span>; }

export function GeneralSettingsPage() {
  const auth = useAuth();
  const [current, setCurrent] = useState<OperationalSettings | null>(null);
  const [draft, setDraft] = useState<OperationalSettings | null>(null);
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (auth.mode !== 'live') { setPhase('ready'); return; }
    setPhase('loading');
    setError(null);
    const result = await getOperationalSettings();
    if (result.error) { setError(result.error.message); setPhase('error'); return; }
    setCurrent(result.data);
    setDraft(result.data);
    setPhase('ready');
  }, [auth.mode]);

  useEffect(() => { void load(); }, [load]);

  function update<K extends keyof OperationalSettings>(key: K, value: OperationalSettings[K]) {
    setDraft((previous) => (previous ? { ...previous, [key]: value } : previous));
    setMessage(null);
  }

  const dirty = draft && current && JSON.stringify(draft) !== JSON.stringify(current);

  async function save() {
    if (!draft || !current) return;
    setSaving(true);
    const patch: Partial<OperationalSettings> = {};
    (Object.keys(draft) as (keyof OperationalSettings)[]).forEach((key) => { if (draft[key] !== current[key]) (patch as Record<string, unknown>)[key] = draft[key]; });
    const result = await updateOperationalSettings(patch);
    setSaving(false);
    if (result.error) { setMessage(`Save failed: ${result.error.message}`); return; }
    setMessage('Saved.');
    void load();
  }

  return <div className="jobs-page policy-page">
    {auth.mode === 'mock' && <div className="jobs-reference" role="note"><Icon name="science" /><b>REFERENCE DATA MODE</b><span>Live Supabase is not configured in this environment.</span></div>}
    <div className="jobs-breadcrumb">PAMARKET OPS / SECURITY & PLATFORM / <b>GENERAL SETTINGS</b></div>
    <header className="jobs-hero"><div><small>PRODUCTION PLATFORM CONFIGURATION</small><h1>General Settings</h1><p>Real operating toggles from app_settings. Content (app store/social links) is managed separately and is not shown here.</p></div></header>

    {phase === 'error' && <div className="jobs-reference" role="alert"><Icon name="error" /><b>Could not load settings</b><span>{error}</span></div>}

    {phase === 'ready' && draft && <section className="policy-panel">
      <header><div><h2><Icon name="tune" />Operational Toggles</h2><p>Changes write directly to production app_settings (admin/super_admin only, server-enforced).</p></div>{dirty && <b>UNSAVED CHANGES</b>}</header>
      <div className="policy-controls">
        <label className="policy-switch"><span>Pause new signups<small>signupPaused — consumed by the mobile/website auth flow</small></span><input type="checkbox" role="switch" checked={draft.signupPaused} onChange={(e) => update('signupPaused', e.target.checked)} /></label>
        <label className="policy-switch"><span>Free listings only<small>freeOnly</small></span><input type="checkbox" role="switch" checked={draft.freeOnly} onChange={(e) => update('freeOnly', e.target.checked)} /></label>
        <label className="policy-switch"><span>Show sponsored ads<small>showSponsoredAds</small></span><input type="checkbox" role="switch" checked={draft.showSponsoredAds} onChange={(e) => update('showSponsoredAds', e.target.checked)} /></label>
        <label className="policy-switch"><span>Allow image uploads<small>allowImageUploads</small></span><input type="checkbox" role="switch" checked={draft.allowImageUploads} onChange={(e) => update('allowImageUploads', e.target.checked)} /></label>
        <label className="policy-switch"><span>Auto-approve verified sellers<small>autoApproveVerified</small></span><input type="checkbox" role="switch" checked={draft.autoApproveVerified} onChange={(e) => update('autoApproveVerified', e.target.checked)} /></label>
        <label className="policy-switch"><span>Enable premium listings<small>enablePremiumListings</small></span><input type="checkbox" role="switch" checked={draft.enablePremiumListings} onChange={(e) => update('enablePremiumListings', e.target.checked)} /></label>
        <label className="policy-switch"><span>Require listing approval<small>requireListingApproval</small></span><input type="checkbox" role="switch" checked={draft.requireListingApproval} onChange={(e) => update('requireListingApproval', e.target.checked)} /></label>
        <label className="policy-switch"><span>Require phone verification<small>requirePhoneVerification</small></span><input type="checkbox" role="switch" checked={draft.requirePhoneVerification} onChange={(e) => update('requirePhoneVerification', e.target.checked)} /></label>
        <label className="policy-field">Support WhatsApp number<input value={draft.supportWhatsapp} onChange={(e) => update('supportWhatsapp', e.target.value)} placeholder="+263…" /></label>
      </div>
      <footer><span>{draft.fxRate != null ? `FX reference: ${draft.fxRate} (updated ${draft.fxRateUpdatedAt ?? '—'})` : 'No FX rate on record.'}</span>
        <button disabled={!dirty || saving} onClick={() => void save()}>{saving ? 'Saving…' : 'Save changes'}</button>
        <button disabled={!dirty || saving} onClick={() => setDraft(current)}>Discard</button>
      </footer>
      {message && <p role="status">{message}</p>}
    </section>}
  </div>;
}
