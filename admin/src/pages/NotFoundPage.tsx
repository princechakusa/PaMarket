import { Link } from 'react-router-dom';
export function NotFoundPage() { return <main className="standalone-state"><p className="eyebrow">404</p><h1>Admin route not found</h1><p>Mock shell only. This section is not connected to production yet.</p><Link className="primary-link" to="/">Open dashboard</Link></main>; }
