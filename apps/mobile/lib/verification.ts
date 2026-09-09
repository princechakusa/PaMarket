import { uploadImageUriToR2 } from "./uploadToR2";

// Mirrors www/js/verify.js H.uploadVerificationDoc — uploads to R2's private
// verification/ prefix and returns the storage key (not a public URL; a
// signed GET URL is generated on demand for review).
//
// Uses uploadImageUriToR2 (not the raw uploadToR2) for two fixes at once:
// 1. The always-re-encode-to-JPEG path (see project_heic_listing_photos
//    memory) — verification photos went through the raw uploader before,
//    so an iPhone HEIC pick could reach R2 unconverted just like listing
//    photos did, quietly failing admin review.
// 2. Returns the server's actual resolved key instead of a locally-guessed
//    `verification/{userId}/{label}_{timestamp}.jpg` string — the edge
//    function has generated its own randomized key server-side since
//    2026-08-19 (see get-r2-upload-url's comment), so the old guessed key
//    silently diverged from where the file really landed. Every
//    verification submitted after that date was unfindable for admin
//    review until this fix (2026-09-09) — see
//    project_verification_doc_key_mismatch memory.
export async function uploadVerificationDoc(userId: string, imageUri: string, label: string): Promise<string | null> {
  try {
    const key = `verification/${userId}/${label}_${Date.now()}.jpg`;
    return await uploadImageUriToR2(imageUri, key);
  } catch {
    return null;
  }
}
