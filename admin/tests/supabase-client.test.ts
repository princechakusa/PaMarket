import { beforeEach, describe, expect, it, vi } from 'vitest';

const createClient = vi.hoisted(() => vi.fn(() => ({ auth: {} })));

vi.mock('@supabase/supabase-js', () => ({ createClient }));
vi.mock('../src/services/supabase/env', () => ({
  adminEnvironment: {
    mode: 'live',
    supabaseUrl: 'https://example.supabase.co',
    publishableKey: 'sb_publishable_FAKE_TEST_VALUE',
  },
}));

import { ADMIN_AUTH_STORAGE_KEY, getSupabaseClient } from '../src/services/supabase/client';

describe('live Supabase client initialization', () => {
  beforeEach(() => createClient.mockClear());

  it('initializes once with persistent auth and the dedicated admin storage key', () => {
    const first = getSupabaseClient();
    const second = getSupabaseClient();

    expect(first).toBeTruthy();
    expect(second).toBe(first);
    expect(createClient).toHaveBeenCalledTimes(1);
    expect(createClient).toHaveBeenCalledWith(
      'https://example.supabase.co',
      'sb_publishable_FAKE_TEST_VALUE',
      {
        auth: {
          storageKey: ADMIN_AUTH_STORAGE_KEY,
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      },
    );
  });
});
