-- rental_aggregate_daily(date) and rental_rebuild_search_index_row(uuid) are
-- cron/system-only recompute jobs (rewrite cache/aggregate tables), but were
-- executable by PUBLIC (including fully unauthenticated anon requests) —
-- confirmed via information_schema.routine_privileges. Anyone could trigger
-- expensive full-dataset recomputation on demand with no rate limit, a
-- DoS/cost vector. No client code calls either function directly (grepped
-- apps/mobile) — safe to restrict to service_role only.

revoke execute on function public.rental_aggregate_daily(date) from public, anon, authenticated;
revoke execute on function public.rental_rebuild_search_index_row(uuid) from public, anon, authenticated;
