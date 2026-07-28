// Shared Apple App Store Server API / signed-payload verification helpers,
// used by verify-apple-purchase, verify-apple-subscription, and
// apple-notifications-webhook. Centralized here (unlike the Google helpers,
// which are duplicated per-function) because constructing these correctly —
// especially SignedDataVerifier's root-of-trust and the production/sandbox
// dual-attempt dance — is easy to get subtly wrong three separate times.
//
// Uses Apple's own official SDK (@apple/app-store-server-library) rather
// than hand-rolled JWS/X.509 chain verification: this is a Node package,
// resolved here via esm.sh's Node-compat shim the same way
// @supabase/supabase-js already is elsewhere in these functions.
//
// Required Edge Function secrets:
//   APPLE_ISSUER_ID     — App Store Connect → Users and Access → Integrations → Issuer ID
//   APPLE_KEY_ID        — the Key ID of the App Store Server API key you create there
//   APPLE_PRIVATE_KEY   — the FULL contents of the downloaded .p8 file (including
//                         the -----BEGIN/END PRIVATE KEY----- lines), as one string
//   APPLE_BUNDLE_ID     — e.g. com.pamarket.app (must match app.config.ts exactly)
//   APPLE_APP_APPLE_ID  — the numeric App Store Connect app ID (My App → App
//                         Information → General Information → Apple ID). Optional
//                         for sandbox-only testing, required once live in production.
import {
  AppStoreServerAPIClient,
  Environment,
  SignedDataVerifier,
  type JWSTransactionDecodedPayload,
  type StatusResponse,
} from 'https://esm.sh/@apple/app-store-server-library@3.1.0';

// Apple Root CA - G3 (DER, base64). Public trust-anchor data, not a secret —
// safe to hardcode. Downloaded from https://www.apple.com/certificateauthority/
// (AppleRootCA-G3.cer). If Apple ever rotates their root, add the new root's
// base64 alongside this one; SignedDataVerifier accepts a list.
const APPLE_ROOT_CA_G3_B64 =
  'MIICQzCCAcmgAwIBAgIILcX8iNLFS5UwCgYIKoZIzj0EAwMwZzEbMBkGA1UEAwwSQXBwbGUgUm9vdCBDQSAtIEczMSYwJAYDVQQLDB1BcHBsZSBDZXJ0aWZpY2F0aW9uIEF1dGhvcml0eTETMBEGA1UECgwKQXBwbGUgSW5jLjELMAkGA1UEBhMCVVMwHhcNMTQwNDMwMTgxOTA2WhcNMzkwNDMwMTgxOTA2WjBnMRswGQYDVQQDDBJBcHBsZSBSb290IENBIC0gRzMxJjAkBgNVBAsMHUFwcGxlIENlcnRpZmljYXRpb24gQXV0aG9yaXR5MRMwEQYDVQQKDApBcHBsZSBJbmMuMQswCQYDVQQGEwJVUzB2MBAGByqGSM49AgEGBSuBBAAiA2IABJjpLz1AcqTtkyJygRMc3RCV8cWjTnHcFBbZDuWmBSp3ZHtfTjjTuxxEtX/1H7YyYl3J6YRbTzBPEVoA/VhYDKX1DyxNB0cTddqXl5dvMVztK517IDvYuVTZXpmkOlEKMaNCMEAwHQYDVR0OBBYEFLuw3qFYM4iapIqZ3r6966/ayySrMA8GA1UdEwEB/wQFMAMBAf8wDgYDVR0PAQH/BAQDAgEGMAoGCCqGSM49BAMDA2gAMGUCMQCD6cHEFl4aXTQY2e3v9GwOAEZLuN+yRhHFD/3meoyhpmvOwgPUnPWTxnS4at+qIxUCMG1mihDK1A3UT82NQz60imOlM27jbdoXt2QfyFMm+YhidDkLF1vLUagM6BgD56KyKA==';

function base64ToBuffer(b64: string): Buffer {
  return Buffer.from(b64, 'base64');
}

function requireEnv(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`Missing required secret: ${name}`);
  return v;
}

export function getAppleConfig() {
  return {
    issuerId: requireEnv('APPLE_ISSUER_ID'),
    keyId: requireEnv('APPLE_KEY_ID'),
    privateKey: requireEnv('APPLE_PRIVATE_KEY'),
    bundleId: requireEnv('APPLE_BUNDLE_ID'),
    // Optional: sandbox-only testing can omit this; production cannot.
    appAppleId: Deno.env.get('APPLE_APP_APPLE_ID') ? Number(Deno.env.get('APPLE_APP_APPLE_ID')) : undefined,
  };
}

let _verifiers: { production: SignedDataVerifier; sandbox: SignedDataVerifier } | null = null;

