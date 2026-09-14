import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../security/auth-context';
import {
  listMarketplaceReviews, deleteMarketplaceReview, listBusinessReviews, listRentalReviews, updateRentalReviewStatus,
  REVIEWS_PAGE_SIZE, type MarketplaceReviewRow, type BusinessReviewRow, type RentalReviewRow,
} from '../services/reviews/query';

function fmtDate(value: string | null) { return value ? new Intl.DateTimeFormat('en-ZW', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Africa/Harare' }).format(new Date(value)) : '—'; }

type Tab = 'marketplace' | 'business' | 'rentals';

export function ReviewsPage() {
  const auth = useAuth();
  const [tab, setTab] = useState<Tab>('marketplace');
  const [page, setPage] = useState(1);
  const [marketplaceRows, setMarketplaceRows] = useState<MarketplaceReviewRow[]>([]);
  const [businessRows, setBusinessRows] = useState<BusinessReviewRow[]>([]);
  const [rentalRows, setRentalRows] = useState<RentalReviewRow[]>([]);
  const [total, setTotal] = useState(0);
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (auth.mode !== 'live') { setPhase('ready'); return; }
    setPhase('loading');
    setError(null);
    if (tab === 'marketplace') {
      const result = await listMarketplaceReviews(page);
      if (result.error) { setError(result.error.message); setPhase('error'); return; }
      setMarketplaceRows(result.data.rows);
      setTotal(result.data.total);
    } else if (tab === 'business') {
      const result = await listBusinessReviews(page);
      if (result.error) { setError(result.error.message); setPhase('error'); return; }
      setBusinessRows(result.data.rows);
      setTotal(result.data.total);
    } else {
      const result = await listRentalReviews(undefined, page);
      if (result.error) { setError(result.error.message); setPhase('error'); return; }
      setRentalRows(result.data.rows);
      setTotal(result.data.total);
    }
    setPhase('ready');
  }, [auth.mode, tab, page]);

  useEffect(() => { void load(); }, [load]);

  async function removeMarketplace(id: string) {
    const result = await deleteMarketplaceReview(id);
    setMessage(result.error ? `Failed: ${result.error.message}` : 'Review removed.');
    void load();
  }
  async function decideRental(id: string, status: string) {
    const result = await updateRentalReviewStatus(id, status);
    setMessage(result.error ? `Failed: ${result.error.message}` : `Review ${status}.`);
    void load();
  }

  const pageCount = Math.max(1, Math.ceil(total / REVIEWS_PAGE_SIZE));

  return <div className="directory-page">
    {auth.mode === 'mock' && <div className="directory-reference" role="note"><span className="material-symbols-outlined">science</span><b>REFERENCE DATA MODE</b><span>Live Supabase is not configured in this environment.</span></div>}
    <div className="directory-breadcrumb">PAMARKET OPS / TRUST & MODERATION / <b>REVIEWS</b></div>
    <header className="directory-hero"><div><small>PRODUCTION REVIEWS</small><h1>Reviews</h1><p>Marketplace, business, and rental reviews in one workspace — three real, distinct tables, not merged.</p></div></header>

    <nav className="listing-tabs" aria-label="Review source"><div>
      <button className={tab === 'marketplace' ? 'active' : ''} onClick={() => { setTab('marketplace'); setPage(1); setMessage(null); }}>Marketplace</button>
      <button className={tab === 'business' ? 'active' : ''} onClick={() => { setTab('business'); setPage(1); setMessage(null); }}>Businesses</button>
      <button className={tab === 'rentals' ? 'active' : ''} onClick={() => { setTab('rentals'); setPage(1); setMessage(null); }}>Rentals</button>
    </div></nav>

    {message && <p role="status">{message}</p>}

    <div className="directory-workspace">
      <section className="directory-ledger" style={{ gridColumn: '1 / -1' }}>
        <header><span aria-live="polite">{phase === 'loading' ? 'Loading…' : `${total.toLocaleString('en-ZW')} review(s)`}</span>
          <div><button disabled={page <= 1 || phase === 'loading'} onClick={() => setPage((p) => Math.max(1, p - 1))}>Prev</button><span>Page {page} of {pageCount}</span><button disabled={page >= pageCount || phase === 'loading'} onClick={() => setPage((p) => Math.min(pageCount, p + 1))}>Next</button></div>
        </header>
        <div className="directory-table-scroll">
          {phase === 'error' && <div className="directory-empty" role="alert">Could not load reviews: {error}</div>}
          {phase !== 'error' && tab === 'marketplace' && <table aria-label="Marketplace reviews"><thead><tr><th>Reviewer</th><th>Rating</th><th>Comment</th><th>Created</th><th>Actions</th></tr></thead>
            <tbody>{marketplaceRows.map((r) => <tr key={r.id}><td>{r.reviewer_name ?? '—'}</td><td>{r.rating ?? '—'}</td><td>{r.body ?? '—'}</td><td>{fmtDate(r.created_at)}</td>
              <td><button onClick={() => void removeMarketplace(r.id)}>Remove</button></td>
            </tr>)}</tbody></table>}
          {phase !== 'error' && tab === 'business' && <table aria-label="Business reviews"><thead><tr><th>Reviewer</th><th>Rating</th><th>Comment</th><th>Created</th></tr></thead>
            <tbody>{businessRows.map((r) => <tr key={r.id}><td>{r.reviewer_name ?? '—'}</td><td>{r.rating ?? '—'}</td><td>{r.comment ?? '—'}</td><td>{fmtDate(r.created_at)}</td></tr>)}</tbody></table>}
          {phase !== 'error' && tab === 'rentals' && <table aria-label="Rental reviews"><thead><tr><th>Reviewer</th><th>Rating</th><th>Title</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>{rentalRows.map((r) => <tr key={r.id}><td>{r.reviewer_name ?? '—'}</td><td>{r.rating ?? '—'}</td><td>{r.title ?? '—'}</td><td>{r.status ?? '—'}</td>
              <td><div className="jobs-actions"><button onClick={() => void decideRental(r.id, 'published')}>Publish</button><button onClick={() => void decideRental(r.id, 'hidden')}>Hide</button></div></td>
            </tr>)}</tbody></table>}
          {phase === 'ready' && ((tab === 'marketplace' && marketplaceRows.length === 0) || (tab === 'business' && businessRows.length === 0) || (tab === 'rentals' && rentalRows.length === 0)) && <div className="directory-empty" role="status">No reviews.</div>}
        </div>
        {tab === 'business' && <p><small>Business reviews have no admin moderation policy in the current backend — view only.</small></p>}
      </section>
    </div>
  </div>;
}
