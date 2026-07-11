// paynow-create-payment — starts a Paynow checkout for a listing boost
// bought on the WEBSITE (the app uses Google Play Billing instead; see
// verify-play-purchase). Creates the transaction with Paynow server-side
// and returns the hosted-checkout URL to redirect the buyer to. The
// boost itself is only ever activated by paynow-check-payment after a
// hash-verified status poll says the money arrived — nothing in this
// function grants an entitlement.
//
// Call shape: POST { listingId: uuid, productId: 'boost_1day'|'boost_7day'|
//                    'boost_30day'|'job_boost_7day'|'job_boost_30day' }
// Auth: caller must be a signed-in user (their own JWT). The price is
// looked up server-side from _shared/paynow.ts — an amount in the request
// body would be ignored.
//
// Deploy:  supabase functions deploy paynow-create-payment
// Required Edge Function secrets:
//   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY (automatic)
//   PAYNOW_INTEGRATION_ID   (from the Paynow merchant dashboard)
//   PAYNOW_INTEGRATION_KEY  (from the Paynow merchant dashboard)

import { PAYNOW_BOOST_PRODUCTS, paynowInitiate } from '../_shared/paynow.ts';

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
    const listingId = body?.listingId;
    const productId = body?.productId;
    if (!listingId || !productId) return json({ error: 'listingId and productId are required' }, 400);

    const product = PAYNOW_BOOST_PRODUCTS[productId];
    if (!product) return json({ error: 'Unknown productId: ' + productId }, 400);

    const integrationId = Deno.env.get('PAYNOW_INTEGRATION_ID');
    const integrationKey = Deno.env.get('PAYNOW_INTEGRATION_KEY');
    if (!integrationId || !integrationKey) return json({ error: 'Payments are not configured yet' }, 503);

    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // Ownership + product/category pairing — same rules as
    // verify-play-purchase: the two boost families are priced differently,
    // so a job listing must use job_boost_* and a marketplace listing must
    // use boost_*.
    const listingRes = await db.from('listings').select('id, seller_id, category, title, status').eq('id', listingId).maybeSingle();
    if (listingRes.error || !listingRes.data) return json({ error: 'Listing not found' }, 404);
    if (listingRes.data.seller_id !== user.id) return json({ error: 'You do not own this listing' }, 403);
    if (listingRes.data.status !== 'active') return json({ error: 'Only active listings can be boosted' }, 400);
    const isJobListing = listingRes.data.category === 'jobs';
    if (product.family === 'job_boost' && !isJobListing) return json({ error: 'Job boost products can only be applied to job listings' }, 400);
    if (product.family === 'boost' && isJobListing) return json({ error: 'Use a job boost product to boost a job listing' }, 400);

    // Ledger row first (status 'created') so there's a durable record even
    // if the Paynow call fails mid-flight. The reference doubles as our
    // idempotency handle and what shows on the merchant dashboard.
    const insertRes = await db.from('paynow_payments').insert({
      user_id: user.id,
      listing_id: listingId,
      product_id: productId,
      amount_usd: product.amountUsd,
      reference: 'PMBOOST-' + crypto.randomUUID(),
      status: 'created',
    }).select('id, reference').single();
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
      description: 'PaMarket boost (' + product.days + ' day' + (product.days > 1 ? 's' : '') + '): ' + String(listingRes.data.title || '').slice(0, 60),
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

    return json({ ok: true, paymentId, redirectUrl: init.browserUrl, amountUsd: product.amountUsd, days: product.days });
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
