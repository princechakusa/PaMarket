import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from '../components/shell/Sidebar';
import { SecureTopbar } from '../components/shell/SecureTopbar';

export function AdminLayout() {
  const [navigationOpen, setNavigationOpen] = useState(false);
  return <div className="admin-shell"><a className="skip-link" href="#main-content">Skip to main content</a><Sidebar open={navigationOpen} onClose={() => setNavigationOpen(false)} /><div className="workspace"><SecureTopbar onMenu={() => setNavigationOpen(true)} /><div className="system-bar"><div><span className="material-symbols-outlined">grid_view</span><span>SYSTEM CORE</span><span>/</span><strong>OPS TERMINAL</strong></div><div><span className="live-dot" /><span>SECURE SESSION</span><span className="system-chip">AUDIT LINKED</span><span className="system-chip">RLS ACTIVE</span></div></div><main id="main-content" className="page" tabIndex={-1}><Outlet /></main></div></div>;
}
