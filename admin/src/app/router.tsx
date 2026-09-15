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
import { JobsRecruitersPage } from '../pages/JobsRecruitersPage';
import { UserDirectoryPage } from '../pages/UserDirectoryPage';
import { GeneralSettingsPage } from '../pages/GeneralSettingsPage';
import { ErrorsHealthPage } from '../pages/ErrorsHealthPage';
import { VehicleRentalsPage } from '../pages/VehicleRentalsPage';
import { RolesPermissionsPage } from '../pages/RolesPermissionsPage';
import { AdsBoostsPage } from '../pages/AdsBoostsPage';
import { PlayBillingPage } from '../pages/PlayBillingPage';
import { FinancePage } from '../pages/FinancePage';
import { ReviewsPage } from '../pages/ReviewsPage';
import { BusinessesPage } from '../pages/BusinessesPage';
import { SupportCenterPage } from '../pages/SupportCenterPage';
import { MaintenancePage } from '../pages/MaintenancePage';
import { NotificationsPage } from '../pages/NotificationsPage';
import { AnalyticsPage } from '../pages/AnalyticsPage';
import { AuditCenterPage } from '../pages/AuditCenterPage';
import { SecurityCenterPage } from '../pages/SecurityCenterPage';
import { ContentPage } from '../pages/ContentPage';
import { TaxonomyPage } from '../pages/TaxonomyPage';
import { AmosDashboardPage } from '../pages/AmosDashboardPage';
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
        element: <RequirePermission permission={route.permission}>{route.path === '/security' ? <SecurityCheckPage /> : route.path === '/marketplace/listings' ? <ListingsModerationPage /> : route.path === '/marketplace/services' ? <ListingsModerationPage fixedCategory="services" /> : route.path === '/marketplace/property' ? <ListingsModerationPage fixedCategory="property" /> : route.path === '/marketplace/vehicles' ? <ListingsModerationPage fixedCategory="vehicles" /> : route.path === '/marketplace/verifications' ? <BusinessVerificationsPage /> : (route.path === '/trust/reports' || route.path === '/trust/moderation' || route.path === '/trust/inbox') ? <ReportsDisputesPage /> : route.path === '/orders' ? <ShopOrdersPage /> : route.path === '/marketplace/jobs' ? <JobsRecruitersPage /> : route.path === '/marketplace/users' ? <UserDirectoryPage /> : route.path === '/settings/general' ? <GeneralSettingsPage /> : route.path === '/observability/errors' ? <ErrorsHealthPage /> : route.path.startsWith('/rentals') ? <VehicleRentalsPage /> : route.path === '/security/permissions' ? <RolesPermissionsPage /> : route.path === '/monetization/ads' ? <AdsBoostsPage /> : route.path === '/monetization/play-billing' ? <PlayBillingPage /> : route.path === '/monetization/finance' ? <FinancePage /> : route.path === '/trust/reviews' ? <ReviewsPage /> : route.path === '/businesses' ? <BusinessesPage /> : (route.path === '/trust/support' || route.path === '/trust/contacts') ? <SupportCenterPage /> : route.path === '/settings/maintenance' ? <MaintenancePage /> : route.path === '/settings/notifications' ? <NotificationsPage /> : route.path === '/observability/analytics' ? <AnalyticsPage /> : route.path === '/observability/audit' ? <AuditCenterPage /> : route.path === '/security/center' ? <SecurityCenterPage /> : route.path.startsWith('/content/') ? <ContentPage /> : route.path === '/taxonomy' ? <TaxonomyPage /> : route.path.startsWith('/amos') ? <AmosDashboardPage /> : <MockSectionPage title={route.label} permission={route.permission} />}</RequirePermission>,
      })),
      { path: 'settings/security', element: <RequirePermission permission="security.view"><SecuritySettingsPage /></RequirePermission> },
      { path: 'settings/security/mfa/enroll', element: <RequirePermission permission="security.view"><MfaEnrollPage /></RequirePermission> },
      { path: 'security/events', element: <RequirePermission permission="audit.view"><SecurityEventsPage /></RequirePermission> },
      { path: 'states/:state', element: <UnavailablePage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]); }
