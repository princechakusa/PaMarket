import type { Permission } from '../security/permissions';

export type NavigationItem = { label: string; path: string; permission: Permission };
export type NavigationGroup = { label: string; items: NavigationItem[] };

export const navigationGroups: NavigationGroup[] = [
  { label: 'Overview', items: [{ label: 'Dashboard', path: '/', permission: 'dashboard.view' }] },
  { label: 'Marketplace', items: [
    { label: 'Users', path: '/marketplace/users', permission: 'users.view' },
    { label: 'Listings', path: '/marketplace/listings', permission: 'listings.view' },
    { label: 'Verifications', path: '/marketplace/verifications', permission: 'verifications.manage' },
    { label: 'Jobs', path: '/marketplace/jobs', permission: 'listings.view' }, { label: 'Services', path: '/marketplace/services', permission: 'listings.view' },
    { label: 'Property', path: '/marketplace/property', permission: 'listings.view' }, { label: 'Vehicle sales', path: '/marketplace/vehicles', permission: 'listings.view' },
  ] },
  { label: 'Trust & Support', items: [
    { label: 'Reports', path: '/trust/reports', permission: 'reports.view' },
    { label: 'Moderation', path: '/trust/moderation', permission: 'moderation.manage' },
    { label: 'Moderation inbox', path: '/trust/inbox', permission: 'moderation.manage' }, { label: 'Reviews', path: '/trust/reviews', permission: 'reviews.moderate' },
    { label: 'Contact requests', path: '/trust/contacts', permission: 'support.manage' }, { label: 'User chats', path: '/trust/chats', permission: 'chats.view' },
    { label: 'Support center', path: '/trust/support', permission: 'support.manage' },
  ] },
  { label: 'Businesses', items: [{ label: 'Business platform', path: '/businesses', permission: 'businesses.view' }] },
  { label: 'Shop Orders', items: [{ label: 'Orders scope', path: '/orders', permission: 'orders.view' }] },
  { label: 'Content', items: [
    { label: 'Legal & policies', path: '/content/legal', permission: 'legal.view' }, { label: 'Help & FAQ', path: '/content/faq', permission: 'content.view' },
    { label: 'Blog videos', path: '/content/videos', permission: 'content.view' }, { label: 'Contact & social', path: '/content/contact', permission: 'content.view' },
  ] },
  { label: 'Taxonomy', items: [{ label: 'Marketplace taxonomy', path: '/taxonomy', permission: 'taxonomy.view' }] },
  { label: 'Monetization', items: [
    { label: 'Ads & boosts', path: '/monetization/ads', permission: 'ads.view' },
    { label: 'Finance center', path: '/monetization/finance', permission: 'revenue.view' },
    { label: 'Play Billing', path: '/monetization/play-billing', permission: 'billing.view' },
  ] },
  { label: 'Marketing / AMOS', items: [
    { label: 'Dashboard', path: '/amos', permission: 'amos.view' }, { label: 'Approval queue', path: '/amos/approval', permission: 'amos.view' },
    { label: 'Content calendar', path: '/amos/calendar', permission: 'amos.view' }, { label: 'Campaigns', path: '/amos/campaigns', permission: 'amos.view' },
    { label: 'Intelligence', path: '/amos/intelligence', permission: 'amos.view' }, { label: 'AI learning', path: '/amos/learning', permission: 'amos.view' },
    { label: 'System health', path: '/amos/health', permission: 'amos.view' }, { label: 'Audit trail', path: '/amos/audit', permission: 'audit.view' },
    { label: 'AI configuration', path: '/amos/settings', permission: 'amos.view' }, { label: 'Analytics & growth', path: '/amos/analytics', permission: 'analytics.view' },
    { label: 'SEO manager', path: '/amos/seo', permission: 'amos.view' },
  ] },
  { label: 'Rentals', items: [
    { label: 'Rental dashboard', path: '/rentals', permission: 'rentals.view' }, { label: 'Approvals', path: '/rentals/approvals', permission: 'rentals.moderate' },
    { label: 'Companies', path: '/rentals/companies', permission: 'rentals.view' }, { label: 'Listings', path: '/rentals/listings', permission: 'rentals.view' },
    { label: 'Reports', path: '/rentals/reports', permission: 'rentals.moderate' }, { label: 'Reviews', path: '/rentals/reviews', permission: 'rentals.moderate' },
    { label: 'Featured', path: '/rentals/featured', permission: 'rentals.manage' }, { label: 'Analytics', path: '/rentals/analytics', permission: 'analytics.view' },
    { label: 'Audit logs', path: '/rentals/audit', permission: 'audit.view' }, { label: 'Lookups', path: '/rentals/lookups', permission: 'rentals.manage' },
  ] },
  { label: 'Observability', items: [
    { label: 'Analytics', path: '/observability/analytics', permission: 'analytics.view' }, { label: 'Audit center', path: '/observability/audit', permission: 'audit.view' },
    { label: 'Errors', path: '/observability/errors', permission: 'errors.view' }, { label: 'Operations', path: '/observability/operations', permission: 'operations.view' },
    { label: 'Security events', path: '/security/events', permission: 'audit.view' },
  ] },
  { label: 'Security', items: [
    { label: 'Connection check', path: '/security', permission: 'security.view' },
    { label: 'Permission preview', path: '/security/permissions', permission: 'security.view' },
    { label: 'Security settings', path: '/settings/security', permission: 'security.view' },
  ] },
  { label: 'Settings', items: [
    { label: 'Notifications', path: '/settings/notifications', permission: 'settings.view' }, { label: 'Automation', path: '/settings/automation', permission: 'settings.view' },
    { label: 'Maintenance', path: '/settings/maintenance', permission: 'settings.manage' }, { label: 'Settings', path: '/settings/general', permission: 'settings.view' },
  ] },
];

export const mockRoutes = navigationGroups
  .flatMap((group) => group.items)
  .filter((item) => item.path !== '/' && item.path !== '/settings/security' && item.path !== '/security/events');
