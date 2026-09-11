import { describe, expect, it, vi, beforeEach } from 'vitest';

const FAKE_SECRET = 'FAKETESTSECRETNOTREAL234567';
const FAKE_QR = '<svg data-fake="not-a-real-qr"></svg>';
const FAKE_URI = 'otpauth://totp/fake?secret=' + FAKE_SECRET;

const mfaMock = {
  enroll: vi.fn(),
  challengeAndVerify: vi.fn(),
  unenroll: vi.fn(),
  listFactors: vi.fn(),
  getAuthenticatorAssuranceLevel: vi.fn(),
};
const authMock = { mfa: mfaMock, refreshSession: vi.fn() };
const fakeClient = { auth: authMock } as unknown;

vi.mock('../src/services/supabase/client', () => ({ getSupabaseClient: vi.fn(() => fakeClient) }));

import { getSupabaseClient } from '../src/services/supabase/client';
import {
  enrollTotpFactor,
  challengeAndVerifyTotp,
  unenrollFactor,
  listMfaFactors,
  getAssuranceLevel,
  refreshSessionAfterMfa,
} from '../src/services/supabase/mfa';

describe('mfa service wrappers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getSupabaseClient as ReturnType<typeof vi.fn>).mockReturnValue(fakeClient);
  });

  it('enrollTotpFactor calls enroll({factorType:"totp"}) and returns the totp payload untouched', async () => {
    mfaMock.enroll.mockResolvedValue({ data: { id: 'factor-1', friendly_name: 'Test', totp: { qr_code: FAKE_QR, secret: FAKE_SECRET, uri: FAKE_URI } }, error: null });
    const result = await enrollTotpFactor('Test');
    expect(mfaMock.enroll).toHaveBeenCalledWith({ factorType: 'totp', friendlyName: 'Test', issuer: 'PaMarket Admin' });
    expect(result.error).toBeNull();
    expect(result.data?.id).toBe('factor-1');
    expect(result.data?.totp.secret).toBe(FAKE_SECRET);
    expect(result.data?.totp.qrCode).toBe(FAKE_QR);
  });

  it('enrollTotpFactor normalizes an error without leaking internals', async () => {
    mfaMock.enroll.mockResolvedValue({ data: null, error: { message: 'enroll failed' } });
    const result = await enrollTotpFactor('Test');
    expect(result.data).toBeNull();
    expect(result.error?.code).toBe('request_failed');
  });

  it('challengeAndVerifyTotp forwards factorId and code exactly, nothing else', async () => {
    mfaMock.challengeAndVerify.mockResolvedValue({ data: { factor_id: 'factor-1' }, error: null });
    const result = await challengeAndVerifyTotp('factor-1', '123456');
    expect(mfaMock.challengeAndVerify).toHaveBeenCalledWith({ factorId: 'factor-1', code: '123456' });
    expect(result.error).toBeNull();
  });

  it('challengeAndVerifyTotp surfaces an invalid-code error safely', async () => {
    mfaMock.challengeAndVerify.mockResolvedValue({ data: null, error: { message: 'Invalid TOTP code entered' } });
    const result = await challengeAndVerifyTotp('factor-1', '000000');
    expect(result.data).toBeNull();
    expect(result.error?.message).toMatch(/invalid/i);
  });

  it('unenrollFactor calls unenroll({factorId})', async () => {
    mfaMock.unenroll.mockResolvedValue({ data: { id: 'factor-1' }, error: null });
    const result = await unenrollFactor('factor-1');
    expect(mfaMock.unenroll).toHaveBeenCalledWith({ factorId: 'factor-1' });
    expect(result.data?.factorId).toBe('factor-1');
  });

  it('listMfaFactors returns the "all" array from listFactors()', async () => {
    const factors = [{ id: 'f1', factor_type: 'totp', status: 'verified', friendly_name: 'a', created_at: '', updated_at: '' }];
    mfaMock.listFactors.mockResolvedValue({ data: { all: factors, totp: factors }, error: null });
    const result = await listMfaFactors();
    expect(result.data?.all).toEqual(factors);
  });

  it('getAssuranceLevel returns currentLevel/nextLevel from getAuthenticatorAssuranceLevel()', async () => {
    mfaMock.getAuthenticatorAssuranceLevel.mockResolvedValue({ data: { currentLevel: 'aal1', nextLevel: 'aal2', currentAuthenticationMethods: [] }, error: null });
    const result = await getAssuranceLevel();
    expect(result.data).toEqual({ currentLevel: 'aal1', nextLevel: 'aal2' });
  });

  it('refreshSessionAfterMfa calls auth.refreshSession()', async () => {
    authMock.refreshSession.mockResolvedValue({ data: { session: {} }, error: null });
    const result = await refreshSessionAfterMfa();
    expect(authMock.refreshSession).toHaveBeenCalledTimes(1);
    expect(result.data?.refreshed).toBe(true);
  });

  it('every wrapper fails safely (no throw) when no live client is configured', async () => {
    (getSupabaseClient as ReturnType<typeof vi.fn>).mockReturnValue(null);
    await expect(enrollTotpFactor('x')).resolves.toEqual({ data: null, error: { code: 'client_unavailable', message: 'Live Supabase is not configured.', retryable: false } });
    await expect(challengeAndVerifyTotp('f', '123456')).resolves.toMatchObject({ data: null });
    await expect(unenrollFactor('f')).resolves.toMatchObject({ data: null });
    await expect(listMfaFactors()).resolves.toMatchObject({ data: null });
    await expect(getAssuranceLevel()).resolves.toMatchObject({ data: null });
    await expect(refreshSessionAfterMfa()).resolves.toMatchObject({ data: null });
  });
});
