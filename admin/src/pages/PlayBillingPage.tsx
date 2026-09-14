import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../security/auth-context';
import { listPlayPurchases, COMMERCE_PAGE_SIZE, type PlayPurchaseRow } from '../services/commerce/query';

function fmtDate(value: string | null) { return value ? new Intl.DateTimeFormat('en-ZW', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Harare' }).format(new Date(value)) : '—'; }

export function PlayBillingPage() {
  const auth = useAuth();
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<PlayPurchaseRow[]>([]);
  const [total, setTotal] = useState(0);
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (auth.mode !== 'live') { setPhase('ready'); return; }
    setPhase('loading');
    setError(null);
    const result = await listPlayPurchases(status || undefined, page);
    if (result.error) { setError(result.error.message); setPhase('error'); return; }
    setRows(result.data.rows);
    setTotal(result.data.total);
    setPhase('ready');
  }, [auth.mode, status, page]);

  useEffect(() => { void load(); }, [load]);

  const pageCount = Math.max(1, Math.ceil(total / COMMERCE_PAGE_SIZE));

  return <div className="directory-page">
    {auth.mode === 'mock' && <div className="directory-reference" role="note"><span className="material-symbols-outlined">science</span><b>REFERENCE DATA MODE</b><span>Live Supabase is not configured in this environment.</span></div>}
    <div className="directory-breadcrumb">PAMARKET OPS / COMMERCE / <b>PLAY BILLING</b></div>
    <header className="directory-hero"><div><small>PRODUCTION GOOGLE PLAY BILLING</small><h1>Play Billing</h1><p>Real, verified Google Play purchase records. Purchase tokens (sensitive receipt credentials) are never displayed. No refund control is shown — none exists in the current backend.</p></div></header>

    <section className="directory-filters" aria-label="Purchase filters"><div>
      <select aria-label="Status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}><option value="">STATUS: ALL</option><option value="verified">VERIFIED</option><option value="pending">PENDING</option><option value="failed">FAILED</option><option value="refunded">REFUNDED</option></select>
      <button onClick={() => { setStatus(''); setPage(1); }} aria-label="Reset filters"><span className="material-symbols-outlined">restart_alt</span></button>
    </div></section>

    <div className="directory-workspace">
      <section className="directory-ledger" style={{ gridColumn: '1 / -1' }}>
        <header><span aria-live="polite">{phase === 'loading' ? 'Loading…' : `${total.toLocaleString('en-ZW')} purchase(s)`}</span>
          <div><button disabled={page <= 1 || phase === 'loading'} onClick={() => setPage((p) => Math.max(1, p - 1))}>Prev</button><span>Page {page} of {pageCount}</span><button disabled={page >= pageCount || phase === 'loading'} onClick={() => setPage((p) => Math.min(pageCount, p + 1))}>Next</button></div>
        </header>
        <div className="directory-table-scroll">
          {phase === 'error' && <div className="directory-empty" role="alert">Could not load purchases: {error}</div>}
          {phase !== 'error' && <table aria-label="Play Billing purchases"><thead><tr><th>Product</th><th>Buyer</th><th>Platform</th><th>Status</th><th>Purchased</th><th>Verified</th></tr></thead>
            <tbody>{rows.map((row) => <tr key={row.id}>
              <td>{row.product_id ?? '—'}</td><td><code>{row.user_id?.slice(0, 8) ?? '—'}…</code></td><td>{row.platform ?? '—'}</td><td>{row.status ?? '—'}</td><td>{fmtDate(row.purchase_time)}</td><td>{fmtDate(row.verified_at)}</td>
            </tr>)}</tbody></table>}
          {phase === 'ready' && rows.length === 0 && <div className="directory-empty" role="status">No purchases match these filters.</div>}
        </div>
      </section>
    </div>
  </div>;
}
