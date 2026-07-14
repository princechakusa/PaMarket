# Premium Visual Polish — Follow-up Spec

## Why this exists

The category hero redesign (`docs/category-hero-redesign-spec.md`) shipped
correctly, real photos, live counts, working chips, no emojis, but the site
owner compared it against the approved mockup
(https://claude.ai/code/artifact/afee4333-cda8-4ce6-8558-293bbbf41b8b) and it
does not look as premium. This is not a Codex execution problem, the
previous spec was scoped too narrowly and never asked for the two things
that actually gave the mockup its premium feel: a distinctive display
typeface for headlines, and a warmer, richer colour palette. Both were
additive-only in the mockup's CSS but were never carried into the build
spec. This follow-up spec closes that gap.

## Critical architectural fact, read before starting

Every single root-level page (25 files: `index.html`, `browse.html`,
`jobs.html`, `dashboard.html`, `auth.html`, etc.) defines its own inline
`<style>` block containing a **duplicate `:root{...}` variable
declaration**, e.g.:

```css
:root{
  --navy:#1A3A8F;--navy-deep:#0F2460;--navy-mid:#1E4BB8;
  --gold:#E8A33D;--gold-dark:#C5871A;
  --ink:#0F172A;--sub:#475569;--mute:#94A3B8;
  --line:#E2E8F0;--paper:#F8FAFC;--white:#FFFFFF;
  --green:#16A34A;--red:#DC2626;
}
```

`css/site.css` is loaded first via `<link>`, but every page's inline
`:root` block loads after it and wins by cascade order, currently with
identical values, so it's invisible today, but it means **editing only
`css/site.css`'s palette will change nothing on any live page**. This is
real, pre-existing duplication (25 copies of the same 6 lines), not
something to fix wholesale in this task (that's a larger refactor, flag it
separately if the site owner wants it), but every page's inline copy must
be updated in lockstep for this visual change to actually render.

Recommend: update the canonical values in `css/site.css`'s `:root` block
first, then update all 25 inline `:root` blocks to match exactly (a
straightforward find-and-replace of the same 6-line block, since they're
currently identical across all pages, confirm this with a diff/grep before
assuming uniformity in case one page has drifted).

## 1. Typeface: add Fraunces as a display face for headlines

**What to add**, alongside the existing Inter `<link>` tag pattern already
present on every page (e.g. `index.html:239-241`):

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Fraunces:opsz,wght@9..144,600;9..144,700&display=swap" rel="stylesheet">
```

(Merge into the existing single Google Fonts link already on each page,
do not add a second `<link>` tag, one request for both families.)

**Where to apply it** — add this rule to `css/site.css` (and each page's
inline block, since headings currently rely on the cascade the same way
colours do):

```css
h1, .hero h1, .cat-hero h1, .j-hero h1, .p-hero h1, .pa-hero h1,
.sec-h, .sec-title, .logo {
  font-family:'Fraunces', Georgia, serif;
  font-weight:700;
  letter-spacing:-.02em;
}
```

Scope this to headline-level elements only (h1, section titles, the logo
wordmark), not body text, buttons, or form labels, Inter stays the
workhorse font everywhere else exactly as today. This matches the
mockup's restraint: Fraunces was used sparingly for personality, not
site-wide.

**Check before applying globally**: grep each of the 25 pages for their
actual heading class names (`.j-hero h1`, `.pa-hero h1`, `.p-hero h1`, `.hero
h1`, `.cat-hero h1`, `.sec-h`, `.sec-title` were found in earlier
investigation, there may be others per-page like `.dashboard h1` or
`.profile h1`), and extend the selector list so no page is missed.

## 2. Palette: warm up the background and deepen the navy

Current (`css/site.css:15-23` and duplicated in all 25 inline blocks):

```css
--navy:#1A3A8F; --navy-deep:#0F2460; --navy-mid:#1E4BB8;
--gold:#E8A33D; --gold-dark:#C5871A;
--ink:#0F172A; --sub:#475569; --mute:#94A3B8;
--line:#E2E8F0; --paper:#F8FAFC; --white:#FFFFFF;
--green:#16A34A; --red:#DC2626;
--navy-tint:#EEF2FF; --gold-tint:#FBF4E6;
```

New values (from the approved mockup):

```css
--navy:#1A3A8F; --navy-deep:#0B1C4D; --navy-mid:#2952CC;
--gold:#E8A33D; --gold-dark:#B9791E;
--ink:#151A2E; --sub:#5B6478; --mute:#9298A8;
--line:#E6DFD1; --paper:#F7F4EE; --white:#FFFFFF;
--green:#1F7A4D; --red:#DC2626;
--navy-tint:#EEF2FF; --gold-tint:#FBF4E6;
```

Notes:
- `--navy-deep` gets noticeably richer (was `#0F2460`, now `#0B1C4D`), this
  is the colour used in hero gradients/dark bands, so this alone will make
  every existing dark-navy section (job hero, CTA bands, footer if dark)
  look more premium with zero markup changes.
- `--paper` (the page background) shifts from cold blue-grey (`#F8FAFC`) to
  warm off-white (`#F7F4EE`), this is a site-wide background colour change,
  confirm it doesn't clash with any hardcoded `#fff`/`#ffffff` backgrounds
  used instead of `var(--paper)` on cards/sections (grep for hardcoded hex
  whites layered on top of the page background and decide case by case if
  they should become `var(--white)` explicitly or shift to match).
- `--line` (borders) shifts from cool grey (`#E2E8F0`) to a warm-biased grey
  (`#E6DFD1`) to match the new paper tone, so borders don't look mismatched
  against the warmer background.
- `--ink`/`--sub`/`--mute` (text colours) get very slightly warmed too, for
  the same reason, kept close to the originals so contrast/accessibility
  isn't meaningfully affected, but confirm contrast ratios still pass basic
  WCAG AA for body text against the new `--paper` background.
- `--gold-dark` shifts slightly toward a deeper amber (`#C5871A` →
  `#B9791E`), a small refinement, not a major change.
- `--green` (used for badges/success states) deepens slightly
  (`#16A34A` → `#1F7A4D`) to sit better with the warmer palette.

## 3. Files to modify

1. `css/site.css` — update the canonical `:root` block, add the Fraunces
   heading rule.
2. All 25 root-level pages with an inline `:root` block (listed above via
   `grep -l ":root{" *.html`) — update their inline `:root` block to match
   `css/site.css` exactly, and add the Google Fonts Fraunces family to
   their existing font `<link>` tag.
3. `partials/header.html` — the `.logo` wordmark should pick up the
   Fraunces treatment (matches the mockup's `Pa<em>Market</em>` logo
   styling); confirm this doesn't break the header's fixed layout/sizing
   at any breakpoint once the font metrics change slightly.

## What NOT to do

- Do not add a base64/data-URI font embed like the mockup used, that was
  only necessary because the Artifact sandbox's CSP blocks external font
  requests. The live site already loads Google Fonts normally via
  `<link>`, keep using that same mechanism, just add Fraunces to the
  existing request.
- Do not apply Fraunces to body text, buttons, form inputs, or navigation
  links, headline-level elements only, per the mockup's restraint.
- Do not touch `www/` (mobile app uses its own design system independently)
  or `android/app/build.gradle`.
- Do not restructure the 25-file `:root` duplication into a single shared
  stylesheet reference as part of this task, that's a separate, larger
  refactor (removing 25 duplicate blocks and relying purely on
  `css/site.css`) worth doing eventually but out of scope here, where the
  goal is matching the approved visual, not a CSS architecture cleanup.

## Testing requirements

- Visually compare the live homepage, Jobs page, and at least one
  `browse.html?cat=X` page against the approved mockup
  (https://claude.ai/code/artifact/afee4333-cda8-4ce6-8558-293bbbf41b8b)
  side by side after this change, headline font and background warmth
  should now visibly match.
- Confirm the Fraunces font actually loads (check Network tab / no
  fallback-to-serif-default flash) on at least 3 different pages.
- Confirm no visual regression on pages not explicitly covered by the
  category hero work, since the palette change is site-wide, spot-check
  `dashboard.html`, `auth.html`, `profile.html`, `post-ad.html` for any
  element that assumed the old cooler grey/blue tones.
- Confirm text contrast still reads clearly against the new warm `--paper`
  background, particularly `--mute` text on `--paper` backgrounds (the
  lightest-contrast combination in the palette).
