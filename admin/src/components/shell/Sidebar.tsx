import { NavLink } from 'react-router-dom';
import { navigationGroups } from '../../app/navigation';

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  return <><button className={`nav-scrim ${open ? 'is-open' : ''}`} type="button" aria-label="Close navigation" onClick={onClose} tabIndex={open ? 0 : -1} />
    <aside className={`sidebar ${open ? 'is-open' : ''}`} aria-label="Admin navigation">
      <div className="brand"><span className="brand-mark" aria-hidden="true">P</span><div><strong>Pa<span>Market</span></strong><small>Admin preview</small></div></div>
      <nav>{navigationGroups.map((group) => <section className="nav-group" key={group.label} aria-labelledby={`nav-${group.label.replace(/\W/g, '-').toLowerCase()}`}><h2 id={`nav-${group.label.replace(/\W/g, '-').toLowerCase()}`}>{group.label}</h2>{group.items.map((item) => <NavLink key={item.path} to={item.path} end={item.path === '/'} onClick={onClose}>{item.label}<span aria-hidden="true">›</span></NavLink>)}</section>)}</nav>
      <div className="sidebar-foot"><span>STAGE B</span><p>Static mock data only</p></div>
    </aside></>;
}
