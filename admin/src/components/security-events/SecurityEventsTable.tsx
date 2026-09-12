import { ipDisplay, type SecurityEventRow } from '../../services/security-events/query';

const SEVERITY_LABEL: Record<string, string> = {
  info: 'Info', notice: 'Notice', warning: 'Warning', high: 'High', critical: 'Critical',
};
const OUTCOME_CLASS: Record<string, string> = {
  success: 'review', failure: 'escalated', blocked: 'escalated', suspicious: 'pending',
};

// The IP column is always shown — what varies per caller is the *value*
// the server returned (a real address for super_admin, "Restricted for
// this role" for admin), never whether the browser decided to render the
// column. Authorization already happened server-side before this data
// arrived.
export function SecurityEventsTable({
  rows,
  onSelect,
}: {
  rows: SecurityEventRow[];
  onSelect: (event: SecurityEventRow) => void;
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
            <th>IP</th>
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
              <td className="break-value">{ipDisplay(row.ip_address, row.ip_source)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
