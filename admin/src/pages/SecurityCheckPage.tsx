import { Link } from 'react-router-dom';
import { useAuth } from '../security/auth-context';

export function SecurityCheckPage() {
  const auth = useAuth();
  return <>
    <div className="page-heading"><div><p className="eyebrow">Stage C verification</p><h1>Connection check</h1><p>Safe client state for the isolated admin shell. No production feature data is queried.</p></div><span className="status-pill neutral">Read only</span></div>
    <div className="section-grid">
      <section className="panel"><h2>Supabase client</h2><dl className="detail-list"><div><dt>Mode</dt><dd>{auth.mode}</dd></div><div><dt>Connection</dt><dd>{auth.mode === 'live' ? 'Configured' : 'Not connected'}</dd></div><div><dt>Session</dt><dd>{auth.status}</dd></div><div><dt>Assurance</dt><dd>{auth.assuranceLevel ?? 'Not available'}</dd></div></dl></section>
      <section className="panel"><h2>Verified identity</h2><dl className="detail-list"><div><dt>User ID</dt><dd className="break-value">{auth.identity?.id ?? 'Unavailable'}</dd></div><div><dt>Profile role</dt><dd>{auth.identity?.role ?? 'Unavailable'}</dd></div></dl><h3>Enabled permissions</h3><div className="permission-list">{auth.identity?.permissions.map((permission) => <span key={permission}>{permission}</span>)}</div></section>
    </div>
    <section className="notice-card connection-note"><div><h2>Authorization boundary</h2><p>The route is visible only after the database profile role is confirmed. UI guards improve navigation, while Postgres RLS and server-side checks remain mandatory for every live operation.</p></div></section>
    <Link className="text-link" to="/settings/security">Manage multi-factor authentication →</Link>
  </>;
}
