-- Rollback for AMOS_MODULE_13_LINKEDIN.sql

DELETE FROM amos_integrations WHERE provider = 'linkedin';
