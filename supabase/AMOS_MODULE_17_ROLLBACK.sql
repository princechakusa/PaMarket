ALTER TABLE amos_media_assets DROP CONSTRAINT amos_media_assets_placement_check;
ALTER TABLE amos_media_assets ADD CONSTRAINT amos_media_assets_placement_check
  CHECK (placement = ANY (ARRAY['facebook'::text, 'instagram'::text, 'linkedin'::text, 'x'::text, 'blog_header'::text, 'website_banner'::text, 'story'::text, 'square'::text, 'landscape'::text, 'portrait'::text]));
