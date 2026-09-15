import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../security/auth-context';
import {
  getDailyGrowth, getCategoryBreakdown, getProvinceBreakdown, getRevenueSummary, getTopPayers, getCohorts,
  type GrowthPoint, type CategoryRow, type ProvinceRow, type RevenueSummary, type TopPayerRow, type CohortRow,
} from '../services/dashboard/query';

function fmt(v: number | null | undefined) { return v == null ? '—' : v.toLocaleString('en-ZW'); }
function money(v: number | null | undefined) { return v == null ? '—' : `$${Number(v).toLocaleString('en-ZW', { maximumFractionDigits: 0 })}`; }
function Icon({ name }: { name: string }) { return <span className="material-symbols-outlined" aria-hidden="true">{name}</span>; }

type Scope = 'growth' | 'marketplace' | 'finance' | 'cohorts';

export function AnalyticsPage() {
  const auth = useAuth();
  const admin = auth.identity;
  const canReadRevenue = Boolean(admin?.permissions.includes('revenue.view'));
  const [scope, setScope] = useState<Scope>('growth');
  const [growth, setGrowth] = useState<GrowthPoint[]>([]);
  const [category, setCategory] = useState<CategoryRow[]>([]);
  const [province, setProvince] = useState<ProvinceRow[]>([]);
  const [revenue, setRevenue] = useState<RevenueSummary | null>(null);
  const [topPayers, setTopPayers] = useState<TopPayerRow[]>([]);
  const [cohorts, setCohorts] = useState<CohortRow[]>([]);
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (auth.mode !== 'live') { setPhase('ready'); return; }
    setPhase('loading'); setError(null);
    if (scope === 'growth') {
      const r = await getDailyGrowth(30);
      if (r.error) { setError(r.error.message); setPhase('error'); return; }
      setGrowth(r.data);
    } else if (scope === 'marketplace') {
      const [c, p] = await Promise.all([getCategoryBreakdown(), getProvinceBreakdown()]);
      if (c.error || p.error) { setError((c.error ?? p.error)!.message); setPhase('error'); return; }
      setCategory(c.data); setProvince(p.data);
    } else if (scope === 'finance') {
      if (!canReadRevenue) { setPhase('ready'); return; }
      const [rev, top] = await Promise.all([getRevenueSummary(30), getTopPayers(30, 10)]);
      if (rev.error || top.error) { setError((rev.error ?? top.error)!.message); setPhase('error'); return; }
      setRevenue(rev.data); setTopPayers(top.data);
    } else {
      const r = await getCohorts(8);
      if (r.error) { setError(r.error.message); setPhase('error'); return; }
      setCohorts(r.data);
    }
    setPhase('ready');
  }, [auth.mode, scope, canReadRevenue]);

  useEffect(() => { void load(); }, [load]);

  return <div className="directory-page">
    {auth.mode === 'mock' && <div className="directory-reference" role="note"><Icon name="science" /><b>REFERENCE DATA MODE</b><span>Live Supabase is not configured in this environment.</span></div>}
    <div className="directory-breadcrumb">PAMARKET OPS / SHARED & ADVANCED / <b>ANALYTICS</b></div>
    <header className="directory-hero"><div><small>SHARED SERVER-AGGREGATED ANALYTICS</small><h1>Analytics</h1><p>One shared analytics view over the existing admin_* RPCs (admin_daily_growth, admin_category_breakdown, admin_province_breakdown, admin_revenue_summary, admin_top_payers, admin_cohorts). No per-vertical analytics engine exists for Jobs/Rentals/Commerce, so those scopes are not shown here — building them would mean fabricating metrics from incomplete data.</p></div></header>

    <nav className="listing-tabs" aria-label="Analytics scope"><div>
      <button className={scope === 'growth' ? 'active' : ''} onClick={() => setScope('growth')}>Growth</button>
      <button className={scope === 'marketplace' ? 'active' : ''} onClick={() => setScope('marketplace')}>Marketplace</button>
      {canReadRevenue && <button className={scope === 'finance' ? 'active' : ''} onClick={() => setScope('finance')}>Finance</button>}
      <button className={scope === 'cohorts' ? 'active' : ''} onClick={() => setScope('cohorts')}>Cohorts</button>
    </div></nav>

    {phase === 'error' && <div className="directory-empty" role="alert">Could not load analytics: {error}</div>}

    {scope === 'growth' && phase !== 'error' && <section className="directory-ledger">
      <header><span>New users/listings — last 30 days (admin_daily_growth)</span></header>
      <div className="directory-table-scroll"><table aria-label="Daily growth"><thead><tr><th>Date</th><th>New users</th><th>New listings</th></tr></thead>
        <tbody>{growth.map((g) => <tr key={g.d}><td>{g.d}</td><td>{fmt(g.users)}</td><td>{fmt(g.listings)}</td></tr>)}</tbody></table>
        {growth.length === 0 && <div className="directory-empty" role="status">No growth data yet.</div>}
      </div>
    </section>}

    {scope === 'marketplace' && phase !== 'error' && <div className="directory-workspace">
      <section className="directory-ledger"><header><span>Listings by category (admin_category_breakdown)</span></header>
        <div className="directory-table-scroll"><table aria-label="Category breakdown"><thead><tr><th>Category</th><th>Listings</th></tr></thead><tbody>{category.map((c) => <tr key={c.category}><td>{c.category}</td><td>{fmt(c.n)}</td></tr>)}</tbody></table></div>
      </section>
      <section className="directory-ledger"><header><span>Listings by province (admin_province_breakdown)</span></header>
        <div className="directory-table-scroll"><table aria-label="Province breakdown"><thead><tr><th>Province</th><th>Listings</th></tr></thead><tbody>{province.map((p) => <tr key={p.province}><td>{p.province}</td><td>{fmt(p.n)}</td></tr>)}</tbody></table></div>
      </section>
    </div>}

    {scope === 'finance' && phase !== 'error' && (canReadRevenue ? <section className="directory-ledger">
      <header><span>Revenue (last 30 days, admin_revenue_summary) — Finance scope</span></header>
      {revenue ? <div className="finance-grid"><div><span>Subscriptions paid</span><strong>{money(revenue.subs_paid)}</strong></div><div><span>Other paid</span><strong>{money(revenue.other_paid)}</strong></div><div><span>Ads revenue</span><strong>{money(revenue.ads_revenue)}</strong></div><div><span>Transactions</span><strong>{fmt(revenue.txn_count)}</strong></div></div> : <p>Loading…</p>}
      <h3>Top payers (admin_top_payers)</h3>
      <div className="directory-table-scroll"><table aria-label="Top payers"><thead><tr><th>Business</th><th>Total paid</th><th>Payments</th></tr></thead><tbody>{topPayers.map((t) => <tr key={t.business_id}><td><code>{t.business_id.slice(0, 8)}…</code></td><td>{money(t.total)}</td><td>{fmt(t.payments)}</td></tr>)}</tbody></table></div>
    </section> : <div className="directory-empty" role="status">Finance scope requires revenue.view permission.</div>)}

    {scope === 'cohorts' && phase !== 'error' && <section className="directory-ledger">
      <header><span>Weekly signup cohorts, last 8 weeks (admin_cohorts)</span></header>
      <div className="directory-table-scroll"><table aria-label="Cohorts"><thead><tr><th>Cohort week</th><th>Signups</th><th>Verified</th></tr></thead>
        <tbody>{cohorts.map((c) => <tr key={c.cohort}><td>{c.cohort}</td><td>{fmt(c.signups)}</td><td>{fmt(c.verified)}</td></tr>)}</tbody></table>
        {cohorts.length === 0 && <div className="directory-empty" role="status">No cohort data yet.</div>}
      </div>
    </section>}
  </div>;
}
