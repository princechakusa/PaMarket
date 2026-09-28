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
    // A hand-typed rate is stamped so the app/website can show its age.
    if (patch.fxRate !== undefined) { patch.fxRateUpdatedAt = new Date().toISOString(); patch.fxRateSource = 'admin'; }
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
        <label className="policy-switch"><span>Pause new signups<small>Blocks new accounts on app, website and server. Existing members can still sign in.</small></span><input type="checkbox" role="switch" checked={draft.signupPaused} onChange={(e) => update('signupPaused', e.target.checked)} /></label>
        <label className="policy-switch"><span>Free for everyone mode<small>Hides every paid feature (plans, credits, boosts, featured slots) and gives all users top-tier limits.</small></span><input type="checkbox" role="switch" checked={draft.freeOnly} onChange={(e) => update('freeOnly', e.target.checked)} /></label>
        <label className="policy-switch"><span>Show sponsored ads<small>Shows paid ads/banners in the app and on the website.</small></span><input type="checkbox" role="switch" checked={draft.showSponsoredAds} onChange={(e) => update('showSponsoredAds', e.target.checked)} /></label>
        <label className="policy-switch"><span>Allow image uploads<small>When off, users cannot upload photos (ID verification uploads still work).</small></span><input type="checkbox" role="switch" checked={draft.allowImageUploads} onChange={(e) => update('allowImageUploads', e.target.checked)} /></label>
        <label className="policy-switch"><span>Auto-approve verified sellers<small>With approval required, ID-verified sellers skip the review queue.</small></span><input type="checkbox" role="switch" checked={draft.autoApproveVerified} onChange={(e) => update('autoApproveVerified', e.target.checked)} /></label>
        <label className="policy-switch"><span>Enable premium listings<small>Shows boosts and featured-slot purchases.</small></span><input type="checkbox" role="switch" checked={draft.enablePremiumListings} onChange={(e) => update('enablePremiumListings', e.target.checked)} /></label>
        <label className="policy-switch"><span>Require listing approval<small>New listings wait in Listings > Pending until a moderator approves them.</small></span><input type="checkbox" role="switch" checked={draft.requireListingApproval} onChange={(e) => update('requireListingApproval', e.target.checked)} /></label>
        <label className="policy-switch"><span>Require phone verification<small>Users must verify a phone number before posting. Only enforced while phone sign-in is on.</small></span><input type="checkbox" role="switch" checked={draft.requirePhoneVerification} onChange={(e) => update('requirePhoneVerification', e.target.checked)} /></label>
        <label className="policy-switch"><span>Phone / WhatsApp sign-in<small>Turn on only after enabling the Phone provider (Twilio SMS/WhatsApp) in Supabase Auth. Shows phone sign-in and phone verification in the app.</small></span><input type="checkbox" role="switch" checked={draft.phoneAuthEnabled} onChange={(e) => update('phoneAuthEnabled', e.target.checked)} /></label>
        <label className="policy-field">USD → ZiG exchange rate<select value={draft.fxRateMode} onChange={(e) => update('fxRateMode', e.target.value === 'manual' ? 'manual' : 'auto')}><option value="auto">Automatic (market feed, refreshed every 6 hours)</option><option value="manual">Manual (I set the rate)</option></select></label>
        {draft.fxRateMode === 'manual' && <label className="policy-field">Manual rate (ZiG per 1 USD)<input type="number" min="0.01" step="0.01" value={draft.fxRate ?? ''} onChange={(e) => { const n = Number(e.target.value); update('fxRate', e.target.value === '' || !(n > 0) ? null : n); }} /></label>}
      </div>
      <footer><span>{draft.fxRate != null ? `Current rate: 1 USD = ${draft.fxRate} ZiG (${draft.fxRateSource === 'admin' ? 'set by admin' : 'market feed'}, updated ${draft.fxRateUpdatedAt ? new Date(draft.fxRateUpdatedAt).toLocaleString() : '—'}). Shown as "≈ ZiG" prices in the app and website.` : 'No FX rate on record yet.'}</span>
        <button disabled={!dirty || saving} onClick={() => void save()}>{saving ? 'Saving…' : 'Save changes'}</button>
        <button disabled={!dirty || saving} onClick={() => setDraft(current)}>Discard</button>
      </footer>
      {message && <p role="status">{message}</p>}
    </section>}
  </div>;
}
