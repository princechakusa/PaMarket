import { createBrowserRouter } from 'react-router-dom';
import { AdminLayout } from '../layouts/AdminLayout';
import { OpsDashboardPage } from '../pages/OpsDashboardPage';
import { MockSectionPage } from '../pages/MockSectionPage';
import { UnavailablePage } from '../pages/UnavailablePage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { SecurityCheckPage } from '../pages/SecurityCheckPage';
import { LoginPage } from '../pages/LoginPage';
import { MfaChallengePage } from '../pages/MfaChallengePage';
import { SecuritySettingsPage } from '../pages/security/SecuritySettingsPage';
import { MfaEnrollPage } from '../pages/security/MfaEnrollPage';
import { SecurityEventsPage } from '../pages/security/SecurityEventsPage';
import { ListingsModerationPage } from '../pages/ListingsModerationPage';
import { BusinessVerificationsPage } from '../pages/BusinessVerificationsPage';
import { ReportsDisputesPage } from '../pages/ReportsDisputesPage';
import { ShopOrdersPage } from '../pages/ShopOrdersPage';
import { RequirePermission } from '../security/RequirePermission';
import { RequireSession } from '../security/RequireSession';
import { mockRoutes } from './navigation';

export function createAppRouter() { return createBrowserRouter([
  // Public, pre-session routes — never wrapped in RequireSession.
  { path: '/login', element: <LoginPage /> },
  { path: '/mfa/challenge', element: <MfaChallengePage /> },
  {
    path: '/', element: <RequireSession><AdminLayout /></RequireSession>, errorElement: <NotFoundPage />, children: [
      { index: true, element: <RequirePermission permission="dashboard.view"><OpsDashboardPage /></RequirePermission> },
      ...mockRoutes.map((route) => ({
        path: route.path.slice(1),
        element: <RequirePermission permission={route.permission}>{route.path === '/security' ? <SecurityCheckPage /> : route.path === '/marketplace/listings' ? <ListingsModerationPage /> : route.path === '/marketplace/verifications' ? <BusinessVerificationsPage /> : route.path === '/trust/reports' ? <ReportsDisputesPage /> : route.path === '/orders' ? <ShopOrdersPage /> : <MockSectionPage title={route.label} permission={route.permission} />}</RequirePermission>,
      })),
      { path: 'settings/security', element: <RequirePermission permission="security.view"><SecuritySettingsPage /></RequirePermission> },
      { path: 'settings/security/mfa/enroll', element: <RequirePermission permission="security.view"><MfaEnrollPage /></RequirePermission> },
      { path: 'security/events', element: <RequirePermission permission="audit.view"><SecurityEventsPage /></RequirePermission> },
      { path: 'states/:state', element: <UnavailablePage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]); }
