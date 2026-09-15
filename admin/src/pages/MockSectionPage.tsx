import { Link, useLocation } from 'react-router-dom';
import type { Permission } from '../security/permissions';
import { useAuth } from '../security/auth-context';

export function MockSectionPage({ title, permission }: { title: string; permission: Permission }) {
  const { identity } = useAuth();
  const location = useLocation();
  const allowed = identity?.permissions.includes(permission) ?? false;
  return <><div className="page-heading"><div><p className="eyebrow">Not yet migrated</p><h1>{title}</h1><p>This capability has not been rebuilt against production data yet. It performs no network requests and exposes no operational actions.</p></div><span className="status-pill neutral">Not migrated</span></div>
    <section className="notice-card" aria-labelledby="section-status"><span className="notice-icon" aria-hidden="true">◇</span><div><h2 id="section-status">Honest placeholder</h2><p>This route exists so navigation and permission checks work, and is not connected to any production or fixture data. It is not a preview of a feature -- there is nothing to see here yet.</p></div></section>
    <div className="section-grid"><section className="panel"><p className="eyebrow">Route</p><h2>{location.pathname}</h2><dl className="detail-list"><div><dt>Data source</dt><dd>None -- no queries are made</dd></div><div><dt>Status</dt><dd>Not migrated</dd></div><div><dt>Production access</dt><dd>Disabled</dd></div></dl></section><section className="panel"><p className="eyebrow">Authorization</p><h2>{permission}</h2><p className={`permission-result ${allowed ? 'allowed' : 'denied'}`}>{allowed ? 'Allowed by verified role' : 'Denied by verified role'}</p><p>This UI guard does not replace RLS or server-side authorization.</p></section></div>
    <Link className="text-link" to="/">Return to dashboard</Link></>;
}
