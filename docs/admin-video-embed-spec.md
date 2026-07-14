# Admin-Managed Marketing Videos (Embedded) — Build Spec

## Objective

Give the admin a way to add marketing/informational videos that display
on the website's blog section. **Confirmed decision: embed only**
(YouTube/Vimeo URL pasted in admin, rendered as an iframe on the
website), no self-hosted video files. This removes essentially all
upload/encoding/bandwidth complexity, no changes needed to
`get-r2-upload-url`, no new video MIME types, no size-limit changes.

## Current state (confirmed by investigation)

Nothing like this exists today, no video table, no video rendering
anywhere on the site. This is a genuine net-new feature, not a bug fix.

## Database

New migration, new table `blog_videos`, follow the exact RLS pattern
already proven in `supabase/migrations/202607140003_site_announcements.sql`
(admin-write via `public.is_admin()`, public read where published):

```sql
create table if not exists public.blog_videos (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  video_url text not null,
  provider text,              -- 'youtube' | 'vimeo', derived/validated at save time
  embed_id text,               -- the extracted video ID, used to build the iframe src
  sort_order integer not null default 0,
  is_published boolean not null default false,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists blog_videos_published_sort_idx
  on public.blog_videos (is_published, sort_order, created_at desc);

alter table public.blog_videos enable row level security;

create policy "blog_videos: public read published"
  on public.blog_videos for select
  to anon, authenticated
  using (is_published = true);

create policy "blog_videos: admin write"
  on public.blog_videos for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant select on public.blog_videos to anon, authenticated;
grant insert, update, delete on public.blog_videos to authenticated;
```

## URL validation and embed ID extraction

Both the admin save flow and (defensively) the public render path should
validate the URL is actually a YouTube or Vimeo link before treating it
as embeddable, don't trust it blindly, a malformed or malicious URL
pasted into admin should never become an arbitrary iframe `src` on the
public site. Recognize standard formats:
- YouTube: `youtube.com/watch?v=ID`, `youtu.be/ID`, `youtube.com/embed/ID`
- Vimeo: `vimeo.com/ID`

Extract the video ID and store `provider`/`embed_id` at save time (in the
admin), so the website only ever needs to build a known-safe embed URL
(`https://www.youtube.com/embed/{embed_id}` or
`https://player.vimeo.com/video/{embed_id}`) from a validated ID, never
directly interpolating admin-supplied freeform text into the iframe
`src`. If the pasted URL doesn't match a recognized pattern, reject it in
the admin UI with a clear error rather than saving something broken.

## Admin UI (`www/admin.html`)

New "Videos" tab, following the same UI shape as the existing "Ads &
Announcements" tab (`showTab('ads')`, `openCreateAd()` around line 3973)
and the Notifications tab's announcement panel added in the previous
round, both are the right reference points for conventions (list view,
create/edit modal or inline form, publish toggle, sort order, a preview
where practical). Fields:
- Title
- Description (optional)
- Video URL (validated as described above on save; show the admin a
  clear error if it's not a recognized YouTube/Vimeo link)
- Sort order (integer, controls display order on the website)
- Published toggle
- List view: show existing videos with title, provider, published
  status, sort order, and edit/delete actions, same list-table
  conventions already used elsewhere in the admin (e.g. the Ads list).

No file upload UI is needed for this feature, it's a URL field only.

## Website rendering

Add a "Videos" section to `blog.html` (place it above or below the post
grid, whichever reads better once you're in the file, a short section
heading like "Watch & Learn" or similar, keep it consistent with the
blog's existing section style).

- **Fetch**: a new function following the existing `pgFetch` pattern in
  `js/marketplace-data.js` (same shape as `fetchActiveSiteAnnouncement`
  added in the previous round) — query `blog_videos` where
  `is_published=eq.true`, ordered by `sort_order`.
- **Render**: for each video, an embedded iframe
  (`youtube.com/embed/{id}` or `player.vimeo.com/video/{id}`, built from
  the stored `provider`/`embed_id`, never raw admin input), with
  `loading="lazy"` on the iframe (below-the-fold content, consistent
  with the image-loading work already done site-wide), a title, and
  optional description below it.
- **Empty state**: if there are no published videos, don't render an
  empty/placeholder section at all, same "fail silently, show nothing"
  principle already used for the ads band and announcement banner.
- Responsive: iframes need a proper aspect-ratio wrapper
  (`aspect-ratio:16/9` or a padding-based fallback) so they don't break
  layout or overflow on mobile widths.

## What NOT to do

- Do not build self-hosted video upload, explicitly out of scope per the
  confirmed decision.
- Do not touch `get-r2-upload-url/index.ts`, no changes needed for this
  feature at all.
- Do not interpolate raw admin-supplied URL text directly into an iframe
  `src` anywhere, always go through the validated `provider`/`embed_id`
  fields.
- Do not touch any other file under `www/` besides `admin.html`.
- Do not touch `android/app/build.gradle`.

## Testing requirements

- Create a published video with a real YouTube URL in admin, confirm it
  renders correctly on `blog.html`.
- Try saving an invalid/non-video URL in admin, confirm it's rejected
  with a clear error rather than silently saved.
- Confirm unpublished videos don't appear on the website.
- Confirm sort order is respected when multiple videos are published.
- Confirm the video section doesn't render at all when there are zero
  published videos (no empty placeholder).
- Confirm the embed is responsive and doesn't break the page layout on a
  mobile-width viewport.
