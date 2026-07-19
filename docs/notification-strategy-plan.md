# PaMarket — Event-Driven Notification Strategy

Complete push-notification strategy for PaMarket's escrow-backed,
in-person-collection marketplace. There is no shipping/delivery in this
app — every payment flow ends in a face-to-face handoff, so the
transactional and safety notifications below are built around **meetup
verification** (OTP/QR) rather than tracking numbers or delivery ETAs.

Categories referenced by `{category}`: Electronics, Vehicles, Kids, Pets,
Fashion, Rooms, Jobs, Agriculture, Services, Property, Furniture, Other.

Legend for every entry: **Trigger Event**, **Target Audience**, **Push
Title**, **Push Body**.

---

## 1. Buyer Journey Notifications

### Saved Search Matches
- **Trigger Event:** A new listing is created (or an existing listing's `status` flips to `active` post-moderation) and its category/attributes/price/location match one or more of the buyer's stored `saved_searches` filter rows. Fired from the `listings` insert/update webhook → matcher job → push queue.
- **Target Audience:** Buyer
- **Push Title:** 🔎 New {category} match for you!
- **Push Body:** "{item_name}" just listed for {amount} in {city} — matches your saved search "{search_name}". Tap to view before it's gone.

### Price Drops
- **Trigger Event:** `UPDATE` on `listings.price` where new price < old price, and the listing's ID exists in the buyer's `favourites`/watchlist table.
- **Target Audience:** Buyer
- **Push Title:** 💸 Price drop on your watchlist!
- **Push Body:** The seller just dropped "{item_name}" from {old_amount} to {amount} ({discount_percent}% off). Grab it before someone else does.

### Real-time Chat Alerts
- **Trigger Event:** A new row is inserted into `messages` where `recipient_id` = buyer AND the buyer's presence/session state is offline (no active socket/heartbeat within the last N minutes).
- **Target Audience:** Buyer
- **Push Title:** 💬 {seller_name} sent you a message
- **Push Body:** About "{item_name}": "{message_preview}" — reply now to secure it.

### Personalized Recommendations
- **Trigger Event:** Scheduled batch job (e.g. daily) reads the buyer's last 7 days of `viewed_listings`/`browse_history` events, ranks categories by view frequency, and selects fresh active listings in the top category not yet viewed by the buyer.
- **Target Audience:** Buyer
- **Push Title:** ✨ More {category} picks for you
- **Push Body:** Based on what you've been browsing, check out "{item_name}" for {amount} in {city}.

---

## 2. Seller Journey Notifications

### New Lead/Offer Alerts
- **Trigger Event:** `INSERT` on `messages` (chat lead), `INSERT` on `job_applications` (for Jobs category listings), or `INSERT` on `offers`/`escrow_transactions` (a buyer submits a payment/offer against the listing) — any of the three fires this event, routed by type.
- **Target Audience:** Seller
- **Push Title:** 📩 New interest in your {category} ad!
- **Push Body:** A buyer sent {offer_type} for "{item_name}" — {amount}. Reply fast, quick responses sell faster.

### Listing Approval/Rejection Status
- **Trigger Event:** Moderation queue action changes `listings.status` from `pending` to `active` (approved) or `rejected`, either by an admin action or an automated moderation rule engine.
- **Target Audience:** Seller
- **Push Title:** ✅ Your ad is live! / ⚠️ Ad needs a fix
- **Push Body (approved):** "{item_name}" is now visible to buyers in {category}. Good luck with the sale!
- **Push Body (rejected):** "{item_name}" wasn't approved: {rejection_reason}. Edit and resubmit in a few taps.

### Listing Expiry Warnings
- **Trigger Event:** Scheduled cron scans `listings` where `expires_at` is within the next 3 days (e.g. T-3 and T-1 reminders) and `status = 'active'`.
- **Target Audience:** Seller
- **Push Title:** ⏳ Your ad expires in {days_left} days
- **Push Body:** "{item_name}" goes offline on {expiry_date}. Renew now to stay visible to buyers in {category}.

### Stale Listing Prompts
- **Trigger Event:** Scheduled cron checks listings where `created_at` ≤ now − 7 days AND `views = 0` (or below a low-views threshold) AND `status = 'active'`.
- **Target Audience:** Seller
- **Push Title:** 👀 Zero views on "{item_name}"?
- **Push Body:** Your {category} ad hasn't been seen yet. Try better photos, a sharper price, or Bump Up to get in front of buyers.

---

## 3. Transactional & In-Person Collection Notifications (Secure Escrow Hold)

### Payment Held in Escrow
- **Trigger Event:** Payment gateway webhook confirms successful charge/hold (e.g. `payment_intent.succeeded` / provider equivalent) and the backend writes `escrow_transactions.status = 'held'`.
- **Target Audience:** Buyer and Seller (two variants)
- **Push Title (Buyer):** 🔒 Your payment is safe with us
- **Push Body (Buyer):** {amount} for "{item_name}" is held securely in escrow. Now arrange a time to meet {seller_name} and collect your item.
- **Push Title (Seller):** 🔒 Item reserved — payment secured
- **Push Body (Seller):** {amount} for "{item_name}" is held in escrow, buyer is committed. Coordinate a meetup with {buyer_name} to hand it over.

### Collection Verification Code
- **Trigger Event:** Same webhook that confirms the escrow hold also generates a unique OTP/QR payload tied to that `escrow_transactions.id`, delivered right after the "Payment Held" notification (or on-demand when buyer opens the transaction).
- **Target Audience:** Buyer
- **Push Title:** 🔑 Your collection code is ready
- **Push Body:** Show code {verification_code} (or your QR) to {seller_name} only after you've inspected "{item_name}" in person. This releases your payment.

### Funds Released / Payout Successful
- **Trigger Event:** Seller app scans the buyer's QR or submits the OTP → backend validates it against `escrow_transactions` → gateway webhook confirms transfer-out → `escrow_transactions.status = 'released'` and seller wallet balance updates.
- **Target Audience:** Seller
- **Push Title:** 🎉 Cash received — sale complete!
- **Push Body:** {amount} for "{item_name}" just landed in your PaMarket wallet. Nice one!

### Order Cancellation / Refund
- **Trigger Event:** Either party triggers a cancellation (no-show past a meetup deadline, or buyer rejects the item at handoff and taps "Cancel") → backend flips `escrow_transactions.status = 'refunded'` → gateway webhook confirms the reversal.
- **Target Audience:** Buyer and Seller (two variants)
- **Push Title (Buyer):** ↩️ Refund confirmed
- **Push Body (Buyer):** Your {amount} for "{item_name}" has been refunded to your wallet since the meetup didn't go through.
- **Push Title (Seller):** ↩️ Transaction cancelled
- **Push Body (Seller):** The hold on "{item_name}" ({amount}) was released back to the buyer. Your listing is active again.

---

## 4. Trust, Safety, & In-Person Meetup Security

### Safe Meetup Advice
- **Trigger Event:** Fires automatically right after the "Payment Held in Escrow" event (same webhook chain), sent once per transaction to both parties.
- **Target Audience:** Buyer and Seller
- **Push Title:** 🛡️ Meet safely, meet smart
- **Push Body:** Before collecting "{item_name}", pick a busy public spot — a mall, mainstreet, or metro station. Avoid private homes and never go alone.

### In-App Chat Scam Warning
- **Trigger Event:** Real-time regex/keyword scan on `messages.content` as each message is inserted, matching patterns like "whatsapp", "otp", phone-number-only handoffs, or external URLs — or a detected attempt to solicit payment outside the in-app escrow flow.
- **Target Audience:** Buyer and/or Seller (whichever sent or is about to receive the flagged message)
- **Push Title:** 🚨 Stay inside the app to stay protected
- **Push Body:** We spotted a request to move this chat off PaMarket or skip secure payment. Only pay through the app — it's the only way your money is protected.

### Identity Verification Updates
- **Trigger Event:** Admin/automated ID-check pipeline updates `profiles.verification_status` to `verified` or `rejected` after document review.
- **Target Audience:** Buyer or Seller (whoever submitted verification)
- **Push Title:** 🪪 Verification update
- **Push Body (verified):** You're verified! Your profile now shows a trust badge — buyers and sellers can meet you with confidence.
- **Push Body (rejected):** We couldn't confirm your ID: {rejection_reason}. Resubmit clear documents to unlock the verified badge before your next meetup.

---

## 5. Monetization & Premium Feature Upsells

### Performance Milestones
- **Trigger Event:** `listings.views` counter crosses a defined threshold (e.g. 50/100/500 views) while `boost = false`, detected via trigger or scheduled aggregation job.
- **Target Audience:** Seller
- **Push Title:** 🔥 Your ad is getting noticed!
- **Push Body:** "{item_name}" has {views_count} views. Bump it to the top or make it Featured to turn views into offers.

### Seasonal / Promotional Campaigns
- **Trigger Event:** Admin-scheduled marketing campaign activation (e.g. holiday date range) targeting all sellers, or sellers with an active/expired listing in a promoted category.
- **Target Audience:** Seller (and prospective sellers)
- **Push Title:** 🎁 {campaign_name} deal — save on Featured ads!
- **Push Body:** Get {discount_percent}% off Bump Up & Featured packages until {promo_end_date}. Make your {category} ad impossible to miss.
