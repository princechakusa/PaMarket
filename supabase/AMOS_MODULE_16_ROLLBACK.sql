ALTER TABLE amos_content_drafts DROP CONSTRAINT amos_content_drafts_channel_check;
ALTER TABLE amos_content_drafts ADD CONSTRAINT amos_content_drafts_channel_check
  CHECK (channel = ANY (ARRAY['facebook'::text, 'instagram'::text, 'linkedin'::text, 'x'::text, 'website'::text, 'push'::text, 'email'::text]));
