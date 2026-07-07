-- =============================================================
-- PaMarket: read-only diagnostic — find personal (conv_*) conversations
-- whose old short-suffix id (conv_<6hex>_<6hex>) may have collided across
-- more than one real pair of users.
--
-- Signal: a conv_ conversation is suspect if any message.sender_id in it is
-- NOT one of conversations.members — meaning messages from more than 2
-- distinct real people landed in the same row, which can only happen via
-- an id collision (two different pairs producing the same 6-char suffix
-- pair) or a members-array sync bug.
--
-- READ-ONLY. Makes no changes. Run in SQL Editor and review the output.
-- =============================================================

select
  c.id                                  as conversation_id,
  c.members                             as recorded_members,
  array_agg(distinct m.sender_id)       as actual_senders,
  count(distinct m.sender_id)           as distinct_sender_count,
  count(*)                              as message_count,
  min(m.created_at)                     as first_message_at,
  max(m.created_at)                     as last_message_at
from public.conversations c
join public.messages m on m.conversation_id = c.id
where c.id like 'conv\_%' escape '\'          -- personal 1:1 chats only (not biz_/job_)
group by c.id, c.members
having exists (
  select 1
  from public.messages m2
  where m2.conversation_id = c.id
    and not (m2.sender_id::text = any (c.members::text[]))
)
order by distinct_sender_count desc, message_count desc;
