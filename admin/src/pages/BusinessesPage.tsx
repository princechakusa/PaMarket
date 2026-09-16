import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../security/auth-context';
import {
  listBusinesses, getBusiness, getBusinessListingsCount, getBusinessStaff, getBusinessPaymentsTotal, getBusinessLeads,
  BUSINESSES_PAGE_SIZE, type BusinessRow, type BusinessDetail, type BusinessStaffRow, type BusinessLeadRow,
} from '../services/businesses/query';

function fmtDate(value: string | null) { return value ? new Intl.DateTimeFormat('en-ZW', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Africa/Harare' }).format(new Date(value)) : '—'; }

export function BusinessesPage() {
  const auth = useAuth();
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<BusinessRow[]>([]);
  const [total, setTotal] = useState(0);
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<BusinessDetail | null>(null);
  const [listingsCount, setListingsCount] = useState(0);
  const [staff, setStaff] = useState<BusinessStaffRow[]>([]);
  const [payments, setPayments] = useState<{ count: number; totalPaid: number } | null>(null);
  const [leads, setLeads] = useState<BusinessLeadRow[]>([]);
  const [detailPhase, setDetailPhase] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');

  const load = useCallback(async () => {
    if (auth.mode !== 'live') { setPhase('ready'); return; }
    setPhase('loading');
    setError(null);
    const result = await listBusinesses({ status: status || undefined, search: search || undefined }, page);
    if (result.error) { setError(result.error.message); setPhase('error'); return; }
    setRows(result.data.rows);
    setTotal(result.data.total);
    setPhase('ready');
  }, [auth.mode, status, search, page]);

  useEffect(() => { void load(); }, [load]);

  const loadDetail = useCallback(async (id: string) => {
    setSelectedId(id);
    setDetailPhase('loading');
    const businessResult = await getBusiness(id);
    if (businessResult.error) { setDetailPhase('error'); return; }
    const [listingsResult, staffResult, paymentsResult, leadsResult] = await Promise.all([
      getBusinessListingsCount(id), getBusinessStaff(id), getBusinessPaymentsTotal(id), getBusinessLeads(id),
    ]);
    setDetail(businessResult.data);
    setListingsCount(listingsResult.data ?? 0);
    setStaff(staffResult.data ?? []);
    setPayments(paymentsResult.data);
    setLeads(leadsResult.data ?? []);
    setDetailPhase('ready');
  }, []);

  const pageCount = Math.max(1, Math.ceil(total / BUSINESSES_PAGE_SIZE));

  return <div className="directory-page">
    {auth.mode === 'mock' && <div className="directory-reference" role="note"><span className="material-symbols-outlined">science</span><b>REFERENCE DATA MODE</b><span>Live Supabase is not configured in this environment.</span></div>}
    <div className="directory-breadcrumb">PAMARKET OPS / BUSINESS PLATFORM / <b>BUSINESSES</b></div>
    <header className="directory-hero"><div><small>PRODUCTION BUSINESS PLATFORM</small><h1>Businesses</h1><p>Real business records, staff, and financial summary. Verification and reviews link out to their own dedicated workspaces rather than duplicating them here.</p></div></header>

    <section className="directory-filters" aria-label="Business filters"><div>
      <label className="directory-search"><span className="material-symbols-outlined">search</span><input aria-label="Search businesses" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search name or business ID" /></label>
      <select aria-label="Status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}><option value="">STATUS: ALL</option><option value="draft">DRAFT</option><option value="pending_activation">PENDING ACTIVATION</option><option value="active">ACTIVE</option><option value="suspended">SUSPENDED</option></select>
      <button onClick={() => { setStatus(''); setSearch(''); setPage(1); void load(); }} aria-label="Reset filters"><span className="material-symbols-outlined">restart_alt</span></button>
    </div></section>

    <div className="directory-workspace">
      <section className="directory-ledger">
        <header><span aria-live="polite">{phase === 'loading' ? 'Loading…' : `${total.toLocaleString('en-ZW')} business(es)`}</span>
          <div><button disabled={page <= 1 || phase === 'loading'} onClick={() => setPage((p) => Math.max(1, p - 1))}>Prev</button><span>Page {page} of {pageCount}</span><button disabled={page >= pageCount || phase === 'loading'} onClick={() => setPage((p) => Math.min(pageCount, p + 1))}>Next</button></div>
        </header>
        <div className="directory-table-scroll">
          {phase === 'error' && <div className="directory-empty" role="alert">Could not load businesses: {error}</div>}
          {phase !== 'error' && <table aria-label="Businesses"><thead><tr><th>Name</th><th>Category</th><th>Location</th><th>Plan</th><th>Status</th><th>Created</th></tr></thead>
            <tbody>{rows.map((row) => <tr key={row.id} className={selectedId === row.id ? 'selected' : ''} onClick={() => void loadDetail(row.id)} style={{ cursor: 'pointer' }}>
              <td>{row.name ?? 'Unnamed'}</td><td>{row.category ?? '—'}</td><td>{row.city ?? '—'}{row.province ? `, ${row.province}` : ''}</td><td>{row.plan_id ?? 'free'}</td><td>{row.status ?? '—'}</td><td>{fmtDate(row.created_at)}</td>
            </tr>)}</tbody></table>}
          {phase === 'ready' && rows.length === 0 && <div className="directory-empty" role="status">No businesses match these filters.</div>}
        </div>
      </section>

      <aside className="directory-inspector" aria-label="Business detail">
        {!selectedId && <p>Select a business to view real production detail.</p>}
        {selectedId && detailPhase === 'loading' && <p>Loading…</p>}
        {selectedId && detailPhase === 'error' && <p role="alert">Could not load business detail.</p>}
        {selectedId && detailPhase === 'ready' && detail && <>
          <header><span className="material-symbols-outlined">storefront</span><div><small>BUSINESS</small><strong>{detail.name ?? 'Unnamed'}</strong></div><b>{detail.status?.toUpperCase() ?? '—'}</b></header>
          <section><h3>Details</h3><dl>
            <div><dt>Category</dt><dd>{detail.category ?? '—'}</dd></div>
            <div><dt>Type</dt><dd>{detail.biz_type ?? '—'}</dd></div>
            <div><dt>Phone</dt><dd>{detail.phone ?? '—'}</dd></div>
            <div><dt>Email</dt><dd>{detail.email ?? '—'}</dd></div>
            <div><dt>Location</dt><dd>{detail.city ?? '—'}{detail.suburb ? `, ${detail.suburb}` : ''}{detail.province ? `, ${detail.province}` : ''}</dd></div>
            {detail.latitude != null && detail.longitude != null && (
              <div><dt>Map</dt><dd><a href={`https://www.openstreetmap.org/?mlat=${detail.latitude}&mlon=${detail.longitude}#map=16/${detail.latitude}/${detail.longitude}`} target="_blank" rel="noreferrer noopener">View on OpenStreetMap ↗</a></dd></div>
            )}
            <div><dt>Plan</dt><dd>{detail.plan_id ?? 'free'}</dd></div>
            <div><dt>Verification level</dt><dd>{detail.verification_level ?? 0}{detail.verification_pending ? ' (pending review)' : ''}</dd></div>
            <div><dt>Created</dt><dd>{fmtDate(detail.created_at)}</dd></div>
            <div><dt>Owner</dt><dd><code>{detail.owner_user_id?.slice(0, 8) ?? '—'}…</code></dd></div>
          </dl></section>
          <section><h3>Activity</h3><dl>
            <div><dt>Listings</dt><dd>{listingsCount}</dd></div>
            <div><dt>Staff</dt><dd>{staff.length}</dd></div>
            <div><dt>Payments (paid)</dt><dd>{payments ? `$${payments.totalPaid.toLocaleString('en-ZW')} across ${payments.count} record(s)` : '—'}</dd></div>
            <div><dt>Recent leads</dt><dd>{leads.length} shown (most recent 20)</dd></div>
          </dl></section>
          {staff.length > 0 && <section><h3>Staff</h3><ul>{staff.map((s) => <li key={s.id}><code>{s.user_id?.slice(0, 8) ?? '—'}…</code> — {s.role} ({s.status})</li>)}</ul></section>}
          <section><h3>Customer Leads</h3>
            <p style={{ fontSize: 12 }}>Call/WhatsApp/Chat inquiries from buyers. The business owner already manages these in the app — this is oversight visibility only.</p>
            {leads.length === 0 && <p><small>No leads yet for this business.</small></p>}
            {leads.length > 0 && <ul>{leads.map((l) => <li key={l.id}>
              <span className="material-symbols-outlined" style={{ fontSize: 14, verticalAlign: 'middle' }}>{l.type === 'whatsapp' ? 'chat' : l.type === 'call' ? 'call' : 'forum'}</span>
              {' '}{l.user_name ?? 'A buyer'} · <span className={`status-pill ${l.status === 'closed' ? 'approved' : 'pending'}`}>{l.status ?? '—'}</span> · {fmtDate(l.created_at)}
            </li>)}</ul>}
          </section>
          <p><small>Business verification status and reviews are managed in the Verifications and Reviews workspaces — not duplicated here.</small></p>
        </>}
      </aside>
    </div>
  </div>;
}
