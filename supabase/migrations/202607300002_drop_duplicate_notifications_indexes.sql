-- notifications had 3 near-identical indexes on (user_id, created_at desc)
-- built up over separate migrations, plus one that also covers type. Every
-- INSERT/UPDATE/DELETE on notifications (a high-write table) was paying to
-- maintain all of them for no read benefit — keep only one plus the
-- type-inclusive index.
drop index if exists public.idx_notifications_user_created;
drop index if exists public.idx_notifications_user_id_created_at_desc;
