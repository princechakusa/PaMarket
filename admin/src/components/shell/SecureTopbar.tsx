import { EnvironmentBadge } from './EnvironmentBadge';
import { useAuth } from '../../security/auth-context';

export function SecureTopbar({ onMenu }: { onMenu: () => void }) {
  const auth = useAuth();
  const admin = auth.identity;
  const initials = admin?.name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase() ?? 'PA';
  return <header className="topbar">
    <button className="menu-button" type="button" onClick={onMenu} aria-label="Open navigation"><span aria-hidden="true">☰</span></button>
    <div className="search-shell" role="search"><label className="sr-only" htmlFor="admin-search">Search the admin foundation</label><span aria-hidden="true">⌕</span><input id="admin-search" type="search" placeholder="Search unavailable in Stage C" disabled /></div>
    <div className="topbar-meta"><EnvironmentBadge /><div className="session-status"><span className="status-label">Session</span><strong>{auth.status}{auth.assuranceLevel ? ` · ${auth.assuranceLevel}` : ''}</strong></div><button type="button" className="profile-button" aria-label={auth.mode === 'live' ? 'Sign out' : 'Mock admin profile'} onClick={() => void auth.signOut()} title={auth.mode === 'live' ? 'Sign out' : 'Logout is inactive in mock mode'}><span className="avatar" aria-hidden="true">{initials}</span><span><strong>{admin?.name ?? 'Administrator'}</strong><small>{admin?.role ?? 'unverified'} · {auth.mode}</small></span></button></div>
  </header>;
}
