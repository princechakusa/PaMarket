import { useCallback, useEffect, useState } from 'react';
import {
  listListings, getListing, getListingReports, updateListingStatus, listApplicationsForJob,
  LISTINGS_PAGE_SIZE, LISTING_CATEGORIES, LISTING_STATUSES,
  type ListingRow, type ListingDetail, type ListingReportRow, type ApplicationRow,
} from '../services/marketplace/query';
import { useAuth } from '../security/auth-context';

const provinces = ['Harare', 'Bulawayo', 'Manicaland', 'Midlands', 'Masvingo', 'Mashonaland East', 'Mashonaland West', 'Mashonaland Central', 'Matabeleland North', 'Matabeleland South'];
const categoryTabs = [
  { label: 'All', value: '' },
  { label: 'Jobs', value: 'jobs' },
  { label: 'Services', value: 'services' },
  { label: 'Property', value: 'property' },
  { label: 'Vehicle Sales', value: 'vehicles' },
];
const moreCategories = LISTING_CATEGORIES.filter((c) => !['jobs', 'services', 'property', 'vehicles'].includes(c));

function fmtDate(value: string | null) { return value ? new Intl.DateTimeFormat('en-ZW', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Harare' }).format(new Date(value)) : '—'; }
function fmtMoney(price: number | null, currency: string | null) { return price === null ? '—' : `${currency ?? 'USD'} ${price.toLocaleString('en-ZW')}`; }

export function ListingsModerationPage({ fixedCategory }: { fixedCategory?: string } = {}) {
  const auth = useAuth();
  const [category, setCategory] = useState(fixedCategory ?? '');
  const [status, setStatus] = useState('');
  const [province, setProvince] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<ListingRow[]>([]);
  const [total, setTotal] = useState(0);
  const [listPhase, setListPhase] = useState<'loading' | 'ready' | 'error'>('loading');
  const [listError, setListError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ListingDetail | null>(null);
  const [reports, setReports] = useState<ListingReportRow[]>([]);
  const [applications, setApplications] = useState<ApplicationRow[]>([]);
  const [detailPhase, setDetailPhase] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [detailError, setDetailError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (auth.mode !== 'live') { setListPhase('ready'); return; }
    setListPhase('loading');
    setListError(null);
    const result = await listListings({ category: category || undefined, status: status || undefined, province: province || undefined, search: search || undefined }, page);
    if (result.error) { setListError(result.error.message); setListPhase('error'); return; }
    setRows(result.data.rows);
    setTotal(result.data.total);
    setListPhase('ready');
  }, [auth.mode, category, status, province, search, page]);

  useEffect(() => { void load(); }, [load]);

  const loadDetail = useCallback(async (id: string) => {
    setSelectedId(id);
    setDetailPhase('loading');
    setDetailError(null);
    setActionMessage(null);
    const listingResult = await getListing(id);
    if (listingResult.error) { setDetailError(listingResult.error.message); setDetailPhase('error'); return; }
    const reportsResult = await getListingReports(id);
    if (reportsResult.error) { setDetailError(reportsResult.error.message); setDetailPhase('error'); return; }
    let apps: ApplicationRow[] = [];
    if (listingResult.data?.category === 'jobs') {
      const appsResult = await listApplicationsForJob(id);
      if (appsResult.error) { setDetailError(appsResult.error.message); setDetailPhase('error'); return; }
      apps = appsResult.data ?? [];
    }
    setDetail(listingResult.data);
    setReports(reportsResult.data ?? []);
    setApplications(apps);
    setDetailPhase('ready');
  }, []);

  async function applyStatus(newStatus: string) {
    if (!selectedId) return;
    setActionMessage(null);
    const result = await updateListingStatus(selectedId, newStatus);
    if (result.error) { setActionMessage(`Failed: ${result.error.message}`); return; }
    setActionMessage(result.data.notified ? `Status updated to "${newStatus}" and the seller was notified.` : `Status updated to "${newStatus}".`);
    void loadDetail(selectedId);
    void load();
  }

  function resetFilters() { setCategory(fixedCategory ?? ''); setStatus(''); setProvince(''); setSearch(''); setPage(1); }
  const pageCount = Math.max(1, Math.ceil(total / LISTINGS_PAGE_SIZE));

  return <div className="directory-page">
    {auth.mode === 'mock' && <div className="directory-reference" role="note"><span className="material-symbols-outlined">science</span><b>REFERENCE DATA MODE</b><span>Live Supabase is not configured in this environment; the Marketplace cannot load real data here.</span></div>}
    <div className="directory-breadcrumb">PAMARKET OPS / MARKETPLACE / <b>{fixedCategory ? 'JOBS' : 'LISTINGS'}</b></div>
    <header className="directory-hero"><div><small>PRODUCTION MARKETPLACE</small><h1>{fixedCategory === 'jobs' ? 'Jobs' : 'Listings'}</h1><p>Search, filter, and review real PaMarket listings. Actions are enforced server-side by your actual role.</p></div></header>

    {!fixedCategory && <nav className="listing-tabs" aria-label="Category"><div>{categoryTabs.map((tab) => <button key={tab.label} className={category === tab.value ? 'active' : ''} onClick={() => { setCategory(tab.value); setPage(1); }}>{tab.label}</button>)}
      <select aria-label="More categories" value={moreCategories.includes(category as typeof moreCategories[number]) ? category : ''} onChange={(e) => { setCategory(e.target.value); setPage(1); }}>
        <option value="">More categories…</option>
        {moreCategories.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
    </div></nav>}

    <section className="directory-filters" aria-label="Listing filters"><div>
      <label className="directory-search"><span className="material-symbols-outlined">search</span><input aria-label="Search listings" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search title, seller, or listing ID" /></label>
      <select aria-label="Status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}><option value="">STATUS: ALL</option>{LISTING_STATUSES.map((s) => <option key={s} value={s}>{s.replaceAll('_', ' ').toUpperCase()}</option>)}</select>
      <select aria-label="Province" value={province} onChange={(e) => { setProvince(e.target.value); setPage(1); }}><option value="">PROVINCE: ALL</option>{provinces.map((p) => <option key={p} value={p}>{p}</option>)}</select>
      <button onClick={resetFilters} aria-label="Reset filters"><span className="material-symbols-outlined">restart_alt</span></button>
    </div></section>

    <div className="directory-workspace">
      <section className="directory-ledger">
        <header><span aria-live="polite">{listPhase === 'loading' ? 'Loading…' : `${total.toLocaleString('en-ZW')} listing(s) match`}</span>
          <div><button disabled={page <= 1 || listPhase === 'loading'} onClick={() => setPage((p) => Math.max(1, p - 1))}>Prev</button><span>Page {page} of {pageCount}</span><button disabled={page >= pageCount || listPhase === 'loading'} onClick={() => setPage((p) => Math.min(pageCount, p + 1))}>Next</button></div>
        </header>
        <div className="directory-table-scroll">
          {listPhase === 'error' && <div className="directory-empty" role="alert">Could not load listings: {listError}</div>}
          {listPhase !== 'error' && <table aria-label="Listings"><thead><tr><th>Listing</th><th>Category</th><th>Seller</th><th>Location</th><th>Price</th><th>Status</th><th>Created</th></tr></thead>
            <tbody>{rows.map((row) => <tr key={row.id} className={selectedId === row.id ? 'selected' : ''} onClick={() => void loadDetail(row.id)} style={{ cursor: 'pointer' }}>
              <td><strong>{row.title ?? 'Untitled'}</strong><br /><code>{row.id.slice(0, 8)}…</code></td>
              <td>{row.category ?? '—'}</td>
              <td>{row.seller_name ?? '—'}</td>
              <td>{row.city ?? '—'}{row.province ? `, ${row.province}` : ''}</td>
              <td>{fmtMoney(row.price, row.currency)}</td>
              <td>{row.status ?? '—'}</td>
              <td>{fmtDate(row.created_at)}</td>
            </tr>)}</tbody></table>}
          {listPhase === 'ready' && rows.length === 0 && <div className="directory-empty" role="status">No listings match these filters. <button onClick={resetFilters}>Clear filters</button></div>}
        </div>
      </section>

      <aside className="directory-inspector" aria-label="Listing detail">
        {!selectedId && <p>Select a listing to view real production detail.</p>}
        {selectedId && detailPhase === 'loading' && <p>Loading…</p>}
        {selectedId && detailPhase === 'error' && <p role="alert">Could not load listing detail: {detailError}</p>}
        {selectedId && detailPhase === 'ready' && detail && <>
          <header><span className="material-symbols-outlined">sell</span><div><small>LISTING DETAIL</small><strong>{detail.title ?? 'Untitled'}</strong></div><b>{detail.status?.toUpperCase() ?? '—'}</b></header>

          <section className="directory-identity"><h3>Listing</h3><dl>
            <div><dt>Category</dt><dd>{detail.category ?? '—'}</dd></div>
            <div><dt>Price</dt><dd>{fmtMoney(detail.price, detail.currency)}</dd></div>
            <div><dt>Condition</dt><dd>{detail.condition ?? '—'}</dd></div>
            <div><dt>Location</dt><dd>{detail.city ?? '—'}{detail.suburb ? `, ${detail.suburb}` : ''}{detail.province ? `, ${detail.province}` : ''}</dd></div>
            <div><dt>Views</dt><dd>{detail.views ?? 0}</dd></div>
            <div><dt>Created</dt><dd>{fmtDate(detail.created_at)}</dd></div>
            <div><dt>Updated</dt><dd>{fmtDate(detail.updated_at)}</dd></div>
            <div><dt>Expires</dt><dd>{fmtDate(detail.expires_at)}</dd></div>
          </dl></section>

          <section><h3>Seller</h3><dl>
            <div><dt>Name</dt><dd>{detail.seller_name ?? '—'}</dd></div>
            <div><dt>Phone</dt><dd>{detail.seller_phone ?? '—'}</dd></div>
          </dl></section>

          {detail.description && <section><h3>Description</h3><p>{detail.description}</p></section>}

          {detail.photos && detail.photos.length > 0 && <section><h3>Photos ({detail.photos.length})</h3>
            <div className="listing-photo-grid">{detail.photos.slice(0, 6).map((url) => <img key={url} src={url} alt="" loading="lazy" style={{ width: 96, height: 96, objectFit: 'cover', borderRadius: 8, marginRight: 8 }} />)}</div>
          </section>}

          <section><h3>Reports ({reports.length})</h3>
            {reports.length === 0 ? <p>None</p> : <ul>{reports.map((r) => <li key={r.id}>{r.status} · {r.reason ?? 'No reason given'} · severity: {r.severity ?? '—'}</li>)}</ul>}
          </section>

          {detail.category === 'jobs' && <section><h3>Applications ({applications.length})</h3>
            {applications.length === 0 ? <p>None</p> : <ul>{applications.map((a) => <li key={a.id}>{a.applicant_name ?? 'Applicant'} · {a.status} · {fmtDate(a.applied_at)}</li>)}</ul>}
          </section>}

          <section><h3>Moderation actions</h3>
            <div className="jobs-actions">
              <button onClick={() => void applyStatus('active')}>Approve (active)</button>
              <button onClick={() => void applyStatus('flagged')}>Flag</button>
              <button onClick={() => void applyStatus('under_review')}>Send to review</button>
              <button onClick={() => void applyStatus('removed')}>Remove</button>
            </div>
            {actionMessage && <p role="status">{actionMessage}</p>}
            <p><small>Actions use the existing admin-scoped update policy. If your role is not admin/super_admin, the server will reject the change.</small></p>
          </section>
        </>}
      </aside>
    </div>
  </div>;
}
