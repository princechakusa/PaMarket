// Normalizes the QR value returned by supabase.auth.mfa.enroll() into a
// safe <img src>.
//
// Verified directly against the installed @supabase/auth-js@2.116.0
// client (node_modules/@supabase/auth-js/dist/module/GoTrueClient.js,
// enroll()): the client itself already runs
//   data.totp.qr_code = `data:image/svg+xml;utf-8,${data.totp.qr_code}`
// before returning the result, so `qr_code` reaching this app is
// normally ALREADY a full `data:image/svg+xml` URI — not raw SVG. The
// type declarations' own doc comment ("prepend data:image/svg+xml;utf-8,
// to the value") describes the *pre-prefix* server value, and is stale
// for this installed version; a newer example in the same .d.ts file
// passes `data.totp.qr_code` straight to an <img>/<Image> src with no
// prefix at all, which matches what this helper now does for the
// already-prefixed case.
//
// This helper accepts either shape — already-prefixed, or raw SVG, in
// case a future or different Supabase project version reverts to
// returning unprefixed SVG — and rejects everything else, so an
// unexpected response degrades to a clear error state instead of an
// invalid, empty, or unsafe <img src>.
const SVG_DATA_URI_PREFIX = 'data:image/svg+xml';
const RAW_SVG_PATTERN = /^<svg[\s>]/i;

export function normalizeQrSource(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;

  // Already a proper SVG image data URI — including the exact
  // `data:image/svg+xml;utf-8,<svg>...` shape the installed client emits.
  // Used as-is; no other data: MIME type is accepted.
  if (trimmed.startsWith(SVG_DATA_URI_PREFIX)) return trimmed;

  // Raw SVG markup — encode it into a safe data URI ourselves rather than
  // trusting it to be safely embeddable unescaped.
  if (RAW_SVG_PATTERN.test(trimmed)) {
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(trimmed)}`;
  }

  // http:, https:, javascript:, file:, blob:, a different data: MIME
  // type, or anything unrecognized — rejected rather than guessed at.
  return null;
}
