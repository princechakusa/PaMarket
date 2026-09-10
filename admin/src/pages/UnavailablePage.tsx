import { Link, useParams } from 'react-router-dom';
import type { Permission } from '../security/permissions';

export function ForbiddenState({ requestedPermission = 'security.manage' }: { requestedPermission?: Permission }) { return <section className="state-card forbidden" role="status"><p className="eyebrow">403 state</p><h1>Permission required</h1><p>This identity does not have <code>{requestedPermission}</code>. No feature data request was made.</p></section>; }

export function UnavailablePage() {
  const { state } = useParams();
  if (state === 'forbidden') return <><ForbiddenState /><StateFooter /></>;
  const content = state === 'loading' ? ['Loading records…', 'Mock loading state', 'loading'] : state === 'empty' ? ['Nothing needs attention', 'Mock empty state', 'empty'] : ['We could not load this preview', 'Mock error state', 'error'];
  return <><section className={`state-card ${content[2]}`} role={state === 'error' ? 'alert' : 'status'} aria-busy={state === 'loading'}><p className="eyebrow">{content[1]}</p><h1>{content[0]}</h1><p>Mock shell only. This section is not connected to production yet.</p>{state === 'loading' && <div className="skeletons" aria-hidden="true"><i /><i /><i /></div>}{state === 'error' && <button type="button" disabled>Retry unavailable in Stage B</button>}</section><StateFooter /></>;
}
function StateFooter() { return <Link className="text-link" to="/">Return to mock dashboard</Link>; }
