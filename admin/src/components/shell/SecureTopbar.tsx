import { EnvironmentBadge } from './EnvironmentBadge';
import { useAuth } from '../../security/auth-context';

export function SecureTopbar({ onMenu }: { onMenu: () => void }) {
  const auth = useAuth();
  const admin = auth.identity;
  const initials = admin?.name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase() ?? 'PA';
  return <header className="topbar">
    <button className="menu-button material-symbols-outlined" type="button" onClick={onMenu} aria-label="Open navigation">menu</button>
    <div className="topbar-left"><EnvironmentBadge /><div className="search-shell" role="search"><label className="sr-only" htmlFor="admin-search">Search PaMarket administration</label><span className="material-symbols-outlined" aria-hidden="true">search</span><input id="admin-search" type="search" placeholder="Search listings, users, national ID, order ID... (Press /)" disabled /><kbd>/</kbd></div></div>
    <div className="topbar-meta"><div className={`assurance-badge ${auth.assuranceLevel === 'aal2' ? 'verified' : ''}`}><span className="material-symbols-outlined" aria-hidden="true">lock</span><span>{auth.assuranceLevel?.toUpperCase() ?? 'NO AAL'} · {auth.assuranceLevel === 'aal2' ? 'MFA VERIFIED' : 'SESSION'}</span></div><div className="topbar-actions"><button type="button" disabled><span className="material-symbols-outlined">campaign</span>+ Announce</button><button type="button" disabled><span className="material-symbols-outlined">download</span>Export</button><button type="button" className="freeze" disabled><span className="material-symbols-outlined">lock_reset</span>Emergency Freeze</button></div><div className="operator"><span><strong>{admin?.name ?? 'Administrator'}</strong><small>{(admin?.role ?? 'unverified').replace('_', ' ').toUpperCase()}</small></span><span className="avatar" aria-hidden="true">{initials}</span><button type="button" className="signout material-symbols-outlined" aria-label="Sign out session" onClick={() => void auth.signOut()} disabled={auth.mode !== 'live'} title={auth.mode === 'live' ? 'Sign out session' : 'Sign-out is inactive in preview mode'}>power_settings_new</button></div></div>
  </header>;
}
