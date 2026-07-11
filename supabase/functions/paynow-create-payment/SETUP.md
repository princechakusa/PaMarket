# Paynow boost checkout — deployment

The website's "Boost this listing" flow (detail page → Paynow hosted
checkout → boost-return page). Prices match the app's Google Play
products: $2/1 day, $10/7 days, $30/30 days ($8 and $20 for job boosts).

## 1. Run the migration

In the Supabase SQL editor, run:

    supabase/migrations/add_paynow_boosts.sql

Creates `paynow_payments` (ledger, own-read RLS, no client writes) and
`activate_paynow_boost` (service-role-only RPC, stacks `featured_until`).

## 2. Set the Paynow secrets

From the Paynow merchant dashboard (paynow.co.zw → your integration —
use a **web** integration; make sure USD is enabled on it):

    supabase secrets set PAYNOW_INTEGRATION_ID=XXXXX
    supabase secrets set PAYNOW_INTEGRATION_KEY=XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX

## 3. Deploy both functions

    supabase functions deploy paynow-create-payment
    supabase functions deploy paynow-check-payment --no-verify-jwt

`--no-verify-jwt` is required on paynow-check-payment because Paynow's
server POSTs the payment result to it without a Supabase JWT. That
endpoint never trusts the POST body — it re-polls Paynow's transaction
status URL and verifies the hash with the integration key before
activating anything.

## 4. Test with a small payment

1. Sign in on the website as a seller, open one of your own listings.
2. Click "Boost this listing" → pick "1 day — $2" → complete the
   EcoCash/card payment on the Paynow page.
3. You land on /boost-return which confirms within a few seconds; the
   listing shows a FEATURED badge and ranks first in its category.
4. Check the `paynow_payments` row is `consumed` and
   `listings.featured_until` moved forward.

Paynow also offers a sandbox: set the integration to test mode in the
merchant dashboard and pay with the test EcoCash numbers from their
docs — the flow is identical.

## Notes

- Refunds: there is no automatic refund webhook (Paynow has no RTDN
  equivalent). If you refund a payment in the Paynow dashboard, revoke
  the boost manually (set `listings.featured_until` back).
- The legal pages (app Terms in www/js/auth.js §11, terms.html) say paid
  features are sold "exclusively through Google Play Billing" — update
  that wording to mention Paynow for website purchases.
