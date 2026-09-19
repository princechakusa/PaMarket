export const permissions = [
  'dashboard.view',
  'users.view', 'users.assist',
  'listings.view', 'listings.moderate',
  'verifications.manage', 'reports.view', 'reports.manage',
  'moderation.manage', 'reviews.moderate', 'chats.view', 'support.manage',
  'businesses.view', 'businesses.manage',
  'orders.view', 'orders.manage',
  'content.view', 'content.edit', 'content.publish',
  'legal.view', 'legal.edit', 'legal.publish',
  'taxonomy.view', 'taxonomy.manage', 'taxonomy.publish',
  'institutions.view', 'institutions.manage',
  'monetization.view', 'revenue.view', 'ads.view', 'ads.manage', 'billing.view',
  'amos.view', 'amos.run', 'amos.publish', 'integrations.manage',
  'rentals.view', 'rentals.moderate', 'rentals.manage',
  'analytics.view', 'audit.view', 'errors.view', 'errors.resolve', 'operations.view',
  'security.view', 'security.manage', 'admins.manage', 'mfa_policy.manage',
  'settings.view', 'settings.manage',
  'legal_holds.manage',
  // DPO/regulator-facing compliance snapshot (2026-09-19): reads across
  // nearly every table holding personal data (profiles, verifications,
  // deletion records, admin/security audit trails, ...). Deliberately left
  // out of `operationalAdmin` -- super_admin is the only role that gets it,
  // matching the most-restrictive-that-still-makes-sense precedent used
  // elsewhere in this file (e.g. legal_holds.manage, admins.manage).
  'privacy.export',
] as const;

export type Permission = typeof permissions[number];
export const adminRoles = ['super_admin', 'admin', 'moderator', 'support', 'finance'] as const;
export type AdminRole = typeof adminRoles[number];

const operationalAdmin: Permission[] = [
  'dashboard.view', 'users.view', 'users.assist', 'listings.view', 'listings.moderate',
  'verifications.manage', 'reports.view', 'reports.manage', 'moderation.manage',
  'reviews.moderate', 'chats.view', 'support.manage', 'businesses.view', 'businesses.manage',
  'orders.view', 'orders.manage', 'content.view', 'content.edit', 'content.publish',
  'legal.view', 'legal.edit', 'legal.publish', 'taxonomy.view', 'taxonomy.manage',
  'taxonomy.publish', 'institutions.view', 'institutions.manage',
  'monetization.view', 'revenue.view', 'ads.view', 'ads.manage',
  'billing.view', 'amos.view', 'amos.run', 'amos.publish', 'rentals.view',
  'rentals.moderate', 'rentals.manage', 'analytics.view', 'audit.view',
  'errors.view', 'errors.resolve', 'operations.view', 'security.view',
  'settings.view', 'settings.manage',
];

export const rolePermissions: Readonly<Record<AdminRole, readonly Permission[]>> = {
  super_admin: permissions,
  admin: operationalAdmin,
  // C2E-20: verifications.manage removed -- KYC/business verification
  // approval stays an admin-tier compliance decision server-side
  // (verifications/business_verifications RLS is deliberately still
  // is_admin()-only); listings.moderate is retained and now matches a
  // real server-side is_moderator() grant on the listings table.
  moderator: [
    'dashboard.view', 'users.view', 'listings.view', 'listings.moderate',
    'reports.view', 'reports.manage', 'moderation.manage', 'reviews.moderate',
  ],
  support: ['dashboard.view', 'users.view', 'users.assist', 'reports.view', 'reports.manage', 'chats.view', 'support.manage'],
  finance: ['dashboard.view', 'monetization.view', 'revenue.view', 'ads.view', 'billing.view'],
};

export function isAdminRole(value: string | null | undefined): value is AdminRole {
  return adminRoles.some((role) => role === value);
}

export function permissionsForRole(role: AdminRole): readonly Permission[] {
  return rolePermissions[role];
}

export function hasPermission(role: AdminRole, permission: Permission): boolean {
  return rolePermissions[role].includes(permission);
}
