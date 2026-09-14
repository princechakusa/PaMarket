-- C2E-8: Enterprise Admin Authorization Reconciliation — remediation.
--
-- Closes the findings from the C2E-8 audit. Server remains authoritative;
-- narrows server access to match an already-correct, narrower client
-- intent where that was the finding, and adds new access-control surface
-- only where a genuine gap existed (MFA secret read, wallet writes).
-- Does not create a new authorization framework or a second audit system.

-- ── Part A: MFA secret cross-user read exposure (mfa_secret only) ────────
-- Confirmed live before this change: profiles' "profiles: owner or staff
-- read" SELECT policy (auth.uid() = id OR is_moderator()) is row-scoped
-- only. Once it makes another user's row visible to a moderator/admin/
-- super_admin at all, every column privilege-granted to `authenticated`
-- is visible on that row too — including the raw TOTP seed in mfa_secret.
-- A moderator (or higher) could select another admin's mfa_secret and
-- mint valid codes, fully bypassing that admin's 2FA.
--
-- A matching fix (admin_mfa_secret_column_lockdown.sql) already exists in
-- this repo, written for exactly this problem, but was never applied live
-- (confirmed: `authenticated` still had SELECT on mfa_secret going into
-- this stage). www/admin.html already calls get_my_mfa_secret() instead of
-- selecting the column directly (see its own login-flow comment and its
-- verifyRLS() self-test, which already expects this column to be locked).
-- This applies that existing, already-integrated fix rather than
-- inventing a new mechanism.
--
-- two_factor_secret is NOT included here — see the end-of-file note.
-- Column privileges are table-wide, not row-scoped, and
-- apps/mobile/app/two-factor-setup.tsx + lib/auth.tsx read/write their
-- OWN two_factor_secret via a direct `.select()`/`.update()` on profiles,
-- not through an RPC. Revoking SELECT on that column from `authenticated`
-- would break every ordinary mobile user's own 2FA enrollment, and the
-- mobile app is out of scope to modify in this stage. This is reported as
-- a stopped/blocked portion, not silently left unresolved.

-- `authenticated` was found live to hold a broad TABLE-LEVEL SELECT grant
-- on profiles (not a column-restricted one) — confirmed via
-- information_schema.role_table_grants during verification, after a
-- column-scoped `revoke select (mfa_secret) ... from authenticated` alone
-- was tested and found to have no effect (a table-level grant already
-- covers every column; only a column-level grant can be column-revoked).
-- The correct fix is to revoke the table-level SELECT entirely and
-- re-grant SELECT on every column except mfa_secret, computed dynamically
-- from the live column list so this can never silently drop an unrelated
-- column if profiles' schema changes later.
do $$
declare
  v_select_cols text;
begin
  select string_agg(quote_ident(attname), ', ' order by attname)
    into v_select_cols
    from pg_attribute
    where attrelid = 'public.profiles'::regclass
      and attnum > 0 and not attisdropped
      and attname <> 'mfa_secret';

  execute 'revoke select on public.profiles from authenticated';
  execute format('grant select (%s) on public.profiles to authenticated', v_select_cols);
end $$;

-- get_my_mfa_secret() already exists live (owner-scoped, SECURITY DEFINER)
-- and is reused as-is; recreated here only to make this migration
-- self-contained and safe to replay.
create or replace function "public"."get_my_mfa_secret"()
returns text
language sql stable security definer
set search_path to 'public'
as $$
  select mfa_secret from public.profiles where id = auth.uid();
$$;
grant execute on function "public"."get_my_mfa_secret"() to "authenticated";

