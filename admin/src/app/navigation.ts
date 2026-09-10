export type NavigationItem = { label: string; path: string; permission?: string };
export type NavigationGroup = { label: string; items: NavigationItem[] };

export const navigationGroups: NavigationGroup[] = [
  { label: 'Overview', items: [{ label: 'Dashboard', path: '/' }] },
  { label: 'Marketplace', items: [
    { label: 'Users', path: '/marketplace/users', permission: 'users.view' },
    { label: 'Listings', path: '/marketplace/listings', permission: 'listings.moderate' },
    { label: 'Verifications', path: '/marketplace/verifications', permission: 'verifications.manage' },
    { label: 'Jobs', path: '/marketplace/jobs' }, { label: 'Services', path: '/marketplace/services' },
    { label: 'Property', path: '/marketplace/property' }, { label: 'Vehicle sales', path: '/marketplace/vehicles' },
  ] },
  { label: 'Trust & Support', items: [
    { label: 'Reports', path: '/trust/reports', permission: 'reports.manage' },
    { label: 'Moderation', path: '/trust/moderation', permission: 'reviews.moderate' },
    { label: 'Moderation inbox', path: '/trust/inbox' }, { label: 'Reviews', path: '/trust/reviews' },
    { label: 'Contact requests', path: '/trust/contacts' }, { label: 'User chats', path: '/trust/chats', permission: 'chats.view' },
    { label: 'Support center', path: '/trust/support' },
  ] },
  { label: 'Businesses', items: [{ label: 'Business platform', path: '/businesses', permission: 'businesses.view' }] },
  { label: 'Shop Orders', items: [{ label: 'Orders scope', path: '/orders' }] },
  { label: 'Content', items: [
    { label: 'Legal & policies', path: '/content/legal' }, { label: 'Help & FAQ', path: '/content/faq' },
    { label: 'Blog videos', path: '/content/videos' }, { label: 'Contact & social', path: '/content/contact' },
  ] },
  { label: 'Taxonomy', items: [{ label: 'Marketplace taxonomy', path: '/taxonomy' }] },
  { label: 'Monetization', items: [
    { label: 'Ads & boosts', path: '/monetization/ads', permission: 'ads.manage' },
    { label: 'Finance center', path: '/monetization/finance', permission: 'finance.view' },
    { label: 'Play Billing', path: '/monetization/play-billing', permission: 'billing.view' },
  ] },
  { label: 'Marketing / AMOS', items: [
    { label: 'Dashboard', path: '/amos' }, { label: 'Approval queue', path: '/amos/approval' },
    { label: 'Content calendar', path: '/amos/calendar' }, { label: 'Campaigns', path: '/amos/campaigns' },
    { label: 'Intelligence', path: '/amos/intelligence' }, { label: 'AI learning', path: '/amos/learning' },
    { label: 'System health', path: '/amos/health' }, { label: 'Audit trail', path: '/amos/audit' },
    { label: 'AI configuration', path: '/amos/settings' }, { label: 'Analytics & growth', path: '/amos/analytics' },
    { label: 'SEO manager', path: '/amos/seo' },
  ] },
  { label: 'Rentals', items: [
    { label: 'Rental dashboard', path: '/rentals' }, { label: 'Approvals', path: '/rentals/approvals' },
    { label: 'Companies', path: '/rentals/companies' }, { label: 'Listings', path: '/rentals/listings' },
    { label: 'Reports', path: '/rentals/reports' }, { label: 'Reviews', path: '/rentals/reviews' },
    { label: 'Featured', path: '/rentals/featured' }, { label: 'Analytics', path: '/rentals/analytics' },
    { label: 'Audit logs', path: '/rentals/audit' }, { label: 'Lookups', path: '/rentals/lookups' },
  ] },
  { label: 'Observability', items: [
    { label: 'Analytics', path: '/observability/analytics' }, { label: 'Audit center', path: '/observability/audit' },
    { label: 'Errors', path: '/observability/errors' }, { label: 'Operations', path: '/observability/operations' },
  ] },
  { label: 'Security', items: [{ label: 'Security center', path: '/security' }, { label: 'Permission preview', path: '/security/permissions' }] },
  { label: 'Settings', items: [
    { label: 'Notifications', path: '/settings/notifications' }, { label: 'Automation', path: '/settings/automation' },
    { label: 'Maintenance', path: '/settings/maintenance' }, { label: 'Settings', path: '/settings/general' },
  ] },
];

export const mockRoutes = navigationGroups.flatMap((group) => group.items).filter((item) => item.path !== '/');
