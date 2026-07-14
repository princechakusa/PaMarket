-- Admin-managed YouTube/Vimeo embeds for the public blog.
create table if not exists public.blog_videos (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  video_url text not null,
  provider text,
  embed_id text,
  sort_order integer not null default 0,
  is_published boolean not null default false,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists blog_videos_published_sort_idx
  on public.blog_videos (is_published, sort_order, created_at desc);

alter table public.blog_videos enable row level security;

drop policy if exists "blog_videos: public read published" on public.blog_videos;
create policy "blog_videos: public read published"
  on public.blog_videos for select
  to anon, authenticated
  using (is_published = true);

drop policy if exists "blog_videos: admin write" on public.blog_videos;
create policy "blog_videos: admin write"
  on public.blog_videos for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant select on public.blog_videos to anon, authenticated;
grant insert, update, delete on public.blog_videos to authenticated;

comment on table public.blog_videos is
  'Validated YouTube and Vimeo embeds displayed in the public blog.';
