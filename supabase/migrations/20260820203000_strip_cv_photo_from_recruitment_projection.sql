-- recruitment_public_cv() already strips CV file path/URL keys so a
-- pre-approval candidate card/detail can't leak the private CV object, but
-- it never stripped `photoUrl` — the candidate's profile photo stored
-- inside the cv jsonb blob. The client (candidate/[id].tsx) explicitly fell
-- back to `cv.photoUrl` whenever `avatar` was hidden (candidate.avatar is
-- now null pre-approval per 202608201931/202608201932), so the candidate's
-- actual photo bypassed the avatar gate entirely before approval — the one
-- field the "avatar hidden pre-approval" rule was supposed to cover. This
-- closes that gap the same way the file-path keys already are.
create or replace function public.recruitment_public_cv(p_cv jsonb)
returns jsonb language sql immutable set search_path = public
as $$
  select coalesce(p_cv, '{}'::jsonb)
    - 'cvFilePath' - 'cv_file_path' - 'cvFileUrl' - 'cv_file_url'
    - 'filePath' - 'fileUrl' - 'storagePath'
    - 'photoUrl' - 'photo_url';
$$;

notify pgrst, 'reload schema';
