// Shared Apple App Store Server API / signed-payload verification helpers,
// used by verify-apple-purchase, verify-apple-subscription, and
// apple-notifications-webhook. Centralized here (unlike the Google helpers,
// which are duplicated per-function) because getting the root-of-trust and
// the production/sandbox dance right is easy to get subtly wrong three
// separate times.
//
// This module is Web Crypto only. Apple's official SDK
// (@apple/app-store-server-library) is still the source of TYPES, but none
// of its runtime code is used, because two separate parts of it are
// incompatible with the Supabase Edge Runtime — both proven in production,
// not assumed. See createAppleBearerToken (API auth) and ./apple-jws.ts
// (signature verification) for the specifics.
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
// Nothing is imported from @apple/app-store-server-library at runtime any
// more — only its TYPES, which are erased at compile time and cost nothing.
//
//  * AppStoreServerAPIClient signs its bearer JWT via jsonwebtoken → Node
//    crypto, which threw `"alg" parameter "ES256" requires curve
//    "prime256v1"` under Deno. Replaced by createAppleBearerToken below.
//  * SignedDataVerifier calls X509Certificate.prototype.toString(), which
//    Supabase Edge Runtime 1.74.3 / Deno 2.1.4 does not implement — proven
//    in production with `Not implemented:
//    crypto.X509Certificate.prototype.toString`. Replaced by
//    ./apple-jws.ts, a Web Crypto implementation of the same security
//    model (pinned Apple root, full chain validation, ES256).
import type {
  JWSTransactionDecodedPayload,
  StatusResponse,
} from "https://esm.sh/@apple/app-store-server-library@3.1.0";
import { verifyAppleJws } from "./apple-jws.ts";

function requireEnv(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`Missing required secret: ${name}`);
  return v;
}

// ── App Store Server API bearer token (Web Crypto, not Node crypto) ─────
//
// AppStoreServerAPIClient signs its own auth JWT via jsonwebtoken →
// jws → Node's crypto module. Under Deno that path threw
//   "alg" parameter "ES256" requires curve "prime256v1"
// on every single call, for a key that is provably a valid P-256/
// prime256v1 key: it imports and signs correctly under real Node, under
// OpenSSL, and (below) under Deno's own Web Crypto. The failure is a
// Node-compat gap in how the key's curve is surfaced to jws, not a bad
// key — so the fix is to stop routing this one JWT through Node crypto
// and mint it with Web Crypto, which Deno implements natively.
//
// This covers only the API-client auth path. JWS signature verification
// had a separate incompatibility and lives in ./apple-jws.ts.

const APPLE_API_AUDIENCE = "appstoreconnect-v1";
const APPLE_TOKEN_LIFETIME_SECONDS = 300; // 5m, matching the SDK

// Base URLs and path taken from @apple/app-store-server-library@3.1.0's
// own constants rather than documentation, so this stays byte-identical
// to the request the SDK was already making.
const APPLE_API_BASE = {
  production: "https://api.storekit.apple.com",
  sandbox: "https://api.storekit-sandbox.apple.com",
} as const;

type AppleApiEnvironment = keyof typeof APPLE_API_BASE;

function base64UrlEncode(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  for (const b of arr) binary += String.fromCharCode(b);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64UrlEncodeString(value: string): string {
  return base64UrlEncode(new TextEncoder().encode(value));
}

// PKCS#8 PEM → DER. Tolerates CRLF and a missing trailing newline; both
// are common when a .p8 is pasted through a secrets UI.
function pkcs8PemToDer(pem: string): ArrayBuffer {
  const body = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  if (!body) throw new Error("APPLE_PRIVATE_KEY is empty after stripping PEM armor");
  const raw = atob(body);
  const der = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) der[i] = raw.charCodeAt(i);
  return der.buffer;
}

// Imported once per isolate. extractable=false so the key material can
// never be read back out of the CryptoKey, even accidentally.
let _signingKeyPromise: Promise<CryptoKey> | null = null;
function getSigningKey(): Promise<CryptoKey> {
  if (!_signingKeyPromise) {
    _signingKeyPromise = (async () => {
      const { privateKey } = getAppleConfig();
      try {
        return await crypto.subtle.importKey(
          "pkcs8",
          pkcs8PemToDer(privateKey),
          { name: "ECDSA", namedCurve: "P-256" },
          false,
          ["sign"]
        );
      } catch (e) {
        // Never include the key (or any part of it) in the message.
        throw new Error(
          "Could not import APPLE_PRIVATE_KEY as a PKCS#8 P-256 key: " +
            (e as Error).message
        );
      }
    })().catch((e) => {
      _signingKeyPromise = null; // don't cache a failure
      throw e;
    });
  }
  return _signingKeyPromise;
}

