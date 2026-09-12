import { NavLink } from 'react-router-dom';
import { opsNavigationGroups } from '../../app/navigation';
import { useAuth } from '../../security/auth-context';

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { identity, mode } = useAuth();
  const allowed = new Set(identity?.permissions ?? []);
  return <><button className={`nav-scrim ${open ? 'is-open' : ''}`} type="button" aria-label="Close navigation" onClick={onClose} tabIndex={open ? 0 : -1} />
    <aside className={`sidebar ${open ? 'is-open' : ''}`} aria-label="Admin navigation">
      <div className="brand"><span className="brand-mark" aria-hidden="true">P</span><div><strong>PAMARKET</strong><small>SECURITY OPS</small></div></div>
      <nav>{opsNavigationGroups.map((group) => {
        const items = group.items.filter((item) => allowed.has(item.permission));
        if (!items.length) return null;
        const headingId = `nav-${group.label.replace(/\W/g, '-').toLowerCase()}`;
        return <section className="nav-group" key={group.label} aria-labelledby={headingId}><h2 id={headingId}>{group.label}</h2>{items.map((item) => <NavLink key={item.path} to={item.path} end={item.path === '/'} onClick={onClose}><span className="material-symbols-outlined" aria-hidden="true">{item.icon}</span><span className="nav-label">{item.label}</span>{item.badge && <b className={`nav-badge ${item.badgeTone ?? 'neutral'}`}>{item.badge}</b>}</NavLink>)}</section>;
      })}</nav>
      <div className="sidebar-foot"><span>CORE v4.19-{mode === 'live' ? 'PROD' : 'PREVIEW'}</span><strong>{mode === 'live' ? 'ZIM-FED-NET' : 'LOCAL FIXTURE'}</strong></div>
    </aside></>;
}
