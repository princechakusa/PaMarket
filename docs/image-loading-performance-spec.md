# Homepage & Category Image Loading Performance — Fix Spec

## Objective

The site owner reports images on the homepage and category pages feel
slow to appear after the page opens. Root cause identified and confirmed
in code, not guessed: the **homepage hero photo is loaded via CSS
`background:url(...)`, not a real `<img>` tag**, and has no priority
hint. This is a well-known, well-documented cause of a visibly
late-appearing hero image, and it also directly hurts the site's Core
Web Vitals (LCP — Largest Contentful Paint), which is a real Google
search ranking factor, so this fix also supports the SEO work already
planned.

## Root cause (confirmed)

- `index.html:263-267` — the homepage `.hero` section sets its background
  photo via CSS: `background: linear-gradient(...), url('img/harare-skyline.jpg')`.
  Browsers can only discover and start fetching a CSS background image
  *after* the stylesheet containing it has been parsed, this is
  meaningfully later than the browser's HTML preload scanner would
  discover a real `<img>` tag, which can start fetching while the rest
  of the HTML is still being read. No `fetchpriority` or preload hint
  exists for this image at all.
- **This is inconsistent with work already shipped elsewhere on the
  site.** `browse.html:372` and `jobs.html:347` already do this
  correctly, both use a real `<img class="cat-hero-bg" ... fetchpriority="high" decoding="async">`
  for their category hero photos. The homepage is the one page that
  was never updated to match that pattern when the category hero work
  shipped, this is closing a gap, not inventing a new technique.
- Secondary, smaller issue: only 3 `<img>` tags on the entire homepage
  currently have a `loading="lazy"` attribute (the listing/business card
  thumbnails). Images without an explicit `loading` attribute default to
  eager-loading in most browsers, meaning below-the-fold images compete
  for bandwidth with the above-the-fold hero right at page load, working
  against the priority fix above rather than with it.

## What to fix

1. **`index.html` hero image** — convert the CSS `background:url(...)`
   hero photo to a real `<img>` element, following the exact same
   pattern already used in `browse.html`/`jobs.html`
   (`class="cat-hero-bg"`-equivalent, `fetchpriority="high"`,
   `decoding="async"`), positioned behind the hero content with the
   existing gradient overlay preserved (the overlay can stay as a CSS
   `::before`/pseudo-element exactly as `.cat-hero::before` already does
   on the category pages, don't lose the darkening effect that makes the
   hero text legible). Also add `<link rel="preload" as="image" href="img/harare-skyline.jpg" fetchpriority="high">`
   in the `<head>`, this gives the browser the earliest possible signal
   to prioritize this specific image before it even reaches the hero
   markup in the HTML.
2. **Explicit `loading` strategy everywhere, consistently**: audit
   `index.html`, `browse.html`, `jobs.html`, and any other page with
   image grids (listing cards, business cards, blog cards, category
   heroes) and ensure:
   - Above-the-fold hero/priority images: `fetchpriority="high"`,
     **not** `loading="lazy"` (lazy-loading the very first thing a user
     sees is counterproductive).
   - Everything else (listing grids, blog card thumbnails, business
     logos, anything below the initial viewport): `loading="lazy"`
     consistently applied, not just on 3 of many `<img>` tags as today.
   Grep each page for `<img` tags missing both attributes and fix them
   as a batch, this is a mechanical audit, not a redesign.
3. **Blog and category-hero images** (added in earlier rounds) — spot
   check they already have correct attributes (they should, per the
   specs that built them), but confirm rather than assume, and fix any
   that were missed.

## What NOT to do

- Do not change image file formats, sizes, or add a CDN/image-optimization
  pipeline as part of this task, that's a separate, larger initiative
  (e.g. serving WebP/AVIF, responsive `srcset` sizes) worth considering
  later but out of scope here. This task is specifically about *loading
  strategy* (when/how the browser is told to fetch what already exists),
  not compressing or re-encoding the images themselves.
- Do not touch `www/` — the mobile app's image loading is a separate
  concern with its own (already-native) loading behavior.
- Do not touch `android/app/build.gradle`.

## Testing requirements

- Open the homepage on a throttled connection (Chrome DevTools Network
  tab, "Fast 3G" or similar) and confirm the hero photo now appears
  noticeably earlier relative to the rest of the page than before the
  fix, this should be visibly, not just theoretically, faster.
- Confirm the hero's gradient/darkening overlay still renders correctly
  over the new `<img>`-based photo (no loss of text legibility).
- Confirm below-the-fold images (listing cards further down the
  homepage, category pages) still load correctly when scrolled into
  view (lazy-loading working as expected, not broken/blank).
- Spot-check the Lighthouse/PageSpeed Insights score for the homepage
  before and after, if accessible, to confirm a measurable LCP
  improvement, not just a subjective "feels faster."
