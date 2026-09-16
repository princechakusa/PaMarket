import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { opsNavigationGroups } from '../../app/navigation';
import { useAuth } from '../../security/auth-context';
import { getPendingVerificationsCount } from '../../services/verifications/query';

// Polled (not just fetched once on mount) because the sidebar itself
// persists across every page navigation inside AdminLayout -- an operator
// could sit on an unrelated page for a while and a new submission would
// otherwise never surface here. 60s keeps this well within "no polling
// storm" territory for a single lightweight two-count query.
const PENDING_VERIFICATIONS_POLL_MS = 60_000;

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { identity, mode } = useAuth();
  const allowed = new Set(identity?.permissions ?? []);
  const [pendingVerifications, setPendingVerifications] = useState<number | null>(null);

  useEffect(() => {
    if (mode !== 'live' || !allowed.has('verifications.manage')) return;
    let active = true;
    async function poll() {
      const result = await getPendingVerificationsCount();
      if (active && !result.error) setPendingVerifications(result.data);
    }
    void poll();
    const interval = window.setInterval(() => void poll(), PENDING_VERIFICATIONS_POLL_MS);
    return () => { active = false; window.clearInterval(interval); };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `allowed` is rebuilt every render from identity.permissions; identity.id is the real dependency.
  }, [mode, identity?.id]);

  return <><button className={`nav-scrim ${open ? 'is-open' : ''}`} type="button" aria-label="Close navigation" onClick={onClose} tabIndex={open ? 0 : -1} />
    <aside className={`sidebar ${open ? 'is-open' : ''}`} aria-label="Admin navigation">
      <div className="brand"><span className="brand-mark" aria-hidden="true">P</span><div><strong>PAMARKET</strong><small>SECURITY OPS</small></div></div>
      <nav>{opsNavigationGroups.map((group) => {
        const items = group.items.filter((item) => allowed.has(item.permission));
        if (!items.length) return null;
        const headingId = `nav-${group.label.replace(/\W/g, '-').toLowerCase()}`;
        return <section className="nav-group" key={group.label} aria-labelledby={headingId}><h2 id={headingId}>{group.label}</h2>{items.map((item) => {
          const badge = item.path === '/marketplace/verifications' && pendingVerifications ? String(pendingVerifications) : item.badge;
          const badgeTone = item.path === '/marketplace/verifications' && pendingVerifications ? 'warning' : item.badgeTone;
          return <NavLink key={item.path} to={item.path} end={item.path === '/'} onClick={onClose}><span className="material-symbols-outlined" aria-hidden="true">{item.icon}</span><span className="nav-label">{item.label}</span>{badge && <b className={`nav-badge ${badgeTone ?? 'neutral'}`}>{badge}</b>}</NavLink>;
        })}</section>;
      })}</nav>
      <div className="sidebar-foot"><span>CORE v4.19-{mode === 'live' ? 'PROD' : 'PREVIEW'}</span><strong>{mode === 'live' ? 'ZIM-FED-NET' : 'LOCAL FIXTURE'}</strong></div>
    </aside></>;
}
