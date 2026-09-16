# Migration history — read before adding a file here

## Why some files in this folder aren't in `schema_migrations`

This project's migration history (`supabase_migrations.schema_migrations`,
tracked by the Supabase CLI/MCP tooling) does **not** cover every `.sql`
file in this directory, and that is expected, not a bug to "fix" by
inserting rows:

- **Files with no leading timestamp** (`add_blocked_users.sql`,
  `_diagnose_conversation_collisions.sql`, `_verify_hardening_applied.sql`,
  etc. — roughly half the files here) were never valid CLI migration
  filenames to begin with. Many are explicitly self-documented as
  read-only diagnostic/verification scripts meant to be run by hand in the
  SQL editor, not applied migrations. There is no CLI-assigned version to
  recover for these — inventing one would be fabricating history.
- **Some timestamp-prefixed files were applied by direct SQL execution**
  (via `mcp__supabase__execute_sql` or the SQL editor) rather than through
  `supabase db push` / `mcp__supabase__apply_migration`, so their schema
  changes are genuinely live but were never recorded in
  `schema_migrations`. This has been spot-checked repeatedly (taxonomy
  tables, listing rate-limit trigger, moderator RLS, business
  verifications) — the underlying schema is correct every time; only the
  bookkeeping entry is absent.
- A few files are deliberately **not** meant to run automatically at all —
  e.g. `20260911090000_c2b_promote_admin_to_super_admin_APPROVAL_REQUIRED.sql`
  requires separate, explicit sign-off before it's ever run, and
  `20260910120000_lock_down_admin_rpc_execute_grants_ROLLBACK.sql` is a
  rollback script, not a forward migration.

**Do not** assume "file exists" means "must be inserted into history," and
**do not** assume "missing from history" means "needs to be (re-)run."
Reconstructing history for 100+ files this way, without being able to
verify each one's actual historical execution content, would itself be
fabrication — see the S3 audit report for the full investigation.

## Going forward

- Give every new migration a real, unique timestamp prefix:
  `YYYYMMDDHHMMSS_short_description.sql`.
- Apply it through the project's authoritative mechanism —
  `mcp__supabase__apply_migration` (or `supabase db push` if working from
  a machine with the CLI installed) — never by manually pasting DDL into
  the SQL editor or running it via a plain `execute_sql` call. Both of the
  above correctly insert a `schema_migrations` row automatically; ad hoc
  execution does not.
- After applying, you can verify it landed by checking
  `mcp__supabase__list_migrations` (or `select version, name from
  supabase_migrations.schema_migrations order by version`) for the new
  version.
- If you need to run something that is genuinely a one-off diagnostic or
  verification query rather than a schema change, don't give it a
  timestamp prefix, and say so in its own header comment (as the existing
  `_diagnose_*` / `_verify_*` files already do) — that keeps it clearly
  out of the migration-history conversation instead of looking like an
  unapplied migration later.
