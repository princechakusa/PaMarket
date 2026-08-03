-- Rollback for AMOS_MODULE_10_MEDIA_GENERATION.sql

DROP FUNCTION IF EXISTS claim_amos_media_jobs(integer);

ALTER TABLE amos_content_drafts DROP COLUMN IF EXISTS media_asset_id;

DROP TABLE IF EXISTS amos_media_jobs;
DROP TABLE IF EXISTS amos_media_assets;
DROP TABLE IF EXISTS amos_brand_kit;
