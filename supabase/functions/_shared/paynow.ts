// Shared Paynow helpers + the authoritative website boost price list.
//
// PRICING MUST MATCH THE APP. The app sells the same products through
// Google Play Billing; their USD prices are declared in
// www/js/billing-products.js (estimatedPriceUsd) and mirrored in
// _shared/billing-products.ts. If a price changes in Play Console,
// change it here too — the website checkout charges what this file says,
// never what the client sends.
//
// Paynow protocol reference: https://developers.paynow.co.zw
//   InitiateTransaction: POST form to
//     https://www.paynow.co.zw/interface/initiatetransaction
//   with fields (id, reference, amount, additionalinfo, returnurl,
//   resulturl, status='Message', hash) where hash = uppercase SHA-512 of
//   every field VALUE concatenated in order + the integration key.
//   Response is urlencoded: status=Ok&browserurl=...&pollurl=...&hash=...
//   The poll URL, when fetched, returns urlencoded transaction state
//   (reference, paynowreference, amount, status, hash) — hash-verified
//   the same way.

export const PAYNOW_BOOST_PRODUCTS: Record<string, { days: number; amountUsd: number; family: 'boost' | 'job_boost' }> = {
  boost_1day:      { days: 1,  amountUsd: 2,  family: 'boost' },
  boost_7day:      { days: 7,  amountUsd: 10, family: 'boost' },
  boost_30day:     { days: 30, amountUsd: 30, family: 'boost' },
  job_boost_7day:  { days: 7,  amountUsd: 8,  family: 'job_boost' },
  job_boost_30day: { days: 30, amountUsd: 20, family: 'job_boost' },
};

const PAYNOW_INITIATE_URL = 'https://www.paynow.co.zw/interface/initiatetransaction';

async function sha512Upper(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-512', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

// Paynow hash: concatenate the VALUES of every field (except 'hash') in
// the order they appear, append the integration key, SHA-512, uppercase.
export async function paynowHash(fields: Array<[string, string]>, integrationKey: string): Promise<string> {
  const concatenated = fields
    .filter(([k]) => k.toLowerCase() !== 'hash')
    .map(([, v]) => v)
    .join('');
  return await sha512Upper(concatenated + integrationKey);
}

function parseUrlencoded(body: string): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  for (const pair of body.split('&')) {
    if (!pair) continue;
    const i = pair.indexOf('=');
    const k = decodeURIComponent(i < 0 ? pair : pair.slice(0, i)).trim();
    const v = i < 0 ? '' : decodeURIComponent(pair.slice(i + 1).replace(/\+/g, '%20')).trim();
    out.push([k, v]);
  }
  return out;
}

export interface PaynowInitResult {
  ok: boolean;
  browserUrl?: string;
  pollUrl?: string;
  error?: string;
}

// Creates a Paynow transaction and returns the hosted-checkout URL the
// buyer is redirected to, plus the poll URL we store for verification.
export async function paynowInitiate(opts: {
  integrationId: string;
  integrationKey: string;
  reference: string;
  amountUsd: number;
  description: string;
  returnUrl: string;
  resultUrl: string;
  authEmail?: string;
}): Promise<PaynowInitResult> {
  const fields: Array<[string, string]> = [
    ['id', opts.integrationId],
    ['reference', opts.reference],
    ['amount', opts.amountUsd.toFixed(2)],
    ['additionalinfo', opts.description],
    ['returnurl', opts.returnUrl],
    ['resulturl', opts.resultUrl],
    ['status', 'Message'],
  ];
  if (opts.authEmail) fields.push(['authemail', opts.authEmail]);
  fields.push(['hash', await paynowHash(fields, opts.integrationKey)]);

  const res = await fetch(PAYNOW_INITIATE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: fields.map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v)).join('&'),
  });
  const text = await res.text();
  if (!res.ok) return { ok: false, error: 'Paynow HTTP ' + res.status + ': ' + text.slice(0, 200) };

  const parsed = parseUrlencoded(text);
  const get = (k: string) => parsed.find(([pk]) => pk.toLowerCase() === k)?.[1] ?? '';

  if (get('status').toLowerCase() !== 'ok') {
    return { ok: false, error: 'Paynow rejected the transaction: ' + (get('error') || text.slice(0, 200)) };
  }

  // Verify the response hash so a tampered/spoofed response can't hand the
  // buyer an attacker-controlled redirect URL.
  const expected = await paynowHash(parsed, opts.integrationKey);
  if (get('hash') !== expected) return { ok: false, error: 'Paynow response hash mismatch' };

  return { ok: true, browserUrl: get('browserurl'), pollUrl: get('pollurl') };
}

export interface PaynowStatusResult {
  ok: boolean;
  paid?: boolean;
  cancelled?: boolean;
  status?: string;
  paynowReference?: string;
  amount?: number;
  error?: string;
}

// Server-side transaction status check. This is the ONLY input trusted to
// activate a boost — the poll URL was returned by Paynow at initiation
// over TLS, and the polled body is hash-verified with the integration key.
export async function paynowPollStatus(pollUrl: string, integrationKey: string): Promise<PaynowStatusResult> {
  const res = await fetch(pollUrl, { method: 'POST' });
  const text = await res.text();
  if (!res.ok) return { ok: false, error: 'Paynow poll HTTP ' + res.status };

  const parsed = parseUrlencoded(text);
  const get = (k: string) => parsed.find(([pk]) => pk.toLowerCase() === k)?.[1] ?? '';

  const expected = await paynowHash(parsed, integrationKey);
  if (get('hash') !== expected) return { ok: false, error: 'Paynow poll hash mismatch' };

  const status = get('status');
  const lowered = status.toLowerCase();
  return {
    ok: true,
    status,
    // 'Paid' is the settled state for standard merchants; 'Awaiting
    // Delivery'/'Delivered' appear for merchants configured with delivery
    // confirmation — money has been collected in all three.
    paid: lowered === 'paid' || lowered === 'awaiting delivery' || lowered === 'delivered',
    cancelled: lowered === 'cancelled' || lowered === 'failed' || lowered === 'refunded' || lowered === 'disputed',
    paynowReference: get('paynowreference'),
    amount: parseFloat(get('amount') || '0'),
  };
}
