# Blog Images, Admin Videos, Website Ads & Notifications — Plan

Three separate requests bundled in one planning pass. They don't share
code, but are grouped here since they were raised together. Recommend
sending to Codex as **three separate tasks**, in the order below, not one
giant PR, each has a different risk profile and none depends on the others.

---

## 1. Blog page images (small, low-risk, ready to build)

### Current state (confirmed by investigation)
- The blog is **entirely static**, no Supabase table exists. All content
  lives in a hardcoded JS array in `js/blog-data.js` (`POSTS`, ~17 entries).
- Neither the blog listing (`blog.html`) nor the individual post template
  (`blog-post.html`) has an image field or `<img>` tag anywhere, not
  "broken", genuinely never built.
- The category hero pattern already exists and is proven
  (`.cat-hero`/`.cat-hero-bg`, used on `browse.html`/`jobs.html`), it's a
  reasonable template to adapt here rather than inventing a new visual
  pattern.
- `og:image`/Twitter/JSON-LD meta tags in `blog-post.html` currently
  hardcode a generic site icon (`img/icon-512.png`) for every single post,
  a missed SEO/social-share opportunity independent of this request, worth
  fixing at the same time since it's the same underlying gap (no
  per-post image).

### What to build
- Add an `image` field (relative path, e.g. `img/blog/{slug}.jpg`) to each
  post object in `js/blog-data.js`.
- `blog.html`'s card rendering (`renderPosts()`): add a thumbnail `<img>`
  to each `.post-card`.
- `blog-post.html`: add a hero image at the top of the article (reuse the
  `.cat-hero` gradient-overlay treatment from the category pages for
  visual consistency across the site), and update the `og:image`/Twitter/
  JSON-LD tags to use the post's real image instead of the generic icon.
- **Image sourcing**: no blog images exist yet. Either the site owner
  supplies real photos per post (preferred, same approach as the category
  hero photos), or a small set of relevant stock/generic images are used
  as placeholders until real ones are ready, flag this explicitly, don't
  let Codex silently pick stock photos without confirming.
- Since there's no backend, this is pure static-file + JS-array editing,
  no Supabase/migration work needed.

### Files
`js/blog-data.js`, `blog.html`, `blog-post.html`, new image assets under
`img/blog/`.

---

## 2. Admin-managed marketing videos, shown on the blog page (new feature, medium effort)

### Current state (confirmed by investigation)
- **Nothing like this exists today.** No video table, no video upload
  path, no video rendering anywhere in the blog or elsewhere on the
  website. This is a genuine net-new feature, not a bug fix, size the
  task and expectations accordingly.
- Cloudflare R2 (already the site's media host for images/CVs) is a
  reasonable place to host video too, but the upload edge function
  (`supabase/functions/get-r2-upload-url/index.ts`) currently:
  - Only allows image MIME types + PDF, no `video/mp4`/`video/webm`.
  - Caps uploads at 10 MB (`MAX_UPLOAD_SIZE_BYTES`), far too small for
    video.
  - Has a 120-second presigned URL expiry, likely too short for a large
    video PUT over a slow connection.
  - Has no `videos/` (or similar) allowed key prefix.
- The admin's existing ad-creative upload flow (`www/admin.html`, `_adUploadToR2()`)
  is the closest existing pattern to follow: request signed URL → PUT
  blob to R2 → save the returned public URL into a database row. New
  video admin tooling should follow this same shape.

### What to build
1. **Database**: new table, e.g. `blog_videos` — `id, title, description,
   video_url, thumbnail_url, sort_order, is_published, created_by,
   created_at`. RLS: admin-only write, public read where `is_published =
   true` (mirror the `paid_ads` pattern of admin-write + public-read-if-active).
2. **Upload path**: extend `get-r2-upload-url/index.ts` to allow a new
   `videos/` prefix (admin-only, same gating as the existing `ads/`
   prefix), add `video/mp4` and `video/webm` to allowed content types,
   raise the size cap for this prefix specifically (don't blanket-raise
   the 10MB cap for all uploads, that would loosen the limit for images/
   CVs too; scope the larger limit to the video prefix only), and extend
   the presigned URL TTL for this prefix if needed.
3. **Admin UI**: new "Videos" tab in `www/admin.html`, following the
   existing Ads tab's create/edit/list/delete pattern — title,
   description, video file upload (or a video URL field if hosting
   externally, e.g. YouTube embed, is preferred over self-hosting raw
   video files, **this is a real decision to make before building**, see
   below), publish toggle, sort order.
4. **Website rendering**: a "Videos" section on `blog.html` (or a
   dedicated `videos.html`, decide based on how many videos are expected
   and whether they should interleave with blog posts or sit in their own
   area) that fetches published videos and renders an HTML5 `<video>`
   player or embed per entry.

### Decision — confirmed
Embedded video only (YouTube/Vimeo URL entered in admin, rendered as an
iframe embed on the website). No self-hosting, no R2 upload path for
video, no new MIME types or size-limit changes needed in
`get-r2-upload-url`. This removes essentially all of the upload/encoding/
bandwidth complexity, admin just pastes a link.

### Files
New migration for `blog_videos` table (`id, title, description, video_url,
thumbnail_url` [optional, can also be auto-derived from the YouTube/Vimeo
URL], `sort_order, is_published, created_by, created_at`), `www/admin.html`
(new "Videos" tab: title, description, video URL field, publish toggle,
sort order — validate the URL is a real YouTube/Vimeo link before saving),
`blog.html` (new video section rendering an iframe embed per published
video, ordered by `sort_order`), `js/blog-data.js` or a new
`js/video-data.js` for the fetch logic (query the new table via the same
`pgFetch`/PostgREST pattern already used elsewhere in `js/marketplace-data.js`).

No changes needed to `get-r2-upload-url/index.ts` at all for this feature.

---

## 3. Website ads not showing (likely a data/config issue, not a code bug)

### Current state (confirmed by investigation — important, changes the plan)
This is **not a missing-wiring bug**. The full pipeline already exists and
is correctly built:
- Admin writes ads to the real `paid_ads` table via the "Ads & Boosts" tab
  in `www/admin.html`.
- The website already has a real consumer: `js/marketplace-data.js`'s
  `fetchActiveAds({placement, limit})` queries `paid_ads` filtered by
  `active=eq.true` and the given `placement`, and both `index.html` and
  `browse.html` already call it and render results into `#adsBand`/
  `#adCards`. Impression/click tracking RPCs are wired too.
- **The most likely real cause**: the investigation found an automated job
  that *deactivates expired ads* (`runExpireAdsAuto`), but **no equivalent
  job that activates scheduled ads once their `starts_at` time arrives**.
  If an admin schedules an ad for a future start date, it may simply never
  flip from `active:false` to `active:true` automatically, meaning the
  website correctly shows nothing because there's genuinely no active ad
  row to show, not because the website failed to fetch/render it.

### What to do, in order
1. **Diagnose first, don't code yet.** Before writing any fix, check the
   live `paid_ads` table directly in the Supabase dashboard: are there any
   rows at all? Any with `active = true`? Any with a `starts_at` in the
   past that never flipped to active? This confirms or rules out the
   theory above in under five minutes, versus guessing and building the
   wrong fix.
2. **If rows exist but never activate**: build the missing "activate
   scheduled ads" side of the automation (a scheduled job/cron or a
   database trigger that flips `active:true` once `starts_at` has passed
   and `ends_at` hasn't, mirroring the existing expiry job's shape).
