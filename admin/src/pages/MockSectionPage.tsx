import { Link, useLocation } from 'react-router-dom';
import type { Permission } from '../security/permissions';
import { useAuth } from '../security/auth-context';

export function MockSectionPage({ title, permission }: { title: string; permission: Permission }) {
  const { identity } = useAuth();
  const location = useLocation();
  const allowed = identity?.permissions.includes(permission) ?? false;
  return <><div className="page-heading"><div><p className="eyebrow">Stage C foundation</p><h1>{title}</h1><p>Mock feature data only. This section is not connected to production data yet.</p></div><span className="status-pill neutral">Not migrated</span></div>
    <section className="notice-card" aria-labelledby="section-status"><span className="notice-icon" aria-hidden="true">◇</span><div><h2 id="section-status">Foundation route ready</h2><p>This route proves navigation, layout, responsive behavior, and explicit migration status. It performs no network requests and exposes no operational actions.</p></div></section>
    <div className="section-grid"><section className="panel"><p className="eyebrow">Route</p><h2>{location.pathname}</h2><dl className="detail-list"><div><dt>Data source</dt><dd>Static mock fixture</dd></div><div><dt>Migration</dt><dd>Legacy only</dd></div><div><dt>Production access</dt><dd>Disabled</dd></div></dl></section><section className="panel"><p className="eyebrow">Authorization</p><h2>{permission}</h2><p className={`permission-result ${allowed ? 'allowed' : 'denied'}`}>{allowed ? 'Allowed by verified role' : 'Denied by verified role'}</p><p>This UI guard does not replace RLS or server-side authorization.</p></section></div>
    <Link className="text-link" to="/">Return to mock dashboard</Link></>;
}