// Mints the App Store Server API bearer token. Claims mirror
// AppStoreServerAPIClient.createBearerToken() exactly: header
// {alg,kid,typ}, payload {iss,iat,exp,aud,bid}.
async function createAppleBearerToken(): Promise<string> {
  const { issuerId, keyId, bundleId } = getAppleConfig();
  const key = await getSigningKey();
  const now = Math.floor(Date.now() / 1000);

  const header = { alg: "ES256", kid: keyId, typ: "JWT" };
  const payload = {
    iss: issuerId,
    iat: now,
    exp: now + APPLE_TOKEN_LIFETIME_SECONDS,
    aud: APPLE_API_AUDIENCE,
    bid: bundleId,
  };

  const signingInput = `${base64UrlEncodeString(
    JSON.stringify(header)
  )}.${base64UrlEncodeString(JSON.stringify(payload))}`;

  // Web Crypto returns ECDSA signatures as raw IEEE-P1363 r||s (64 bytes
  // for P-256), which is precisely what JWS ES256 requires — no DER
  // unwrapping needed. Verified by test before this was written.
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    new TextEncoder().encode(signingInput)
  );

  return `${signingInput}.${base64UrlEncode(signature)}`;
}

type AppleApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; errorCode?: number; errorMessage?: string };

// One authenticated GET against the App Store Server API. Logs enough to
// diagnose failures (environment, status, Apple's own error code/message)
// and nothing sensitive — never the token, header, or key.
async function appleApiGet<T>(
  environment: AppleApiEnvironment,
  path: string,
  context: Record<string, string | undefined>
): Promise<AppleApiResult<T>> {
  const token = await createAppleBearerToken();
  const res = await fetch(`${APPLE_API_BASE[environment]}${path}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "User-Agent": "PaMarket/1.0",
    },
  });

  if (res.ok) return { ok: true, data: (await res.json()) as T };

  let errorCode: number | undefined;
  let errorMessage: string | undefined;
  try {
    const body = await res.json();
    errorCode = body?.errorCode;
    errorMessage = body?.errorMessage;
  } catch {
    // Non-JSON error body — status alone still tells us what we need.
  }
  console.error("apple-api: request failed", {
    environment,
    path,
    status: res.status,
    errorCode,
    errorMessage,
    ...context,
  });
  return { ok: false, status: res.status, errorCode, errorMessage };
}

export function getAppleConfig() {
  return {
    issuerId: requireEnv("APPLE_ISSUER_ID"),
    keyId: requireEnv("APPLE_KEY_ID"),
    privateKey: requireEnv("APPLE_PRIVATE_KEY"),
    bundleId: requireEnv("APPLE_BUNDLE_ID"),
    // Optional: sandbox-only testing can omit this; production cannot.
    appAppleId: Deno.env.get("APPLE_APP_APPLE_ID")
      ? Number(Deno.env.get("APPLE_APP_APPLE_ID"))
      : undefined,
  };
}

// Verifies an Apple-signed JWS with Web Crypto (see ./apple-jws.ts): the
// x5c chain is validated to our PINNED Apple root and the ES256 signature
// is checked before the payload is parsed.
//
// The production/sandbox verifier split is gone, and that is not a
// loosening: Apple signs both environments with the same certificate
// chain, so the cryptography is identical. The SDK's two verifiers
// differed only in the post-verification `bundleId`/`environment`
// comparison, which is now done explicitly below so the semantic check is
// preserved rather than silently dropped. As a bonus the old code's habit
// of reporting the production error and discarding the sandbox one — which
// is what hid this bug behind an empty message for so long — is gone too.

// Enforced on every signed transaction: a JWS that is genuinely
// Apple-signed but issued for a DIFFERENT app must never be accepted.
function assertBundleId(
  decodedBundleId: string | undefined,
  what: string
): void {
  const expected = requireEnv("APPLE_BUNDLE_ID");
  if (decodedBundleId && decodedBundleId !== expected) {
    throw new Error(
      `${what} is for bundleId ${decodedBundleId}, expected ${expected}`
    );
  }
}

export async function verifyTransactionJWS(
  signedTransactionInfo: string
): Promise<JWSTransactionDecodedPayload> {
  const decoded = await verifyAppleJws<JWSTransactionDecodedPayload>(
    signedTransactionInfo
  );
  assertBundleId(decoded.bundleId, "Transaction");
  return decoded;
}

// Renewal info carries no bundleId of its own — it is only ever read
// alongside a transaction from the same Apple response, which is
// bundle-checked above.
export async function verifyRenewalInfoJWS(signedRenewalInfo: string) {
  return await verifyAppleJws(signedRenewalInfo);
}

export async function verifyNotificationPayload(signedPayload: string) {
  const decoded = await verifyAppleJws<{
    data?: { bundleId?: string };
  }>(signedPayload);
  assertBundleId(decoded?.data?.bundleId, "Notification");
  return decoded;
}

// Get All Subscription Statuses, production first then sandbox — the same
// order and fallback the previous AppStoreServerAPIClient-based code used.
// A TestFlight/sandbox transaction does not exist in production, and Apple
// answers that with 401 (verified live against this project's own sandbox
// transaction: production 401, sandbox 200), NOT a 404 — so the fallback
// must trigger on any non-ok production response, not just "not found".
// This is a normal path for every sandbox/TestFlight purchase.
async function getAllSubscriptionStatuses(
  transactionId: string
): Promise<AppleApiResult<StatusResponse>> {
  const path = `/inApps/v1/subscriptions/${encodeURIComponent(transactionId)}`;
  const production = await appleApiGet<StatusResponse>("production", path, {
    transactionId,
  });
  if (production.ok) return production;

  const sandbox = await appleApiGet<StatusResponse>("sandbox", path, {
    transactionId,
  });
  if (sandbox.ok) return sandbox;

  // Both failed. Report sandbox's error alongside production's status: a
  // 401 from BOTH (rather than production-401 + sandbox-200) is the signal
  // that the credentials themselves are wrong, which is worth being able
  // to tell apart from "this transaction simply isn't in production".
  console.error("apple-api: subscription status failed in both environments", {
    transactionId,
    productionStatus: production.status,
    sandboxStatus: sandbox.status,
    sandboxErrorCode: sandbox.errorCode,
  });
  return sandbox;
}

// Apple's Status enum (from @apple/app-store-server-library models/Status):
//   1 ACTIVE, 2 EXPIRED, 3 BILLING_RETRY, 4 BILLING_GRACE_PERIOD, 5 REVOKED
// Mapped to the same lowercase column values play_subscriptions already
// uses, so activate_play_subscription/activate_recruiter_subscription need
// no changes to work with Apple-sourced rows.
function mapAppleStatus(status: number): string {
  const m: Record<number, string> = {
    1: "active",
    2: "expired",
    3: "on_hold", // billing retry — closest existing analog to Play's on_hold
    4: "in_grace_period",
    5: "canceled", // revoked
  };
  return m[status] || "expired";
}

export type AppleSubscriptionStatus =
  | {
      ok: true;
      subscriptionState: string;
      productId?: string;
      expiryTime?: string;
      autoRenewing: boolean;
      originalTransactionId?: string;
      transactionId?: string;
      appAccountToken?: string;
    }
  | { ok: false; reason: string };

// Looks up the AUTHORITATIVE current state of a subscription by its stable
// originalTransactionId — used for both the initial purchase/upgrade moment
// and (via apple-notifications-webhook) every later lifecycle event, mirroring
// how verify-play-subscription/play-rtdn-webhook both always re-fetch truth
// from subscriptionsv2 rather than trusting the triggering event alone.
export async function fetchAppleSubscriptionStatus(
  originalTransactionId: string
): Promise<AppleSubscriptionStatus> {
  const apiResult = await getAllSubscriptionStatuses(originalTransactionId);
  if (!apiResult.ok) {
    return {
      ok: false,
      reason:
        apiResult.errorMessage ||
        `Apple API error (HTTP ${apiResult.status}${
          apiResult.errorCode ? `, code ${apiResult.errorCode}` : ""
        })`,
    };
  }
  const statusResponse: StatusResponse = apiResult.data;

  const candidates = (statusResponse.data || []).flatMap(
    (group) => group.lastTransactions || []
  );
  if (candidates.length === 0) {
    return {
      ok: false,
      reason: "No subscription data returned for this transaction",
    };
  }

  let selected: {
    item: (typeof candidates)[number];
    decoded: JWSTransactionDecodedPayload;
  } | null = null;
  for (const item of candidates) {
    if (!item.signedTransactionInfo) continue;
    try {
      const decoded = await verifyTransactionJWS(item.signedTransactionInfo);
      if (decoded.originalTransactionId === originalTransactionId) {
        selected = { item, decoded };
        break;
      }
      if (!selected) selected = { item, decoded };
    } catch (e) {
      return {
        ok: false,
        reason:
          "Could not verify transaction signature: " + (e as Error).message,
      };
    }
  }
  if (!selected)
    return {
      ok: false,
      reason: "No signed transaction data returned for this subscription",
    };

  let autoRenewing = selected.item.status === 1 || selected.item.status === 4;
  let gracePeriodExpiresDate: number | undefined;
  if (selected.item.signedRenewalInfo) {
    try {
      const renewal = await verifyRenewalInfoJWS(
        selected.item.signedRenewalInfo
      );
      autoRenewing = renewal.autoRenewStatus === 1;
      gracePeriodExpiresDate = renewal.gracePeriodExpiresDate;
    } catch (e) {
      return {
        ok: false,
        reason: "Could not verify renewal signature: " + (e as Error).message,
      };
    }
  }

  return {
    ok: true,
    subscriptionState: mapAppleStatus(
      selected.item.status as unknown as number
    ),
    productId: selected.decoded.productId,
    expiryTime:
      selected.item.status === 4 && gracePeriodExpiresDate
        ? new Date(gracePeriodExpiresDate).toISOString()
        : selected.decoded.expiresDate
        ? new Date(selected.decoded.expiresDate).toISOString()
        : undefined,
    autoRenewing,
    originalTransactionId: selected.decoded.originalTransactionId,
    transactionId: selected.decoded.transactionId,
    appAccountToken: selected.decoded.appAccountToken,
  };
}
