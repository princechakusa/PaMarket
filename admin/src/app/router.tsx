import { createBrowserRouter } from 'react-router-dom';
import { AdminLayout } from '../layouts/AdminLayout';
import { MockDashboardPage } from '../pages/MockDashboardPage';
import { MockSectionPage } from '../pages/MockSectionPage';
import { UnavailablePage } from '../pages/UnavailablePage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { SecurityCheckPage } from '../pages/SecurityCheckPage';
import { LoginPage } from '../pages/LoginPage';
import { MfaChallengePage } from '../pages/MfaChallengePage';
import { SecuritySettingsPage } from '../pages/security/SecuritySettingsPage';
import { MfaEnrollPage } from '../pages/security/MfaEnrollPage';
import { RequirePermission } from '../security/RequirePermission';
import { RequireSession } from '../security/RequireSession';
import { mockRoutes } from './navigation';

export function createAppRouter() { return createBrowserRouter([
  // Public, pre-session routes — never wrapped in RequireSession.
  { path: '/login', element: <LoginPage /> },
  { path: '/mfa/challenge', element: <MfaChallengePage /> },
  {
    path: '/', element: <RequireSession><AdminLayout /></RequireSession>, errorElement: <NotFoundPage />, children: [
      { index: true, element: <RequirePermission permission="dashboard.view"><MockDashboardPage /></RequirePermission> },
      ...mockRoutes.map((route) => ({
        path: route.path.slice(1),
        element: <RequirePermission permission={route.permission}>{route.path === '/security' ? <SecurityCheckPage /> : <MockSectionPage title={route.label} permission={route.permission} />}</RequirePermission>,
      })),
      { path: 'settings/security', element: <RequirePermission permission="security.view"><SecuritySettingsPage /></RequirePermission> },
      { path: 'settings/security/mfa/enroll', element: <RequirePermission permission="security.view"><MfaEnrollPage /></RequirePermission> },
      { path: 'states/:state', element: <UnavailablePage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]); }
