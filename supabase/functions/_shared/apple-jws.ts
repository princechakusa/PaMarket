// Web Crypto JWS verification for Apple StoreKit signed data.
//
// WHY THIS EXISTS
// ---------------
// @apple/app-store-server-library's SignedDataVerifier cannot run in the
// Supabase Edge Runtime. Proven from inside production (Edge Runtime
// 1.74.3 / Deno 2.1.4):
//
//   VerificationException status=1 (VERIFICATION_FAILURE)
//   cause: "Not implemented: crypto.X509Certificate.prototype.toString"
//
// The SDK calls leaf.toString() on the FIRST line of
// verifyCertificateChain() (jws_verification.js:234) just to build a cache
// key — before any cryptography and unconditionally, so disabling online
// checks does not avoid it. Deno does not implement that method, so every
// verification threw.
//
// This module reimplements the same security model on Web Crypto only:
// no Node crypto, no global Buffer, no X509Certificate, no jsonwebtoken.
//
// SECURITY MODEL (unchanged from the SDK's)
// -----------------------------------------
//   * alg MUST be ES256 (the header is otherwise untrusted).
//   * The x5c chain is leaf -> intermediate -> root.
//   * The chain's root MUST be byte-identical to our PINNED Apple root.
//     A root supplied by the JWS is never trusted on its own.
//   * Each certificate's signature is verified against its issuer's public
//     key, and issuer/subject names must line up.
//   * CA certificates must actually assert basicConstraints CA=true.
//   * Validity windows are enforced for every certificate.
//   * Only then is the JWS signature verified with the leaf's public key,
//     and only then is the payload parsed.
//
// Apple's chain mixes curves: the leaf is P-256 (ES256) while the
// intermediate and root are P-384 — so certificate signatures use
// SHA-384/P-384 while the JWS itself uses SHA-256/P-256. Verified against
// a real Apple sandbox transaction; assuming SHA-256 throughout silently
// fails to validate the chain.

// Apple Root CA - G3, DER as base64. Public trust anchor, not a secret.
// From https://www.apple.com/certificateauthority/ (AppleRootCA-G3.cer).
// SHA-256 of these DER bytes is asserted below and re-checked at runtime.
const APPLE_ROOT_CA_G3_B64 =
  "MIICQzCCAcmgAwIBAgIILcX8iNLFS5UwCgYIKoZIzj0EAwMwZzEbMBkGA1UEAwwSQXBwbGUgUm9vdCBDQSAtIEczMSYwJAYDVQQLDB1BcHBsZSBDZXJ0aWZpY2F0aW9uIEF1dGhvcml0eTETMBEGA1UECgwKQXBwbGUgSW5jLjELMAkGA1UEBhMCVVMwHhcNMTQwNDMwMTgxOTA2WhcNMzkwNDMwMTgxOTA2WjBnMRswGQYDVQQDDBJBcHBsZSBSb290IENBIC0gRzMxJjAkBgNVBAsMHUFwcGxlIENlcnRpZmljYXRpb24gQXV0aG9yaXR5MRMwEQYDVQQKDApBcHBsZSBJbmMuMQswCQYDVQQGEwJVUzB2MBAGByqGSM49AgEGBSuBBAAiA2IABJjpLz1AcqTtkyJygRMc3RCV8cWjTnHcFBbZDuWmBSp3ZHtfTjjTuxxEtX/1H7YyYl3J6YRbTzBPEVoA/VhYDKX1DyxNB0cTddqXl5dvMVztK517IDvYuVTZXpmkOlEKMaNCMEAwHQYDVR0OBBYEFLuw3qFYM4iapIqZ3r6966/ayySrMA8GA1UdEwEB/wQFMAMBAf8wDgYDVR0PAQH/BAQDAgEGMAoGCCqGSM49BAMDA2gAMGUCMQCD6cHEFl4aXTQY2e3v9GwOAEZLuN+yRhHFD/3meoyhpmvOwgPUnPWTxnS4at+qIxUCMG1mihDK1A3UT82NQz60imOlM27jbdoXt2QfyFMm+YhidDkLF1vLUagM6BgD56KyKA==";

// Defence in depth: if the constant above is ever edited, this mismatch
// fails closed rather than silently trusting a different root.
const APPLE_ROOT_CA_G3_SHA256 =
  "63343abfb89a6a03ebb57e9b3f5fa7be7c4f5c756f3017b3a8c488c3653e9179";

