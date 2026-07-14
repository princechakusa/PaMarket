# Blog Images — Build Spec

## Objective

The blog has no images anywhere today, not broken, genuinely never built.
Add a category-based hero photo to each blog post (matching the visual
language already established for marketplace category pages) and a
matching thumbnail on the blog listing cards, plus fix the social-share
meta tags which currently point every single post at the same generic
site icon.

## Current state (confirmed)

- Blog content is a static hardcoded array (`POSTS`) in `js/blog-data.js`,
  no Supabase table, no admin UI, editing this file is how posts are
  added today, that doesn't change here.
- 25 posts across 5 categories: **Selling Guides, Buying Guides,
  Comparisons, Platform Education, Safety & Trust**.
- `blog.html`'s `renderPosts()` (around line 379) builds each `.post-card`
  from `category`, `title`, `description`, `datePublished`, `readTime` —
  no image markup at all.
- `blog-post.html`'s article template (around line 267) has no image
  element in the article body.
- `blog-post.html`'s social meta tags hardcode the generic site icon for
  every post: `#ogImage` (has an id already, easy target), the
  `twitter:image` meta (no id currently, add one, e.g. `id="twImage"`),
  and the JSON-LD `Article` schema's `image` field (built in a `<script>`
  block, straightforward to update alongside the other dynamic fields
  already set there like `headline`/`description`).
- The category-hero visual pattern (`.cat-hero`/`.cat-hero-bg`, gradient
  overlay `linear-gradient(100deg, rgba(11,28,77,.94) 0%, ...)`) already
  exists in `css/site.css` from the marketplace category work, reuse it
  here rather than inventing a new visual treatment.

## Approach: one image per category, not per post

25 individual photos is unnecessary sourcing effort for guide/educational
content. Use **one representative hero image per category** (5 images
total), the same pattern already used for the 11 marketplace category
heroes. A post's image is simply looked up by its `category` field.

## What to build

1. **New images**: 5 new files under `img/blog-heroes/`, one per category
   (e.g. `hero-selling-guides.jpg`, `hero-buying-guides.jpg`,
   `hero-comparisons.jpg`, `hero-platform-education.jpg`,
   `hero-safety-trust.jpg`). These need to be sourced, either real
   photos supplied by the site owner (preferred, same as the marketplace
   category heroes) or a small set of relevant, properly licensed stock
   photos if the owner doesn't have specific photos in mind, confirm
   which before picking images, don't silently choose stock photography.
2. **`js/blog-data.js`**: add a small category→image lookup map (not a
   per-post field, since the image is category-based) — e.g. a
   `CATEGORY_IMAGES` object exported alongside `POSTS`, or a helper
   function `getCategoryImage(category)` added to the existing `PMBlog`
   public API (`getAllPosts`, `getPostBySlug`, etc.).
3. **`blog.html`** (`renderPosts()`): add a thumbnail `<img>` to each
   `.post-card`, sourced via the new category→image lookup. Keep it a
   modest thumbnail size (card thumbnail, not full hero), consistent
   with the compact card layout already in place.
4. **`blog-post.html`**: add a hero image section at the top of the
   article (reuse `.cat-hero`/`.cat-hero-bg` styling from `css/site.css`
   for visual consistency with the rest of the site), positioned between
   the breadcrumb and the article content, sourced via the same
   category→image lookup as the post's `category`.
5. **Social/SEO meta tags** in `blog-post.html`: update `#ogImage`'s
   `content` attribute, add an `id` to the `twitter:image` meta tag and
   update it the same way, and update the JSON-LD `articleSchema.image`
   field, all three to point at the post's real category image (as a
   full `https://pamarketzw.com/img/blog-heroes/...` URL, matching the
   existing absolute-URL pattern already used for `canonicalUrl`/`ogUrl`
   elsewhere on this page) instead of the generic `icon-512.png`.

## What NOT to do

- Do not add a per-post `image` field to all 25 `POSTS` entries, that's
  unnecessary maintenance overhead for guide content where a category
  image is a perfectly good visual signal. If the site owner later wants
  specific per-post photos, that's a separate, later enhancement.
- Do not touch `www/` (mobile app blog, if any, is out of scope here).
- Do not introduce a Supabase table for blog content as part of this
  task, that's a larger, separate architectural change (moving blog off
  static JS) not requested here.

## Testing requirements

- Confirm all 25 posts render a correct, category-matching image on both
  the blog listing page and their individual article page.
- Confirm `og:image`/`twitter:image`/JSON-LD `image` are correct
  per-post (i.e. per-category) when sharing a specific blog post link,
  test by checking the rendered meta tag values directly in page source
  for at least 2 different categories.
- Confirm no layout regression on the existing blog card grid or article
  layout at mobile widths once images are added.
