# Site Announcement Banner — Build Spec

## Objective

Admin-broadcast announcements currently only reach the mobile app via
push notification (Firebase). The website has no consumer for these at
all. Add a lightweight on-site banner, visible to any visitor browsing
the website, driven by a new admin panel, separate from the personal
per-user notification center already shipped (favourites/saved-searches/
My Ads notifications). Confirmed decision: **on-site banner only, not
real browser push** — no Web Push API, no service worker, no permission
prompts.

## Why a separate table from the existing `notifications` table

The existing `notifications` table (already consumed by the website's
`notifications.html`) is scoped per-user via RLS (`user_id = auth.uid()`)
— it's "things that happened to your account." A site-wide announcement
is a different data shape entirely: one row, shown to every visitor,
including signed-out ones. Do not try to force this into the personal
notifications table (e.g. by inserting one row per user, or a fake
"broadcast" user_id), that would be a real RLS/scaling problem and a
data-model mismatch. Use a new, small, purpose-built table.

## Database

New migration, new table `site_announcements`:

```sql
create table if not exists public.site_announcements (
  id uuid primary key default gen_random_uuid(),
  message text not null,
  link_url text,
  link_label text,
  is_active boolean not null default false,
  starts_at timestamptz,
  ends_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.site_announcements enable row level security;

-- Public/anon can read only the currently-active announcement(s).
create policy "site_announcements: public read active"
  on public.site_announcements for select
  to anon, authenticated
  using (
    is_active = true
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at > now())
  );

-- Admin-only write (mirror whatever admin-role check the paid_ads /
-- other admin-managed tables already use in this codebase — check
-- fix_listings_rls_2026_07.sql or similar for the existing is_admin()
-- pattern rather than inventing a new one).
create policy "site_announcements: admin write"
  on public.site_announcements for all
  to authenticated
  using (is_admin(auth.uid()))
  with check (is_admin(auth.uid()));
```

(Adjust the `is_admin()` reference to match whatever the codebase's real
existing admin-check helper is named, grep for `is_admin(` in existing
migrations before assuming this exact signature.)

Only one announcement should realistically be "live" at a time for a
clean UX, but don't enforce that in a constraint, just query
`order by created_at desc limit 1` on the frontend so an admin can queue
a new one without needing to manually deactivate the old one first (or
handle it in the admin UI's save flow, deactivating the previous active
row when a new one is activated, admin's choice, keep it simple).

## Admin UI (`www/admin.html`)

Add a small panel for managing the site announcement. Two integration
options, pick whichever fits the existing tab structure better once
you're in the file:
- A new small section inside the existing **Notifications** tab
  (`showTab('notifications')`, `renderNotifications()` around line 2792),
  since it's conceptually related (admin broadcasting a message) even
  though the delivery mechanism and data model are different, or
- Its own lightweight tab if that keeps the Notifications tab from
  getting too crowded.

Follow the same UI conventions already established by `renderNotifications()`
(character-count fields, a preview card, a "currently active" status
line, save/deactivate buttons) rather than inventing a new visual style
for this one panel. Fields needed:
- Message text (with a sensible max length, e.g. 200 chars, matching the
  existing notification body cap for consistency)
- Optional link URL + link label (e.g. "Learn more →")
- Active toggle
- Optional start/end scheduling (`starts_at`/`ends_at`)
- A "currently active announcement" preview/status so the admin can see
  what's live right now before changing it

## Website consumer

1. **Fetch**: add a small function (in `js/session.js` or
   `js/marketplace-data.js`, whichever already handles similar
   lightweight public reads — check the pattern used for
   `fetchActiveAds` in `js/marketplace-data.js` and mirror it) that
   queries `site_announcements` for the current active row (RLS already
   scopes this to active + in-window rows, so the query is simply "get
   the latest matching row").
2. **Render**: a slim, dismissible banner mounted just below the top bar
   in `partials/header.html` (then rebuild via `tools/build-includes.js`
   so it stamps into all pages), matching the site's visual language
   (navy/gold, not a jarring alert-style banner). Include:
   - The message text
   - Optional link (if `link_url`/`link_label` are set)
   - A close/dismiss button (×)
3. **Dismiss persistence**: when a visitor dismisses the banner, store the
   dismissed announcement's `id` in `localStorage` (e.g.
   `pm_dismissed_announcement`), and don't re-show that specific
   announcement again in the same browser. If the admin activates a
   *new* announcement (different `id`), it should show again even if a
   previous one was dismissed, compare by id, not a blanket "seen any
   banner ever" flag.
4. Banner should not show at all if there's no active announcement
   (don't render an empty/placeholder banner), and should fail silently
   (not show anything, not throw a console error that breaks the page)
   if the fetch fails.

## What NOT to do

- Do not build real browser push notifications (Web Push API, service
  worker, permission prompts) — explicitly out of scope per the
  confirmed decision.
- Do not touch the existing personal `notifications` table or
  `notifications.html`, this is additive, a new parallel feature, not a
  change to what's already shipped.
- Do not touch `www/` — this is a website-only feature. (The mobile app
  already has its own FCM push mechanism for admin broadcasts; this task
  doesn't change or duplicate that.)
- Do not touch `android/app/build.gradle`.

## Testing requirements

- Create an active announcement in the admin panel, confirm it appears
  on the website banner within a page load/refresh.
- Confirm the banner does NOT appear when no announcement is active, or
  when the only announcement's `starts_at` is in the future or `ends_at`
  has passed.
- Dismiss the banner, confirm it doesn't reappear on a page reload/
  navigating to another page (same browser/session).
- Activate a *new* announcement after dismissing a previous one, confirm
  the new one shows (dismissal should be per-announcement-id, not global).
- Confirm signed-out visitors see the banner too (this is a public,
  non-authenticated feature, unlike the personal notification center).
- Confirm the banner renders correctly across at least 3 different pages
  after the `tools/build-includes.js` rebuild (spot-check `index.html`,
  `browse.html`, `jobs.html`).
