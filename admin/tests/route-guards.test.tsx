import { render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AuthContext, type AuthContextValue } from '../src/security/auth-context';
import { permissionsForRole } from '../src/security/permissions';
import { RequirePermission } from '../src/security/RequirePermission';
import { RequireSession } from '../src/security/RequireSession';

function authValue(overrides: Partial<AuthContextValue>): AuthContextValue {
  return {
    mode: 'live',
    status: 'anonymous',
    identity: null,
    accessToken: null,
    assuranceLevel: null,
    nextAssuranceLevel: null,
    error: null,
    signOut: vi.fn(async () => {}),
    signInWithPassword: vi.fn(async () => ({ error: null })),
    refreshAssurance: vi.fn(async () => {}),
    ...overrides,
  };
}

function renderRoutes(initialEntry: string, auth: AuthContextValue) {
  const router = createMemoryRouter([
    { path: '/login', element: <p>login-route</p> },
    {
      path: '/',
      element: <RequireSession><p>dashboard-route</p></RequireSession>,
    },
    {
      path: '/settings/security',
      element: (
        <RequireSession>
          <RequirePermission permission="security.view"><p>security-settings-route</p></RequirePermission>
        </RequireSession>
      ),
    },
  ], { initialEntries: [initialEntry] });

  render(<AuthContext.Provider value={auth}><RouterProvider router={router} /></AuthContext.Provider>);
  return router;
}

describe('live admin route guards', () => {
  it('redirects an anonymous user from / to /login with a local returnTo', async () => {
    const router = renderRoutes('/', authValue({ status: 'anonymous' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(router.state.location.search).toBe('?returnTo=%2F');
    expect(screen.getByText('login-route')).toBeInTheDocument();
  });

  it('allows an authenticated super_admin to open /settings/security', () => {
    renderRoutes('/settings/security', authValue({
      status: 'authenticated',
      identity: {
        id: 'super-admin-test',
        name: 'Test administrator',
        role: 'super_admin',
        permissions: permissionsForRole('super_admin'),
      },
    }));
    expect(screen.getByText('security-settings-route')).toBeInTheDocument();
  });

  it('denies an authenticated identity without the required admin permission', () => {
    renderRoutes('/settings/security', authValue({
      status: 'authenticated',
      identity: {
        id: 'unprivileged-test',
        name: 'Unprivileged test identity',
        role: 'support',
        permissions: [],
      },
    }));
    expect(screen.getByRole('heading', { name: /permission required/i })).toBeInTheDocument();
    expect(screen.queryByText('security-settings-route')).not.toBeInTheDocument();
  });
});
