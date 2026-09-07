-- ============================================================
-- PaMarket — lock down content_pages_before_update()
-- Supabase's security advisor (run after the content-management
-- migration) flagged this SECURITY DEFINER trigger function as callable
-- directly by anon/authenticated via /rest/v1/rpc/content_pages_before_update
-- — Postgres exposes every function in `public` to PostgREST by default.
-- It's only meant to run as a BEFORE UPDATE trigger, never as a
-- general-purpose RPC, so revoke direct execute from the client roles.
-- Safe to run more than once.
-- ============================================================
revoke execute on function public.content_pages_before_update() from public;
revoke execute on function public.content_pages_before_update() from anon;
revoke execute on function public.content_pages_before_update() from authenticated;
