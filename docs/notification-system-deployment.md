# Notification System — Deployment Status & Runbook

Tracks what's built vs. what's actually live for the marketplace
notification system (see `docs/notification-strategy-plan.md` for the
original design). Read this first if you're picking up deployment work
on this — it tells you exactly what's left.

## What was built

All delivery reuses the existing pipeline: a trigger or poll job inserts a
row into `public.scheduled_notifications` → `automation-runner` claims it →
`send-push` sends the FCM/web push and writes the in-app bell entry. No new
delivery infrastructure — only the triggers/jobs that decide *when* to fire,
plus three migrations and one edge function edit:

| File | Adds |
|---|---|
| `supabase/migrations/marketplace_notifications_phase1.sql` | Listing approved/rejected/flagged, price drop, saved-search match, listing expiry warning, stale-listing prompt, view-count milestone |
| `supabase/migrations/marketplace_notifications_phase2.sql` | Job application push (employer lead + candidate shortlisted/declined), `viewed_listings` history table, personalized recommendations poll job |
| `supabase/migrations/marketplace_notifications_phase3.sql` | Real-time in-app chat scam warning (WhatsApp/Telegram redirects, OTP requests, external links, pay-before-meetup phrasing) |
| `supabase/migrations/marketplace_notifications_phase4.sql` | Proactive, Dubizzle-style re-engagement pushes sent even when the user isn't in the app: shop new-arrivals (viewed a business, it posted new listings since), category digest (browsed a category repeatedly with no saved search), verification nudge. Shared daily engagement cap (max 2/24h) across all proactive types so this never feels like spam. |
| `supabase/functions/automation-runner/index.ts` | Calls the new poll-driven jobs (`run_listing_expiry_warnings`, `run_stale_listing_prompts`, `run_view_milestones`, `run_personalized_recommendations`, `run_shop_new_arrivals`, `run_category_digest`, `run_verification_nudge`) each tick |
| `www/js/business-profile.js` | `pages.BusinessShop` calls the new `increment_business_view` RPC once per session per shop, logging interest for the shop-new-arrivals job |
| `www/js/notifications.js` | Icon/color/label mapping for all the new notification `type` values, so the in-app bell list renders them properly instead of falling back to defaults |

Out of scope, on purpose: nothing related to escrow/buyer-seller in-app
payments (Payment Held, Collection Code, Funds Released, Refund) — this app
has no such payment feature (only platform-fee payments for boosts/ads via
Google Play Billing and Paynow), so those notification types don't apply.

## Deployment checklist

- [x] `marketplace_notifications_phase1.sql` run in Supabase SQL Editor
- [x] `marketplace_notifications_phase2.sql` run in Supabase SQL Editor
- [x] `marketplace_notifications_phase3.sql` run in Supabase SQL Editor
- [ ] `marketplace_notifications_phase4.sql` run in Supabase SQL Editor (proactive
      re-engagement: shop new arrivals, category digest, verification nudge —
      assumes phase1-3 plus `schema/profiles.sql`, `schema/businesses.sql`,
      `schema/conversations.sql`, `schema/applications.sql`, `schema/saved_searches.sql`
      are already applied)
- [ ] `automation-runner` redeployed as an Edge Function (after phase4 lands, so
      the new RPCs it calls actually exist) (it did not exist in
      this project before this work — only its `AUTOMATION_SECRET` secret
      did). Deploy via:
      ```bash
      supabase link --project-ref <project-ref>
      supabase functions deploy automation-runner
      ```
      or via Dashboard → Edge Functions → create new function named exactly
      `automation-runner`, paste in `supabase/functions/automation-runner/index.ts`, deploy.
- [ ] `automation-runner` scheduled to run periodically — nothing below the
      SQL layer fires on its own; every notification type sits queued in
      `scheduled_notifications` until this runs. Recommended: pg_cron +
      pg_net inside Supabase (Dashboard → Database → Extensions → enable
      both), then in the SQL Editor:
      ```sql
      select cron.schedule(
        'automation-runner-tick',
        '*/15 * * * *',
        $cron$
        select net.http_post(
          url := 'https://<project-ref>.supabase.co/functions/v1/automation-runner',
          headers := jsonb_build_object('Content-Type','application/json','x-automation-secret','<AUTOMATION_SECRET value>'),
          body := '{}'::jsonb
        );
        $cron$
      );
      ```
- [ ] `notification_push_dispatch_trigger.sql` run in Supabase SQL Editor —
      fixes ~20 notification types (rental listing/company decisions,
      business verification/suspension, new reviews, new leads, job
      application status changes, admin/moderation notices) that were
      inserted straight into `notifications` by their own triggers and never
      pushed at all, so they only ever showed in the in-app Notifications
      screen, never the Android tray. Adds a `push_sent` column and a single
      AFTER INSERT trigger that calls the new `dispatch-notification-push`
      function for any row not already pushed (send-push's own inserts are
      flagged `push_sent: true` so they're never double-sent).
- [ ] `dispatch-notification-push` deployed as an Edge Function, with its
      `AUTOMATION_SECRET` secret set to the **same value** already configured
      for `automation-runner`:
      ```bash
      supabase functions deploy dispatch-notification-push
      ```

## Verifying it's actually live

```sql
-- cron job registered?
select * from cron.job;

-- cron actually firing?
select * from cron.job_run_details order by start_time desc limit 5;

-- automation-runner running clean, and what it's doing each tick?
select * from job_runs order by created_at desc limit 5;
-- meta should show counts like notifications_sent, listings_expiry_warned,
-- listings_stale_prompted, listings_milestone_notified, users_recommended
```

End-to-end functional check: approve a pending listing, or send a chat
message containing "whatsapp" — within one `automation-runner` tick, the
target user should get a real push notification and a bell-icon entry.
