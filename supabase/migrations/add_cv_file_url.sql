-- Add cv_file_url column to store public URL of uploaded resume
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cv_file_url text;

-- Create cv-files storage bucket (public so employer can download CV)
INSERT INTO storage.buckets (id, name, public)
VALUES ('cv-files', 'cv-files', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload/replace their own CV
CREATE POLICY "cv_files_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'cv-files' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "cv_files_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'cv-files' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "cv_files_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'cv-files' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow anyone to read CV files (employer downloads)
CREATE POLICY "cv_files_select" ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'cv-files');
