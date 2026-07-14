# AdSense Site Verification Script — Placement Spec

## Objective

Google has asked for their site-verification/linking script to be added
so they can review PaMarket for AdSense approval. This is **not** actual
ad-serving code yet, no publisher has been approved, no ad units exist.
This script alone doesn't display any ads, it just lets Google confirm
site ownership/control as part of the review.

Script to add (exact, do not modify):

```html
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-2601167334065110"
     crossorigin="anonymous"></script>
```

## Placement

Add this script tag as early as possible inside `<head>`, immediately
after the existing Google Analytics `<script async src="...gtag/js...">`
tag already present at the very top of every page's `<head>` (see
`index.html:5` for the exact existing line to place it right after).
This mirrors how Google Analytics is already loaded, same convention,
same position, consistent with how the codebase already handles
early-loading Google scripts.

## Scope: every public-facing root page

There are 25 root-level pages, each with its own independent `<head>`
block (confirmed via `grep -l ":root{" *.html`, same set of files
touched by every previous site-wide change this session, e.g. the
palette/font work and the announcement banner header stamp). Add the
script to all of them:

about.html, advertise.html, applications.html, auth.html, blog-post.html,
blog.html, boost-return.html, browse.html, community-guidelines.html,
contact.html, dashboard.html, delete-account.html, detail.html,
favourites.html, help.html, index.html, jobs.html, notifications.html,
plans.html, post-ad.html, post-job.html, privacy.html, profile.html,
rental-detail.html, rentals.html, saved-searches.html, services.html,
terms.html.

Also add it to `business.html` if it has its own independent `<head>`
(confirm, it wasn't in the original 25-page list from earlier rounds
but should get the same treatment if it's a real standalone page
Google's crawler would visit).

**Also add it to the shared header source** if one exists that stamps
into generated pages (`partials/header.html` is body content only, not
`<head>`, so this doesn't apply there, but check `tools/prerender.js`'s
page-shell template, the same file that was fixed earlier this session
for `js/session.js` script-order, since it generates the `l/` and `b/`
static SEO pages, dozens of them). If Google's crawler might land on
those generated listing/business pages too, the verification script
should be in that shared template as well, not just the 25 hand-written
pages, otherwise those generated pages won't carry it.

## What NOT to do

- Do not add this to `www/` (mobile app), this is website-only, the
  mobile app is a separate Capacitor build, not something AdSense
  reviews or serves ads into.
- Do not add any actual ad unit `<ins class="adsbygoogle">` tags or call
  `(adsbygoogle = window.adsbygoogle || []).push({})` anywhere yet,
  there's no approved placement plan and no confirmation Google has
  actually approved the account. That's a separate, later task once
  approval comes through and we've agreed on where ads should go.
- Do not modify the script tag's attributes, URL, or publisher ID.
- Do not touch `android/app/build.gradle`.

## Testing requirements

- Confirm the script tag appears in the rendered `<head>` of at least 5
  different pages after the change (spot check `index.html`, `browse.html`,
  `jobs.html`, `blog.html`, and one generated `l/` page if the prerender
  template was updated).
- Confirm no console errors are introduced by the script load on any
  spot-checked page (the script itself does nothing yet without ad
  units present, but confirm it loads without failing).
- Confirm `tools/build-includes.js`/`tools/prerender.js` regenerate
  cleanly if either was touched, per the existing repo convention for
  shared-template changes.
