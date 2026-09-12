import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../security/auth-context';
import { ipDisplay, listSecurityEvents, type SecurityEventRow, type SecurityEventFilters, PAGE_SIZE } from '../../services/security-events/query';
import { SecurityEventsTable } from '../../components/security-events/SecurityEventsTable';
import { SecurityEventDetail } from '../../components/security-events/SecurityEventDetail';

const EVENT_TYPES = [
  'admin_login_honeypot', 'admin_login_failed', 'admin_login_succeeded',
  'admin_mfa_challenge_failed', 'admin_mfa_challenge_succeeded', 'admin_logout',
  'admin_sentry_access_denied', 'admin_sentry_issues_listed', 'admin_sentry_issue_viewed',
];
const SEVERITIES = ['info', 'notice', 'warning', 'high', 'critical'];
const SOURCES = ['edge_function', 'database'];
const OUTCOMES = ['success', 'failure', 'blocked', 'suspicious'];

type LoadState = 'loading' | 'loaded' | 'empty' | 'error';

export function SecurityEventsPage() {
  const auth = useAuth();
  const hasAal2 = auth.assuranceLevel === 'aal2';

  const [filters, setFilters] = useState<SecurityEventFilters>({});
  const [page, setPage] = useState(1);
  const [state, setState] = useState<LoadState>('loading');
  const [rows, setRows] = useState<SecurityEventRow[]>([]);
  const [total, setTotal] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selected, setSelected] = useState<SecurityEventRow | null>(null);

  const load = useCallback(async () => {
    if (!hasAal2) return;
    setState('loading');
    const result = await listSecurityEvents(filters, page);
    if (result.error) {
      setState('error');
      setErrorMessage(result.error.message);
      return;
    }
    setRows(result.data.rows);
    setTotal(result.data.total);
    setState(result.data.rows.length === 0 ? 'empty' : 'loaded');
  }, [filters, page, hasAal2]);

  useEffect(() => { void load(); }, [load]);

  function updateFilter<K extends keyof SecurityEventFilters>(key: K, value: string) {
    setPage(1);
    setFilters((current) => ({ ...current, [key]: value || undefined }));
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const honeypotCount = rows.filter((row) => row.event_type.includes('honeypot')).length;
  const blockedCount = rows.filter((row) => row.outcome === 'blocked').length;
  const elevatedCount = rows.filter((row) => ['high', 'critical'].includes(row.severity)).length;

  if (!hasAal2) {
    return (
      <main className="standalone-state" role="alert">
        <p className="eyebrow">Verification required</p>
        <h1>An aal2 session is required</h1>
        <p>Security events are only readable with a verified aal2 session. Complete MFA, then return to this page.</p>
      </main>
    );
  }

  return (
    <div className="security-ops-page">
      <header className="security-ops-hero"><div><small>PAMARKET OPS / SECURITY & PLATFORM / <b>SECURITY & HONEYPOT EVIDENCE</b></small><h1>Honeypot Traps & Forensic Evidence Center</h1><p>Server-recorded authentication, MFA, tripwire, and rate-limit evidence. Signals require investigation and do not prove attribution by themselves.</p></div><aside><span><i className={elevatedCount ? 'danger' : ''}/>THREAT SIGNALS</span><strong>{elevatedCount ? 'ELEVATED' : 'NORMAL'}</strong><span><i/>EVIDENCE CONTROL</span><strong>APPEND-ONLY · RLS</strong></aside><button disabled><span className="material-symbols-outlined">file_download</span>Export requires super_admin handler</button></header>
      <section className="security-kpis"><article><header><span className="material-symbols-outlined">bug_report</span>HONEYPOT SIGNALS<b>SERVER RECORDED</b></header><strong>{honeypotCount}</strong><span>IN CURRENT PAGE</span><p>Hidden-field tripwire events returned by the protected audit RPC.</p><footer>DISPLAYED / TOTAL <b>{honeypotCount} / {total}</b></footer></article><article className="danger"><header><span className="material-symbols-outlined">block</span>BLOCKED ATTEMPTS<b>ACTIVE RESULT</b></header><strong>{blockedCount}</strong><span>IN CURRENT PAGE</span><p>Requests recorded with a server-owned blocked outcome.</p><footer>HIGH OR CRITICAL <b>{elevatedCount}</b></footer></article><article className="legal"><header><span className="material-symbols-outlined">gavel</span>LEGAL EVIDENCE CONTROL<b>AAL2</b></header><strong>24</strong><span>MONTH RETENTION</span><p>Active legal holds suspend retention cleanup for matching records.</p><footer>HASH CHAIN <b>NOT IMPLEMENTED</b></footer></article></section>
      <section className="security-stream"><header><div><span className="material-symbols-outlined">terminal</span><b>STREAM: SERVER SECURITY EVENTS</b></div><span><i/>RPC BUFFER: {rows.length} EVENTS</span></header><div>{rows.slice(0,4).map((row)=><button key={row.id} onClick={()=>setSelected(row)}><b className={['high','critical'].includes(row.severity)?'danger-text':''}>{row.event_type.replaceAll('_',' ')}</b><time>{new Date(row.occurred_at).toLocaleTimeString()}</time><code>IP: {ipDisplay(row.ip_address,row.ip_source)}</code><span>{row.request_method ?? 'EVENT'} {row.request_path ?? row.source}</span><em>{row.outcome.toUpperCase()}</em></button>)}{rows.length===0&&<p>{state==='loading'?'Connecting to protected event stream…':'No event rows available for this filter.'}</p>}</div><footer><span>EVENT RATE · CURRENT PAGE</span><div>{Array.from({length:12},(_,index)=><i key={index} style={{height:`${18+((index*17+rows.length*7)%75)}%`}}/>)}</div><b>NO RAW CREDENTIAL OR TOKEN DATA</b></footer></section>

      <section className="panel security-filters" aria-label="Filters">
        <div className="section-grid" style={{ gridTemplateColumns: 'repeat(4, minmax(0,1fr))' }}>
          <div>
            <label htmlFor="filter-from">From</label>
            <input id="filter-from" type="datetime-local" onChange={(event) => updateFilter('from', event.target.value ? new Date(event.target.value).toISOString() : '')} />
          </div>
          <div>
            <label htmlFor="filter-to">To</label>
            <input id="filter-to" type="datetime-local" onChange={(event) => updateFilter('to', event.target.value ? new Date(event.target.value).toISOString() : '')} />
          </div>
          <div>
            <label htmlFor="filter-severity">Severity</label>
            <select id="filter-severity" onChange={(event) => updateFilter('severity', event.target.value)}>
              <option value="">Any</option>
              {SEVERITIES.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="filter-event-type">Event type</label>
            <select id="filter-event-type" onChange={(event) => updateFilter('eventType', event.target.value)}>
              <option value="">Any</option>
              {EVENT_TYPES.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="filter-source">Source</label>
            <select id="filter-source" onChange={(event) => updateFilter('source', event.target.value)}>
              <option value="">Any</option>
              {SOURCES.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="filter-outcome">Outcome</label>
            <select id="filter-outcome" onChange={(event) => updateFilter('outcome', event.target.value)}>
              <option value="">Any</option>
              {OUTCOMES.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="filter-actor">Actor user ID</label>
            <input id="filter-actor" placeholder="uuid" onChange={(event) => updateFilter('actorUserId', event.target.value.trim())} />
          </div>
          <div>
            <label htmlFor="filter-correlation">Correlation ID</label>
            <input id="filter-correlation" placeholder="uuid" onChange={(event) => updateFilter('correlationId', event.target.value.trim())} />
          </div>
        </div>
      </section>

      {state === 'loading' && (
        <section className="panel" role="status" aria-busy="true">
          <div className="skeletons" aria-hidden="true"><i /><i /><i /></div>
        </section>
      )}

      {state === 'error' && (
        <section className="state-card error" role="alert">
          <p className="eyebrow">Could not load events</p>
          <h1>{errorMessage ?? 'Something went wrong.'}</h1>
          <button type="button" onClick={() => void load()}>Retry</button>
        </section>
      )}

      {state === 'empty' && (
        <section className="state-card empty" role="status">
          <p className="eyebrow">No matching events</p>
          <h1>Nothing to show for these filters</h1>
        </section>
      )}

      {state === 'loaded' && (
        <>
          <section className="panel table-panel security-ledger">
            <SecurityEventsTable rows={rows} onSelect={setSelected} />
          </section>
          <div className="state-preview security-pagination">
            <p>Page {page} of {totalPages}</p>
            <div>
              <button type="button" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Previous</button>
              <button type="button" disabled={page >= totalPages} onClick={() => setPage((current) => current + 1)}>Next</button>
            </div>
          </div>
        </>
      )}

      {selected && (
        <SecurityEventDetail
          eventSummary={selected}
          onClose={() => setSelected(null)}
          onHoldChanged={() => void load()}
        />
      )}
      <footer className="security-ledger-footer"><span className="material-symbols-outlined">lock_clock</span><div><strong>PAMARKET FORENSIC AUDIT LEDGER</strong><small>Append-only evidence · 24-month default retention · active holds suspend cleanup</small></div><span>CRYPTOGRAPHIC HASH CHAIN: <b>NOT IMPLEMENTED</b></span></footer>
    </div>
  );
}