-- ── Part B: wallet_usd — dedicated audited admin RPC, raw UPDATE closed ──
-- Confirmed live before this change: profiles.wallet_usd had no column
-- restriction under the "profiles: admin update" (is_admin_team(), all 5
-- staff roles) and "profiles admin update" (is_admin()) UPDATE policies,
-- so any of the 5 staff roles could set any user's wallet_usd to any
-- value via a plain UPDATE, with no AAL2 and no audit trail.
--
-- Investigated first, per instructions, before designing anything new:
-- wallet_usd is legacy/dead in production. add_listing_boost_rpc.sql's
-- wallet-funded apply_listing_boost RPC was dropped in
-- billing_entitlement_enforcement_2026_07.sql ("wallet_usd is dead") when
-- listing boosts moved to Google Play Billing (add_play_purchases.sql /
-- add_activate_play_boost_rpc.sql, which touch wallet_usd nowhere). No
-- live client code performs a direct wallet_usd UPDATE. This means
-- closing raw UPDATE access has zero functional regression risk.
--
-- The `transactions` table (id, user_id, type, amount, note, created_at)
-- already exists as a per-user ledger with its own owner-scoped RLS
-- ("Users can insert/see own transactions") — reused here as the ledger
-- entry for an admin adjustment (type = 'admin_adjustment'), rather than
-- inventing a new ledger table. `admin_audit_logs` (actor_id, actor_role,
-- action, entity, entity_id, before_state, after_state, reason,
-- created_at, ip, user_agent) already exists as this project's
-- operational-audit trail (not evidence-grade, browser-writable by
-- design — the same distinction already established for every other
-- admin_* mutation) and is reused for the audit-trail requirement rather
-- than building a second audit system.

create or replace function "public"."admin_adjust_wallet"(
  p_user_id uuid,
  p_amount numeric,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_caller_role text;
  v_before numeric;
  v_after numeric;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;
  if not public.has_admin_privilege('admin') then
    raise exception 'Admin access required.' using errcode = '42501';
  end if;
  if not public.has_mfa_aal2() then
    raise exception 'mfa_required' using errcode = '42501';
  end if;
  if p_user_id is null then
    raise exception 'Target user is required.' using errcode = '22023';
  end if;
  if p_amount is null or p_amount = 0 then
    raise exception 'A non-zero adjustment amount is required.' using errcode = '22023';
  end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'A reason is required for a wallet adjustment.' using errcode = '22023';
  end if;

  select role into v_caller_role from public.profiles where id = auth.uid();

  select wallet_usd into v_before from public.profiles where id = p_user_id for update;
  if not found then
    raise exception 'Target user not found.' using errcode = 'P0002';
  end if;

  v_after := coalesce(v_before, 0) + p_amount;
  if v_after < 0 then
    raise exception 'Adjustment would leave a negative wallet balance.' using errcode = '22023';
  end if;

  update public.profiles set wallet_usd = v_after where id = p_user_id;

  insert into public.transactions (user_id, type, amount, note)
  values (p_user_id, 'admin_adjustment', p_amount, p_reason);

  insert into public.admin_audit_logs
    (actor_id, actor_role, action, entity, entity_id, before_state, after_state, reason)
  values (
    auth.uid(), v_caller_role, 'admin_adjust_wallet', 'profiles', p_user_id::text,
    jsonb_build_object('wallet_usd', v_before),
    jsonb_build_object('wallet_usd', v_after),
    p_reason
  );

  return jsonb_build_object('ok', true, 'user_id', p_user_id, 'balance', v_after);
end;
$$;

revoke all on function "public"."admin_adjust_wallet"(uuid, numeric, text) from public;
grant execute on function "public"."admin_adjust_wallet"(uuid, numeric, text) to "authenticated";

-- Close the raw UPDATE path this RPC replaces. Applies to every staff
-- role uniformly (including admin/super_admin) — the RPC is now the only
-- path, matching "prevent arbitrary direct wallet modification through
-- raw table UPDATE" for every caller, not just the previously-unauthorized
-- ones.
-- Same table-level-grant issue as Part A applies here: `authenticated`
-- holds a broad table-level UPDATE grant on profiles, so a column-scoped
-- revoke of wallet_usd alone would have no effect. Revoke table-level
-- UPDATE and re-grant on every column except wallet_usd, computed
-- dynamically for the same reason as above.
do $$
declare
  v_update_cols text;
begin
  select string_agg(quote_ident(attname), ', ' order by attname)
    into v_update_cols
    from pg_attribute
    where attrelid = 'public.profiles'::regclass
      and attnum > 0 and not attisdropped
      and attname <> 'wallet_usd';

  execute 'revoke update on public.profiles from authenticated';
  execute format('grant update (%s) on public.profiles to authenticated', v_update_cols);
end $$;

-- ── Part C: moderation_appeals — narrow to the moderation team ──────────
-- Client permission moderation.manage: admin, super_admin, moderator only.
-- Server was is_admin_team() (all 5 staff roles). is_moderator() already
-- exists live and its role set (admin, super_admin, moderator) is an
-- exact match — reused as-is, no new helper.

drop policy if exists "appeals team read" on "public"."moderation_appeals";
create policy "appeals team read" on "public"."moderation_appeals"
  for select using (public.is_moderator());

drop policy if exists "appeals team update" on "public"."moderation_appeals";
create policy "appeals team update" on "public"."moderation_appeals"
  for update using (public.is_moderator());

drop policy if exists "appeals user insert" on "public"."moderation_appeals";
create policy "appeals user insert" on "public"."moderation_appeals"
  for insert with check ((requester_id = auth.uid()) or public.is_moderator());

-- ── Part D: support tickets/messages — narrow to the support team ───────
-- Client permissions chats.view/support.manage: admin, super_admin,
-- support only. Server was is_admin_team() (all 5 staff roles, including
-- moderator/finance who have no client permission implying support-ticket
-- access). No existing helper expresses (admin, super_admin, support) —
-- is_moderator() is the wrong shape for this (it includes moderator, not
-- support). A new helper is added, deliberately mirroring is_moderator()'s
-- existing exact style/signature rather than introducing a different
-- pattern.

create or replace function "public"."is_support_team"()
returns boolean
language sql stable security definer
set search_path to ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'super_admin', 'support')
  );
