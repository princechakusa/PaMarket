import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../security/auth-context';
import {
  listVerifications, updateVerificationStatus, listBusinessVerifications, updateBusinessVerificationStatus,
  getSignedDocumentUrl, listUserVerificationDocuments, VERIFICATIONS_PAGE_SIZE,
  type VerificationRow, type BusinessVerificationRow, type StorageObject,
} from '../services/verifications/query';

function StorageSearch({ userId, accessToken }: { userId: string; accessToken: string }) {
  const [phase, setPhase] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [objects, setObjects] = useState<StorageObject[]>([]);
  const [previewKey, setPreviewKey] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | 'loading' | 'error' | null>(null);

  async function search() {
    setPhase('loading');
    const result = await listUserVerificationDocuments(userId, accessToken);
    if (result.error) { setPhase('error'); return; }
    setObjects(result.data);
    setPhase('ready');
  }

  async function preview(key: string) {
    setPreviewKey(key);
    setPreviewUrl('loading');
    const result = await getSignedDocumentUrl(key, accessToken);
    setPreviewUrl(result.error ? 'error' : result.data);
  }

  return <div className="verif-doc-search">
    <button onClick={() => void search()} disabled={phase === 'loading'}>{phase === 'loading' ? 'Searching storage…' : 'Search storage for this user\'s real files'}</button>
    {phase === 'error' && <p role="alert">Could not search storage.</p>}
    {phase === 'ready' && objects.length === 0 && <p role="status">No files found under this user's verification folder. The upload never reached storage.</p>}
    {phase === 'ready' && objects.length > 0 && <ul>{objects.map((o) => <li key={o.key}>
      <code style={{ fontSize: '0.7em' }}>{o.key.split('/').pop()}</code>
      {o.lastModified && <small> · {new Intl.DateTimeFormat('en-ZW', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Harare' }).format(new Date(o.lastModified))}</small>}
      <button onClick={() => void preview(o.key)}>Preview</button>
    </li>)}</ul>}
    {previewKey && <div>
      {previewUrl === 'loading' && <p>Loading preview…</p>}
      {previewUrl === 'error' && <p role="alert">Could not load this file.</p>}
      {previewUrl && previewUrl !== 'loading' && previewUrl !== 'error' && <img src={previewUrl} alt="Recovered upload" style={{ maxWidth: '100%', maxHeight: 240, borderRadius: 8 }} />}
    </div>}
  </div>;
}

type DocUrls = Record<string, string | 'loading' | 'error' | 'missing'>;

function DocumentPreview({ label, path, urls, onMissing }: { label: string; path: string | null; urls: DocUrls; onMissing: (path: string) => void }) {
  if (!path) return <div className="verif-doc"><span>{label}</span><p>Not submitted.</p></div>;
  const state = urls[path];
  return <div className="verif-doc"><span>{label}</span>
    {state === 'loading' && <p>Loading…</p>}
    {state === 'error' && <p role="alert">Could not request this document (check your session/permissions).</p>}
    {state === 'missing' && <p role="alert">This file could not be found in storage. The upload may have failed or the record predates a since-fixed upload bug — ask the applicant to resubmit.</p>}
    {state && state !== 'loading' && state !== 'error' && state !== 'missing' && <a href={state} target="_blank" rel="noreferrer"><img src={state} alt={label} style={{ maxWidth: '100%', maxHeight: 240, borderRadius: 8 }} onError={() => onMissing(path)} /></a>}
  </div>;
}

const statuses = ['pending', 'approved', 'rejected'];

function fmtDate(value: string | null) { return value ? new Intl.DateTimeFormat('en-ZW', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Harare' }).format(new Date(value)) : '—'; }

export function BusinessVerificationsPage() {
  const auth = useAuth();
  const [tab, setTab] = useState<'individual' | 'business'>('individual');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [individualRows, setIndividualRows] = useState<VerificationRow[]>([]);
  const [businessRows, setBusinessRows] = useState<BusinessVerificationRow[]>([]);
  const [total, setTotal] = useState(0);
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [docUrls, setDocUrls] = useState<DocUrls>({});

  const load = useCallback(async () => {
    if (auth.mode !== 'live') { setPhase('ready'); return; }
    setPhase('loading');
    setError(null);
    if (tab === 'individual') {
      const result = await listVerifications(status || undefined, page);
      if (result.error) { setError(result.error.message); setPhase('error'); return; }
      setIndividualRows(result.data.rows);
      setTotal(result.data.total);
    } else {
      const result = await listBusinessVerifications(status || undefined, page);
      if (result.error) { setError(result.error.message); setPhase('error'); return; }
      setBusinessRows(result.data.rows);
      setTotal(result.data.total);
    }
    setPhase('ready');
  }, [auth.mode, tab, status, page]);

  useEffect(() => { void load(); }, [load]);

  const selectedIndividualForDocs = individualRows.find((r) => r.id === selectedId);
  const selectedBusinessForDocs = businessRows.find((r) => r.id === selectedId);
  useEffect(() => {
    if (auth.mode !== 'live' || !selectedId || !auth.accessToken) return;
    const paths = tab === 'individual'
      ? [selectedIndividualForDocs?.id_doc_path, selectedIndividualForDocs?.selfie_path]
      : [selectedBusinessForDocs?.id_doc_path, selectedBusinessForDocs?.reg_doc_path];
    const wanted = paths.filter((p): p is string => Boolean(p));
    if (wanted.length === 0) return;
    setDocUrls((prev) => { const next = { ...prev }; wanted.forEach((p) => { next[p] = 'loading'; }); return next; });
    wanted.forEach((path) => {
      void getSignedDocumentUrl(path, auth.accessToken!).then((result) => {
        setDocUrls((prev) => ({ ...prev, [path]: result.error ? 'error' : result.data }));
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.mode, selectedId, tab, auth.accessToken]);

  function markDocMissing(path: string) { setDocUrls((prev) => ({ ...prev, [path]: 'missing' })); }

  async function decide(newStatus: string) {
    if (!selectedId) return;
    setActionMessage(null);
    const result = tab === 'individual'
      ? await updateVerificationStatus(selectedId, newStatus, note || undefined)
      : await updateBusinessVerificationStatus(selectedId, newStatus, note || undefined);
    if (result.error) { setActionMessage(`Failed: ${result.error.message}`); return; }
    setActionMessage(
      result.data.notified
        ? `Status updated to "${newStatus}" and the applicant was notified.`
        : `Status updated to "${newStatus}". The applicant was NOT notified — check the notifications feed or notify them another way.`,
    );
    setNote('');
    void load();
  }

  const pageCount = Math.max(1, Math.ceil(total / VERIFICATIONS_PAGE_SIZE));
  const selectedIndividual = individualRows.find((r) => r.id === selectedId);
  const selectedBusiness = businessRows.find((r) => r.id === selectedId);

  return <div className="directory-page">
    {auth.mode === 'mock' && <div className="directory-reference" role="note"><span className="material-symbols-outlined">science</span><b>REFERENCE DATA MODE</b><span>Live Supabase is not configured in this environment; Verifications cannot load real data here.</span></div>}
    <div className="directory-breadcrumb">PAMARKET OPS / TRUST & MODERATION / <b>VERIFICATIONS</b></div>
    <header className="directory-hero"><div><small>PRODUCTION VERIFICATION QUEUE</small><h1>Verifications</h1><p>Individual KYC and business verification review, in one workspace.</p></div></header>

    <nav className="listing-tabs" aria-label="Verification type"><div>
      <button className={tab === 'individual' ? 'active' : ''} onClick={() => { setTab('individual'); setSelectedId(null); setPage(1); }}>Individual (KYC)</button>
      <button className={tab === 'business' ? 'active' : ''} onClick={() => { setTab('business'); setSelectedId(null); setPage(1); }}>Business</button>
    </div></nav>

    <section className="directory-filters" aria-label="Verification filters"><div>
      <select aria-label="Status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}><option value="">STATUS: ALL</option>{statuses.map((s) => <option key={s} value={s}>{s.toUpperCase()}</option>)}</select>
      <button onClick={() => { setStatus(''); setPage(1); }} aria-label="Reset filters"><span className="material-symbols-outlined">restart_alt</span></button>
    </div></section>

    <div className="directory-workspace">
      <section className="directory-ledger">
        <header><span aria-live="polite">{phase === 'loading' ? 'Loading…' : `${total.toLocaleString('en-ZW')} record(s)`}</span>
          <div><button disabled={page <= 1 || phase === 'loading'} onClick={() => setPage((p) => Math.max(1, p - 1))}>Prev</button><span>Page {page} of {pageCount}</span><button disabled={page >= pageCount || phase === 'loading'} onClick={() => setPage((p) => Math.min(pageCount, p + 1))}>Next</button></div>
        </header>
        <div className="directory-table-scroll">
          {phase === 'error' && <div className="directory-empty" role="alert">Could not load verifications: {error}</div>}
          {phase !== 'error' && tab === 'individual' && <table aria-label="Individual verifications"><thead><tr><th>User</th><th>Status</th><th>Submitted</th><th>Reviewed</th></tr></thead>
            <tbody>{individualRows.map((row) => <tr key={row.id} className={selectedId === row.id ? 'selected' : ''} onClick={() => { setSelectedId(row.id); setActionMessage(null); setNote(''); }} style={{ cursor: 'pointer' }}>
              <td><code>{row.user_id?.slice(0, 8) ?? '—'}…</code></td><td>{row.status ?? '—'}</td><td>{fmtDate(row.submitted_at)}</td><td>{fmtDate(row.reviewed_at)}</td>
            </tr>)}</tbody></table>}
          {phase !== 'error' && tab === 'business' && <table aria-label="Business verifications"><thead><tr><th>Business</th><th>Level</th><th>Status</th><th>Submitted</th></tr></thead>
            <tbody>{businessRows.map((row) => <tr key={row.id} className={selectedId === row.id ? 'selected' : ''} onClick={() => { setSelectedId(row.id); setActionMessage(null); setNote(''); }} style={{ cursor: 'pointer' }}>
              <td><code>{row.business_id?.slice(0, 8) ?? '—'}…</code></td><td>{row.level_requested ?? '—'}</td><td>{row.status ?? '—'}</td><td>{fmtDate(row.submitted_at)}</td>
            </tr>)}</tbody></table>}
          {phase === 'ready' && (tab === 'individual' ? individualRows.length === 0 : businessRows.length === 0) && <div className="directory-empty" role="status">No records match these filters.</div>}
        </div>
      </section>

      <aside className="directory-inspector" aria-label="Verification detail">
        {!selectedId && <p>Select a record to review.</p>}
        {selectedId && tab === 'individual' && selectedIndividual && <>
          <header><span className="material-symbols-outlined">badge</span><div><small>INDIVIDUAL VERIFICATION</small><strong>{selectedIndividual.user_id?.slice(0, 8)}…</strong></div><b>{selectedIndividual.status?.toUpperCase() ?? '—'}</b></header>
          <section><h3>Details</h3><dl>
            <div><dt>Status</dt><dd>{selectedIndividual.status ?? '—'}</dd></div>
            <div><dt>Submitted</dt><dd>{fmtDate(selectedIndividual.submitted_at)}</dd></div>
            <div><dt>Reviewed</dt><dd>{fmtDate(selectedIndividual.reviewed_at)}</dd></div>
            {selectedIndividual.admin_note && <div><dt>Note</dt><dd>{selectedIndividual.admin_note}</dd></div>}
          </dl></section>
          <section className="verif-docs"><h3>Submitted Documents</h3>
            <DocumentPreview label="ID document" path={selectedIndividual.id_doc_path} urls={docUrls} onMissing={markDocMissing} />
            <DocumentPreview label="Selfie" path={selectedIndividual.selfie_path} urls={docUrls} onMissing={markDocMissing} />
            {selectedIndividual.user_id && auth.accessToken && <StorageSearch userId={selectedIndividual.user_id} accessToken={auth.accessToken} />}
          </section>
          <section><h3>Decision</h3>
            <textarea placeholder="Admin note (optional)" value={note} onChange={(e) => setNote(e.target.value)} style={{ width: '100%', minHeight: 60 }} />
            <div className="jobs-actions"><button onClick={() => void decide('approved')}>Approve</button><button onClick={() => void decide('rejected')}>Reject</button><button onClick={() => void decide('pending')}>Reset to pending</button></div>
            {actionMessage && <p role="status">{actionMessage}</p>}
          </section>
        </>}
        {selectedId && tab === 'business' && selectedBusiness && <>
          <header><span className="material-symbols-outlined">storefront</span><div><small>BUSINESS VERIFICATION</small><strong>{selectedBusiness.business_id?.slice(0, 8)}…</strong></div><b>{selectedBusiness.status?.toUpperCase() ?? '—'}</b></header>
          <section><h3>Details</h3><dl>
            <div><dt>Level requested</dt><dd>{selectedBusiness.level_requested ?? '—'}</dd></div>
            <div><dt>Status</dt><dd>{selectedBusiness.status ?? '—'}</dd></div>
            <div><dt>Submitted</dt><dd>{fmtDate(selectedBusiness.submitted_at)}</dd></div>
            <div><dt>Reviewed</dt><dd>{fmtDate(selectedBusiness.reviewed_at)}</dd></div>
            {selectedBusiness.admin_note && <div><dt>Note</dt><dd>{selectedBusiness.admin_note}</dd></div>}
          </dl></section>
          <section className="verif-docs"><h3>Submitted Documents</h3>
            <DocumentPreview label="Owner ID document" path={selectedBusiness.id_doc_path} urls={docUrls} onMissing={markDocMissing} />
            <DocumentPreview label="Business registration" path={selectedBusiness.reg_doc_path} urls={docUrls} onMissing={markDocMissing} />
          </section>
          <section><h3>Decision</h3>
            <textarea placeholder="Admin note (optional)" value={note} onChange={(e) => setNote(e.target.value)} style={{ width: '100%', minHeight: 60 }} />
            <div className="jobs-actions"><button onClick={() => void decide('approved')}>Approve</button><button onClick={() => void decide('rejected')}>Reject</button><button onClick={() => void decide('pending')}>Reset to pending</button></div>
            {actionMessage && <p role="status">{actionMessage}</p>}
          </section>
        </>}
      </aside>
    </div>
  </div>;
}