3. **If no rows exist at all**: this isn't a code problem, the admin
   simply hasn't created any ads yet, or created them without checking
   "active". No code change needed, just admin action, worth confirming
   before Codex spends time "fixing" something that isn't broken.
4. **"Automatic ads" (ad-network/programmatic rotation, e.g. Google
   AdSense-style)**: confirmed to not exist anywhere in the codebase. If
   the site owner wants this specifically (rather than admin-curated
   `paid_ads`), that's a distinct, larger, separate feature (integrating
   a real ad network, which has its own approval/policy process with
   Google, not something to build as a quick website change), flag this
   back to the site owner as its own conversation before scoping any
   build work here.

### Files (only if step 2 applies)
A new Supabase migration for the activation job/trigger, possibly a new
scheduled Edge Function (mirroring how `runExpireAdsAuto` presumably
already runs on a schedule, check `supabase/config.toml`/cron config for
its exact mechanism and replicate it for activation).

---

## 4. Website notifications (genuine scope gap, needs a decision, not a quick fix)

### Current state (confirmed by investigation)
- The admin's "send notification" flow only ever targets Firebase Cloud
  Messaging (mobile push), via the `send-push` edge function. There is no
  `platform` column excluding web, the website was simply **never built
  as a consumer of admin-sent notifications at all**.
- Note: this is different from the personal notification center
  (favourites/saved-searches/My Ads notifications) already shipped on the
  website in an earlier round, that system reads a user's own
  `notifications` table rows. This request is about **admin-broadcast**
  notifications (announcements, marketing pushes) reaching website
  visitors, a different, currently-nonexistent path.

### Decision — confirmed
On-site announcement banner, not real browser push. Visible only while a
visitor is actively browsing the site, no Web Push API, no service
worker, no permission prompts.

### What to build
- New lightweight table, e.g. `site_announcements` — `id, message,
  link_url` (optional, e.g. "Learn more" destination), `is_active,
  starts_at, ends_at, created_by, created_at`. Keep this separate from the
  personal per-user `notifications` table already shipped (that one is
  "things that happened to your account"; this one is "things the admin
  wants every visitor to see"), don't conflate the two data models.
- Admin UI: a small "Site Announcement" panel (could live in the existing
  Notifications tab or its own small tab) — message text, optional link,
  active toggle, optional start/end scheduling.
- Website: a slim banner component (dismissible, remembers dismissal per
  visitor via localStorage so it doesn't reappear every page load once
  closed) that fetches the current active announcement (if any) and
  renders it, likely just below the header on every page via the shared
  `partials/header.html`/`tools/build-includes.js` pattern already used
  site-wide, so it appears consistently without per-page wiring.
- RLS: admin-only write, public/anon read where `is_active = true`
  (same pattern as `paid_ads`).

### Files
New migration for `site_announcements`, `www/admin.html` (new panel),
`partials/header.html` + rebuild via `tools/build-includes.js` (banner
markup/mount point), a small new JS file or an addition to
`js/session.js`/`js/marketplace-data.js` for the fetch + dismiss-state
logic.

---

## Recommended order

1. **Ads diagnostic** (step 3.1) — check the live `paid_ads` table first,
   nearly free, may mean nothing else needs building at all. Do this
   before writing any other code so the ads fix (if needed) isn't
   guessed at.
2. **Blog images** — smallest, no backend work.
3. **Ads activation fix** — only if the diagnostic in step 1 confirms
   it's needed.
4. **Site announcement banner** — decision confirmed (banner, not push),
   ready to build.
5. **Admin video embed feature** — decision confirmed (embed, not
   self-hosted), ready to build, largest of the four but still bounded
   now that self-hosting is off the table.