$$;

drop policy if exists "tickets team" on "public"."support_tickets";
create policy "tickets team" on "public"."support_tickets"
  using (public.is_support_team()) with check (public.is_support_team());

drop policy if exists "ticket_msgs team" on "public"."support_ticket_messages";
create policy "ticket_msgs team" on "public"."support_ticket_messages"
  using (public.is_support_team()) with check (public.is_support_team());

-- ── Part E: recruiter authorization hierarchy ────────────────────────────
-- is_authorized_recruiter() checked role IN ('admin','moderator'), which
-- omits super_admin — a super_admin would unexpectedly fail every
-- recruiter-gated RPC that an admin passes. Single function definition
-- change; every call site (browse_recruitment_candidates,
-- get_recruitment_candidate, create_job_listing, the recruitment-chat
-- trigger, recruiter_contact_entitlement, gate_candidate_identity_server_
-- side) picks this up automatically with no separate edits.

create or replace function public.is_authorized_recruiter()
returns boolean language sql stable security definer set search_path = public
as $$
  select auth.uid() is not null and exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.status = 'active'
      and (coalesce(p.company_verified, false) or p.role in ('admin', 'moderator', 'super_admin'))
  );
$$;

notify pgrst, 'reload schema';

-- ── Not fixed in this stage (explicitly out of the enumerated scope) ────
-- 1. two_factor_secret cross-user read exposure (Part A note above) —
--    BLOCKED. Needs a future stage that also updates
--    apps/mobile/lib/auth.tsx and apps/mobile/app/two-factor-setup.tsx to
--    read/write two_factor_secret through a new owner-scoped RPC pair
--    (mirroring get_my_mfa_secret()), which is out of scope for an
--    Admin-only stage that is barred from touching the mobile app.
-- 2. profiles "owner or staff read" SELECT policy still uses is_moderator()
--    (admin/super_admin/moderator), which does not match users.view's
--    client role set (admin/super_admin/support) — flagged in the C2E-8
--    audit but not in this stage's enumerated fix list; needs explicit
--    sign-off before changing, since it affects general staff read access
--    to every profile column, not just this stage's four named surfaces.
