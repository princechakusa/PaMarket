import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../security/auth-context';
import { getRevenueSummary, getTopPayers, listSubscriptions, COMMERCE_PAGE_SIZE, type RevenueSummary, type TopPayerRow, type SubscriptionRow } from '../services/commerce/query';

function money(value: number | null | undefined) { return value === null || value === undefined ? '—' : `$${Number(value).toLocaleString('en-ZW', { maximumFractionDigits: 0 })}`; }
function fmtDate(value: string | null) { return value ? new Intl.DateTimeFormat('en-ZW', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Africa/Harare' }).format(new Date(value)) : '—'; }

export function FinancePage() {
  const auth = useAuth();
  const [revenue, setRevenue] = useState<RevenueSummary | null>(null);
  const [topPayers, setTopPayers] = useState<TopPayerRow[]>([]);
  const [subs, setSubs] = useState<SubscriptionRow[]>([]);
  const [subsTotal, setSubsTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (auth.mode !== 'live') { setPhase('ready'); return; }
    setPhase('loading');
    setError(null);
    const [revenueResult, payersResult, subsResult] = await Promise.all([getRevenueSummary(30), getTopPayers(90, 5), listSubscriptions(undefined, page)]);
    const errs = [revenueResult, payersResult, subsResult].find((r) => r.error);
    if (errs?.error) { setError(errs.error.message); setPhase('error'); return; }
    setRevenue(revenueResult.data);
    setTopPayers(payersResult.data ?? []);
    setSubs(subsResult.data?.rows ?? []);
    setSubsTotal(subsResult.data?.total ?? 0);
    setPhase('ready');
  }, [auth.mode, page]);

  useEffect(() => { void load(); }, [load]);

  const pageCount = Math.max(1, Math.ceil(subsTotal / COMMERCE_PAGE_SIZE));

  return <div className="directory-page">
    {auth.mode === 'mock' && <div className="directory-reference" role="note"><span className="material-symbols-outlined">science</span><b>REFERENCE DATA MODE</b><span>Live Supabase is not configured in this environment.</span></div>}
    <div className="directory-breadcrumb">PAMARKET OPS / COMMERCE / <b>FINANCE</b></div>
    <header className="directory-hero"><div><small>PRODUCTION REVENUE</small><h1>Finance</h1><p>Real aggregate revenue via the existing analytics RPCs (now finance-tier accessible). No raw payment records are shown here.</p></div></header>

    {phase === 'error' && <div className="directory-empty" role="alert">Could not load finance data: {error}</div>}

    <section className="kpi-grid" aria-label="Revenue summary">{[
      ['Subscriptions paid (30d)', money(revenue?.subs_paid)],
      ['Other paid (30d)', money(revenue?.other_paid)],
      ['Ads revenue (all time)', money(revenue?.ads_revenue)],
      ['Transactions (30d)', revenue?.txn_count ?? '—'],
      ['Subs pending', revenue?.subs_pending ?? '—'],
      ['Subs failed (30d)', revenue?.subs_failed ?? '—'],
    ].map(([label, value]) => <article key={label as string}><header><span>{label}</span></header><strong>{phase === 'loading' ? '…' : value}</strong></article>)}</section>

    <section className="ops-panel" aria-label="Top payers"><header className="panel-title"><h2>Top Payers (90 days)</h2></header>
      {topPayers.length === 0 ? <p>None</p> : <ol>{topPayers.map((p) => <li key={p.business_id}><code>{p.business_id.slice(0, 8)}…</code> — {money(p.total)} ({p.payments} payments)</li>)}</ol>}
    </section>

    <section className="ops-panel" aria-label="Subscriptions"><header className="panel-title"><h2>Business Subscriptions</h2><span>Page {page} of {pageCount}</span></header>
      <div className="directory-table-scroll"><table aria-label="Subscriptions"><thead><tr><th>Business</th><th>Plan</th><th>Cycle</th><th>Status</th><th>Renews</th><th>Auto-renew</th></tr></thead>
        <tbody>{subs.map((s) => <tr key={s.id}><td><code>{s.business_id?.slice(0, 8) ?? '—'}…</code></td><td>{s.plan_id ?? '—'}</td><td>{s.billing_cycle ?? '—'}</td><td>{s.status ?? '—'}</td><td>{fmtDate(s.current_period_end)}</td><td>{s.auto_renew ? 'Yes' : 'No'}</td></tr>)}</tbody>
      </table>{subs.length === 0 && <p>No subscriptions.</p>}</div>
      <div><button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Prev</button><button disabled={page >= pageCount} onClick={() => setPage((p) => Math.min(pageCount, p + 1))}>Next</button></div>
    </section>
  </div>;
}
