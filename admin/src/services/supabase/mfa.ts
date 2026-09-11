// Thin, typed wrappers around supabase-js's native MFA API
// (supabase.auth.mfa.*). Kept separate from AuthProvider so every MFA call
// site normalizes errors the same way and — deliberately — none of these
// functions ever logs, persists, or forwards a factor secret, QR payload,
// or verification code. Callers own rendering the secret/QR to the DOM;
// this module only ever returns them once, in memory, to the caller.
import type { Factor } from '@supabase/supabase-js';
import { getSupabaseClient } from './client';
import { normalizeError, type NormalizedError } from '../errors/normalize-error';

export type MfaResult<T> = { data: T; error: null } | { data: null; error: NormalizedError };

function unavailable<T>(): MfaResult<T> {
  return { data: null, error: { code: 'client_unavailable', message: 'Live Supabase is not configured.', retryable: false } };
}

export type EnrolledTotpFactor = {
  id: string;
  friendlyName: string | undefined;
  totp: { qrCode: string; secret: string; uri: string };
};

/** supabase.auth.mfa.enroll() for a TOTP factor. */
export async function enrollTotpFactor(friendlyName: string): Promise<MfaResult<EnrolledTotpFactor>> {
  const client = getSupabaseClient();
  if (!client) return unavailable();
  const { data, error } = await client.auth.mfa.enroll({ factorType: 'totp', friendlyName, issuer: 'PaMarket Admin' });
  if (error || !data) return { data: null, error: normalizeError(error) };
  return {
    data: {
      id: data.id,
      friendlyName: data.friendly_name,
      totp: { qrCode: data.totp.qr_code, secret: data.totp.secret, uri: data.totp.uri },
    },
    error: null,
  };
}

/**
 * supabase.auth.mfa.challengeAndVerify() — the combined, atomic form of
 * challenge() + verify() for TOTP that supabase-js recommends when there is
 * no need to inspect the intermediate challenge (this admin app never
 * does). Used for both completing enrollment and answering a login
 * challenge.
 */
export async function challengeAndVerifyTotp(factorId: string, code: string): Promise<MfaResult<{ verified: true }>> {
  const client = getSupabaseClient();
  if (!client) return unavailable();
  // The response carries new access/refresh tokens, which the Supabase
  // client already applies to its own internal session — this wrapper
  // deliberately never surfaces them to callers.
  const { data, error } = await client.auth.mfa.challengeAndVerify({ factorId, code });
  if (error || !data) return { data: null, error: normalizeError(error) };
  return { data: { verified: true }, error: null };
}

/** supabase.auth.mfa.unenroll() — removes a factor (verified or not). */
export async function unenrollFactor(factorId: string): Promise<MfaResult<{ factorId: string }>> {
  const client = getSupabaseClient();
  if (!client) return unavailable();
  const { data, error } = await client.auth.mfa.unenroll({ factorId });
  if (error || !data) return { data: null, error: normalizeError(error) };
  return { data: { factorId: data.id }, error: null };
}

/** supabase.auth.mfa.listFactors() — every factor for the current user. */
export async function listMfaFactors(): Promise<MfaResult<{ all: Factor[] }>> {
  const client = getSupabaseClient();
  if (!client) return unavailable();
  const { data, error } = await client.auth.mfa.listFactors();
  if (error || !data) return { data: null, error: normalizeError(error) };
  return { data: { all: data.all }, error: null };
}

export type AssuranceLevels = { currentLevel: string | null; nextLevel: string | null };

/** supabase.auth.mfa.getAuthenticatorAssuranceLevel(). */
export async function getAssuranceLevel(): Promise<MfaResult<AssuranceLevels>> {
  const client = getSupabaseClient();
  if (!client) return unavailable();
  const { data, error } = await client.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error || !data) return { data: null, error: normalizeError(error) };
  return { data: { currentLevel: data.currentLevel, nextLevel: data.nextLevel }, error: null };
}

/**
 * supabase.auth.refreshSession() — required after a successful MFA verify
 * so the client's in-memory session/JWT reflects the new aal2 claim before
 * getAuthenticatorAssuranceLevel() is re-checked.
 */
export async function refreshSessionAfterMfa(): Promise<MfaResult<{ refreshed: boolean }>> {
  const client = getSupabaseClient();
  if (!client) return unavailable();
  const { error } = await client.auth.refreshSession();
  if (error) return { data: null, error: normalizeError(error) };
  return { data: { refreshed: true }, error: null };
}
