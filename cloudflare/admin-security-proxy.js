// Cloudflare edge observer for the existing Supabase security-event writer.
// Location comes only from request.cf and is an approximate IP lookup.
const ALLOWED_ORIGINS = new Set([
  'https://pamarket-admin-react.pages.dev',
  'https://main.pamarket-admin-react.pages.dev',
]);
const UPSTREAM = 'https://gxgytumhknmnwspxjzxw.supabase.co/functions/v1/record-security-event';

addEventListener('fetch', (event) => event.respondWith(handle(event.request)));

function headers(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
    'Vary': 'Origin',
    'Cache-Control': 'no-store',
  };
}

function encode(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function handle(request) {
  const origin = request.headers.get('origin') || '';
  if (!ALLOWED_ORIGINS.has(origin)) return new Response('forbidden', { status: 403 });
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: headers(origin) });
  if (request.method !== 'POST') return new Response('method_not_allowed', { status: 405, headers: headers(origin) });

  const body = await request.text();
  if (body.length > 4096) return new Response('payload_too_large', { status: 413, headers: headers(origin) });

  const cf = request.cf || {};
  const ip = request.headers.get('cf-connecting-ip');
  const latitude = Number(cf.latitude);
  const longitude = Number(cf.longitude);
  const geo = {
    ip: ip || null,
    country: typeof cf.country === 'string' ? cf.country.slice(0, 2) : null,
    region: typeof cf.region === 'string' ? cf.region.slice(0, 100) : null,
    city: typeof cf.city === 'string' ? cf.city.slice(0, 100) : null,
    latitude: Number.isFinite(latitude) && Math.abs(latitude) <= 90 ? latitude : null,
    longitude: Number.isFinite(longitude) && Math.abs(longitude) <= 180 ? longitude : null,
    observed_at: new Date().toISOString(),
    source: 'cloudflare_request_cf',
  };
  const payload = new TextEncoder().encode(JSON.stringify(geo));
  const key = await crypto.subtle.importKey('jwk', JSON.parse(CF_GEO_SIGNING_KEY), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, payload);
  const forwardHeaders = new Headers({
    'content-type': 'application/json',
    'x-pamarket-geo-payload': encode(payload),
    'x-pamarket-geo-signature': encode(signature),
  });
  for (const name of ['authorization', 'apikey', 'user-agent']) {
    const value = request.headers.get(name);
    if (value) forwardHeaders.set(name, value);
  }
  const upstream = await fetch(UPSTREAM, { method: 'POST', headers: forwardHeaders, body, redirect: 'manual' });
  if (upstream.status >= 300 && upstream.status < 400) return new Response('upstream_redirect_rejected', { status: 502, headers: headers(origin) });
  return new Response(upstream.body, {
    status: upstream.status,
    headers: { ...headers(origin), 'Content-Type': upstream.headers.get('content-type') || 'application/json' },
  });
}
