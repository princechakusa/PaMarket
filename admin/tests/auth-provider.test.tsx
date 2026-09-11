import { render, screen } from '@testing-library/react';
import type { Session } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';

const getSupabaseClient = vi.hoisted(() => vi.fn());

vi.mock('../src/services/supabase/env', () => ({
  adminEnvironment: {
    mode: 'live',
    supabaseUrl: 'https://example.supabase.co',
    publishableKey: 'sb_publishable_FAKE_TEST_VALUE',
  },
}));
vi.mock('../src/services/supabase/client', () => ({ getSupabaseClient }));

import { AuthProvider } from '../src/security/AuthProvider';
import { useAuth } from '../src/security/auth-context';

function StatusProbe() {
  const auth = useAuth();
  return <p>{auth.status}</p>;
}

describe('AuthProvider role enforcement', () => {
  it('denies a signed-in profile whose role is not an admin role', async () => {
    const session = { user: { id: 'non-admin-test' }, access_token: '' } as unknown as Session;
    getSupabaseClient.mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: { id: 'non-admin-test', name: 'Test user', role: 'customer' },
              error: null,
            }),
          }),
        }),
      }),
      auth: {
        getSession: async () => ({ data: { session } }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
        mfa: {
          getAuthenticatorAssuranceLevel: async () => ({
            data: { currentLevel: 'aal1', nextLevel: 'aal1' },
          }),
        },
      },
    });

    render(<AuthProvider><StatusProbe /></AuthProvider>);
    expect(await screen.findByText('forbidden')).toBeInTheDocument();
  });
});
