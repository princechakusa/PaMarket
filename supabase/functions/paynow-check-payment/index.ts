// paynow-check-payment — verifies a Paynow boost payment and activates
// the boost. Two callers hit this endpoint:
//
//   1. Paynow itself (the transaction's resulturl): a server-to-server
//      POST when the payment status changes. Carries no Supabase JWT,
//      which is why this function must be deployed with --no-verify-jwt.
//   2. The buyer's browser (boost-return page): polls with the user's
//      own JWT + JSON { paymentId } until the payment settles.
//
// NEITHER caller is trusted. In both cases the ONLY thing that can mark
// a payment 'paid' is a fresh server-side fetch of the transaction's
// stored poll URL, hash-verified with the integration key, with the
// amount checked against the ledger row. Then activate_paynow_boost
// (service-role-only RPC) stacks featured_until — the same activation
// path and stacking rule as the app's Play Billing boosts.
//
// Deploy:  supabase functions deploy paynow-check-payment --no-verify-jwt
// Required Edge Function secrets:
//   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY (automatic)
//   PAYNOW_INTEGRATION_KEY  (from the Paynow merchant dashboard)

import { paynowPollStatus } from '../_shared/paynow.ts';

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

    // Payment id comes from either the resulturl query string (Paynow) or
    // the JSON body (buyer polling).
    const url = new URL(req.url);
    let paymentId = url.searchParams.get('payment') || '';
    let callerJwt = '';
    const authHeader = req.headers.get('Authorization') || '';
    if (authHeader.startsWith('Bearer ')) callerJwt = authHeader.slice(7).trim();

    if (!paymentId && req.method === 'POST') {
      const contentType = req.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const body = await req.json().catch(() => ({}));
        paymentId = body?.paymentId || '';
      }
      // Paynow's own POST body is urlencoded transaction fields; the id is
      // already in the query string, and the body is deliberately ignored —
      // status truth comes from the poll below, never from a POSTed body.
    }
    if (!paymentId) return json({ error: 'payment id is required' }, 400);

    const integrationKey = Deno.env.get('PAYNOW_INTEGRATION_KEY');
    if (!integrationKey) return json({ error: 'Payments are not configured yet' }, 503);

    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const payRes = await db.from('paynow_payments')
      .select('id, user_id, listing_id, product_id, amount_usd, poll_url, status, expiry_time')
      .eq('id', paymentId).maybeSingle();
    if (payRes.error || !payRes.data) return json({ error: 'Payment not found' }, 404);
    const payment = payRes.data;

    // When the buyer polls (JWT present), the row must be theirs. Paynow's
    // server POST carries no JWT — that path can only ever cause a
    // hash-verified poll + activation, so it needs no identity.
    if (callerJwt) {
      const authClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
        global: { headers: { Authorization: authHeader } },
      });
      const authResult = await authClient.auth.getUser(callerJwt);
      if (authResult.error || !authResult.data?.user) return json({ error: 'Invalid token' }, 401);
      if (authResult.data.user.id !== payment.user_id) return json({ error: 'This payment belongs to a different account' }, 403);
    } else if (req.method !== 'POST') {
      // Unauthenticated GET probes get nothing.
      return json({ error: 'Missing authorization' }, 401);
    }

    // Fast paths — already settled one way or the other.
    if (payment.status === 'consumed') {
      return json({ ok: true, state: 'boosted', until: payment.expiry_time });
    }
    if (payment.status === 'failed' || payment.status === 'cancelled') {
      return json({ ok: true, state: payment.status });
    }
    if (!payment.poll_url) return json({ error: 'Payment has no verification URL' }, 500);

    // The moment of truth: ask Paynow, verify the hash, check the amount.
    const poll = await paynowPollStatus(payment.poll_url, integrationKey);
    if (!poll.ok) {
      console.error('paynow-check-payment: poll failed for', paymentId, '—', poll.error);
      return json({ ok: true, state: 'pending', detail: 'Could not verify with Paynow yet' });
    }

    if (poll.cancelled) {
      const upd = await db.from('paynow_payments')
        .update({ status: 'cancelled', paynow_reference: poll.paynowReference || null, verification_error: 'Paynow status: ' + poll.status })
        .eq('id', paymentId).in('status', ['created', 'paid']);
      if (upd.error) console.error('paynow-check-payment: could not record cancellation:', upd.error.message);
      return json({ ok: true, state: 'cancelled' });
    }

    if (!poll.paid) {
      // Created / Sent / etc — buyer may still be completing the payment.
      return json({ ok: true, state: 'pending', paynowStatus: poll.status });
    }

    // Underpayment guard (tampered initiation would already fail the
    // response-hash check, but belt-and-braces against partial payments).
    if ((poll.amount || 0) + 0.005 < Number(payment.amount_usd)) {
      const upd = await db.from('paynow_payments')
        .update({ status: 'failed', verification_error: 'Amount mismatch: paid ' + poll.amount + ', expected ' + payment.amount_usd })
        .eq('id', paymentId);
      if (upd.error) console.error('paynow-check-payment: could not record amount mismatch:', upd.error.message);
      return json({ ok: true, state: 'failed', detail: 'Payment amount did not match' });
    }

    // Mark paid (only from 'created' — a concurrent call that already moved
    // it is harmless because activate_paynow_boost is idempotent).
    const paidRes = await db.from('paynow_payments')
      .update({ status: 'paid', paid_at: new Date().toISOString(), paynow_reference: poll.paynowReference || null })
      .eq('id', paymentId).in('status', ['created']);
    if (paidRes.error) {
      console.error('paynow-check-payment: could not mark paid:', paidRes.error.message);
      return json({ error: 'Payment verified but could not be recorded' }, 500);
    }

    const activateRes = await db.rpc('activate_paynow_boost', { p_payment_id: paymentId });
    if (activateRes.error || !activateRes.data?.ok) {
      // Money confirmed but boost not applied — loud log so it's findable;
      // the next poll (buyer page retries, and Paynow re-POSTs) will land in
      // the 'paid' state and retry activation.
      console.error('[BILLING_ALERT] paynow-check-payment: paid-but-activation-failed:', activateRes.error?.message || activateRes.data?.msg);
      return json({ error: 'Payment received but boost activation failed — it will be retried' }, 500);
    }

    return json({ ok: true, state: 'boosted', until: activateRes.data.until, days: activateRes.data.days });
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
