import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../security/auth-context';
import {
  listErrorEvents, getErrorEvent, updateErrorEventStatus, listSentryIssues,
  PLATFORM_PAGE_SIZE, type ErrorEventRow, type ErrorEventDetail, type SentryIssue,
} from '../services/platform/query';

function fmtDate(value: string | null) { return value ? new Intl.DateTimeFormat('en-ZW', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Harare' }).format(new Date(value)) : '—'; }
function Icon({ name }: { name: string }) { return <span className="material-symbols-outlined" aria-hidden="true">{name}</span>; }

export function ErrorsHealthPage() {
  const auth = useAuth();
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<ErrorEventRow[]>([]);
  const [total, setTotal] = useState(0);
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ErrorEventDetail | null>(null);
  const [detailPhase, setDetailPhase] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [note, setNote] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [sentry, setSentry] = useState<SentryIssue[] | null>(null);
  const [sentryPhase, setSentryPhase] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');

  const load = useCallback(async () => {
    if (auth.mode !== 'live') { setPhase('ready'); return; }
    setPhase('loading');
    setError(null);
    const result = await listErrorEvents(status || undefined, page, PLATFORM_PAGE_SIZE);
    if (result.error) { setError(result.error.message); setPhase('error'); return; }
    setRows(result.data.rows);
    setTotal(result.data.total);
    setPhase('ready');
  }, [auth.mode, status, page]);

  useEffect(() => { void load(); }, [load]);

  const loadDetail = useCallback(async (id: string) => {
    setSelectedId(id);
    setDetailPhase('loading');
    setMessage(null);
    const result = await getErrorEvent(id);
    if (result.error || !result.data) { setDetailPhase('error'); return; }
    setDetail(result.data);
    setNote(result.data.admin_notes ?? '');
    setDetailPhase('ready');
  }, []);

  async function setErrorStatus(next: string) {
    if (!selectedId) return;
    const result = await updateErrorEventStatus(selectedId, next, note || undefined);
    setMessage(result.error ? `Failed: ${result.error.message}` : `Marked ${next}.`);
    void loadDetail(selectedId);
    void load();
  }

  async function loadSentry() {
    if (!auth.accessToken || auth.mode !== 'live') return;
    setSentryPhase('loading');
    const result = await listSentryIssues(auth.accessToken);
    if (result.error) { setSentryPhase('error'); return; }
    setSentry(result.data);
    setSentryPhase('ready');
  }

  const pageCount = Math.max(1, Math.ceil(total / PLATFORM_PAGE_SIZE));

  return <div className="directory-page">
    {auth.mode === 'mock' && <div className="directory-reference" role="note"><Icon name="science" /><b>REFERENCE DATA MODE</b><span>Live Supabase is not configured in this environment.</span></div>}
    <div className="directory-breadcrumb">PAMARKET OPS / SECURITY & PLATFORM / <b>ERRORS & HEALTH</b></div>
    <header className="directory-hero"><div><small>PRODUCTION OBSERVABILITY</small><h1>Errors & Health</h1><p>Real client/server error events (app_error_events) and, on demand, real Sentry issues via the secure admin-sentry-issues function. No fabricated uptime or incident data.</p></div></header>

    <section className="directory-filters" aria-label="Filters"><div>
      <select aria-label="Status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}><option value="">STATUS: ALL</option><option value="open">OPEN</option><option value="investigating">INVESTIGATING</option><option value="resolved">RESOLVED</option><option value="ignored">IGNORED</option></select>
      <button onClick={() => { setStatus(''); setPage(1); }} aria-label="Reset filters"><Icon name="restart_alt" /></button>
      <button onClick={() => void loadSentry()} disabled={sentryPhase === 'loading' || auth.mode !== 'live'}><Icon name="bug_report" />Load Sentry Issues (14d)</button>
    </div></section>

    {sentryPhase !== 'idle' && <section className="directory-panel" aria-label="Sentry issues">
      {sentryPhase === 'loading' && <p>Loading Sentry issues…</p>}
      {sentryPhase === 'error' && <p role="alert">Could not load Sentry issues.</p>}
      {sentryPhase === 'ready' && sentry && (sentry.length === 0 ? <p role="status">No Sentry issues in the last 14 days.</p> : <ul>{sentry.map((issue) => <li key={issue.id ?? issue.shortId}><b>{issue.level?.toUpperCase() ?? '—'}</b> {issue.title ?? '—'} — {issue.culprit ?? '—'} ({issue.count ?? 0} events, {issue.userCount ?? 0} users) · last seen {fmtDate(issue.lastSeen)}{issue.permalink && <> · <a href={issue.permalink} target="_blank" rel="noreferrer">Sentry</a></>}</li>)}</ul>)}
    </section>}

    <div className="directory-workspace">
      <section className="directory-ledger">
        <header><span aria-live="polite">{phase === 'loading' ? 'Loading…' : `${total.toLocaleString('en-ZW')} event(s)`}</span>
          <div><button disabled={page <= 1 || phase === 'loading'} onClick={() => setPage((p) => Math.max(1, p - 1))}>Prev</button><span>Page {page} of {pageCount}</span><button disabled={page >= pageCount || phase === 'loading'} onClick={() => setPage((p) => Math.min(pageCount, p + 1))}>Next</button></div>
        </header>
        <div className="directory-table-scroll">
          {phase === 'error' && <div className="directory-empty" role="alert">Could not load error events: {error}</div>}
          {phase !== 'error' && <table aria-label="Error events"><thead><tr><th>Type</th><th>Screen</th><th>Severity</th><th>Occurrences</th><th>Affected users</th><th>Status</th><th>Last seen</th></tr></thead>
            <tbody>{rows.map((row) => <tr key={row.id} className={selectedId === row.id ? 'selected' : ''} onClick={() => void loadDetail(row.id)} style={{ cursor: 'pointer' }}>
              <td>{row.error_type ?? '—'}</td><td>{row.screen ?? '—'}</td><td>{row.severity ?? '—'}</td><td>{row.occurrence_count ?? 0}</td><td>{row.affected_users_count ?? 0}</td><td>{row.status ?? '—'}</td><td>{fmtDate(row.last_seen_at)}</td>
            </tr>)}</tbody></table>}
          {phase === 'ready' && rows.length === 0 && <div className="directory-empty" role="status">No error events match these filters.</div>}
        </div>
      </section>

      <aside className="directory-inspector" aria-label="Error detail">
        {!selectedId && <p>Select an error event to view real production detail.</p>}
        {selectedId && detailPhase === 'loading' && <p>Loading…</p>}
        {selectedId && detailPhase === 'error' && <p role="alert">Could not load error detail.</p>}
        {selectedId && detailPhase === 'ready' && detail && <>
          <header><Icon name="bug_report" /><div><small>ERROR</small><strong>{detail.error_type ?? '—'}</strong></div><b>{detail.status?.toUpperCase() ?? '—'}</b></header>
          <section><h3>Details</h3><dl>
            <div><dt>Message</dt><dd>{detail.message ?? '—'}</dd></div>
            <div><dt>Screen</dt><dd>{detail.screen ?? '—'}</dd></div>
            <div><dt>Platform</dt><dd>{detail.platform ?? '—'}</dd></div>
            <div><dt>App version</dt><dd>{detail.app_version ?? '—'}</dd></div>
            <div><dt>Environment</dt><dd>{detail.environment ?? '—'}</dd></div>
            <div><dt>First seen</dt><dd>{fmtDate(detail.first_seen_at)}</dd></div>
            <div><dt>Last seen</dt><dd>{fmtDate(detail.last_seen_at)}</dd></div>
            <div><dt>Sentry event</dt><dd>{detail.sentry_event_id ?? '—'}</dd></div>
          </dl></section>
          {detail.stack && <section><h3>Stack</h3><pre>{detail.stack}</pre></section>}
          <section><h3>Notes & status</h3>
            <textarea placeholder="Admin notes…" value={note} onChange={(e) => setNote(e.target.value)} style={{ width: '100%', minHeight: 60 }} />
            <div className="jobs-actions"><button onClick={() => void setErrorStatus('investigating')}>Investigating</button><button onClick={() => void setErrorStatus('resolved')}>Resolve</button><button onClick={() => void setErrorStatus('ignored')}>Ignore</button></div>
            {message && <p role="status">{message}</p>}
          </section>
        </>}
      </aside>
    </div>
  </div>;
}
