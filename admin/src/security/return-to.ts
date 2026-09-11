// Sanitizes a caller-supplied `returnTo` query value so /login and
// /mfa/challenge can send an administrator back to the page they wanted,
// without ever becoming an open redirect. Only a same-app, single-leading-
// slash internal path is accepted; anything else (absolute URLs,
// protocol-relative `//host`, `javascript:`/other schemes hidden after a
// leading slash, or unparsable input) falls back to the safe default.
const INTERNAL_PATH = /^\/(?!\/)[^\s]*$/;
const SCHEME_LIKE = /^\/[a-z][a-z0-9+.-]*:/i;

export function sanitizeReturnTo(value: string | null | undefined, fallback = '/'): string {
  if (!value) return fallback;
  let decoded: string;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return fallback;
  }
  if (!INTERNAL_PATH.test(decoded)) return fallback;
  if (SCHEME_LIKE.test(decoded)) return fallback;
  return decoded;
}
