/** Security-critical constants and pure request classification for
 * admin-login-guard. Kept dependency-free so the deployed Edge handler and
 * local regression tests exercise the same policy. */

export const ADMIN_ALERT_ROLES = ['super_admin', 'admin', 'moderator', 'support', 'finance'] as const

export function isRetiredPublicLoginStateAction(action: unknown): boolean {
  return action === 'check' || action === 'record'
}

export function trustedCloudflareIp(headers: Headers): string {
  const cf = headers.get('cf-connecting-ip')
  return cf?.trim() || 'unknown'
}
