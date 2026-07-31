-- ============================================================
-- PaMarket — add ip/user_agent to admin_audit_logs (run once)
-- Section 9 of the SOC brief asks every audit entry to include IP + browser,
-- not just actor/action/timestamp. admin_audit_logs (ADMIN_ENTERPRISE_UPGRADE.sql)
-- didn't capture either. Safe to run more than once.
-- ============================================================

alter table public.admin_audit_logs add column if not exists ip text;
alter table public.admin_audit_logs add column if not exists user_agent text;

create index if not exists idx_aal_ip on public.admin_audit_logs (ip);
