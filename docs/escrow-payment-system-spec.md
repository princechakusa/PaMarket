# Escrow + In-Person Collection Payment System — Design Spec

Section 3/4 of the original notification strategy (Payment Held in Escrow,
Collection Verification Code, Funds Released, Order Cancellation/Refund,
Safe Meetup Advice) all depend on this system existing. It doesn't yet —
this spec proposes what to build, grounded in what's actually already in
the codebase, not a generic escrow design.

## Current state (confirmed by investigation)

- **Paynow integration is collect-only.** `_shared/paynow.ts` implements
  `InitiateTransaction` (buyer pays PaMarket) and a poll/verify step. There
  is no disbursement/payout API wired up anywhere — money collected via
  Paynow lands in PaMarket's own merchant account, full stop.
- **`profiles.wallet_usd` is dead.** Explicitly called out in
  `billing_entitlement_enforcement_2026_07.sql`: it was the pre-Play-Billing
  purchase mechanism, superseded by Google Play Billing (Android) and direct
  Paynow checkout (website) for boosts/slots/job credits. It is not a live
  ledger and shouldn't be reused for escrow balances — that would resurrect
  a deprecated code path and conflate two unrelated balances.
- **`topup_requests` is a dormant, unused pattern.** Schema exists (manual
  EcoCash/OneMoney/bank top-up request, admin reviews and approves/rejects),
  but no client code references it — only QA/audit scripts touch it. It's
  never been wired into any UI. Its *shape* (user submits a manual money
  request → admin reviews → status flips) is exactly the pattern this spec
  reuses for seller payouts, since there's no automated disbursement API to
  build on top of.
- **No refund API confirmed.** Nothing in this repo shows a Paynow refund
  call. Zimbabwean payment gateways typically require refunds to be
  initiated from the merchant's own Paynow dashboard, not via API — treat
  this as a manual, admin-triggered step until proven otherwise.

## ⚠️ Not a coding question — flag before building

Holding buyer funds between payment and handoff is, in most jurisdictions,
a regulated activity (money transmission / escrow services), and Zimbabwe's
central bank (RBZ) has rules in this space. This is a business/legal
question for you or counsel to confirm, not something I can validate or
design around silently. The architecture below is written so the actual
custody period is as short as practical (funds move from Paynow → PaMarket
account → seller payout on OTP verification, no long-term float), but that
doesn't remove the need for a real compliance check before this goes live
with real money.

## Proposed architecture

### 1. `escrow_transactions`
```
id                    uuid pk
listing_id            uuid -> listings
buyer_id              uuid -> auth.users
seller_id             uuid -> auth.users
amount                numeric(12,2)      -- listing price at time of payment
platform_fee          numeric(12,2)      -- PaMarket's cut, held back from payout
currency              text
paynow_reference      text unique        -- ties to the Paynow transaction
status                text check in (
                        'pending_payment', -- Paynow checkout opened, awaiting webhook
                        'held',            -- payment confirmed, OTP/QR issued
                        'released',        -- seller verified code, payout credited
                        'refund_pending',  -- cancelled/no-show, awaiting manual refund
                        'refunded',        -- admin confirmed Paynow refund done
                        'expired'          -- held too long with no verification, auto -> refund_pending
                      )
verification_code     text               -- 6-digit OTP, shown to buyer
verification_expires_at timestamptz      -- e.g. held_at + 7 days
created_at / held_at / released_at / refunded_at   timestamptz
```

### 2. `profiles.payout_balance_usd` (new column, NOT wallet_usd)
Credited when an escrow transaction is released. Purely an internal ledger
number — no money has physically moved to the seller yet at that point.

### 3. `payout_requests` (mirrors the dormant `topup_requests` shape)
```
id, user_id, amount, method (ecocash/onemoney/bank), destination_details,
status ('pending','approved','rejected'), created_at, reviewed_at
```
Seller requests a withdrawal of their `payout_balance_usd`; an admin
manually sends the real money (EcoCash/OneMoney/bank transfer) outside the
app and marks the request approved, which deducts the ledger balance. This
is the same manual-review pattern `topup_requests` already established for
cash-in — reused here for cash-out, since there's no payout API to
automate against yet.

### 4. State machine
```
pending_payment --(Paynow webhook success)--> held
held --(seller enters buyer's OTP / scans QR)--> released
held --(no verification within window, OR either party cancels)--> refund_pending
refund_pending --(admin confirms manual Paynow refund)--> refunded
```

### 5. Key RPCs (security definer, following this repo's existing convention)
- `create_escrow_transaction(listing_id)` — buyer-initiated, opens Paynow
  checkout, inserts `pending_payment` row.
- (Paynow webhook, same shape as `paynow-check-payment`) → flips to `held`,
  generates `verification_code` (6-digit, random, single-use), fires the
  **Payment Held in Escrow** + **Collection Verification Code** +
  **Safe Meetup Advice** notifications from the original strategy — all
  three reuse the `scheduled_notifications` pipeline already built.
- `release_escrow_transaction(transaction_id, code)` — seller-called. Checks
  code matches, not expired, status = 'held', seller_id = auth.uid(). On
  success: status → 'released', credits `payout_balance_usd`, fires
  **Funds Released** notification.
- `cancel_escrow_transaction(transaction_id, reason)` — either party, before
  release only. Status → 'refund_pending', fires **Order
  Cancellation/Refund** notification to both.
- Poll job (same automation-runner tick) auto-expires `held` transactions
  past `verification_expires_at` → `refund_pending`.

### 6. In-app chat scam warning (Section 4)
Straightforward extension of the existing message pipeline: a keyword/regex
check (whatsapp, otp, external links, "pay outside the app") on
`messages.content` insert, firing a **Trust & Safety** push to the sender or
recipient. This piece doesn't depend on escrow existing and could be built
independently if you want it sooner.

## Open decisions I can't make for you

1. **Platform fee** — flat %, flat fee, or none at MVP?
2. **Refund/expiry window** — how many days after `held` before an
   unverified transaction auto-flips to `refund_pending`?
3. **Minimum listing price** eligible for escrow (skip it for very cheap
   items where a payment gateway fee doesn't make sense)?
4. **ID verification requirement** — require a verified profile before a
   user can buy/sell through escrow, given the in-person/cash-adjacent risk?

## Phased build plan

- **Phase A (buildable now):** schema above + state machine + manual admin
  refund/payout workflow (mirrors `topup_requests`) + all four notifications
  wired to `scheduled_notifications`. This is real, working escrow — just
  with a human in the loop for the two money-movement steps that have no
  API (refunds, payouts) rather than full automation.
- **Phase B:** automate refunds if a Paynow refund API turns out to exist
  (needs your Paynow merchant docs/account to confirm — not in this repo).
- **Phase C:** automate seller payouts via Paynow's bulk-payment/disbursement
  API if available, retiring the manual `payout_requests` review step.