export class AppleJwsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AppleJwsError";
  }
}

// ── encoding helpers ────────────────────────────────────────────────────

function base64ToBytes(b64: string): Uint8Array {
  const normalized = b64.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

function base64UrlToString(b64url: string): string {
  return new TextDecoder().decode(base64ToBytes(b64url));
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

// ── minimal DER / ASN.1 reader ──────────────────────────────────────────
// Only what X.509 path validation needs. Deliberately narrow rather than
// pulling in a general-purpose ASN.1 stack.

interface Asn1 {
  tag: number;
  start: number; // first content byte
  end: number; // exclusive
  headerStart: number; // first byte of the tag (for full-element slices)
}

function readAsn1(buf: Uint8Array, offset: number): Asn1 {
  if (offset + 2 > buf.length) throw new AppleJwsError("DER truncated");
  const headerStart = offset;
  const tag = buf[offset++];
  let len = buf[offset++];
  if (len & 0x80) {
    const n = len & 0x7f;
    if (n === 0 || n > 4) throw new AppleJwsError("Unsupported DER length");
    len = 0;
    for (let i = 0; i < n; i++) len = (len << 8) | buf[offset++];
  }
  const start = offset;
  const end = offset + len;
  if (end > buf.length) throw new AppleJwsError("DER length exceeds buffer");
  return { tag, start, end, headerStart };
}

function children(buf: Uint8Array, node: Asn1): Asn1[] {
  const out: Asn1[] = [];
  let off = node.start;
  while (off < node.end) {
    const child = readAsn1(buf, off);
    out.push(child);
    off = child.end;
  }
  return out;
}

function oidToString(buf: Uint8Array, node: Asn1): string {
  const b = buf.subarray(node.start, node.end);
  const parts: number[] = [Math.floor(b[0] / 40), b[0] % 40];
  let value = 0;
  for (let i = 1; i < b.length; i++) {
    value = (value << 7) | (b[i] & 0x7f);
    if (!(b[i] & 0x80)) {
      parts.push(value);
      value = 0;
    }
  }
  return parts.join(".");
}

// YYMMDDHHMMSSZ (UTCTime) / YYYYMMDDHHMMSSZ (GeneralizedTime)
function parseAsn1Time(buf: Uint8Array, node: Asn1): number {
  const s = new TextDecoder().decode(buf.subarray(node.start, node.end));
  const utc = node.tag === 0x17;
  let year: number;
  let rest: string;
  if (utc) {
    const yy = parseInt(s.slice(0, 2), 10);
    year = yy >= 50 ? 1900 + yy : 2000 + yy;
    rest = s.slice(2);
  } else {
    year = parseInt(s.slice(0, 4), 10);
    rest = s.slice(4);
  }
  const mo = parseInt(rest.slice(0, 2), 10);
  const d = parseInt(rest.slice(2, 4), 10);
  const h = parseInt(rest.slice(4, 6), 10);
  const mi = parseInt(rest.slice(6, 8), 10);
  const sec = parseInt(rest.slice(8, 10) || "0", 10);
  return Date.UTC(year, mo - 1, d, h, mi, sec);
}

const OID_EC_PUBLIC_KEY = "1.2.840.10045.2.1";
const OID_P256 = "1.2.840.10045.3.1.7";
const OID_P384 = "1.3.132.0.34";
const OID_ECDSA_SHA256 = "1.2.840.10045.4.3.2";
const OID_ECDSA_SHA384 = "1.2.840.10045.4.3.3";
const OID_BASIC_CONSTRAINTS = "2.5.29.19";

interface ParsedCert {
  der: Uint8Array;
  tbsBytes: Uint8Array; // exact bytes the signature covers
  signatureAlgOid: string;
  signature: Uint8Array; // DER-encoded ECDSA (r,s)
  issuerDer: Uint8Array; // raw DER of the Name — compared byte-wise
  subjectDer: Uint8Array;
  notBefore: number;
  notAfter: number;
  spkiDer: Uint8Array; // SubjectPublicKeyInfo, for crypto.subtle.importKey
  curveOid: string;
  isCa: boolean;
}

function parseCertificate(der: Uint8Array): ParsedCert {
  const cert = readAsn1(der, 0);
  const [tbs, sigAlg, sigVal] = children(der, cert);

  const tbsBytes = der.subarray(tbs.headerStart, tbs.end);
  const signatureAlgOid = oidToString(der, children(der, sigAlg)[0]);

  // BIT STRING: first content byte is the count of unused bits (always 0 here)
  const signature = der.subarray(sigVal.start + 1, sigVal.end);

  const tbsKids = children(der, tbs);
  // Optional [0] EXPLICIT version prefix
  let i = tbsKids[0].tag === 0xa0 ? 1 : 0;
  i++; // serialNumber
  i++; // signature AlgorithmIdentifier
  const issuer = tbsKids[i++];
  const validity = tbsKids[i++];
  const subject = tbsKids[i++];
  const spki = tbsKids[i++];

  const [nb, na] = children(der, validity);
  const spkiKids = children(der, spki);
  const algKids = children(der, spkiKids[0]);
  const keyTypeOid = oidToString(der, algKids[0]);
  if (keyTypeOid !== OID_EC_PUBLIC_KEY) {
    throw new AppleJwsError("Certificate public key is not EC");
  }
  const curveOid = oidToString(der, algKids[1]);

  // basicConstraints CA flag, from extensions ([3] EXPLICIT)
  let isCa = false;
  for (let j = i; j < tbsKids.length; j++) {
    if (tbsKids[j].tag !== 0xa3) continue;
    const extSeq = children(der, tbsKids[j])[0];
    for (const ext of children(der, extSeq)) {
      const extKids = children(der, ext);
      if (oidToString(der, extKids[0]) !== OID_BASIC_CONSTRAINTS) continue;
      const octet = extKids[extKids.length - 1];
      const bc = readAsn1(der, octet.start);
      const bcKids = children(der, bc);
      if (bcKids.length > 0 && bcKids[0].tag === 0x01) {
        isCa = der[bcKids[0].start] !== 0x00;
      }
    }
  }

  return {
    der,
    tbsBytes,
    signatureAlgOid,
    signature,
    issuerDer: der.subarray(issuer.headerStart, issuer.end),
    subjectDer: der.subarray(subject.headerStart, subject.end),
    notBefore: parseAsn1Time(der, nb),
    notAfter: parseAsn1Time(der, na),
    spkiDer: der.subarray(spki.headerStart, spki.end),
    curveOid,
    isCa,
  };
}

// ECDSA signatures in X.509 are DER SEQUENCE{r,s}; Web Crypto wants raw
// r||s, each left-padded to the curve size.
function derSignatureToRaw(der: Uint8Array, size: number): Uint8Array {
  const seq = readAsn1(der, 0);
  const [rNode, sNode] = children(der, seq);
  const out = new Uint8Array(size * 2);
  for (const [node, offset] of [[rNode, 0], [sNode, size]] as const) {
    let bytes = der.subarray(node.start, node.end);
    while (bytes.length > 1 && bytes[0] === 0x00) bytes = bytes.subarray(1);
    if (bytes.length > size) throw new AppleJwsError("ECDSA integer too large");
    out.set(bytes, offset + size - bytes.length);
  }
  return out;
}

function curveName(oid: string): "P-256" | "P-384" {
  if (oid === OID_P256) return "P-256";
  if (oid === OID_P384) return "P-384";
  throw new AppleJwsError("Unsupported EC curve in certificate");
}

async function importSpki(cert: ParsedCert): Promise<CryptoKey> {
  return await crypto.subtle.importKey(
    "spki",
    cert.spkiDer,
    { name: "ECDSA", namedCurve: curveName(cert.curveOid) },
    false,
    ["verify"],
  );
}

// Verify `cert` was signed by `issuer`.
async function verifyCertSignature(
  cert: ParsedCert,
  issuer: ParsedCert,
): Promise<boolean> {
  let hash: "SHA-256" | "SHA-384";
  if (cert.signatureAlgOid === OID_ECDSA_SHA256) hash = "SHA-256";
  else if (cert.signatureAlgOid === OID_ECDSA_SHA384) hash = "SHA-384";
  else throw new AppleJwsError("Unsupported certificate signature algorithm");

  const size = curveName(issuer.curveOid) === "P-384" ? 48 : 32;
  const raw = derSignatureToRaw(cert.signature, size);
  return await crypto.subtle.verify(
    { name: "ECDSA", hash },
    await importSpki(issuer),
    raw,
    cert.tbsBytes,
  );
}

// ── chain validation ────────────────────────────────────────────────────

let _pinnedRoot: Uint8Array | null = null;
async function getPinnedRoot(): Promise<Uint8Array> {
  if (_pinnedRoot) return _pinnedRoot;
  const bytes = base64ToBytes(APPLE_ROOT_CA_G3_B64);
  const digest = await sha256Hex(bytes);
  if (digest !== APPLE_ROOT_CA_G3_SHA256) {
    throw new AppleJwsError(
      "Pinned Apple root certificate failed its own fingerprint check",
    );
  }
  _pinnedRoot = bytes;
  return bytes;
}

async function validateChain(
  x5c: string[],
  now: number,
): Promise<ParsedCert> {
  if (!Array.isArray(x5c) || x5c.length < 2) {
    throw new AppleJwsError("JWS x5c chain missing or too short");
  }
  const certs = x5c.map((b64) => parseCertificate(base64ToBytes(b64)));
  const leaf = certs[0];
  const root = certs[certs.length - 1];

  // The chain is only trusted because its root is byte-identical to the
  // root we pin. An attacker-supplied chain terminating at their own root
  // fails here regardless of internal consistency.
  const pinned = await getPinnedRoot();
  if (!bytesEqual(root.der, pinned)) {
    throw new AppleJwsError("JWS chain does not terminate at the pinned Apple root");
  }

  for (const cert of certs) {
    if (now < cert.notBefore || now > cert.notAfter) {
      throw new AppleJwsError("Certificate in chain is outside its validity window");
    }
  }

  // Walk leaf -> ... -> root: every certificate must be signed by the next
  // one, whose subject must match its issuer, and every issuer must be a CA.
  for (let i = 0; i < certs.length - 1; i++) {
    const child = certs[i];
    const parent = certs[i + 1];
    if (!bytesEqual(child.issuerDer, parent.subjectDer)) {
      throw new AppleJwsError("Certificate issuer does not match its parent's subject");
    }
    if (!parent.isCa) {
      throw new AppleJwsError("Certificate chain contains a non-CA issuer");
    }
    if (!(await verifyCertSignature(child, parent))) {
      throw new AppleJwsError("Certificate signature verification failed");
    }
  }

  if (leaf.isCa) {
    throw new AppleJwsError("JWS leaf certificate must not be a CA certificate");
  }
  if (curveName(leaf.curveOid) !== "P-256") {
    throw new AppleJwsError("JWS leaf key must be P-256 for ES256");
  }
  return leaf;
}

// ── public API ──────────────────────────────────────────────────────────

/**
 * Cryptographically verify an Apple-signed JWS and return its payload.
 * Throws AppleJwsError unless the full chain validates to the pinned Apple
 * root AND the ES256 signature is valid. The payload is parsed only after
 * verification succeeds — nothing from an unverified JWS is trusted.
 */
export async function verifyAppleJws<T = Record<string, unknown>>(
  jws: string,
  options: { now?: number } = {},
): Promise<T> {
  if (typeof jws !== "string" || !jws) {
    throw new AppleJwsError("Missing JWS");
  }
  const parts = jws.split(".");
  if (parts.length !== 3) throw new AppleJwsError("Malformed JWS");
  const [headerB64, payloadB64, signatureB64] = parts;

  let header: { alg?: string; x5c?: string[] };
  try {
    header = JSON.parse(base64UrlToString(headerB64));
  } catch {
    throw new AppleJwsError("Malformed JWS header");
  }
  if (header.alg !== "ES256") {
    throw new AppleJwsError(`Unexpected JWS alg: ${header.alg}`);
  }

  const now = options.now ?? Date.now();
  const leaf = await validateChain(header.x5c ?? [], now);

  // JWS ES256 signatures are raw r||s (64 bytes), not DER — confirmed
  // against real Apple data, and what crypto.subtle.verify expects.
  const signature = base64ToBytes(signatureB64);
  if (signature.length !== 64) {
    throw new AppleJwsError("Unexpected ES256 signature length");
  }
  const signingInput = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  const valid = await crypto.subtle.verify(
    { name: "ECDSA", hash: "SHA-256" },
    await importSpki(leaf),
    signature,
    signingInput,
  );
  if (!valid) throw new AppleJwsError("JWS signature verification failed");

  try {
    return JSON.parse(base64UrlToString(payloadB64)) as T;
  } catch {
    throw new AppleJwsError("Malformed JWS payload");
  }
}
