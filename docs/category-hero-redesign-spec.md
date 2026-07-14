# Category Page Hero Redesign — Build Spec for Codex

Approved design concept: https://claude.ai/code/artifact/afee4333-cda8-4ce6-8558-293bbbf41b8b
(Interactive mockup — use the tabs at the top to preview each category's hero before implementing.)

## Objective

Every category currently either has a plain gradient hero with no photo (`jobs.html`) or no hero at all (`browse.html`, used for Property/Vehicles/Electronics/Furniture/Shops via query params). Add a photo-led hero section to each, matching the homepage's existing photo-hero treatment, using a distinct, category-relevant photo per page (e.g. a graduate/professional for Jobs, a house exterior for Property). Also remove the emoji icons from the category mega-menu while touching this area.

## Files to modify

1. `jobs.html` — has a hero already (`.j-hero`, line ~333), needs the photo treatment applied to the existing gradient hero, not a rebuild.
2. `browse.html` — has **no hero section at all** today (goes straight from header to `.mob-filter-bar` / results grid at line ~413). Needs a new hero section inserted, with content that switches based on `state.cat` / `state.shops` (the existing client-side state object at line ~593).
3. `css/site.css` — add the shared `.cat-hero` component styles (see below) so both `jobs.html` and `browse.html` can use the same class names/behavior.
4. `js/nav-dropdowns.js` — remove emoji characters (🔑 line 104, 🔍 line 129, 💼 line 133, 🏬 line 142, ➕ line 146), replace with inline SVG icons matching the existing icon style already used elsewhere in that file (see `ICONS` object at line 52 for the pattern to follow).
5. `partials/header.html` — no change required (mega-menu markup lives in `nav-dropdowns.js`, injected at runtime).

## Design reference (from the approved mockup)

**Structure per hero:**
- Full-width section, ~340px min-height, background photo with `object-fit:cover`.
- A left-to-right gradient overlay (`linear-gradient(100deg, rgba(11,28,77,.94) 0%, rgba(11,28,77,.82) 38%, rgba(11,28,77,.42) 68%, rgba(11,28,77,.15) 100%)`) so white text sits legibly over the photo, photo stays visible on the right side.
- Content, left-aligned, max-width ~640px: an uppercase gold eyebrow (e.g. "5,206 live listings"), a headline (serif display face if adopted, or bold sans to match current site fonts — confirm with design owner before adding a new webfont), a one-line description, a rounded search bar, and 3–4 filter chips linking to relevant subcategory/browse URLs.

**Per-category content** (copy exactly from the approved mockup, do not invent new copy):

| Category | Eyebrow | Headline | Chips |
|---|---|---|---|
| Property | "5,206 live listings" | "Find your next home in Zimbabwe." | Houses, Flats & Apartments, Stands & Land, Commercial |
| Vehicles | "7,965 live listings" | "Cars, bakkies and bikes, ready to drive." | Cars, SUVs & 4x4, Bakkies & Trucks, Spares & Parts |
| Jobs | "1,340 open roles" | "Your next role starts here." | Graduate & Entry Level, Sales & Marketing, IT & Engineering, Post a Vacancy |
| Electronics | "9,241 live listings" | "Phones, laptops and gadgets you can trust." | Phones & Tablets, Laptops & Computers, TVs & Monitors, Gaming |
| Furniture | "3,158 live listings" | "Furnish your home for less." | Sofas & Lounge, Beds & Bedroom, Dining & Kitchen, Home Décor |
| Shops | "640 verified storefronts" | "Shop from trusted Zimbabwean businesses." | Electronics Shops, Fashion Shops, Hardware Shops, Open Your Shop |

**Live counts**: the numbers above are illustrative placeholders from the mockup. Wire them to real counts if a cheap query/RPC exists (e.g. `count` from the `listings` table filtered by category and `status=active`); otherwise it's acceptable to omit the eyebrow count entirely rather than hardcode a stale number — do not ship a fake static number as if live.

## CSS (add to `css/site.css`)

```css
.cat-hero{position:relative;min-height:340px;display:flex;align-items:center;overflow:hidden}
.cat-hero-bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.cat-hero::before{
  content:'';position:absolute;inset:0;
  background:linear-gradient(100deg,rgba(11,28,77,.94) 0%,rgba(11,28,77,.82) 38%,rgba(11,28,77,.42) 68%,rgba(11,28,77,.15) 100%);
}
.cat-hero-w{position:relative;max-width:1240px;margin:0 auto;padding:0 28px;width:100%}
.cat-hero-eyebrow{display:inline-flex;align-items:center;gap:8px;color:var(--gold);font-size:12.5px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;margin-bottom:16px}
.cat-hero h1{font-size:44px;color:#fff;margin:0 0 14px;max-width:640px}
.cat-hero p{font-size:15.5px;color:#D7DEF3;max-width:520px;margin:0 0 28px;line-height:1.6}
.cat-hero-search{display:flex;align-items:center;background:#fff;border-radius:999px;max-width:560px;height:56px;padding:0 6px 0 22px;box-shadow:0 20px 40px -12px rgba(11,28,77,.5)}
.cat-hero-search input{flex:1;border:none;outline:none;font-size:14.5px;font-family:inherit;color:var(--ink)}
.cat-hero-search button{background:var(--navy);color:#fff;border:none;border-radius:999px;height:44px;padding:0 24px;font-weight:700;font-size:13.5px}
.cat-hero-chips{display:flex;gap:10px;margin-top:18px;flex-wrap:wrap}
.cat-hero-chip{background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.22);color:#fff;font-size:12.5px;font-weight:600;padding:7px 14px;border-radius:999px;backdrop-filter:blur(6px)}
@media(max-width:980px){.cat-hero h1{font-size:32px}}
```

Note: `--gold` here refers to the existing site.css custom property already defined (`#E8A33D`) — no new tokens needed, this is additive only.

## `jobs.html` changes

Replace the existing `.j-hero` section (line 333) to add a background photo + overlay, keeping the existing `#heroTag`/`#heroTitle`/`#heroSub`/buttons (they're populated dynamically by JS elsewhere — check for `heroTag`/`heroTitle` references before removing IDs). Add `<img class="cat-hero-bg">` behind the content, and apply the `.cat-hero`-style overlay to `.j-hero` (either rename the class or merge the overlay rule into `.j-hero::before`, whichever is less invasive to existing JS that toggles `#heroTag`/`#heroTitle`/`#heroSub` for hire-mode vs seek-mode — check both modes still read correctly against the new photo).

## `browse.html` changes

Insert a new `<section class="cat-hero">` immediately after the header (before `<main>`, around line 413). It needs:
- An `<img class="cat-hero-bg" id="catHeroImg">` with `src` set by JS based on `state.cat`/`state.shops`.
- Content elements with IDs (`#catHeroEyebrow`, `#catHeroTitle`, `#catHeroSub`, `#catHeroChips`) populated by a small JS function, e.g. `renderCategoryHero()`, called once on page load right after `state` is parsed from the URL (near line 593), using a lookup table keyed by category matching the table above. Default to a generic "All Listings" hero (or hide the hero entirely) when no `cat`/`shops` param is present, since Browse-all doesn't have one clear photo.
- The search input in the hero can either be a duplicate lightweight search that redirects to `browse?cat=X&q=...`, or omitted in favor of the existing filter UI already on the page — recommend omitting the search bar on `browse.html` specifically (the filters below already cover this) and keeping just eyebrow/headline/sub/chips, to avoid two competing search inputs on one page. Confirm this simplification is acceptable before implementing — it's a deviation from the mockup made for practical reasons, not a visual downgrade.

## Image sourcing

The mockup uses Unsplash placeholder URLs for preview purposes only. Do not ship hotlinked Unsplash URLs to production. Before implementation, source and host real images:
- Either license/download equivalent royalty-free photos and add them to `img/` (e.g. `img/hero-jobs.jpg`, `img/hero-property.jpg`, etc.), sized appropriately (~1400×700, compressed to reasonable file size for web), or
- Use real PaMarket content if available (e.g. a real featured listing photo) — confirm which approach with the site owner before sourcing stock photography, since photo choice affects brand feel.

## Testing requirements

- Verify `jobs.html`'s existing hire/seek toggle logic (whatever populates `#heroTag`/`#heroTitle`/`#heroSub`) still displays correctly against the new photo background in both modes.
- Verify `browse.html` hero updates correctly for each of: `?cat=property`, `?cat=vehicles`, `?cat=electronics`, `?cat=furniture`, `?shops=1`, and no param (Browse All).
- Confirm mobile responsiveness (hero height, text size, chip wrapping) at common breakpoints.
- Confirm removed emoji icons in `nav-dropdowns.js` render correctly as SVG at the sizes currently used (20–22px).
- Run `node tools/build-includes.js` if any shared header/footer markup was touched, then `tools/smoke-test.js`.

## Out of scope for this task

- Property/Vehicles/Electronics/Furniture do not have dedicated HTML files (they route through `browse.html?cat=X`) — do not create new standalone pages for them, extend `browse.html` as described.
- No changes to Supabase schema, RLS, or `PM.*` data functions are needed for this task — it is presentation-layer only.
- Do not touch `www/` (mobile app) — this is a website-only visual change per standing scope rules.
