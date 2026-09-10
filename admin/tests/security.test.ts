import { describe, expect, it } from 'vitest';
import { navigationGroups } from '../src/app/navigation';
import { permissions, rolePermissions } from '../src/security/permissions';
import { readAdminEnvironment } from '../src/services/supabase/env';
import { normalizeError } from '../src/services/errors/normalize-error';

describe('Stage C authorization foundation', () => {
  it('reserves owner-level controls for super_admin', () => {
    const ownerOnly = ['admins.manage', 'mfa_policy.manage', 'security.manage', 'integrations.manage', 'audit.export'] as const;
    for (const permission of ownerOnly) {
      expect(rolePermissions.super_admin).toContain(permission);
      expect(rolePermissions.admin).not.toContain(permission);
      expect(rolePermissions.moderator).not.toContain(permission);
      expect(rolePermissions.support).not.toContain(permission);
      expect(rolePermissions.finance).not.toContain(permission);
    }
  });

  it('keeps specialist roles inside their documented scopes', () => {
    expect(rolePermissions.moderator).toEqual(expect.arrayContaining(['listings.moderate', 'reports.manage', 'reviews.moderate']));
    expect(rolePermissions.moderator).not.toContain('users.assist');
    expect(rolePermissions.support).toEqual(expect.arrayContaining(['users.assist', 'support.manage', 'chats.view']));
    expect(rolePermissions.support).not.toContain('content.publish');
    expect(rolePermissions.finance).toEqual(['dashboard.view', 'monetization.view', 'revenue.view', 'ads.view', 'billing.view']);
  });

  it('maps every route to a declared permission', () => {
    const declared = new Set<string>(permissions);
    for (const item of navigationGroups.flatMap((group) => group.items)) {
      expect(declared.has(item.permission), `${item.path} has an unknown permission`).toBe(true);
    }
  });

  it('defaults to mock mode and fails clearly for incomplete live config', () => {
    expect(readAdminEnvironment({})).toEqual({ mode: 'mock' });
    expect(readAdminEnvironment({ VITE_ADMIN_MODE: 'live' }).configurationError).toMatch(/requires/i);
    expect(readAdminEnvironment({ VITE_ADMIN_MODE: 'live', VITE_SUPABASE_URL: 'http://example.com', VITE_SUPABASE_PUBLISHABLE_KEY: 'public' }).configurationError).toMatch(/HTTPS/i);
    expect(readAdminEnvironment({ VITE_ADMIN_MODE: 'live', VITE_SUPABASE_URL: 'https://example.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: 'public' })).toEqual({ mode: 'live', supabaseUrl: 'https://example.supabase.co', publishableKey: 'public' });
  });

  it('normalizes cancellation without exposing arbitrary payloads', () => {
    expect(normalizeError(new DOMException('cancelled', 'AbortError'))).toEqual({ code: 'request_cancelled', message: 'The request was cancelled.', retryable: true });
    expect(normalizeError({ private: 'do not print' })).toEqual({ code: 'unknown_error', message: 'An unexpected error occurred.', retryable: false });
  });
});
