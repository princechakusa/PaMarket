import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../security/auth-context';
import { listSecurityEvents } from '../services/security-events/query';
import {
  getCategoryBreakdown, getDailyGrowth, getProvinceBreakdown, getQueueCounts,
  getRecentAuditLog, getRevenueSummary, getTopPayers,
  type AuditLogRow, type CategoryRow, type GrowthPoint, type ProvinceRow,
  type QueueCounts, type RevenueSummary, type TopPayerRow,
} from '../services/dashboard/query';
import { ZimbabweActivityMap } from '../components/ZimbabweActivityMap';

type Phase = 'loading' | 'ready' | 'error';

type Snapshot = {
  growth: GrowthPoint[];
  category: CategoryRow[];
  province: ProvinceRow[];
  revenue: RevenueSummary | null;
  topPayers: TopPayerRow[];
  queues: QueueCounts | null;
  auditLog: AuditLogRow[];
};

const emptySnapshot: Snapshot = { growth: [], category: [], province: [], revenue: null, topPayers: [], queues: null, auditLog: [] };

function sum(rows: GrowthPoint[], key: 'users' | 'listings') { return rows.reduce((total, row) => total + row[key], 0); }
function fmt(value: number | null | undefined) { return value === null || value === undefined ? '—' : value.toLocaleString('en-ZW'); }
function money(value: number | null | undefined) { return value === null || value === undefined ? '—' : `$${Number(value).toLocaleString('en-ZW', { maximumFractionDigits: 0 })}`; }

function toCsv(snapshot: Snapshot): string {
  const lines: string[] = ['section,metric,value'];
  lines.push(`growth,new_users_14d,${sum(snapshot.growth, 'users')}`);
  lines.push(`growth,new_listings_14d,${sum(snapshot.growth, 'listings')}`);
  if (snapshot.queues) Object.entries(snapshot.queues).forEach(([key, value]) => lines.push(`queues,${key},${value}`));
  if (snapshot.revenue) Object.entries(snapshot.revenue).forEach(([key, value]) => lines.push(`revenue,${key},${value}`));
  snapshot.category.forEach((row) => lines.push(`category,${row.category},${row.n}`));
  snapshot.province.forEach((row) => lines.push(`province,${row.province},${row.n}`));
  snapshot.topPayers.forEach((row, index) => lines.push(`top_payer_${index + 1},business_id_${row.business_id},${row.total}`));
  return lines.join('\n');
}

