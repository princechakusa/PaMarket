import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../security/auth-context';
import {
  listRentalCompanies, decideRentalCompany, listRentalListings, decideRentalListing,
  listRentalReports, resolveRentalReport, listFeaturedListings, setFeaturedActive,
  getRentalAnalyticsSummary, listRentalAuditLogs, listRentalBrands, listRentalCategories, listRentalLocations,
  setBrandActive, setCategoryActive, setLocationActive, RENTALS_PAGE_SIZE,
  type RentalCompanyRow, type RentalListingRow, type RentalReportRow, type FeaturedListingRow,
  type RentalAnalyticsSummary, type RentalAuditLogRow, type LookupRow, type RentalLocationRow,
} from '../services/rentals/query';
import { listRentalReviews, updateRentalReviewStatus, type RentalReviewRow } from '../services/reviews/query';

type Tab = 'dashboard' | 'approvals' | 'companies' | 'listings' | 'reports' | 'reviews' | 'featured' | 'analytics' | 'audit' | 'lookups';
const tabFromPath: Record<string, Tab> = {
  '/rentals': 'dashboard', '/rentals/approvals': 'approvals', '/rentals/companies': 'companies',
  '/rentals/listings': 'listings', '/rentals/reports': 'reports', '/rentals/reviews': 'reviews',
  '/rentals/featured': 'featured', '/rentals/analytics': 'analytics', '/rentals/audit': 'audit', '/rentals/lookups': 'lookups',
};
const tabLabels: [Tab, string][] = [['dashboard', 'Dashboard'], ['approvals', 'Approvals'], ['companies', 'Companies'], ['listings', 'All Listings'], ['reports', 'Reports'], ['reviews', 'Reviews'], ['featured', 'Featured'], ['analytics', 'Analytics'], ['audit', 'Audit Logs'], ['lookups', 'Lookups']];

