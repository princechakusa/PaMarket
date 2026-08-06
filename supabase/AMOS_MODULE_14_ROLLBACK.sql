-- Rollback for AMOS_MODULE_14_TIKTOK.sql

DELETE FROM amos_integrations WHERE provider = 'tiktok';
DROP FUNCTION IF EXISTS amos_purge_old_oauth_states();
DROP TABLE IF EXISTS amos_oauth_states;
