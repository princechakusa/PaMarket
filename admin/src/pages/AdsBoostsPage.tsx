import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../security/auth-context';
import { listPaidAds, setPaidAdActive, pauseScheduledPaidAd, COMMERCE_PAGE_SIZE, type PaidAdRow } from '../services/commerce/query';

function fmtDate(value: string | null) { return value ? new Intl.DateTimeFormat('en-ZW', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Africa/Harare' }).format(new Date(value)) : '—'; }

export function AdsBoostsPage() {
  const auth = useAuth();
  const [activeFilter, setActiveFilter] = useState<'' | 'true' | 'false'>('');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<PaidAdRow[]>([]);
  const [total, setTotal] = useState(0);
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (auth.mode !== 'live') { setPhase('ready'); return; }
    setPhase('loading');
    setError(null);
    const result = await listPaidAds(activeFilter === '' ? undefined : activeFilter === 'true', page);
    if (result.error) { setError(result.error.message); setPhase('error'); return; }
    setRows(result.data.rows);
    setTotal(result.data.total);
    setPhase('ready');
  }, [auth.mode, activeFilter, page]);

  useEffect(() => { void load(); }, [load]);

  async function toggleActive(id: string, active: boolean) {
    setActionMessage(null);
    const result = await setPaidAdActive(id, active);
    if (result.error) { setActionMessage(`Failed: ${result.error.message}`); return; }
    setActionMessage(`Ad ${active ? 'activated' : 'deactivated'}.`);
    void load();
  }

  async function pauseScheduled(id: string) {
    setActionMessage(null);
    const result = await pauseScheduledPaidAd(id);
    if (result.error) { setActionMessage(`Failed: ${result.error.message}`); return; }
    setActionMessage('Scheduled ad paused.');
    void load();
  }

  const pageCount = Math.max(1, Math.ceil(total / COMMERCE_PAGE_SIZE));

  return <div className="directory-page">
    {auth.mode === 'mock' && <div className="directory-reference" role="note"><span className="material-symbols-outlined">science</span><b>REFERENCE DATA MODE</b><span>Live Supabase is not configured in this environment.</span></div>}
    <div className="directory-breadcrumb">PAMARKET OPS / COMMERCE / <b>ADS & BOOSTS</b></div>
    <header className="directory-hero"><div><small>PRODUCTION ADVERTISING</small><h1>Ads &amp; Boosts</h1><p>Real paid ad records, including scheduled and expired ads. Impressions/clicks shown are the stored operational counters — no campaign performance is invented.</p></div></header>

    <section className="directory-filters" aria-label="Ad filters"><div>
      <select aria-label="Active" value={activeFilter} onChange={(e) => { setActiveFilter(e.target.value as typeof activeFilter); setPage(1); }}><option value="">ACTIVE: ALL</option><option value="true">ACTIVE</option><option value="false">INACTIVE</option></select>
      <button onClick={() => { setActiveFilter(''); setPage(1); void load(); }} aria-label="Reset filters"><span className="material-symbols-outlined">restart_alt</span></button>
    </div></section>

    <div className="directory-workspace">
      <section className="directory-ledger" style={{ gridColumn: '1 / -1' }}>
        <header><span aria-live="polite">{phase === 'loading' ? 'Loading…' : `${total.toLocaleString('en-ZW')} ad(s)`}</span>
          <div><button disabled={page <= 1 || phase === 'loading'} onClick={() => setPage((p) => Math.max(1, p - 1))}>Prev</button><span>Page {page} of {pageCount}</span><button disabled={page >= pageCount || phase === 'loading'} onClick={() => setPage((p) => Math.min(pageCount, p + 1))}>Next</button></div>
        </header>
        <div className="directory-table-scroll">
          {phase === 'error' && <div className="directory-empty" role="alert">Could not load ads: {error}</div>}
          {phase !== 'error' && <table aria-label="Paid ads"><thead><tr><th>Business</th><th>Headline</th><th>Type</th><th>Target</th><th>Window</th><th>Impressions</th><th>Clicks</th><th>Price paid</th><th>Status</th><th>Active</th><th>Actions</th></tr></thead>
            <tbody>{rows.map((row) => <tr key={row.id}>
              <td>{row.business_name ?? '—'}</td><td>{row.headline ?? '—'}</td><td>{row.ad_type ?? '—'}</td><td>{row.target_cat ?? '—'}</td>
              <td>{fmtDate(row.starts_at)} – {fmtDate(row.ends_at)}</td><td>{row.impressions ?? 0}</td><td>{row.clicks ?? 0}</td>
              <td>{row.price_paid !== null ? `$${row.price_paid.toLocaleString('en-ZW')}` : '—'}</td><td>{row.status ?? '—'}</td><td>{row.active ? 'Yes' : 'No'}</td>
              <td><div className="jobs-actions">
                {!row.active && <button onClick={() => void toggleActive(row.id, true)}>Activate</button>}
                {row.active && <button onClick={() => void toggleActive(row.id, false)}>Deactivate</button>}
                {row.status === 'scheduled' && <button onClick={() => void pauseScheduled(row.id)}>Pause</button>}
              </div></td>
            </tr>)}</tbody></table>}
          {phase === 'ready' && rows.length === 0 && <div className="directory-empty" role="status">No ads match these filters.</div>}
        </div>
        {actionMessage && <p role="status">{actionMessage}</p>}
        <p><small>Actions use the existing admin_set_paid_ad_active/admin_pause_scheduled_paid_ad RPCs (is_admin() + AAL2).</small></p>
      </section>
    </div>
  </div>;
}
