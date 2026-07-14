# Mega-Menu Dropdown Redesign — Spec

## What this covers

The hover dropdown that appears under Property / Vehicles / Jobs /
Electronics / Furniture / Shops in the category nav bar
(`.cat-nav-w .cnav`). This is a **separate piece of UI from the category
landing pages** already redesigned (`browse.html?cat=X`, `jobs.html`) —
those got hero photos; this dropdown did not, and still looks like the
original plain design. Reference the approved mockup
(https://claude.ai/code/artifact/afee4333-cda8-4ce6-8558-293bbbf41b8b),
hover Property/Vehicles/Jobs/Electronics/Furniture/Shops in that mockup's
own nav bar to see the target dropdown design.

## Current implementation

Everything lives in one file: `js/nav-dropdowns.js`. It builds the dropdown
markup as JS-generated HTML strings (`buildCategoryMega()` for
Property/Vehicles/Electronics/Furniture, `buildSimpleMega()` for
Jobs/Shops) and injects the CSS via `injectStyles()`
(`js/nav-dropdowns.js:158-192`). This is fully self-contained, it does not
depend on `css/site.css` or the per-page inline `:root` blocks, so none of
the duplication risk from the palette spec applies here. However, since
this task should still visually match the same warm palette adopted in
`docs/premium-visual-polish-spec.md`, use the **same colour values** from
that spec rather than inventing new ones (see below), so the dropdown and
the page it links to feel like one continuous design.

Current structure per category:
- **Property / Electronics / Furniture**: two-column layout (`mega-rail`
  left, hover-to-switch subcategory groups; `mega-content` right, links in
  the active group) — no photo, no feature panel at all.
- **Vehicles**: same two-column layout, plus a small icon-based
  `mega-featured` link at the bottom (key icon + "Vehicle Rental" text),
  `js/nav-dropdowns.js:107-113`.
- **Jobs / Shops**: simpler `mega-simple` two-card layout (Find a
  Job/Hire Talent, or Browse Shops/Open Your Shop), no photo at all.

## Target design (from the approved mockup)

Add a third column, a photo feature card, to the right of the existing
two-column layout for Property/Vehicles/Electronics/Furniture, and add an
equivalent photo feature card to the Jobs and Shops simple layout. Each
feature card:
- Fixed-width column (~280-300px), full-height of the dropdown panel,
  rounded corners, overflow hidden.
- Background photo (`object-fit:cover`), reuse the **same hero photos**
  already added for the category pages in
  `img/category-heroes/hero-{property,vehicles,jobs,electronics,furniture,shops}.jpg`
  (do not source new images, these already exist and are already
  attributed in `img/category-heroes/ATTRIBUTION.md`).
- A dark gradient overlay for text legibility: reuse the same gradient
  formula as the category page heroes
  (`linear-gradient(100deg, rgba(11,28,77,.94) 0%, rgba(11,28,77,.82) 38%,
  rgba(11,28,77,.42) 68%, rgba(11,28,77,.15) 100%)` — but adjust the angle
  to `180deg` top-to-bottom instead of a diagonal, since this card is
  narrower/taller than the page hero, top-to-bottom reads better in a
  vertical card, use judgement here and check visually).
- A small uppercase gold "tag" label (reuse `.mega-viewall`'s gold colour
  `#B9791E` per the new palette, not the current `#C5871A`).
- A headline in Fraunces (per `docs/premium-visual-polish-spec.md`, if
  that spec has already shipped by the time this one is implemented, reuse
  its `font-family:'Fraunces'` rule; if not yet shipped, add the Fraunces
  Google Fonts `<link>` locally to this component's needs, do not depend on
  the other spec being merged first, but avoid double-loading the font if
  it already is).
- One line of supporting copy.
- A text link with an arrow icon (reuse the existing inline-SVG arrow
  pattern already used elsewhere in this file's `ICONS` object as a
  reference for style, add one more entry if a right-arrow doesn't already
  exist).

Per-category feature card content (copy exactly, do not invent new copy):

| Category | Tag | Headline | Copy | Link |
|---|---|---|---|---|
| Property | Tool | Estimate a rent price | See what similar homes in your suburb are renting for before you list. | (no real page exists yet for this — link to `browse?cat=property` as a placeholder, or omit the link entirely and treat this card as informational only; flag to the site owner that a real rent-estimator tool does not exist yet) |
| Vehicles | Featured | Vehicle Rental | Rent a car by the day, week or month from verified local fleets. | `rentals` (same as the existing `mega-featured` link) |
| Jobs | 1,340 open roles | Start your career here | From graduate trainee to senior roles, new vacancies added daily across Zimbabwe. | `jobs` |
| Electronics | Trust & safety | Verified sellers only | Look for the verified badge, ID-checked sellers with a track record. | `browse?cat=electronics` (or a dedicated trust/verification info page if one exists, check first) |
| Furniture | Trending in Harare | Corner sofas and dining sets are this week's most-viewed furniture. | (mockup used this as both headline and copy in a condensed card, feel free to add a short separate headline like "Trending now" with this as the supporting line if it reads better) | `browse?cat=furniture` |
| Shops | Featured | Browse all shops | Verified business storefronts across Zimbabwe. | `browse?shops=1` |

**Important**: the "Jobs" and "Property" feature cards reference live
counts / tools that may not have a real backing page (e.g. "1,340 open
roles" should be a real count via the same `PM.fetchListingCount('jobs')`
already used on the Jobs page hero, not a hardcoded number; "Estimate a
rent price" has no real feature behind it yet). Do not ship fake
functionality or fake numbers, either wire the count to the real function
already available, or omit that specific eyebrow/tag rather than
hardcode a static placeholder number, consistent with the rule from the
first hero spec.

## Layout changes needed

- `.mega-inner` (`js/nav-dropdowns.js:165` in the injected CSS) needs a
  wider `min-width` to fit the new third column (currently `560px`,
  estimate ~560px + ~300px card + gap, so roughly `880-900px`, verify
  against actual rendered width and adjust `openMenu()`'s clamping logic
  at `js/nav-dropdowns.js:244-256` so the wider menu still stays within the
  viewport and doesn't get cut off on smaller desktop widths).
- `buildCategoryMega()` (`js/nav-dropdowns.js:86-127`) needs a new
  `photoFeatured` block appended alongside the existing rail/content
  columns, for all four categories that use this function (Property,
  Vehicles, Electronics, Furniture), replacing/extending the current
  Vehicles-only `mega-featured` icon link with the new photo-card version
  (reuse the Vehicle Rental copy/link, just restyle it as a photo card
  like the other three).
- `buildSimpleMega()` (`js/nav-dropdowns.js:129-156`) needs the new photo
  card added alongside the existing two `mega-simple-card` link tiles for
  both Jobs and Shops.

## What NOT to do

- Do not change the hover-to-switch subcategory rail/panel behavior
  (`wireCategoryMega()`, `js/nav-dropdowns.js:194-209`), that part already
  works correctly and isn't part of this visual complaint.
- Do not touch `www/` or any mobile app dropdown/menu equivalent.
- Do not introduce new stock photography, reuse the six images already
  added to `img/category-heroes/`.
- Do not hardcode fake counts or ship a feature (like the rent estimator)
  that doesn't actually exist yet, omit or link to the closest real
  equivalent page instead.

## Testing requirements

- Hover each of the six category nav items and confirm the new photo
  feature card renders correctly, images load, gradient overlay keeps text
  legible.
- Confirm the wider dropdown still positions correctly and doesn't overflow
  off-screen on a standard 1366px or 1440px wide desktop viewport (the
  existing `openMenu()` clamping logic needs to account for the new width).
- Confirm mobile/tablet is unaffected, this dropdown is a desktop hover
  interaction only, check it doesn't render or interfere on touch devices
  (confirm existing behavior here, likely `.cat-nav-w` already has
  different mobile handling, don't regress it).
- Confirm the Jobs feature card's count is live (via `PM.fetchListingCount`)
  and not hardcoded.
