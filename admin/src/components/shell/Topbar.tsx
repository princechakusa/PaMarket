import { EnvironmentBadge } from './EnvironmentBadge';
import { useAuth } from '../../security/auth-context';

export function Topbar({ onMenu }: { onMenu: () => void }) {
  const { identity: admin } = useAuth();
  if (!admin) return null;
  return <header className="topbar">
    <button className="menu-button" type="button" onClick={onMenu} aria-label="Open navigation"><span aria-hidden="true">☰</span></button>
    <div className="search-shell" role="search"><label className="sr-only" htmlFor="admin-search">Search the mock admin</label><span aria-hidden="true">⌕</span><input id="admin-search" type="search" placeholder="Search preview (not connected)" disabled /><kbd aria-hidden="true">⌘ K</kbd></div>
    <div className="topbar-meta"><EnvironmentBadge /><div className="session-status"><span className="status-label">Session</span><strong>Mock · 42 min</strong></div><button type="button" className="profile-button" aria-label="Open mock admin profile"><span className="avatar" aria-hidden="true">TM</span><span><strong>{admin.name}</strong><small>{admin.role} · mock</small></span></button></div>
  </header>;
}
