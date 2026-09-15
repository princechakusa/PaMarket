import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../security/auth-context';
import { listSecurityEvents } from '../services/security-events/query';

function Icon({ name }: { name: string }) { return <span className="material-symbols-outlined" aria-hidden="true">{name}</span>; }
function fmt(v: number | null) { return v == null ? '—' : v.toLocaleString('en-ZW'); }

/** Security Center is a real-data hub, not a second Security Events system
 * -- it reuses listSecurityEvents (the same protected, AAL2-gated,
 * IP-redacted RPC path SecurityEventsPage already uses) for its one summary
 * count, and links out to SecurityEventsPage/SecuritySettingsPage rather
 * than re-implementing either. No risk scores, device graphs, IMEI/IP
 * reputation, sanctions screening or fraud-network intelligence exist in
 * the backend, so none are shown -- those are BUILD REQUIRED/NOT JUSTIFIED,
 * not simulated. */
export function SecurityCenterPage() {
  const auth = useAuth();
  const admin = auth.identity;
  const canReadEvents = Boolean(admin?.permissions.includes('audit.view'));
  const [total, setTotal] = useState<number | null>(null);
  const [state, setState] = useState<'loading' | 'live' | 'unavailable' | 'unchecked'>('unchecked');

  const load = useCallback(async () => {
    if (auth.mode !== 'live' || auth.assuranceLevel !== 'aal2' || !canReadEvents) { setState('unchecked'); return; }
    setState('loading');
    const result = await listSecurityEvents({}, 1);
    if (result.error) { setState('unavailable'); return; }
    setTotal(result.data.total); setState('live');
  }, [auth.mode, auth.assuranceLevel, canReadEvents]);

  useEffect(() => { void load(); }, [load]);

  return <div className="directory-page">
    {auth.mode === 'mock' && <div className="directory-reference" role="note"><Icon name="science" /><b>REFERENCE DATA MODE</b><span>Live Supabase is not configured in this environment.</span></div>}
    <div className="directory-breadcrumb">PAMARKET OPS / SHARED & ADVANCED / <b>SECURITY CENTER</b></div>
    <header className="directory-hero"><div><small>REAL SECURITY INFRASTRUCTURE ONLY</small><h1>Security Center</h1><p>A hub over the real security surfaces this platform actually has: evidence-grade security events, MFA/2FA controls and session security settings. No fabricated risk scores, threat levels, device graphs or fraud-network intelligence — the backend does not have them.</p></div></header>

    <section className="alert-grid" aria-label="Security summary">
      <article className="alert-card success"><div><span className="alert-icon material-symbols-outlined">shield_person</span><div><header><strong>SECURITY EVENTS</strong><b>{state === 'live' ? fmt(total) : state === 'loading' ? '…' : 'RESTRICTED'}</b></header><p>Evidence-grade authentication and honeypot events. Requires AAL2 + audit.view — restricted here means the boundary is working, not broken.</p></div></div><footer><span>security_events · RLS + AAL2 boundary</span><Link to="/security/events">Open Security Events</Link></footer></article>
      <article className="alert-card"><div><span className="alert-icon material-symbols-outlined">passkey</span><div><header><strong>MFA / 2FA CONTROLS</strong></header><p>Enrollment, session and assurance-level policy for admin accounts.</p></div></div><footer><span>profiles.mfa_enabled / two_factor_secret</span><Link to="/settings/security">Open Security Settings</Link></footer></article>
      <article className="alert-card"><div><span className="alert-icon material-symbols-outlined">admin_panel_settings</span><div><header><strong>ROLES & PERMISSIONS</strong></header><p>Live server-enforced role/permission preview for the signed-in admin.</p></div></div><footer><span>has_admin_privilege() / role_rank()</span><Link to="/security/permissions">Open Roles & Permissions</Link></footer></article>
    </section>

    <section className="policy-panel"><header><h2><Icon name="block" />Not Implemented (by design)</h2></header>
      <ul>
        <li><b>Fraud / risk scoring</b> — NOT JUSTIFIED. No fraud-scoring model or fraud_score column exists in the backend; showing one would be fabricated.</li>
        <li><b>Device intelligence / IMEI / IP reputation</b> — NOT JUSTIFIED. No device-fingerprinting or reputation infrastructure exists.</li>
        <li><b>Sanctions / watchlist screening</b> — NOT JUSTIFIED. No screening provider is integrated.</li>
        <li><b>AI-detected fraud alerts</b> — NOT JUSTIFIED. No such model or alerting pipeline exists.</li>
      </ul>
    </section>
  </div>;
}
