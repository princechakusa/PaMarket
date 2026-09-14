import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../security/auth-context';
import {
  listReports, updateReportStatus, listAppeals, updateAppealStatus,
  TRUST_PAGE_SIZE, REPORT_TARGET_TYPES, type ReportRow, type AppealRow,
} from '../services/trust-safety/query';

function fmtDate(value: string | null) { return value ? new Intl.DateTimeFormat('en-ZW', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Harare' }).format(new Date(value)) : '—'; }
function fmtReportDate(value: number | null) { return value ? new Intl.DateTimeFormat('en-ZW', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Harare' }).format(new Date(value)) : '—'; }

export function ReportsDisputesPage() {
  const auth = useAuth();
  const [tab, setTab] = useState<'reports' | 'appeals'>('reports');
  const [status, setStatus] = useState('');
  const [targetType, setTargetType] = useState('');
  const [page, setPage] = useState(1);
  const [reportRows, setReportRows] = useState<ReportRow[]>([]);
  const [appealRows, setAppealRows] = useState<AppealRow[]>([]);
  const [total, setTotal] = useState(0);
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (auth.mode !== 'live') { setPhase('ready'); return; }
    setPhase('loading');
    setError(null);
    if (tab === 'reports') {
      const result = await listReports({ status: status || undefined, targetType: targetType || undefined }, page);
      if (result.error) { setError(result.error.message); setPhase('error'); return; }
      setReportRows(result.data.rows);
      setTotal(result.data.total);
    } else {
      const result = await listAppeals(status || undefined, page);
      if (result.error) { setError(result.error.message); setPhase('error'); return; }
      setAppealRows(result.data.rows);
      setTotal(result.data.total);
    }
    setPhase('ready');
  }, [auth.mode, tab, status, targetType, page]);

  useEffect(() => { void load(); }, [load]);

  async function decide(newStatus: string) {
    if (!selectedId) return;
    setActionMessage(null);
    const result = tab === 'reports' ? await updateReportStatus(selectedId, newStatus) : await updateAppealStatus(selectedId, newStatus);
    if (result.error) { setActionMessage(`Failed: ${result.error.message}`); return; }
    setActionMessage(`Status updated to "${newStatus}".`);
    void load();
  }

  const pageCount = Math.max(1, Math.ceil(total / TRUST_PAGE_SIZE));
  const selectedReport = reportRows.find((r) => r.id === selectedId);
  const selectedAppeal = appealRows.find((r) => r.id === selectedId);

  return <div className="directory-page">
    {auth.mode === 'mock' && <div className="directory-reference" role="note"><span className="material-symbols-outlined">science</span><b>REFERENCE DATA MODE</b><span>Live Supabase is not configured in this environment; Trust &amp; Safety cannot load real data here.</span></div>}
    <div className="directory-breadcrumb">PAMARKET OPS / TRUST & MODERATION / <b>TRUST & SAFETY</b></div>
    <header className="directory-hero"><div><small>PRODUCTION TRUST &amp; SAFETY</small><h1>Reports &amp; Moderation Appeals</h1><p>Reports and appeals in one workflow — both operate on the same underlying moderation activity.</p></div></header>

    <nav className="listing-tabs" aria-label="Workflow"><div>
      <button className={tab === 'reports' ? 'active' : ''} onClick={() => { setTab('reports'); setSelectedId(null); setPage(1); }}>Reports</button>
      <button className={tab === 'appeals' ? 'active' : ''} onClick={() => { setTab('appeals'); setSelectedId(null); setPage(1); }}>Appeals</button>
    </div></nav>

    <section className="directory-filters" aria-label="Filters"><div>
      <select aria-label="Status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}><option value="">STATUS: ALL</option>
        {tab === 'reports' ? <>
          <option value="open">OPEN</option><option value="resolved">RESOLVED</option><option value="dismissed">DISMISSED</option>
        </> : <>
          <option value="open">OPEN</option><option value="approved">APPROVED</option><option value="rejected">REJECTED</option>
        </>}
      </select>
      {tab === 'reports' && <select aria-label="Target type" value={targetType} onChange={(e) => { setTargetType(e.target.value); setPage(1); }}><option value="">TARGET: ALL</option>{REPORT_TARGET_TYPES.map((t) => <option key={t} value={t}>{t.toUpperCase()}</option>)}</select>}
      <button onClick={() => { setStatus(''); setTargetType(''); setPage(1); }} aria-label="Reset filters"><span className="material-symbols-outlined">restart_alt</span></button>
    </div></section>

    <div className="directory-workspace">
      <section className="directory-ledger">
        <header><span aria-live="polite">{phase === 'loading' ? 'Loading…' : `${total.toLocaleString('en-ZW')} record(s)`}</span>
          <div><button disabled={page <= 1 || phase === 'loading'} onClick={() => setPage((p) => Math.max(1, p - 1))}>Prev</button><span>Page {page} of {pageCount}</span><button disabled={page >= pageCount || phase === 'loading'} onClick={() => setPage((p) => Math.min(pageCount, p + 1))}>Next</button></div>
        </header>
        <div className="directory-table-scroll">
          {phase === 'error' && <div className="directory-empty" role="alert">Could not load: {error}</div>}
          {phase !== 'error' && tab === 'reports' && <table aria-label="Reports"><thead><tr><th>Target</th><th>Reason</th><th>Severity</th><th>Status</th><th>Created</th></tr></thead>
            <tbody>{reportRows.map((row) => <tr key={row.id} className={selectedId === row.id ? 'selected' : ''} onClick={() => { setSelectedId(row.id); setActionMessage(null); }} style={{ cursor: 'pointer' }}>
              <td>{row.target_type ?? '—'} <code>{row.target_id?.slice(0, 8) ?? ''}</code></td><td>{row.reason ?? '—'}</td><td>{row.severity ?? '—'}</td><td>{row.status ?? '—'}</td><td>{fmtReportDate(row.created_at)}</td>
            </tr>)}</tbody></table>}
          {phase !== 'error' && tab === 'appeals' && <table aria-label="Appeals"><thead><tr><th>Entity</th><th>Reason</th><th>Status</th><th>Created</th></tr></thead>
            <tbody>{appealRows.map((row) => <tr key={row.id} className={selectedId === row.id ? 'selected' : ''} onClick={() => { setSelectedId(row.id); setActionMessage(null); }} style={{ cursor: 'pointer' }}>
              <td>{row.entity ?? '—'} <code>{row.entity_id?.slice(0, 8) ?? ''}</code></td><td>{row.reason ?? '—'}</td><td>{row.status ?? '—'}</td><td>{fmtDate(row.created_at)}</td>
            </tr>)}</tbody></table>}
          {phase === 'ready' && (tab === 'reports' ? reportRows.length === 0 : appealRows.length === 0) && <div className="directory-empty" role="status">No records match these filters.</div>}
        </div>
      </section>

      <aside className="directory-inspector" aria-label="Detail">
        {!selectedId && <p>Select a record to review.</p>}
        {selectedId && tab === 'reports' && selectedReport && <>
          <header><span className="material-symbols-outlined">flag</span><div><small>REPORT</small><strong>{selectedReport.target_type ?? '—'}</strong></div><b>{selectedReport.status?.toUpperCase() ?? '—'}</b></header>
          <section><h3>Details</h3><dl>
            <div><dt>Target</dt><dd>{selectedReport.target_type ?? '—'} · {selectedReport.target_id ?? '—'}</dd></div>
            <div><dt>Reason</dt><dd>{selectedReport.reason ?? '—'}</dd></div>
            <div><dt>Severity</dt><dd>{selectedReport.severity ?? '—'}</dd></div>
            <div><dt>Created</dt><dd>{fmtReportDate(selectedReport.created_at)}</dd></div>
          </dl></section>
          <section><h3>Resolution</h3>
            <div className="jobs-actions"><button onClick={() => void decide('resolved')}>Resolve</button><button onClick={() => void decide('dismissed')}>Dismiss</button><button onClick={() => void decide('open')}>Reopen</button></div>
            {actionMessage && <p role="status">{actionMessage}</p>}
          </section>
        </>}
        {selectedId && tab === 'appeals' && selectedAppeal && <>
          <header><span className="material-symbols-outlined">gavel</span><div><small>MODERATION APPEAL</small><strong>{selectedAppeal.entity ?? '—'}</strong></div><b>{selectedAppeal.status?.toUpperCase() ?? '—'}</b></header>
          <section><h3>Details</h3><dl>
            <div><dt>Entity</dt><dd>{selectedAppeal.entity ?? '—'} · {selectedAppeal.entity_id ?? '—'}</dd></div>
            <div><dt>Reason</dt><dd>{selectedAppeal.reason ?? '—'}</dd></div>
            <div><dt>Created</dt><dd>{fmtDate(selectedAppeal.created_at)}</dd></div>
            <div><dt>Decided</dt><dd>{fmtDate(selectedAppeal.decided_at)}</dd></div>
          </dl></section>
          <section><h3>Decision</h3>
            <div className="jobs-actions"><button onClick={() => void decide('approved')}>Approve appeal</button><button onClick={() => void decide('rejected')}>Reject appeal</button><button onClick={() => void decide('open')}>Reopen</button></div>
            {actionMessage && <p role="status">{actionMessage}</p>}
          </section>
        </>}
      </aside>
    </div>
  </div>;
}
