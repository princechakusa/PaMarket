-- ============================================================================
-- "Usually replies within an hour" seller badge.
--
-- seller_response_stats(user) looks at the last 90 days of that user's chats
-- and measures, every time the conversation turns over to them (someone
-- else wrote, then they replied), how long the reply took. Returns the
-- median in minutes plus how many replies it's based on; the app only shows
-- a badge with at least 3 replies. Message contents are never returned.
--
-- Idempotent — safe to re-run.
-- ============================================================================
create or replace function public.seller_response_stats(p_user uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with convs as (
    select c.id
    from public.conversations c
    where c.members::text[] @> array[p_user::text]
  ),
  msgs as (
    select m.conversation_id,
           m.sender_id::text as sender,
           m.created_at::timestamptz as at,
           lag(m.sender_id::text) over w as prev_sender,
           lag(m.created_at::timestamptz) over w as prev_at
    from public.messages m
    where m.conversation_id in (select id from convs)
      and m.created_at::timestamptz > now() - interval '90 days'
    window w as (partition by m.conversation_id order by m.created_at::timestamptz)
  ),
  replies as (
    select extract(epoch from (at - prev_at)) / 60.0 as minutes
    from msgs
    where sender = p_user::text
      and prev_sender is not null
      and prev_sender <> p_user::text
  )
  select jsonb_build_object(
    'replies', (select count(*) from replies),
    'median_minutes', (select percentile_cont(0.5) within group (order by minutes) from replies)
  )
$$;
revoke execute on function public.seller_response_stats(uuid) from public;
grant execute on function public.seller_response_stats(uuid) to anon, authenticated;

notify pgrst, 'reload schema';
