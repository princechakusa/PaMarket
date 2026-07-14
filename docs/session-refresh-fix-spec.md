# Session Expiry / Intermittent Sign-Out — Fix Spec

## Objective

Users are sometimes shown "Sign In" while actually signed in, or get silently
signed out mid-session. Root cause (confirmed by investigation, not
speculation): the website never uses the real Supabase JS SDK. It hand-rolls
its own session object in `localStorage['pm_session']` with a hard 1-hour
`expires_at` and **no refresh logic at all**. Once that timer runs out,
`getSession()` just deletes the session and returns `null`, on the very next
page load or check, even though a valid `refresh_token` has been sitting
unused in the same object the whole time.

There is also no cross-tab sync: if one tab's session expires or the user
signs out, other open tabs don't find out until their own next check, which
explains why the symptom feels inconsistent between tabs.

## Root causes, ranked

1. **No token refresh.** `expires_at` is set once at sign-in
   (`now + expires_in`, typically 3600s) and never renewed. `getSession()` in
   three separate places (`js/session.js:7-20`, `js/marketplace-data.js:281-289`,
   `auth.html:342-352`) all independently delete the session once
   `expires_at - 60 < now`, instead of attempting a refresh first.
2. **Three independent copies of the same logic**, at risk of drifting out of
   sync over time (they currently match, but any future edit to one and not
   the others reintroduces bugs like this).
3. **No cross-tab sync** — no `window.addEventListener('storage', ...)`
   anywhere, so a sign-out or expiry in one tab doesn't update others.

## Files to modify

1. `js/session.js` — becomes the single source of truth for session
   read/write/refresh. Add:
   - `refreshSession()`: POSTs to
     `${SB_URL}/auth/v1/token?grant_type=refresh_token` with header
     `apikey: SB_KEY` and body `{ refresh_token: session.refresh_token }`
     (use the same `SUPABASE_URL`/`SUPABASE_ANON_KEY` globals already read in
     `js/marketplace-data.js:5-6` — confirm `supabase-config.js` exposes
     these globally before this file loads; if not, read them the same way
     `marketplace-data.js` does).
   - Modify `getSession()` so that when `expires_at - 60 < now` **and** a
     `refresh_token` is present, it calls `refreshSession()` and saves the
     new `access_token`/`refresh_token`/`expires_at` in place of deleting the
     session outright. Only fall back to deleting the session if the refresh
     call itself fails (genuinely invalid/expired refresh token, e.g. after
     ~30+ days or explicit revocation).
   - Because `getSession()` becomes asynchronous once it can make a network
     call, decide on one of two approaches and apply it consistently:
     - (a) make `getSession()` return a Promise everywhere it's used (touches
       every call site across all three files), or
     - (b) keep `getSession()` synchronous (serving the cached, not-yet-
       expired session immediately) and run the refresh proactively on a
       timer (e.g. check every few minutes, or on page load, or on
       `visibilitychange`) so the token is renewed *before* it goes stale,
       meaning by the time any page actually calls `getSession()`,
       `expires_at` is already comfortably in the future.
     Recommend (b) — proactive background refresh — since it avoids
     rewriting every call site in `marketplace-data.js`/`auth.html`/etc. to
     handle a Promise, and matches how the Supabase SDK's own
     `autoRefreshToken` behaves (refreshes ahead of expiry, not on-demand).
   - Add `window.addEventListener('storage', function(e){ if (e.key ===
     'pm_session') { /* re-run initAccountUI or reload account UI state */ }
     })` so a session change in one tab (sign-out, refresh, sign-in) is
     reflected in other open tabs without a manual reload.
2. `js/marketplace-data.js` — remove its own duplicate `getSession()`
   (`js/marketplace-data.js:281-289`) and call the shared one from
   `js/session.js` instead (confirm `js/session.js` is loaded before
   `js/marketplace-data.js` on every page that uses both — check script tag
   order in `partials/header.html`-stamped pages, or load order may need
   adjusting).
3. `auth.html` — same de-duplication: remove its local `getSession()`
   (`auth.html:342-352`) and `saveSession()` can stay (it's the one place a
   *new* session is created after sign-in, that's correct and separate from
   the refresh logic), but the "already signed in, redirect" check
   (`auth.html:355-362`) should call the shared `getSession()` too.
4. `auth-callback.html` — check its own session-writing logic (mentioned in
   investigation at lines ~80-98, ~141-159, ~177-192) for the same pattern;
   it likely doesn't need a `getSession()` of its own (it only writes a
   session after OAuth/email callback), but confirm it isn't also
   independently reading/expiring `pm_session` anywhere.

## What NOT to change

- Do not introduce the full `@supabase/supabase-js` SDK to the website. The
  existing hand-rolled `fetch()`-based approach is intentional (see the
  comment at `js/marketplace-data.js:1-3`: "No supabase-js needed for simple
  selects/filters"). This fix should stay within that same lightweight
  pattern, just add the one missing piece (refresh call).
- Do not touch `www/js/supabase.js` or any other `www/` file. The mobile app
  already has correct SDK-based refresh via `autoRefreshToken` — this bug is
  website-only.
- Do not change the `pm_session` localStorage shape/keys in a way that
  breaks `auth-callback.html`'s writer or any other reader — only add
  `refresh_token`-driven renewal on top of the existing shape (it already
  stores `refresh_token`, just unused until now).

## Testing requirements

- Manually set a test session's `expires_at` to a near-future timestamp
  (e.g. 90 seconds from now) via devtools, then confirm the site refreshes
  the token automatically without the user being signed out or seeing a
  "Sign In" flash.
- Confirm a genuinely invalid/revoked `refresh_token` still correctly signs
  the user out (don't accidentally make sessions un-expirable).
- Open the site in two tabs signed in as the same user; sign out in one tab;
  confirm the other tab reflects signed-out state without a manual reload
  (via the new `storage` event listener).
- Confirm no regressions on pages that call `authHeaders()` /
  `fetchOwnListingById()` / any RLS-scoped request in `marketplace-data.js`,
  since those depend on `getSession()` returning a valid, current
  `access_token`.
- Confirm `dashboard.html`, `favourites.html`, `saved-searches.html`,
  `notifications.html` (all recently added, all session-dependent) still
  work correctly after a simulated token refresh mid-session.

## Out of scope

- No Supabase schema/RLS changes needed — this is entirely client-side
  session handling.
- No changes to `www/` (mobile app already handles this correctly via the
  real SDK).
