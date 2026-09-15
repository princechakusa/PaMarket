import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../security/auth-context';
import {
  getAmosCounts, listPendingDrafts, decideDraft, listMarketIntelligence, listSeoRecommendations, listIntegrations,
  type AmosCounts, type DraftRow, type MarketIntelRow, type SeoRecommendationRow, type IntegrationRow,
} from '../services/amos/query';

function fmtDate(value: string | null) { return value ? new Intl.DateTimeFormat('en-ZW', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Harare' }).format(new Date(value)) : '—'; }
function Icon({ name }: { name: string }) { return <span className="material-symbols-outlined" aria-hidden="true">{name}</span>; }
function fmt(v: number | null | undefined) { return v == null ? '—' : v.toLocaleString('en-ZW'); }

type Tab = 'overview' | 'approvals' | 'intelligence' | 'seo' | 'integrations';

export function AmosDashboardPage() {
  const auth = useAuth();
  const [tab, setTab] = useState<Tab>('overview');
  const [counts, setCounts] = useState<AmosCounts | null>(null);
  const [drafts, setDrafts] = useState<DraftRow[]>([]);
  const [intel, setIntel] = useState<MarketIntelRow[]>([]);
  const [seo, setSeo] = useState<SeoRecommendationRow[]>([]);
  const [integrations, setIntegrations] = useState<IntegrationRow[]>([]);
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (auth.mode !== 'live') { setPhase('ready'); return; }
    setPhase('loading'); setError(null);
    const countsResult = await getAmosCounts();
    if (countsResult.error) { setError(countsResult.error.message); setPhase('error'); return; }
    setCounts(countsResult.data);
    if (tab === 'approvals') { const r = await listPendingDrafts(); if (!r.error) setDrafts(r.data); }
    if (tab === 'intelligence') { const r = await listMarketIntelligence(); if (!r.error) setIntel(r.data); }
    if (tab === 'seo') { const r = await listSeoRecommendations(); if (!r.error) setSeo(r.data); }
    if (tab === 'integrations') { const r = await listIntegrations(); if (!r.error) setIntegrations(r.data); }
    setPhase('ready');
  }, [auth.mode, tab]);

  useEffect(() => { void load(); }, [load]);

  async function decide(id: string, status: 'approved' | 'rejected') {
    if (!auth.identity) return;
    const result = await decideDraft(id, status, auth.identity.id);
    setMessage(result.error ? `Failed: ${result.error.message}` : `Draft ${status}.`);
    void load();
  }

  const metrics: [string, string | number][] = counts ? [
    ['Total Drafts', fmt(counts.drafts)], ['Pending Review', fmt(counts.pendingReview)],
    ['Approved', fmt(counts.approved)], ['Rejected', fmt(counts.rejected)],
    ['Scheduled (pending)', fmt(counts.scheduledUpcoming)],
    ['Integrations', fmt(counts.integrations)], ['Integrations Failing', fmt(counts.integrationsFailing)],
  ] : [];

  return <div className="directory-page">
    {auth.mode === 'mock' && <div className="directory-reference" role="note"><Icon name="science" /><b>REFERENCE DATA MODE</b><span>Live Supabase is not configured in this environment.</span></div>}
    <div className="directory-breadcrumb">PAMARKET OPS / SHARED & ADVANCED / <b>AMOS</b></div>
    <header className="directory-hero"><div><small>MARKETING AUTOMATION (REAL SYSTEM)</small><h1>AMOS</h1><p>Real operational status for the live AMOS marketing-automation pipeline (11 Edge Functions). This is visibility and approval only — no arbitrary automation triggers, code execution, or credential access are exposed here.</p></div></header>

    <nav className="listing-tabs" aria-label="AMOS section"><div>
      <button className={tab === 'overview' ? 'active' : ''} onClick={() => setTab('overview')}>Overview</button>
      <button className={tab === 'approvals' ? 'active' : ''} onClick={() => setTab('approvals')}>Approval Queue</button>
      <button className={tab === 'intelligence' ? 'active' : ''} onClick={() => setTab('intelligence')}>Market Intelligence</button>
      <button className={tab === 'seo' ? 'active' : ''} onClick={() => setTab('seo')}>SEO Recommendations</button>
      <button className={tab === 'integrations' ? 'active' : ''} onClick={() => setTab('integrations')}>Integrations</button>
    </div></nav>

    {phase === 'error' && <div className="directory-empty" role="alert">Could not load AMOS data: {error}</div>}

    {tab === 'overview' && phase !== 'error' && <section className="kpi-grid" aria-label="AMOS status">{metrics.map(([label, value]) => <article key={label}><header><span>{label}</span></header><strong>{phase === 'loading' ? '…' : value}</strong></article>)}</section>}

    {tab === 'approvals' && phase !== 'error' && <section className="directory-ledger">
      <header><span>{drafts.length} pending draft(s)</span></header>
      <div className="directory-table-scroll"><table aria-label="Pending AMOS drafts"><thead><tr><th>Channel</th><th>Type</th><th>Body</th><th>Relevance</th><th>Brand fit</th><th>Created</th><th>Action</th></tr></thead>
        <tbody>{drafts.map((d) => <tr key={d.id}><td>{d.channel ?? '—'}</td><td>{d.draft_type ?? '—'}</td><td style={{ maxWidth: 300 }}>{(d.body ?? '').slice(0, 120)}{(d.body?.length ?? 0) > 120 ? '…' : ''}</td><td>{d.relevance_score ?? '—'}</td><td>{d.brand_alignment_score ?? '—'}</td><td>{fmtDate(d.created_at)}</td>
          <td><div className="jobs-actions"><button onClick={() => void decide(d.id, 'approved')}>Approve</button><button onClick={() => void decide(d.id, 'rejected')}>Reject</button></div></td>
        </tr>)}</tbody></table>
        {drafts.length === 0 && <div className="directory-empty" role="status">No drafts pending review.</div>}
      </div>
      {message && <p role="status">{message}</p>}
    </section>}

    {tab === 'intelligence' && phase !== 'error' && <section className="directory-ledger">
      <header><span>{intel.length} signal(s) (real, collected by amos-research-runner)</span></header>
      <div className="directory-table-scroll"><table aria-label="Market intelligence"><thead><tr><th>Country</th><th>Signal</th><th>Topic</th><th>Score</th><th>Collected</th></tr></thead>
        <tbody>{intel.map((r) => <tr key={r.id}><td>{r.country_code ?? '—'}</td><td>{r.signal_type ?? '—'}</td><td>{r.topic ?? '—'}</td><td>{r.score ?? '—'}</td><td>{fmtDate(r.collected_at)}</td></tr>)}</tbody></table>
        {intel.length === 0 && <div className="directory-empty" role="status">No market intelligence recorded yet.</div>}
      </div>
    </section>}

    {tab === 'seo' && phase !== 'error' && <section className="directory-ledger">
      <header><span>{seo.length} recommendation(s) (real, from amos-seo-runner)</span></header>
      <div className="directory-table-scroll"><table aria-label="SEO recommendations"><thead><tr><th>Page</th><th>Type</th><th>Current</th><th>Suggested</th><th>Status</th></tr></thead>
        <tbody>{seo.map((r) => <tr key={r.id}><td>{r.page_type}{r.page_ref ? ` · ${r.page_ref}` : ''}</td><td>{r.recommendation_type ?? '—'}</td><td>{r.current_value ?? '—'}</td><td>{r.suggested_value ?? '—'}</td><td>{r.status ?? '—'}</td></tr>)}</tbody></table>
        {seo.length === 0 && <div className="directory-empty" role="status">No SEO recommendations yet.</div>}
      </div>
      <p><small>These are recommendations only — applying an SEO change to the live site is not performed from this screen.</small></p>
    </section>}

    {tab === 'integrations' && phase !== 'error' && <section className="directory-ledger">
      <header><span>{integrations.length} integration(s)</span></header>
      <div className="directory-table-scroll"><table aria-label="AMOS integrations"><thead><tr><th>Provider</th><th>Status</th><th>Last success</th><th>Consecutive failures</th><th>Auto-disabled</th></tr></thead>
        <tbody>{integrations.map((i) => <tr key={i.id}><td>{i.provider}</td><td>{i.status ?? '—'}</td><td>{fmtDate(i.last_success_at)}</td><td>{i.consecutive_failures ?? 0}</td><td>{i.auto_disabled ? 'Yes' : 'No'}</td></tr>)}</tbody></table>
      </div>
      <p><small>Credentials and provider secrets are never read or shown here.</small></p>
    </section>}
  </div>;
}
