import type { SecurityEvent } from '../../services/security-events/query';

const SEVERITY_LABEL: Record<string, string> = {
  info: 'Info', notice: 'Notice', warning: 'Warning', high: 'High', critical: 'Critical',
};
const OUTCOME_CLASS: Record<string, string> = {
  success: 'review', failure: 'escalated', blocked: 'escalated', suspicious: 'pending',
};

export function SecurityEventsTable({
  rows,
  canSeeIp,
  onSelect,
}: {
  rows: SecurityEvent[];
  canSeeIp: boolean;
  onSelect: (event: SecurityEvent) => void;
}) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Occurred</th>
            <th>Event</th>
            <th>Severity</th>
            <th>Outcome</th>
            <th>Actor</th>
            <th>Source</th>
            {canSeeIp && <th>IP</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} onClick={() => onSelect(row)} style={{ cursor: 'pointer' }}>
              <td>{new Date(row.occurred_at).toLocaleString()}</td>
              <td>
                <strong>{row.event_type}</strong>
                {row.event_type === 'admin_login_honeypot' && (
                  <span className="status-pill escalated" style={{ marginLeft: 8 }}>Signal — needs investigation</span>
                )}
              </td>
              <td>{SEVERITY_LABEL[row.severity] ?? row.severity}</td>
              <td><span className={`status-pill ${OUTCOME_CLASS[row.outcome] ?? 'neutral'}`}>{row.outcome}</span></td>
              <td>{row.actor_role ?? (row.actor_authenticated ? 'authenticated' : '—')}</td>
              <td>{row.source}</td>
              {canSeeIp && <td className="break-value">{row.ip_address ?? '—'}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