function fmtDate(value: string | null) { return value ? new Intl.DateTimeFormat('en-ZW', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Harare' }).format(new Date(value)) : '—'; }

export function VehicleRentalsPage() {
  const auth = useAuth();
  const location = useLocation();
  const [tab, setTab] = useState<Tab>(tabFromPath[location.pathname] ?? 'dashboard');
  const [message, setMessage] = useState<string | null>(null);

  return <div className="directory-page">
    {auth.mode === 'mock' && <div className="directory-reference" role="note"><span className="material-symbols-outlined">science</span><b>REFERENCE DATA MODE</b><span>Live Supabase is not configured in this environment.</span></div>}
    <div className="directory-breadcrumb">PAMARKET OPS / RENTALS / <b>{tab.toUpperCase()}</b></div>
    <header className="directory-hero"><div><small>PRODUCTION VEHICLE RENTALS</small><h1>Rentals</h1><p>One consolidated workspace over the real rental_* tables.</p></div></header>
    <nav className="listing-tabs" aria-label="Rentals section"><div>{tabLabels.map(([value, label]) => <button key={value} className={tab === value ? 'active' : ''} onClick={() => { setTab(value); setMessage(null); }}>{label}</button>)}</div></nav>
    {message && <p role="status">{message}</p>}
    {tab === 'dashboard' && <RentalsDashboard mode={auth.mode} />}
    {tab === 'approvals' && <RentalsApprovals mode={auth.mode} onMessage={setMessage} />}
    {tab === 'companies' && <RentalsCompanies mode={auth.mode} actorId={auth.identity?.id ?? ''} onMessage={setMessage} />}
    {tab === 'listings' && <RentalsListings mode={auth.mode} onMessage={setMessage} />}
    {tab === 'reports' && <RentalsReports mode={auth.mode} actorId={auth.identity?.id ?? ''} onMessage={setMessage} />}
    {tab === 'reviews' && <RentalsReviews mode={auth.mode} onMessage={setMessage} />}
    {tab === 'featured' && <RentalsFeatured mode={auth.mode} onMessage={setMessage} />}
    {tab === 'analytics' && <RentalsAnalytics mode={auth.mode} />}
    {tab === 'audit' && <RentalsAudit mode={auth.mode} />}
    {tab === 'lookups' && <RentalsLookups mode={auth.mode} onMessage={setMessage} />}
  </div>;
}

function RentalsDashboard({ mode }: { mode: string }) {
  const [summary, setSummary] = useState<RentalAnalyticsSummary | null>(null);
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading');
  useEffect(() => { if (mode !== 'live') { setPhase('ready'); return; } void getRentalAnalyticsSummary().then((r) => { if (r.error) setPhase('error'); else { setSummary(r.data); setPhase('ready'); } }); }, [mode]);
  return <section className="kpi-grid" aria-label="Rentals overview">{[
    ['Companies', summary?.totalCompanies], ['Active companies', summary?.activeCompanies],
    ['Listings', summary?.totalListings], ['Approved listings', summary?.approvedListings],
    ['Pending approval', summary?.pendingListings], ['Total views', summary?.totalViews],
  ].map(([label, value]) => <article key={label as string}><header><span>{label}</span></header><strong>{phase === 'loading' ? '…' : phase === 'error' ? '—' : (value ?? 0)}</strong></article>)}</section>;
}

function RentalsApprovals({ mode, onMessage }: { mode: string; onMessage: (m: string) => void }) {
  const [rows, setRows] = useState<RentalListingRow[]>([]);
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading');
  const load = useCallback(async () => {
    if (mode !== 'live') { setPhase('ready'); return; }
    setPhase('loading');
    const result = await listRentalListings({ adminStatus: 'pending_review' }, 1);
    if (result.error) { setPhase('error'); return; }
    setRows(result.data.rows);
    setPhase('ready');
  }, [mode]);
  useEffect(() => { void load(); }, [load]);
  async function decide(id: string, status: 'approved' | 'rejected') {
    const result = await decideRentalListing(id, status);
    onMessage(result.error ? `Failed: ${result.error.message}` : `Listing ${status}.`);
    void load();
  }
  return <section className="ops-panel"><header className="panel-title"><h2>Pending Listing Approvals</h2></header>
    <div className="directory-table-scroll"><table aria-label="Pending rental listings"><thead><tr><th>Model</th><th>Year</th><th>Daily rate</th><th>Submitted</th><th>Actions</th></tr></thead>
      <tbody>{rows.map((r) => <tr key={r.id}><td>{r.model ?? '—'}</td><td>{r.year ?? '—'}</td><td>{r.daily_rate !== null ? `$${r.daily_rate}` : '—'}</td><td>{fmtDate(r.created_at)}</td>
        <td><div className="jobs-actions"><button onClick={() => void decide(r.id, 'approved')}>Approve</button><button onClick={() => void decide(r.id, 'rejected')}>Reject</button></div></td>
      </tr>)}</tbody></table>{phase === 'ready' && rows.length === 0 && <p>No pending approvals.</p>}{phase === 'error' && <p role="alert">Could not load approvals.</p>}</div>
  </section>;
}

function RentalsCompanies({ mode, actorId, onMessage }: { mode: string; actorId: string; onMessage: (m: string) => void }) {
  const [rows, setRows] = useState<RentalCompanyRow[]>([]);
  const [status, setStatus] = useState('');
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading');
  const load = useCallback(async () => {
    if (mode !== 'live') { setPhase('ready'); return; }
    setPhase('loading');
    const result = await listRentalCompanies(status || undefined, 1);
    if (result.error) { setPhase('error'); return; }
    setRows(result.data.rows);
    setPhase('ready');
  }, [mode, status]);
  useEffect(() => { void load(); }, [load]);
  async function decide(id: string, next: 'active' | 'rejected') {
    const result = await decideRentalCompany(id, next, actorId);
    onMessage(result.error ? `Failed: ${result.error.message}` : `Company ${next}.`);
    void load();
  }
  return <section className="ops-panel"><header className="panel-title"><h2>Rental Companies</h2><select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">ALL</option><option value="pending">PENDING</option><option value="active">ACTIVE</option><option value="rejected">REJECTED</option></select></header>
    <div className="directory-table-scroll"><table aria-label="Rental companies"><thead><tr><th>Company</th><th>Status</th><th>Fleet</th><th>Rating</th><th>Actions</th></tr></thead>
      <tbody>{rows.map((r) => <tr key={r.id}><td>{r.trading_name ?? '—'}</td><td>{r.status ?? '—'}</td><td>{r.fleet_count ?? 0}</td><td>{r.avg_rating ?? '—'} ({r.review_count ?? 0})</td>
        <td><div className="jobs-actions">{r.status === 'pending' && <><button onClick={() => void decide(r.id, 'active')}>Approve</button><button onClick={() => void decide(r.id, 'rejected')}>Reject</button></>}</div></td>
      </tr>)}</tbody></table>{phase === 'ready' && rows.length === 0 && <p>No companies match.</p>}{phase === 'error' && <p role="alert">Could not load companies.</p>}</div>
  </section>;
}

function RentalsListings({ mode, onMessage }: { mode: string; onMessage: (m: string) => void }) {
  const [rows, setRows] = useState<RentalListingRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading');
  const load = useCallback(async () => {
    if (mode !== 'live') { setPhase('ready'); return; }
    setPhase('loading');
    const result = await listRentalListings({}, page);
    if (result.error) { setPhase('error'); return; }
    setRows(result.data.rows);
    setTotal(result.data.total);
    setPhase('ready');
  }, [mode, page]);
  useEffect(() => { void load(); }, [load]);
  const pageCount = Math.max(1, Math.ceil(total / RENTALS_PAGE_SIZE));
  async function decide(id: string, status: 'approved' | 'rejected') {
    const result = await decideRentalListing(id, status);
    onMessage(result.error ? `Failed: ${result.error.message}` : `Listing ${status}.`);
    void load();
  }
  return <section className="ops-panel"><header className="panel-title"><h2>All Rental Listings</h2><span>Page {page} of {pageCount}</span></header>
    <div className="directory-table-scroll"><table aria-label="All rental listings"><thead><tr><th>Model</th><th>Year</th><th>Rate</th><th>Status</th><th>Admin status</th><th>Views</th><th>Actions</th></tr></thead>
      <tbody>{rows.map((r) => <tr key={r.id}><td>{r.model ?? '—'}</td><td>{r.year ?? '—'}</td><td>{r.daily_rate !== null ? `$${r.daily_rate}` : '—'}</td><td>{r.status ?? '—'}</td><td>{r.admin_status ?? '—'}</td><td>{r.view_count ?? 0}</td>
        <td><div className="jobs-actions">{r.admin_status !== 'approved' && <button onClick={() => void decide(r.id, 'approved')}>Approve</button>}{r.admin_status !== 'rejected' && <button onClick={() => void decide(r.id, 'rejected')}>Reject</button>}</div></td>
      </tr>)}</tbody></table>{phase === 'ready' && rows.length === 0 && <p>No listings.</p>}{phase === 'error' && <p role="alert">Could not load listings.</p>}</div>
    <div><button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Prev</button><button disabled={page >= pageCount} onClick={() => setPage((p) => Math.min(pageCount, p + 1))}>Next</button></div>
  </section>;
}

function RentalsReports({ mode, actorId, onMessage }: { mode: string; actorId: string; onMessage: (m: string) => void }) {
  const [rows, setRows] = useState<RentalReportRow[]>([]);
  const [status, setStatus] = useState('');
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading');
  const load = useCallback(async () => {
    if (mode !== 'live') { setPhase('ready'); return; }
    setPhase('loading');
    const result = await listRentalReports(status || undefined, 1);
    if (result.error) { setPhase('error'); return; }
    setRows(result.data.rows);
    setPhase('ready');
  }, [mode, status]);
  useEffect(() => { void load(); }, [load]);
  async function resolve(id: string, next: string) {
    const result = await resolveRentalReport(id, next, actorId);
    onMessage(result.error ? `Failed: ${result.error.message}` : `Report ${next}.`);
    void load();
  }
  return <section className="ops-panel"><header className="panel-title"><h2>Rental Reports</h2><select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">ALL</option><option value="open">OPEN</option><option value="resolved">RESOLVED</option><option value="dismissed">DISMISSED</option></select></header>
    <div className="directory-table-scroll"><table aria-label="Rental reports"><thead><tr><th>Listing</th><th>Reason</th><th>Severity</th><th>Status</th><th>Created</th><th>Actions</th></tr></thead>
      <tbody>{rows.map((r) => <tr key={r.id}><td><code>{r.listing_id?.slice(0, 8) ?? '—'}…</code></td><td>{r.reason ?? '—'}</td><td>{r.severity ?? '—'}</td><td>{r.status ?? '—'}</td><td>{fmtDate(r.created_at)}</td>
        <td><div className="jobs-actions"><button onClick={() => void resolve(r.id, 'resolved')}>Resolve</button><button onClick={() => void resolve(r.id, 'dismissed')}>Dismiss</button></div></td>
      </tr>)}</tbody></table>{phase === 'ready' && rows.length === 0 && <p>No reports match.</p>}{phase === 'error' && <p role="alert">Could not load reports.</p>}</div>
  </section>;
}

function RentalsReviews({ mode, onMessage }: { mode: string; onMessage: (m: string) => void }) {
  const [rows, setRows] = useState<RentalReviewRow[]>([]);
  const [status, setStatus] = useState('');
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading');
  const load = useCallback(async () => {
    if (mode !== 'live') { setPhase('ready'); return; }
    setPhase('loading');
    const result = await listRentalReviews(status || undefined, 1);
    if (result.error) { setPhase('error'); return; }
    setRows(result.data.rows);
    setPhase('ready');
  }, [mode, status]);
  useEffect(() => { void load(); }, [load]);
  async function decide(id: string, next: string) {
    const result = await updateRentalReviewStatus(id, next);
    onMessage(result.error ? `Failed: ${result.error.message}` : `Review ${next}.`);
    void load();
  }
  return <section className="ops-panel"><header className="panel-title"><h2>Rental Reviews</h2><select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">ALL</option><option value="published">PUBLISHED</option><option value="pending">PENDING</option><option value="hidden">HIDDEN</option></select></header>
    <div className="directory-table-scroll"><table aria-label="Rental reviews"><thead><tr><th>Reviewer</th><th>Rating</th><th>Title</th><th>Status</th><th>Actions</th></tr></thead>
      <tbody>{rows.map((r) => <tr key={r.id}><td>{r.reviewer_name ?? '—'}</td><td>{r.rating ?? '—'}</td><td>{r.title ?? '—'}</td><td>{r.status ?? '—'}</td>
        <td><div className="jobs-actions"><button onClick={() => void decide(r.id, 'published')}>Publish</button><button onClick={() => void decide(r.id, 'hidden')}>Hide</button></div></td>
      </tr>)}</tbody></table>{phase === 'ready' && rows.length === 0 && <p>No reviews match.</p>}{phase === 'error' && <p role="alert">Could not load reviews.</p>}</div>
  </section>;
}

function RentalsFeatured({ mode, onMessage }: { mode: string; onMessage: (m: string) => void }) {
  const [rows, setRows] = useState<FeaturedListingRow[]>([]);
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading');
  const load = useCallback(async () => {
    if (mode !== 'live') { setPhase('ready'); return; }
    setPhase('loading');
    const result = await listFeaturedListings(1);
    if (result.error) { setPhase('error'); return; }
    setRows(result.data.rows);
    setPhase('ready');
  }, [mode]);
  useEffect(() => { void load(); }, [load]);
  async function toggle(id: string, next: boolean) {
    const result = await setFeaturedActive(id, next);
    onMessage(result.error ? `Failed: ${result.error.message}` : `Featured slot ${next ? 'activated' : 'deactivated'}.`);
    void load();
  }
  return <section className="ops-panel"><header className="panel-title"><h2>Featured Listings</h2></header>
    <div className="directory-table-scroll"><table aria-label="Featured rental listings"><thead><tr><th>Listing</th><th>Window</th><th>Priority</th><th>Active</th><th>Actions</th></tr></thead>
      <tbody>{rows.map((r) => <tr key={r.id}><td><code>{r.listing_id?.slice(0, 8) ?? '—'}…</code></td><td>{fmtDate(r.starts_at)} – {fmtDate(r.ends_at)}</td><td>{r.priority ?? '—'}</td><td>{r.is_active ? 'Yes' : 'No'}</td>
        <td><div className="jobs-actions">{r.is_active ? <button onClick={() => void toggle(r.id, false)}>Deactivate</button> : <button onClick={() => void toggle(r.id, true)}>Activate</button>}</div></td>
      </tr>)}</tbody></table>{phase === 'ready' && rows.length === 0 && <p>No featured listings.</p>}{phase === 'error' && <p role="alert">Could not load featured listings.</p>}</div>
  </section>;
}

function RentalsAnalytics({ mode }: { mode: string }) {
  const [summary, setSummary] = useState<RentalAnalyticsSummary | null>(null);
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading');
  useEffect(() => { if (mode !== 'live') { setPhase('ready'); return; } void getRentalAnalyticsSummary().then((r) => { if (r.error) setPhase('error'); else { setSummary(r.data); setPhase('ready'); } }); }, [mode]);
  return <section className="ops-panel"><header className="panel-title"><h2>Rental Analytics</h2><span>Real stored counters only</span></header>
    {phase === 'error' ? <p role="alert">Could not load analytics.</p> : <dl>
      <div><dt>Total companies</dt><dd>{summary?.totalCompanies ?? '…'}</dd></div>
      <div><dt>Active companies</dt><dd>{summary?.activeCompanies ?? '…'}</dd></div>
      <div><dt>Total listings</dt><dd>{summary?.totalListings ?? '…'}</dd></div>
      <div><dt>Approved listings</dt><dd>{summary?.approvedListings ?? '…'}</dd></div>
      <div><dt>Pending approval</dt><dd>{summary?.pendingListings ?? '…'}</dd></div>
      <div><dt>Total views (all listings)</dt><dd>{summary?.totalViews ?? '…'}</dd></div>
      <div><dt>Total inquiries (all listings)</dt><dd>{summary?.totalInquiries ?? '…'}</dd></div>
    </dl>}
  </section>;
}

function RentalsAudit({ mode }: { mode: string }) {
  const [rows, setRows] = useState<RentalAuditLogRow[]>([]);
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading');
  useEffect(() => { if (mode !== 'live') { setPhase('ready'); return; } void listRentalAuditLogs(1).then((r) => { if (r.error) setPhase('error'); else { setRows(r.data.rows); setPhase('ready'); } }); }, [mode]);
  return <section className="ops-panel"><header className="panel-title"><h2>Rental Audit Logs</h2><span>Operational — not evidence-grade</span></header>
    <div className="directory-table-scroll"><table aria-label="Rental audit logs"><thead><tr><th>Actor role</th><th>Action</th><th>Target</th><th>When</th></tr></thead>
      <tbody>{rows.map((r) => <tr key={r.id}><td>{r.actor_role ?? '—'}</td><td>{r.action ?? '—'}</td><td>{r.target_table ?? '—'} {r.target_id?.slice(0, 8) ?? ''}</td><td>{fmtDate(r.created_at)}</td></tr>)}</tbody>
    </table>{phase === 'ready' && rows.length === 0 && <p>No audit log entries.</p>}{phase === 'error' && <p role="alert">Could not load audit logs.</p>}</div>
  </section>;
}

function RentalsLookups({ mode, onMessage }: { mode: string; onMessage: (m: string) => void }) {
  const [brands, setBrands] = useState<LookupRow[]>([]);
  const [categories, setCategories] = useState<LookupRow[]>([]);
  const [locations, setLocations] = useState<RentalLocationRow[]>([]);
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading');
  const load = useCallback(async () => {
    if (mode !== 'live') { setPhase('ready'); return; }
    setPhase('loading');
    const [b, c, l] = await Promise.all([listRentalBrands(), listRentalCategories(), listRentalLocations()]);
    if (b.error || c.error || l.error) { setPhase('error'); return; }
    setBrands(b.data ?? []); setCategories(c.data ?? []); setLocations(l.data ?? []);
    setPhase('ready');
  }, [mode]);
  useEffect(() => { void load(); }, [load]);
  const items = useMemo(() => [
    { title: 'Brands', rows: brands, toggle: setBrandActive },
    { title: 'Categories', rows: categories, toggle: setCategoryActive },
  ], [brands, categories]);
  async function toggleGeneric(fn: (id: string, active: boolean) => Promise<{ error: unknown }>, id: string, active: boolean) {
    const result = await fn(id, active);
    onMessage(result.error ? 'Failed to update.' : 'Updated.');
    void load();
  }
  return <>
    {phase === 'error' && <p role="alert">Could not load lookups.</p>}
    {items.map((group) => <section className="ops-panel" key={group.title}><header className="panel-title"><h2>{group.title}</h2></header>
      <div className="directory-table-scroll"><table aria-label={group.title}><thead><tr><th>Label</th><th>Active</th><th>Actions</th></tr></thead>
        <tbody>{group.rows.map((r) => <tr key={r.id}><td>{r.label ?? '—'}</td><td>{r.is_active ? 'Yes' : 'No'}</td>
          <td><button onClick={() => void toggleGeneric(group.toggle, r.id, !r.is_active)}>{r.is_active ? 'Deactivate' : 'Activate'}</button></td>
        </tr>)}</tbody></table>{group.rows.length === 0 && <p>None.</p>}</div>
    </section>)}
    <section className="ops-panel"><header className="panel-title"><h2>Locations</h2></header>
      <div className="directory-table-scroll"><table aria-label="Locations"><thead><tr><th>City</th><th>Province</th><th>Active</th><th>Actions</th></tr></thead>
        <tbody>{locations.map((r) => <tr key={r.id}><td>{r.city ?? '—'}</td><td>{r.province ?? '—'}</td><td>{r.is_active ? 'Yes' : 'No'}</td>
          <td><button onClick={() => void toggleGeneric(setLocationActive, r.id, !r.is_active)}>{r.is_active ? 'Deactivate' : 'Activate'}</button></td>
        </tr>)}</tbody></table>{locations.length === 0 && <p>None.</p>}</div>
    </section>
  </>;
}
