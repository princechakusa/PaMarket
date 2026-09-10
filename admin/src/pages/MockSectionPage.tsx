import { Link, useLocation } from 'react-router-dom';
import { useMockAdmin } from '../app/providers';

export function MockSectionPage({ title, permission }: { title: string; permission?: string }) {
  const admin = useMockAdmin();
  const location = useLocation();
  const allowed = !permission || admin.permissions.includes(permission);
  return <><div className="page-heading"><div><p className="eyebrow">Stage B preview</p><h1>{title}</h1><p>Mock shell only. This section is not connected to production yet.</p></div><span className="status-pill neutral">Not migrated</span></div>
    <section className="notice-card" aria-labelledby="section-status"><span className="notice-icon" aria-hidden="true">◇</span><div><h2 id="section-status">Foundation route ready</h2><p>This route proves navigation, layout, responsive behavior, and explicit migration status. It performs no network requests and exposes no operational actions.</p></div></section>
    <div className="section-grid"><section className="panel"><p className="eyebrow">Route</p><h2>{location.pathname}</h2><dl className="detail-list"><div><dt>Data source</dt><dd>Static mock fixture</dd></div><div><dt>Migration</dt><dd>Legacy only</dd></div><div><dt>Production access</dt><dd>Disabled</dd></div></dl></section><section className="panel"><p className="eyebrow">Mock authorization</p><h2>{permission ?? 'Route visibility only'}</h2><p className={`permission-result ${allowed ? 'allowed' : 'denied'}`}>{allowed ? 'Allowed by mock role' : 'Denied by mock role'}</p><p>This display is a UI placeholder. Server authorization and RLS must enforce real access in a later approved stage.</p></section></div>
    <Link className="text-link" to="/">Return to mock dashboard</Link></>;
}
