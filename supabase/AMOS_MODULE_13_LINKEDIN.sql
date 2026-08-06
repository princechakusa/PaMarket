-- AMOS Module 13 — LinkedIn Company Page publishing.
--
-- Adds LinkedIn as its own row in amos_integrations, matching the
-- Facebook row's shape. The publisher (amos-publishers/linkedin.ts)
-- reads credentials_ref -> a Vault secret formatted as
-- "urn:li:organization:{id}:{accessToken}".
--
-- LinkedIn's w_organization_social scope requires their manual
-- Community Management API review (commonly 1-4+ weeks) before this
-- actually publishes — connecting a token before approval completes
-- will surface LinkedIn's own permission error on publish, not a bug.
--
-- Idempotent: safe to re-run. Paired rollback: AMOS_MODULE_13_ROLLBACK.sql

INSERT INTO amos_integrations (provider, status)
VALUES ('linkedin', 'not_connected')
ON CONFLICT (provider) DO NOTHING;