export function OpsDashboardPage() {
  const auth = useAuth();
  const admin = auth.identity;
  const canReadAudit = Boolean(admin?.permissions.includes('audit.view'));

  const [snapshot, setSnapshot] = useState<Snapshot>(emptySnapshot);
  const [phase, setPhase] = useState<Phase>('loading');
  const [sectionErrors, setSectionErrors] = useState<string[]>([]);
  const [securityTotal, setSecurityTotal] = useState<number | null>(null);
  const [securityState, setSecurityState] = useState<'loading' | 'live' | 'unavailable' | 'unchecked'>('unchecked');

  const load = useCallback(async () => {
    if (auth.mode !== 'live') { setPhase('ready'); return; }
    setPhase('loading');
    setSectionErrors([]);
    const [growth, category, province, revenue, topPayers, queues, auditLog] = await Promise.all([
      getDailyGrowth(14), getCategoryBreakdown(), getProvinceBreakdown(),
      getRevenueSummary(30), getTopPayers(30, 5), getQueueCounts(), getRecentAuditLog(8),
    ]);
    const errors: string[] = [];
    if (growth.error) errors.push(`Growth: ${growth.error.message}`);
    if (category.error) errors.push(`Category breakdown: ${category.error.message}`);
    if (province.error) errors.push(`Province breakdown: ${province.error.message}`);
    if (revenue.error) errors.push(`Revenue summary: ${revenue.error.message}`);
    if (topPayers.error) errors.push(`Top payers: ${topPayers.error.message}`);
    if (queues.error) errors.push(`Queue counts: ${queues.error.message}`);
    if (auditLog.error) errors.push(`Audit log: ${auditLog.error.message}`);
    setSnapshot({
      growth: growth.data ?? [], category: category.data ?? [], province: province.data ?? [],
      revenue: revenue.data ?? null, topPayers: topPayers.data ?? [], queues: queues.data ?? null,
      auditLog: auditLog.data ?? [],
    });
    setSectionErrors(errors);
    setPhase('ready');
  }, [auth.mode]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (auth.mode !== 'live' || auth.assuranceLevel !== 'aal2' || !canReadAudit) return;
    let active = true;
    setSecurityState('loading');
    void listSecurityEvents({}, 1).then((result) => {
      if (!active) return;
      if (result.error) setSecurityState('unavailable');
      else { setSecurityTotal(result.data.total); setSecurityState('live'); }
    });
    return () => { active = false; };
  }, [auth.mode, auth.assuranceLevel, canReadAudit]);

  const exportCsv = useCallback(() => {
    const blob = new Blob([toCsv(snapshot)], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `pamarket-command-center-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }, [snapshot]);

  if (!admin) return null;
  const today = new Intl.DateTimeFormat('en-ZW', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Africa/Harare' }).format(new Date());
  const q = snapshot.queues;

  const metrics: [string, string, string, string][] = [
    ['New Users (14d)', fmt(sum(snapshot.growth, 'users')), 'admin_daily_growth', 'groups'],
    ['New Listings (14d)', fmt(sum(snapshot.growth, 'listings')), 'admin_daily_growth', 'sell'],
    ['Businesses', fmt(q?.businesses), 'businesses', 'storefront'],
    ['Pending Verify', fmt((q?.pendingVerifications ?? 0) + (q?.pendingBusinessVerifications ?? 0)), 'verifications + business_verifications', 'pending_actions'],
    ['In Moderation', fmt(q?.pendingListings), 'listings', 'fact_check'],
    ['Open Reports', fmt(q?.openReports), 'reports', 'report'],
    ['Open Appeals', fmt(q?.openAppeals), 'moderation_appeals', 'gavel'],
    ['Open Errors', fmt(q?.openErrors), 'app_error_events', 'bug_report'],
    ['Open Tickets', fmt(q?.openTickets), 'support_tickets', 'support_agent'],
  ];

  const queueRows: [string, string, number | undefined, string][] = [
    ['fact_check', 'Pending Listing Moderation', q?.pendingListings, '/marketplace/listings'],
    ['verified_user', 'Pending Business Verification', q?.pendingBusinessVerifications, '/marketplace/verifications'],
    ['badge', 'Pending KYC Verification', q?.pendingVerifications, '/marketplace/verifications'],
    ['report', 'Open Reports', q?.openReports, '/trust/reports'],
    ['gavel', 'Open Moderation Appeals', q?.openAppeals, '/trust/reports'],
    ['work', 'Pending Job Applications', q?.pendingApplications, '/marketplace/jobs'],
    ['directions_car', 'Rentals Pending Approval', q?.pendingRentals, '/rentals'],
    ['support_agent', 'Open Support Tickets', q?.openTickets, '/trust/support'],
  ];

  const categoryTotal = snapshot.category.reduce((total, row) => total + row.n, 0);
  const growthMax = Math.max(1, ...snapshot.growth.map((row) => row.listings));
  const growthPoints = snapshot.growth
    .map((row, index) => `${(index / Math.max(1, snapshot.growth.length - 1)) * 800},${150 - (row.listings / growthMax) * 140}`)
    .join(' ');

  return <div className="ops-dashboard">
    {auth.mode === 'mock' && <div className="preview-notice" role="note"><span className="material-symbols-outlined">science</span><strong>REFERENCE DATA MODE</strong><span>Live Supabase is not configured in this environment. Authentication and permission behavior remain connected to the admin shell; Dashboard figures cannot load.</span></div>}
    {phase === 'ready' && sectionErrors.length > 0 && <div className="preview-notice" role="alert"><span className="material-symbols-outlined">error</span><strong>SOME DASHBOARD DATA UNAVAILABLE</strong><span>{sectionErrors.join(' · ')}</span></div>}

    <section className="command-bar"><div><span className="command-label">CONTEXT:</span><span className="context-chip"><span className="material-symbols-outlined">calendar_today</span>Today ({today})</span><span className="context-chip muted"><span className="material-symbols-outlined">compare_arrows</span>Window: Last 14 Days</span></div><div><button onClick={exportCsv} disabled={phase !== 'ready'}><span className="material-symbols-outlined">download</span>Export KPI (CSV)</button><button onClick={() => void load()} disabled={phase === 'loading'} className="primary"><span className="material-symbols-outlined">refresh</span>{phase === 'loading' ? 'Refreshing…' : 'Refresh Dashboard'}</button></div></section>

    <section className="alert-grid" aria-label="Operational alerts">
      <article className="alert-card warning"><div><span className="alert-icon material-symbols-outlined">report</span><div><header><strong>OPEN REPORTS</strong><b>{fmt(q?.openReports)}</b></header><p>Unresolved marketplace reports awaiting moderator review.</p></div></div><footer><span>reports · status = open</span><Link to="/trust/reports">Review Queue</Link></footer></article>
      <article className="alert-card warning"><div><span className="alert-icon material-symbols-outlined">hourglass_top</span><div><header><strong>PENDING VERIFICATION</strong><b>{fmt((q?.pendingVerifications ?? 0) + (q?.pendingBusinessVerifications ?? 0))}</b></header><p>KYC and business verification submissions waiting on review.</p></div></div><footer><span>verifications + business_verifications</span><Link to="/marketplace/verifications">Review Queue</Link></footer></article>
      <article className="alert-card success"><div><span className="alert-icon material-symbols-outlined">shield_person</span><div><header><strong>SECURITY EVENTS</strong><b>{securityState === 'live' ? fmt(securityTotal) : securityState === 'loading' ? '…' : 'RESTRICTED'}</b></header><p>Server-owned authentication and honeypot evidence, available through the protected security-event review path.</p></div></div><footer><span>RLS + AAL2 boundary</span><Link to="/security/events">Inspect Events</Link></footer></article>
    </section>

    <section className="kpi-grid" aria-label="Core telemetry">{metrics.map(([label, value, source, icon]) => <article key={label}><header><span>{label}</span><span className="material-symbols-outlined">{icon}</span></header><strong>{phase === 'loading' ? '…' : value}</strong><small>{source}</small></article>)}</section>

    <section className="analytics-grid">
      <article className="ops-panel influx"><header className="panel-title"><div><span className="material-symbols-outlined">query_stats</span><h2>Listing Volume &amp; Category Mix</h2></div><span>14-DAY WINDOW · LIVE</span></header>
        <div className="chart"><div className="grid-lines" /><svg viewBox="0 0 800 150" preserveAspectRatio="none" aria-label="Daily new listings, last 14 days">
          {snapshot.growth.length > 0 ? <polyline points={growthPoints} fill="none" stroke="#68dba9" strokeWidth="3" /> : <text x="20" y="80" fill="#8aa" fontSize="14">No listing growth data yet.</text>}
        </svg></div>
        <div className="category-bars">{snapshot.category.length > 0
          ? snapshot.category.map((row) => <div key={row.category}><span>{row.category}</span><i><b style={{ width: `${categoryTotal ? (row.n / categoryTotal) * 100 : 0}%` }} /></i><strong>{fmt(row.n)}</strong></div>)
          : <p>No category data yet.</p>}</div>
      </article>
      <article className="ops-panel geo"><header className="panel-title"><div><span className="material-symbols-outlined">public</span><h2>Provincial Activity Grid</h2></div><span>LIVE · LISTINGS BY PROVINCE</span></header><ZimbabweActivityMap data={snapshot.province} /></article>
    </section>

    <section className="ops-panel finance-panel" aria-label="Revenue"><header className="panel-title"><div><span className="material-symbols-outlined">payments</span><h2>Revenue (Last 30 Days)</h2></div><span>admin_revenue_summary</span></header>
      {snapshot.revenue
        ? <div className="finance-grid"><div><span>Subscriptions paid</span><strong>{money(snapshot.revenue.subs_paid)}</strong></div><div><span>Other paid</span><strong>{money(snapshot.revenue.other_paid)}</strong></div><div><span>Ads revenue</span><strong>{money(snapshot.revenue.ads_revenue)}</strong></div><div><span>Transactions</span><strong>{fmt(snapshot.revenue.txn_count)}</strong></div><div><span>Subs pending</span><strong>{fmt(snapshot.revenue.subs_pending)}</strong></div><div><span>Subs failed</span><strong>{fmt(snapshot.revenue.subs_failed)}</strong></div></div>
        : <p>{phase === 'loading' ? 'Loading revenue…' : 'Revenue summary unavailable.'}</p>}
      {snapshot.topPayers.length > 0 && <ol className="top-payers">{snapshot.topPayers.map((row) => <li key={row.business_id}>{row.business_id.slice(0, 8)}… — {money(row.total)} ({fmt(row.payments)} payments)</li>)}</ol>}
    </section>

    <section className="ops-panel queue-panel"><header className="queue-head"><div><span className="material-symbols-outlined">checklist_rtl</span><h2>Operational Queue Matrix</h2></div></header><div className="table-scroll"><table className="ops-table"><thead><tr><th>Queue Name</th><th>Pending Count</th><th>Action</th></tr></thead><tbody>{queueRows.map(([icon, name, count, path]) => <tr key={name}><td><span className="material-symbols-outlined">{icon}</span><strong>{name}</strong></td><td><b className={count ? 'count attention' : 'count'}>{phase === 'loading' ? '…' : fmt(count)}</b></td><td><Link to={path}>Open</Link></td></tr>)}</tbody></table></div></section>

    <section className="ops-panel audit-panel"><header className="panel-title"><div><span className="material-symbols-outlined">history</span><h2>Recent Administrator Actions</h2></div><span className="live-label"><i />admin_audit_logs</span></header>
      {phase === 'loading' ? <p>Loading…</p>
        : snapshot.auditLog.length === 0 ? <p>No recent administrator actions recorded.</p>
        : <div className="audit-list">{snapshot.auditLog.map((row) => <div className="audit-row" key={row.id}><time>{new Intl.DateTimeFormat('en-ZW', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Africa/Harare' }).format(new Date(row.created_at))}</time><span className="audit-icon material-symbols-outlined">history</span><div><header><strong>{row.actor_role?.replace('_', ' ').toUpperCase() ?? 'ADMIN'}</strong><b>{row.action.replaceAll('_', ' ').toUpperCase()}</b></header><p>{row.entity}{row.entity_id ? ` · ${row.entity_id}` : ''}{row.reason ? ` · ${row.reason}` : ''}</p></div></div>)}</div>}
      <footer><span>OPERATIONAL AUDIT LOG · NOT EVIDENCE-GRADE</span><Link to="/security/events">Open protected security-event log</Link></footer>
    </section>
  </div>;
}