function getVerifiers() {
  if (_verifiers) return _verifiers;
  const { bundleId, appAppleId } = getAppleConfig();
  const roots = [base64ToBuffer(APPLE_ROOT_CA_G3_B64)];
  _verifiers = {
    production: new SignedDataVerifier(roots, true, Environment.PRODUCTION, bundleId, appAppleId),
    sandbox: new SignedDataVerifier(roots, true, Environment.SANDBOX, bundleId, appAppleId),
  };
  return _verifiers;
}

// Verifies a client-supplied signed transaction JWS (StoreKit already hands
// the app a verifiable JWS locally — this is the one-time-purchase path, no
// live Apple API call needed). Tries production first, falls back to
// sandbox, since the same signing chain covers both and we don't otherwise
// know in advance whether this is a TestFlight/sandbox purchase.
export async function verifyTransactionJWS(signedTransactionInfo: string): Promise<JWSTransactionDecodedPayload> {
  const { production, sandbox } = getVerifiers();
  try {
    return await production.verifyAndDecodeTransaction(signedTransactionInfo);
  } catch (prodErr) {
    try {
      return await sandbox.verifyAndDecodeTransaction(signedTransactionInfo);
    } catch {
      throw prodErr;
    }
  }
}

export async function verifyNotificationPayload(signedPayload: string) {
  const { production, sandbox } = getVerifiers();
  try {
    return await production.verifyAndDecodeNotification(signedPayload);
  } catch (prodErr) {
    try {
      return await sandbox.verifyAndDecodeNotification(signedPayload);
    } catch {
      throw prodErr;
    }
  }
}

let _apiClients: { production: AppStoreServerAPIClient; sandbox: AppStoreServerAPIClient } | null = null;

function getApiClients() {
  if (_apiClients) return _apiClients;
  const { issuerId, keyId, privateKey, bundleId } = getAppleConfig();
  _apiClients = {
    production: new AppStoreServerAPIClient(privateKey, keyId, issuerId, bundleId, Environment.PRODUCTION),
    sandbox: new AppStoreServerAPIClient(privateKey, keyId, issuerId, bundleId, Environment.SANDBOX),
  };
  return _apiClients;
}

// Apple's Status enum (from @apple/app-store-server-library models/Status):
//   1 ACTIVE, 2 EXPIRED, 3 BILLING_RETRY, 4 BILLING_GRACE_PERIOD, 5 REVOKED
// Mapped to the same lowercase column values play_subscriptions already
// uses, so activate_play_subscription/activate_recruiter_subscription need
// no changes to work with Apple-sourced rows.
function mapAppleStatus(status: number): string {
  const m: Record<number, string> = {
    1: 'active',
    2: 'expired',
    3: 'on_hold', // billing retry — closest existing analog to Play's on_hold
    4: 'in_grace_period',
    5: 'canceled', // revoked
  };
  return m[status] || 'expired';
}

export type AppleSubscriptionStatus = {
  ok: true;
  subscriptionState: string;
  productId?: string;
  expiryTime?: string;
  autoRenewing: boolean;
  originalTransactionId?: string;
  transactionId?: string;
} | { ok: false; reason: string };

// Looks up the AUTHORITATIVE current state of a subscription by its stable
// originalTransactionId — used for both the initial purchase/upgrade moment
// and (via apple-notifications-webhook) every later lifecycle event, mirroring
// how verify-play-subscription/play-rtdn-webhook both always re-fetch truth
// from subscriptionsv2 rather than trusting the triggering event alone.
export async function fetchAppleSubscriptionStatus(originalTransactionId: string): Promise<AppleSubscriptionStatus> {
  const { production, sandbox } = getApiClients();
  let statusResponse: StatusResponse;
  try {
    statusResponse = await production.getAllSubscriptionStatuses(originalTransactionId);
  } catch (prodErr) {
    try {
      statusResponse = await sandbox.getAllSubscriptionStatuses(originalTransactionId);
    } catch {
      return { ok: false, reason: (prodErr as Error).message || 'Apple API error' };
    }
  }

  const group = statusResponse.data?.[0];
  const lastTx = group?.lastTransactions?.[0];
  if (!group || !lastTx) {
    return { ok: false, reason: 'No subscription data returned for this transaction' };
  }

  let decoded: JWSTransactionDecodedPayload | null = null;
  if (lastTx.signedTransactionInfo) {
    try {
      decoded = await verifyTransactionJWS(lastTx.signedTransactionInfo);
    } catch (e) {
      return { ok: false, reason: 'Could not verify transaction signature: ' + (e as Error).message };
    }
  }

  return {
    ok: true,
    subscriptionState: mapAppleStatus(lastTx.status as unknown as number),
    productId: decoded?.productId,
    expiryTime: decoded?.expiresDate ? new Date(decoded.expiresDate).toISOString() : undefined,
    autoRenewing: lastTx.status === 1 || lastTx.status === 4, // Apple doesn't expose a separate autoRenew flag on the status entry itself; renewalInfo would, but state alone is enough to drive activate_play_subscription's own "active/in_grace_period" gate
    originalTransactionId: decoded?.originalTransactionId,
    transactionId: decoded?.transactionId,
  };
}
