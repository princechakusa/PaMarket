# Phone notifications for chat messages

This makes a message show on the recipient's **phone** (lock screen / tray) even
when the PaMarket app is in the background or fully closed.

The app already:
- captures each user's FCM `push_token` (saved to `profiles.push_token`), and
- shows the system notification automatically when an FCM push arrives.

The only missing piece is **sending** that push when a message is created. The
`notify-message` Edge Function does that, triggered by a database webhook.

## 1. Prerequisites (one-time)
- A Firebase project with Cloud Messaging enabled (you already have
  `google-services.json` in the Android app).
- A Firebase **service account** JSON (Firebase Console → Project Settings →
  Service accounts → Generate new private key).

## 2. Set the Edge Function secrets
In the Supabase dashboard → Project Settings → Edge Functions → Secrets (or CLI):

```bash
supabase secrets set FIREBASE_SERVICE_ACCOUNT='{...paste the whole service account JSON...}'
supabase secrets set NOTIFY_WEBHOOK_SECRET='choose-a-long-random-string'
```
(`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are provided automatically.)

## 3. Deploy the function
```bash
supabase functions deploy notify-message --no-verify-jwt
```
`--no-verify-jwt` is required because the database webhook calls it without a
user token; the function instead checks `NOTIFY_WEBHOOK_SECRET`.

## 4. Create the database webhook
Supabase dashboard → Database → **Webhooks** → Create:
- **Table:** `public.messages`
- **Events:** `INSERT`
- **Type:** Supabase Edge Function → `notify-message`
- **HTTP Headers:** add `x-webhook-secret` = the same value as `NOTIFY_WEBHOOK_SECRET`

Save. Now every new message fires the webhook, which pushes to the recipient's
phone.

## 5. Test
1. Build/install the app on two devices and sign in as two different users
   (so each saves a `push_token`).
2. Background or close the app on device B.
3. Send a message from device A → device B should get a phone notification.

### Notes
- If nothing arrives: check the function logs (Dashboard → Edge Functions →
  notify-message → Logs). Common causes: `FIREBASE_SERVICE_ACCOUNT` missing,
  the recipient has no `push_token` yet (open the app once while signed in to
  register), or the webhook secret header doesn't match.
- Offers and photos are previewed as "💰 Sent an offer" / "📷 Photo".
- This is **backend only** — no app rebuild is needed for it to start working.
