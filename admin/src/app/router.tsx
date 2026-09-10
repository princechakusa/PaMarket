import { createBrowserRouter } from 'react-router-dom';
import { AdminLayout } from '../layouts/AdminLayout';
import { MockDashboardPage } from '../pages/MockDashboardPage';
import { MockSectionPage } from '../pages/MockSectionPage';
import { UnavailablePage } from '../pages/UnavailablePage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { SecurityCheckPage } from '../pages/SecurityCheckPage';
import { RequirePermission } from '../security/RequirePermission';
import { RequireSession } from '../security/RequireSession';
import { mockRoutes } from './navigation';

export function createAppRouter() { return createBrowserRouter([{
  path: '/', element: <RequireSession><AdminLayout /></RequireSession>, errorElement: <NotFoundPage />, children: [
    { index: true, element: <RequirePermission permission="dashboard.view"><MockDashboardPage /></RequirePermission> },
    ...mockRoutes.map((route) => ({
      path: route.path.slice(1),
      element: <RequirePermission permission={route.permission}>{route.path === '/security' ? <SecurityCheckPage /> : <MockSectionPage title={route.label} permission={route.permission} />}</RequirePermission>,
    })),
    { path: 'states/:state', element: <UnavailablePage /> },
    { path: '*', element: <NotFoundPage /> },
  ],
}]); }
