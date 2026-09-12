import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../security/auth-context';
import {
  getSecurityEvent, placeLegalHold, releaseLegalHold, ipDisplay,
  type SecurityEventRow, type SecurityEventDetail as SecurityEventDetailRow,
} from '../../services/security-events/query';

function MetadataList({ metadata }: { metadata: unknown }) {
  if (!metadata || typeof metadata !== 'object') return <p>None recorded.</p>;
  const entries = Object.entries(metadata as Record<string, unknown>);
  if (entries.length === 0) return <p>None recorded.</p>;
  // Rendered as plain React text nodes only — never dangerouslySetInnerHTML,
  // never interpreted as HTML/markup, regardless of what a value contains.
  return (
    <dl className="detail-list">
      {entries.map(([key, value]) => (
        <div key={key}><dt>{key}</dt><dd>{typeof value === 'string' ? value : JSON.stringify(value)}</dd></div>
      ))}
    </dl>
  );
}

/**
 * Detail drawer. C2D-FIX: fetches through get_security_event() only —
 * never a direct table read of security_events or
 * security_event_legal_holds. IP visibility and hold_status both come
 * back from that one RPC call, already redacted/computed server-side.
 */
export function SecurityEventDetail({ eventSummary, onClose, onHoldChanged }: {
  eventSummary: SecurityEventRow;
  onClose: () => void;
  onHoldChanged: () => void;
}) {
  const auth = useAuth();
  const [event, setEvent] = useState<SecurityEventDetailRow | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const canManageHolds = auth.identity?.role === 'super_admin' && auth.assuranceLevel === 'aal2';

  const load = useCallback(async () => {
    const result = await getSecurityEvent(eventSummary.id);
    if (result.error) { setLoadError(result.error.message); return; }
    setLoadError(null);
    setEvent(result.data);
  }, [eventSummary.id]);

  useEffect(() => { void load(); }, [load]);

  async function handlePlaceHold() {
    if (busy || reason.trim().length === 0) return;
    setBusy(true);
    setActionError(null);
    const result = await placeLegalHold({ eventId: eventSummary.id, reason: reason.trim() });
    setBusy(false);
    if (result.error) { setActionError(result.error.message); return; }
    setReason('');
    await load();
    onHoldChanged();
  }

  async function handleReleaseHold() {
    if (busy || !event?.hold_id) return;
    setBusy(true);
    setActionError(null);
    const result = await releaseLegalHold(event.hold_id);
    setBusy(false);
    if (result.error) { setActionError(result.error.message); return; }
    await load();
    onHoldChanged();
  }

  if (!event) {
    return (
      <aside className="panel" role="dialog" aria-label="Security event detail" style={{ marginTop: 16 }}>
        {loadError ? <p role="alert" className="form-error">{loadError}</p> : <p>Loading…</p>}
        <button type="button" onClick={onClose}>Close</button>
      </aside>
    );
  }

  return (
    <aside className="panel" role="dialog" aria-label="Security event detail" style={{ marginTop: 16 }}>
      <div className="panel-heading">
        <h2>{event.event_type}</h2>
        <button type="button" onClick={onClose}>Close</button>
      </div>

      {event.event_type === 'admin_login_honeypot' && (
        <p className="notice-card" style={{ padding: 10 }}>
          This is a honeypot signal — a hidden form field was filled in. On its own it is a signal that requires
          investigation, not proof of a specific person, device, or intrusion.
        </p>
      )}

      <dl className="detail-list">
        <div><dt>Occurred</dt><dd>{new Date(event.occurred_at).toLocaleString()}</dd></div>
        <div><dt>Received</dt><dd>{new Date(event.received_at).toLocaleString()}</dd></div>
        <div><dt>Severity</dt><dd>{event.severity}</dd></div>
        <div><dt>Source</dt><dd>{event.source}</dd></div>
        <div><dt>Action</dt><dd>{event.action}</dd></div>
        <div><dt>Outcome</dt><dd>{event.outcome}</dd></div>
        <div><dt>Reason code</dt><dd>{event.reason_code ?? '—'}</dd></div>
        <div><dt>Actor role</dt><dd>{event.actor_role ?? '—'}</dd></div>
        <div><dt>Actor authenticated</dt><dd>{event.actor_authenticated ? 'Yes' : 'No'}</dd></div>
        <div><dt>Assurance level</dt><dd>{event.assurance_level}</dd></div>
        <div><dt>Target</dt><dd>{event.target_type ? `${event.target_type}:${event.target_id ?? ''}` : '—'}</dd></div>
        <div><dt>Correlation ID</dt><dd className="break-value">{event.correlation_id ?? '—'}</dd></div>
        <div><dt>Request path</dt><dd className="break-value">{event.request_path ?? '—'}</dd></div>
        <div><dt>IP address</dt><dd>{ipDisplay(event.ip_address, event.ip_source)}</dd></div>
        <div><dt>User agent</dt><dd className="break-value">{event.user_agent ?? '—'}</dd></div>
        <div><dt>Retention until</dt><dd>{new Date(event.retention_until).toLocaleDateString()}</dd></div>
      </dl>

      <h3>Metadata</h3>
      <MetadataList metadata={event.metadata} />

      <h3>Legal hold</h3>
      {event.hold_status === 'active' ? (
        <p><span className="status-pill escalated">On hold</span></p>
      ) : (
        <p><span className="status-pill neutral">No active hold</span></p>
      )}

      {canManageHolds ? (
        event.hold_status === 'active' ? (
          <button type="button" className="danger-button" disabled={busy} onClick={() => void handleReleaseHold()}>Release hold</button>
        ) : (
          <div>
            <label htmlFor="hold-reason" className="sr-only">Hold reason</label>
            <input id="hold-reason" placeholder="Reason (required)" value={reason} onChange={(changeEvent) => setReason(changeEvent.target.value.slice(0, 500))} disabled={busy} />
            <button type="button" className="primary-button" disabled={busy || reason.trim().length === 0} onClick={() => void handlePlaceHold()}>{busy ? 'Placing…' : 'Place legal hold'}</button>
          </div>
        )
      ) : (
        <p>Only super_admin, with an aal2 session, may place or release a legal hold.</p>
      )}
      {actionError && <p role="alert" className="form-error">{actionError}</p>}
    </aside>
  );
}
