import type { Permission } from '../security/permissions';

export type NavigationItem = { label: string; path: string; permission: Permission };
export type NavigationGroup = { label: string; items: NavigationItem[] };

export type OpsNavigationItem = NavigationItem & { icon: string; badge?: string; badgeTone?: 'warning' | 'danger' | 'neutral' };
export type OpsNavigationGroup = { label: string; items: OpsNavigationItem[] };

export const opsNavigationGroups: OpsNavigationGroup[] = [
  { label: 'Overview', items: [{ label: 'Operations Dashboard', path: '/', permission: 'dashboard.view', icon: 'monitoring' }] },
  { label: 'Trust & Moderation', items: [
    { label: 'Listings Queue', path: '/marketplace/listings', permission: 'listings.view', icon: 'fact_check' },
    { label: 'Verifications', path: '/marketplace/verifications', permission: 'verifications.manage', icon: 'verified' },
    { label: 'Reports & Disputes', path: '/trust/reports', permission: 'reports.view', icon: 'gavel' },
  ] },
  { label: 'Directory & Commerce', items: [
    { label: 'User Directory', path: '/marketplace/users', permission: 'users.view', icon: 'group' },
    { label: 'Shop Orders', path: '/orders', permission: 'orders.view', icon: 'receipt_long' },
    { label: 'Jobs & Recruiters', path: '/marketplace/jobs', permission: 'listings.view', icon: 'work' },
    { label: 'Vehicle Rentals', path: '/rentals', permission: 'rentals.view', icon: 'directions_car' },
    { label: 'Reviews', path: '/trust/reviews', permission: 'reviews.moderate', icon: 'reviews' },
    { label: 'Ads & Boosts', path: '/monetization/ads', permission: 'ads.view', icon: 'campaign' },
    { label: 'Finance Center', path: '/monetization/finance', permission: 'revenue.view', icon: 'payments' },
    { label: 'Play Billing', path: '/monetization/play-billing', permission: 'billing.view', icon: 'receipt' },
  ] },
  { label: 'Business Platform', items: [
    { label: 'Businesses', path: '/businesses', permission: 'businesses.view', icon: 'storefront' },
    { label: 'Support Center', path: '/trust/support', permission: 'support.manage', icon: 'support_agent' },
    { label: 'Contact Requests', path: '/trust/contacts', permission: 'support.manage', icon: 'contact_mail' },
  ] },
  { label: 'Security & Platform', items: [
    { label: 'Security Center', path: '/security/center', permission: 'security.view', icon: 'security' },
    { label: 'Security & Honeypot', path: '/security/events', permission: 'audit.view', icon: 'shield_with_heart' },
    { label: 'Roles & Permissions', path: '/security/permissions', permission: 'security.view', icon: 'admin_panel_settings' },
    { label: 'Errors & Health', path: '/observability/errors', permission: 'errors.view', icon: 'vital_signs' },
    { label: 'Security Settings', path: '/settings/security', permission: 'security.view', icon: 'passkey' },
    { label: 'General Settings', path: '/settings/general', permission: 'settings.view', icon: 'tune' },
    { label: 'Maintenance', path: '/settings/maintenance', permission: 'settings.manage', icon: 'construction' },
    { label: 'Notifications', path: '/settings/notifications', permission: 'settings.view', icon: 'notifications' },
  ] },
  { label: 'Shared & Advanced', items: [
    { label: 'Analytics', path: '/observability/analytics', permission: 'analytics.view', icon: 'query_stats' },
    { label: 'Audit Center', path: '/observability/audit', permission: 'audit.view', icon: 'history' },
    // Reality-audit finding: this used to be one generic "Content" entry
    // pointing at /content/legal -- an administrator scanning the sidebar
    // for "Legal & Policies" would never recognize it. ContentPage.tsx
    // already has four real, working tabs (matching the full
    // navigationGroups "Content" group below); each now gets its own
    // clearly-labeled sidebar entry instead of being buried behind one.
    { label: 'Legal & Policies', path: '/content/legal', permission: 'legal.view', icon: 'gavel' },
    { label: 'Help & FAQ', path: '/content/faq', permission: 'content.view', icon: 'quiz' },
    { label: 'Blog Videos', path: '/content/videos', permission: 'content.view', icon: 'smart_display' },
    { label: 'Contact & Social', path: '/content/contact', permission: 'content.view', icon: 'contact_mail' },
    { label: 'Institutions', path: '/institutions', permission: 'institutions.view', icon: 'school' },
    { label: 'Taxonomy', path: '/taxonomy', permission: 'taxonomy.view', icon: 'category' },
    { label: 'AMOS', path: '/amos', permission: 'amos.view', icon: 'smart_toy' },
  ] },
];

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
  { label: 'Institutions', items: [{ label: 'Institutions', path: '/institutions', permission: 'institutions.view' }] },
  { label: 'Monetization', items: [
    { label: 'Ads & boosts', path: '/monetization/ads', permission: 'ads.view' },
    { label: 'Finance center', path: '/monetization/finance', permission: 'revenue.view' },
    { label: 'Play Billing', path: '/monetization/play-billing', permission: 'billing.view' },
  ] },
  { label: 'Marketing / AMOS', items: [
    { label: 'Dashboard', path: '/amos', permission: 'amos.view' }, { label: 'Approval queue', path: '/amos/approval', permission: 'amos.view' },
    { label: 'Intelligence', path: '/amos/intelligence', permission: 'amos.view' }, { label: 'SEO manager', path: '/amos/seo', permission: 'amos.view' },
    { label: 'Integrations', path: '/amos/integrations', permission: 'amos.view' },
  ] },
  // Reality audit: removed Content calendar/Campaigns/AI learning/System
  // health/AI configuration -- these had no distinct implemented view and
  // silently fell through to the AMOS Overview tab under a misleading
  // label. Audit trail/Analytics & growth were removed as true duplicates
  // of the real Audit Center and Analytics pages under Shared & Advanced.
  { label: 'Rentals', items: [
    { label: 'Rental dashboard', path: '/rentals', permission: 'rentals.view' }, { label: 'Approvals', path: '/rentals/approvals', permission: 'rentals.moderate' },
    { label: 'Companies', path: '/rentals/companies', permission: 'rentals.view' }, { label: 'Listings', path: '/rentals/listings', permission: 'rentals.view' },
    { label: 'Reports', path: '/rentals/reports', permission: 'rentals.moderate' }, { label: 'Reviews', path: '/rentals/reviews', permission: 'rentals.moderate' },
    { label: 'Featured', path: '/rentals/featured', permission: 'rentals.manage' }, { label: 'Analytics', path: '/rentals/analytics', permission: 'analytics.view' },
    { label: 'Audit logs', path: '/rentals/audit', permission: 'audit.view' }, { label: 'Lookups', path: '/rentals/lookups', permission: 'rentals.manage' },
  ] },
  { label: 'Observability', items: [
    { label: 'Analytics', path: '/observability/analytics', permission: 'analytics.view' }, { label: 'Audit center', path: '/observability/audit', permission: 'audit.view' },
    { label: 'Errors', path: '/observability/errors', permission: 'errors.view' },
    { label: 'Security events', path: '/security/events', permission: 'audit.view' },
  ] },
  // Reality audit: removed the "Operations" item (/observability/operations)
  // -- it duplicated the real Operations Dashboard at "/" with no distinct
  // backing view, and always fell through to MockSectionPage.
  { label: 'Security', items: [
    { label: 'Connection check', path: '/security', permission: 'security.view' },
    { label: 'Security center', path: '/security/center', permission: 'security.view' },
    { label: 'Permission preview', path: '/security/permissions', permission: 'security.view' },
    { label: 'Security settings', path: '/settings/security', permission: 'security.view' },
  ] },
  { label: 'Settings', items: [
    { label: 'Notifications', path: '/settings/notifications', permission: 'settings.view' },
    { label: 'Maintenance', path: '/settings/maintenance', permission: 'settings.manage' }, { label: 'Settings', path: '/settings/general', permission: 'settings.view' },
  ] },
  // Reality audit: removed "Automation" (/settings/automation) -- it
  // duplicated the real AMOS dashboard/schedule with no distinct backing
  // view of its own, and always fell through to MockSectionPage.
];

export const mockRoutes = navigationGroups
  .flatMap((group) => group.items)
  .filter((item) => item.path !== '/' && item.path !== '/settings/security' && item.path !== '/security/events');
