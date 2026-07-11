// paynow-create-payment — starts a Paynow checkout for a paid feature
// bought on the WEBSITE (the app uses Google Play Billing instead; see
// verify-play-purchase). Handles three product families: listing boosts,
// shop featured-slot packs, and job-posting credit packs. Creates the
// transaction with Paynow server-side and returns the hosted-checkout URL.
// The entitlement is only ever granted by paynow-check-payment after a
// hash-verified status poll says the money arrived — nothing here grants
// anything.
//
// Call shape:
//   boost:      POST { listingId: uuid, productId: 'boost_1day'|'boost_7day'|'boost_30day'|'job_boost_7day'|'job_boost_30day' }
//   slot pack:  POST { businessId: uuid, productId: 'featured_slot_pack_1'|'featured_slot_pack_3' }
//   job credit: POST { productId: 'job_credit_pack_1'|'job_credit_pack_5' }
// Auth: caller must be a signed-in user (their own JWT). The price is
// looked up server-side from _shared/paynow.ts — an amount in the request
// body would be ignored.
//
// Deploy:  supabase functions deploy paynow-create-payment
// Required Edge Function secrets:
//   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY (automatic)
//   PAYNOW_INTEGRATION_ID   (from the Paynow merchant dashboard)
//   PAYNOW_INTEGRATION_KEY  (from the Paynow merchant dashboard)

import { PAYNOW_PRODUCTS, paynowInitiate } from '../_shared/paynow.ts';

const SITE = 'https://pamarketzw.com';

const ALLOWED_ORIGINS = new Set([
  'https://pamarketzw.com',
  'https://www.pamarketzw.com',
  'http://127.0.0.1:5500',
  'http://localhost:5500',
]);

function corsHeaders(req: Request) {
  const origin = req.headers.get('origin') ?? '';
  const allowed = ALLOWED_ORIGINS.has(origin) ? origin : 'https://pamarketzw.com';
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Vary': 'Origin',
  };
}

Deno.serve(async (req) => {
  const cors = corsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const json = (d: unknown, s?: number) =>
    new Response(JSON.stringify(d), { status: s || 200, headers: { ...cors, 'Content-Type': 'application/json' } });

  try {
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');

    const authHeader = req.headers.get('Authorization') || '';
    const userJwt = authHeader.replace('Bearer ', '').trim();
    if (!userJwt) return json({ error: 'Missing authorization' }, 401);

    const authClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const authResult = await authClient.auth.getUser(userJwt);
    if (authResult.error || !authResult.data?.user) return json({ error: 'Invalid token' }, 401);
    const user = authResult.data.user;

    const body = await req.json();
    const productId = body?.productId;
    const listingId = body?.listingId;
    const businessId = body?.businessId;
    if (!productId) return json({ error: 'productId is required' }, 400);

    const product = PAYNOW_PRODUCTS[productId];
    if (!product) return json({ error: 'Unknown productId: ' + productId }, 400);

    const integrationId = Deno.env.get('PAYNOW_INTEGRATION_ID');
    const integrationKey = Deno.env.get('PAYNOW_INTEGRATION_KEY');
    if (!integrationId || !integrationKey) return json({ error: 'Payments are not configured yet' }, 503);

    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // Per-kind ownership validation + a human description for the Paynow page.
    const ledger: Record<string, unknown> = {
      user_id: user.id,
      product_id: productId,
      amount_usd: product.amountUsd,
      reference: 'PM-' + crypto.randomUUID(),
      status: 'created',
    };
    let description = 'PaMarket';

    if (product.kind === 'boost') {
      if (!listingId) return json({ error: 'listingId is required for a boost' }, 400);
      const listingRes = await db.from('listings').select('id, seller_id, category, title, status').eq('id', listingId).maybeSingle();
      if (listingRes.error || !listingRes.data) return json({ error: 'Listing not found' }, 404);
      if (listingRes.data.seller_id !== user.id) return json({ error: 'You do not own this listing' }, 403);
      if (listingRes.data.status !== 'active') return json({ error: 'Only active listings can be boosted' }, 400);
      const isJobListing = listingRes.data.category === 'jobs';
      if (product.boostFamily === 'job_boost' && !isJobListing) return json({ error: 'Job boost products can only be applied to job listings' }, 400);
      if (product.boostFamily === 'boost' && isJobListing) return json({ error: 'Use a job boost product to boost a job listing' }, 400);
      ledger.listing_id = listingId;
      description = 'PaMarket boost (' + product.days + ' day' + ((product.days || 0) > 1 ? 's' : '') + '): ' + String(listingRes.data.title || '').slice(0, 50);
    } else if (product.kind === 'slot_pack') {
      if (!businessId) return json({ error: 'businessId is required for a featured-slot pack' }, 400);
      const bizRes = await db.from('businesses').select('id, owner_user_id, name').eq('id', businessId).maybeSingle();
      if (bizRes.error || !bizRes.data) return json({ error: 'Business not found' }, 404);
      if (bizRes.data.owner_user_id !== user.id) return json({ error: 'You do not own this business' }, 403);
      ledger.business_id = businessId;
      description = 'PaMarket featured slots (+' + product.extraSlots + '): ' + String(bizRes.data.name || '').slice(0, 50);
    } else if (product.kind === 'job_credit') {
      // No target entity — the credits attach to the buyer's account.
      description = 'PaMarket job credits (' + product.credits + ' post' + ((product.credits || 0) > 1 ? 's' : '') + ')';
    }

    // Ledger row first (status 'created') so there's a durable record even
    // if the Paynow call fails mid-flight. The reference doubles as our
    // idempotency handle and what shows on the merchant dashboard.
    const insertRes = await db.from('paynow_payments').insert(ledger).select('id, reference').single();
    if (insertRes.error || !insertRes.data) {
      return json({ error: 'Could not record payment: ' + insertRes.error?.message }, 500);
    }
    const paymentId = insertRes.data.id;

    const functionsBase = Deno.env.get('SUPABASE_URL')! + '/functions/v1';
    const init = await paynowInitiate({
      integrationId,
      integrationKey,
      reference: insertRes.data.reference,
      amountUsd: product.amountUsd,
      description,
      returnUrl: SITE + '/boost-return?payment=' + paymentId,
      resultUrl: functionsBase + '/paynow-check-payment?payment=' + paymentId,
      authEmail: user.email || undefined,
    });

    if (!init.ok || !init.browserUrl || !init.pollUrl) {
      const failRes = await db.from('paynow_payments').update({ status: 'failed', verification_error: init.error || 'Paynow initiation failed' }).eq('id', paymentId);
      if (failRes.error) console.error('paynow-create-payment: could not record initiation failure:', failRes.error.message);
      return json({ error: init.error || 'Could not start the payment' }, 502);
    }

    const saveRes = await db.from('paynow_payments').update({ poll_url: init.pollUrl }).eq('id', paymentId);
    if (saveRes.error) {
      // Without the poll URL the payment can never be verified — fail
      // closed before the buyer is redirected and charged.
      console.error('paynow-create-payment: could not save poll_url:', saveRes.error.message);
      return json({ error: 'Could not record the payment session. You have not been charged — please try again.' }, 500);
    }

    return json({ ok: true, paymentId, redirectUrl: init.browserUrl, amountUsd: product.amountUsd });
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
