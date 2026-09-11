import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../src/services/supabase/env', () => ({
  adminEnvironment: { mode: 'live', supabaseUrl: 'https://example.supabase.co', publishableKey: 'sb_publishable_FAKE_TEST_VALUE' },
}));

import { reportLoginSecurityEvent } from '../src/services/security-events/report';

describe('reportLoginSecurityEvent', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('sends only the allowed fields — never a password, honeypot value, or full request body beyond them', async () => {
    await reportLoginSecurityEvent('admin_login_failed', { reasonCode: 'invalid_credentials' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/functions/v1/record-security-event');
    const body = JSON.parse((init as RequestInit).body as string);
    // undefined optional fields are dropped by JSON.stringify — only what
    // was actually passed is ever sent.
    expect(Object.keys(body).sort()).toEqual(['eventType', 'reasonCode']);
    expect(body.eventType).toBe('admin_login_failed');
    expect(body.reasonCode).toBe('invalid_credentials');
  });

  it('never throws when the network call fails, and does not retry', async () => {
    fetchMock.mockRejectedValue(new Error('network down'));
    await expect(reportLoginSecurityEvent('admin_login_honeypot')).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does nothing in mock mode (no network call at all)', async () => {
    vi.doMock('../src/services/supabase/env', () => ({ adminEnvironment: { mode: 'mock' } }));
    vi.resetModules();
    const { reportLoginSecurityEvent: reportMock } = await import('../src/services/security-events/report');
    await reportMock('admin_login_failed');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('uses the publishable key as a fallback bearer token when no access token is supplied', async () => {
    await reportLoginSecurityEvent('admin_login_honeypot');
    const [, init] = fetchMock.mock.calls[0];
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer sb_publishable_FAKE_TEST_VALUE');
  });
});
