import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from '../components/shell/Sidebar';
import { SecureTopbar } from '../components/shell/SecureTopbar';
import { useAuth } from '../security/auth-context';

export function AdminLayout() {
  const auth = useAuth();
  const [navigationOpen, setNavigationOpen] = useState(false);
  // These chips previously read "SECURE SESSION / AUDIT LINKED / RLS
  // ACTIVE" unconditionally, even in mock/preview mode where none of that
  // is actually true -- unlike the rest of the shell (EnvironmentBadge,
  // the AAL2 badge), which derives its state from auth.mode/session. Now
  // matches that same convention.
  const live = auth.mode === 'live';
  return <div className="admin-shell"><a className="skip-link" href="#main-content">Skip to main content</a><Sidebar open={navigationOpen} onClose={() => setNavigationOpen(false)} /><div className="workspace"><SecureTopbar onMenu={() => setNavigationOpen(true)} /><div className="system-bar"><div><span className="material-symbols-outlined">grid_view</span><span>SYSTEM CORE</span><span>/</span><strong>OPS TERMINAL</strong></div><div>{live ? <><span className="live-dot" /><span>SECURE SESSION</span><span className="system-chip">AUDIT LINKED</span><span className="system-chip">RLS ACTIVE</span></> : <span className="system-chip">REFERENCE DATA MODE</span>}</div></div><main id="main-content" className="page" tabIndex={-1}><Outlet /></main></div></div>;
}
