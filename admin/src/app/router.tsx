import { createBrowserRouter } from 'react-router-dom';
import { AdminLayout } from '../layouts/AdminLayout';
import { MockDashboardPage } from '../pages/MockDashboardPage';
import { MockSectionPage } from '../pages/MockSectionPage';
import { UnavailablePage } from '../pages/UnavailablePage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { mockRoutes } from './navigation';

export function createAppRouter() { return createBrowserRouter([{
  path: '/', element: <AdminLayout />, errorElement: <NotFoundPage />, children: [
    { index: true, element: <MockDashboardPage /> },
    ...mockRoutes.map((route) => ({ path: route.path.slice(1), element: <MockSectionPage title={route.label} permission={route.permission} /> })),
    { path: 'states/:state', element: <UnavailablePage /> },
    { path: '*', element: <NotFoundPage /> },
  ],
}]); }
