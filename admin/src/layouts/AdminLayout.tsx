import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from '../components/shell/Sidebar';
import { SecureTopbar } from '../components/shell/SecureTopbar';

export function AdminLayout() {
  const [navigationOpen, setNavigationOpen] = useState(false);
  return <div className="admin-shell"><a className="skip-link" href="#main-content">Skip to main content</a><Sidebar open={navigationOpen} onClose={() => setNavigationOpen(false)} /><div className="workspace"><SecureTopbar onMenu={() => setNavigationOpen(true)} /><main id="main-content" className="page" tabIndex={-1}><Outlet /></main></div></div>;
}
