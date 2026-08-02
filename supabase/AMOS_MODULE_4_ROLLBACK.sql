-- ════════════════════════════════════════════════════════════════════════
-- AMOS Module 4 — Rollback
--
-- Drops the Vault-read RPC. Does NOT disconnect Facebook or delete any
-- stored credential automatically — disconnecting is a deliberate,
-- separate action (see below) so a rollback of this migration can't
-- accidentally destroy a working API credential.
-- ════════════════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS amos_get_vault_secret(text);
DROP FUNCTION IF EXISTS amos_set_integration_credential(text, text, text);

-- To also disconnect Facebook (optional, NOT run automatically):
--   update amos_integrations set status='not_connected', credentials_ref=null where provider='facebook';
--   -- the Vault secret itself (e.g. 'facebook_page_token') is left in
--   -- place; delete it separately via Vault's own UI/SQL if truly done
--   -- with it, since amos_get_vault_secret being gone already means
--   -- nothing in AMOS can read it anymore.
