import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../security/auth-context';
import { listSecurityEvents, type SecurityEventRow, type SecurityEventFilters, PAGE_SIZE } from '../../services/security-events/query';
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
    <>
      <div className="page-heading">
        <div><p className="eyebrow">Observability</p><h1>Security events</h1><p>Server-recorded login, MFA, and honeypot signals. Investigation records, not a claim of proven intrusion.</p></div>
        <span className="status-pill neutral">{total} total</span>
      </div>

      <section className="panel" aria-label="Filters">
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
          <section className="panel table-panel">
            <SecurityEventsTable rows={rows} onSelect={setSelected} />
          </section>
          <div className="state-preview">
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
    </>
  );
}
