export const permissions = [
  'dashboard.view',
  'users.view', 'users.assist',
  'listings.view', 'listings.moderate',
  'verifications.manage', 'reports.view', 'reports.manage',
  'moderation.manage', 'reviews.moderate', 'chats.view', 'support.manage',
  'businesses.view',
  'orders.view', 'orders.manage',
  'content.view', 'content.edit', 'content.publish',
  'legal.view', 'legal.edit', 'legal.publish',
  'taxonomy.view', 'taxonomy.manage', 'taxonomy.publish',
  'monetization.view', 'revenue.view', 'ads.view', 'ads.manage', 'billing.view',
  'amos.view', 'amos.run', 'amos.publish', 'integrations.manage',
  'rentals.view', 'rentals.moderate', 'rentals.manage',
  'analytics.view', 'audit.view', 'audit.export', 'errors.view', 'errors.resolve', 'operations.view',
  'security.view', 'security.manage', 'admins.manage', 'mfa_policy.manage',
  'settings.view', 'settings.manage',
] as const;

export type Permission = typeof permissions[number];
export const adminRoles = ['super_admin', 'admin', 'moderator', 'support', 'finance'] as const;
export type AdminRole = typeof adminRoles[number];

const operationalAdmin: Permission[] = [
  'dashboard.view', 'users.view', 'users.assist', 'listings.view', 'listings.moderate',
  'verifications.manage', 'reports.view', 'reports.manage', 'moderation.manage',
  'reviews.moderate', 'chats.view', 'support.manage', 'businesses.view',
  'orders.view', 'orders.manage', 'content.view', 'content.edit', 'content.publish',
  'legal.view', 'legal.edit', 'legal.publish', 'taxonomy.view', 'taxonomy.manage',
  'taxonomy.publish', 'monetization.view', 'revenue.view', 'ads.view', 'ads.manage',
  'billing.view', 'amos.view', 'amos.run', 'amos.publish', 'rentals.view',
  'rentals.moderate', 'rentals.manage', 'analytics.view', 'audit.view',
  'errors.view', 'errors.resolve', 'operations.view', 'security.view',
  'settings.view', 'settings.manage',
];

export const rolePermissions: Readonly<Record<AdminRole, readonly Permission[]>> = {
  super_admin: permissions,
  admin: operationalAdmin,
  moderator: [
    'dashboard.view', 'listings.view', 'listings.moderate', 'verifications.manage',
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
