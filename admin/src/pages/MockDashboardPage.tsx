import { Link } from 'react-router-dom';
import { useMockAdmin } from '../app/providers';

const metrics = [
  { label: 'Active listings', value: '18,420', change: '+6.4%', tone: 'navy' },
  { label: 'Verified sellers', value: '3,286', change: '+128', tone: 'green' },
  { label: 'Open reports', value: '24', change: '5 urgent', tone: 'red' },
  { label: 'Mock GMV', value: '$84.2k', change: 'Preview only', tone: 'gold' },
];
const queues = [
  { name: 'Pending listings', count: 37, path: '/marketplace/listings', tone: 'gold' },
  { name: 'Verifications', count: 12, path: '/marketplace/verifications', tone: 'blue' },
  { name: 'Reports', count: 24, path: '/trust/reports', tone: 'red' },
  { name: 'Errors', count: 8, path: '/observability/errors', tone: 'purple' },
  { name: 'Orders', count: 'Scope pending', path: '/orders', tone: 'gray' },
];
const rows = [
  { item: 'Toyota Hilux 2021', seller: 'Moyo Motors', area: 'Harare', status: 'Pending', age: '18 min' },
  { item: 'Two-bedroom cottage', seller: 'T. Ncube', area: 'Bulawayo', status: 'Review', age: '43 min' },
  { item: 'Solar installation', seller: 'SunGrid ZW', area: 'Mutare', status: 'Pending', age: '1 hr' },
  { item: 'Graphic design package', seller: 'Studio North', area: 'Gweru', status: 'Escalated', age: '2 hrs' },
];

export function MockDashboardPage() {
  const admin = useMockAdmin();
  return <>
    <div className="mock-banner" role="note"><strong>Mock shell only.</strong> This section is not connected to production yet. Every number and identity shown here is fictional.</div>
    <div className="page-heading dashboard-heading"><div><p className="eyebrow">Wednesday, 10 September</p><h1>Good morning, {admin.name.split(' ')[0]}</h1><p>A static operations preview for the new PaMarket admin application.</p></div><button type="button" className="primary-button" disabled>Export mock report</button></div>
    <section aria-labelledby="marketplace-overview"><div className="section-heading"><div><p className="eyebrow">Marketplace pulse</p><h2 id="marketplace-overview">Overview</h2></div><span className="data-label">Static fixture · 09:30 CAT</span></div><div className="metric-grid">{metrics.map((metric) => <article className={`metric-card ${metric.tone}`} key={metric.label}><p>{metric.label}</p><strong>{metric.value}</strong><span>{metric.change}</span></article>)}</div></section>
    <section aria-labelledby="work-queues"><div className="section-heading"><div><p className="eyebrow">Requires attention</p><h2 id="work-queues">Work queues</h2></div></div><div className="queue-grid">{queues.map((queue) => <Link className="queue-card" to={queue.path} key={queue.name}><span className={`queue-icon ${queue.tone}`} aria-hidden="true">{typeof queue.count === 'number' ? queue.count : '—'}</span><span><strong>{queue.name}</strong><small>{typeof queue.count === 'number' ? 'Mock items awaiting review' : queue.count}</small></span><b aria-hidden="true">→</b></Link>)}</div></section>
    <div className="dashboard-columns"><section className="panel table-panel" aria-labelledby="review-preview"><div className="panel-heading"><div><p className="eyebrow">Sample data</p><h2 id="review-preview">Latest review queue</h2></div><Link to="/marketplace/listings">View mock route</Link></div><div className="table-scroll"><table><thead><tr><th>Listing</th><th>Seller</th><th>Area</th><th>Status</th><th>Age</th></tr></thead><tbody>{rows.map((row) => <tr key={row.item}><td><strong>{row.item}</strong></td><td>{row.seller}</td><td>{row.area}</td><td><span className={`status-pill ${row.status.toLowerCase()}`}>{row.status}</span></td><td>{row.age}</td></tr>)}</tbody></table></div></section>
      <aside className="panel permission-panel" aria-labelledby="mock-access"><div className="panel-heading"><div><p className="eyebrow">Security placeholder</p><h2 id="mock-access">Mock access</h2></div><span className="status-pill neutral">UI only</span></div><div className="identity-card"><span className="avatar large" aria-hidden="true">TM</span><div><strong>{admin.name}</strong><p>{admin.email}</p></div></div><dl className="detail-list"><div><dt>Role</dt><dd>Admin · mock</dd></div><div><dt>Session</dt><dd>Active · mock</dd></div><div><dt>Environment</dt><dd>Local fixture</dd></div></dl><h3>Permission sample</h3><div className="permission-list">{admin.permissions.map((permission) => <span key={permission}>{permission}</span>)}</div><Link className="text-link" to="/states/forbidden">Preview forbidden state</Link></aside></div>
    <section className="panel state-preview" aria-labelledby="state-library"><div><p className="eyebrow">Interaction states</p><h2 id="state-library">State library</h2><p>Review the shell’s explicit non-production feedback patterns.</p></div><div>{['loading', 'empty', 'error', 'forbidden'].map((state) => <Link key={state} to={`/states/${state}`}>{state}</Link>)}</div></section>
  </>;
}
