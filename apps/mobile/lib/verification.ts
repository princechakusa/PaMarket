import { uploadToR2 } from "./uploadToR2";

// Mirrors www/js/verify.js H.uploadVerificationDoc — uploads to R2's private
// verification/ prefix and returns the storage key (not a public URL; a
// signed GET URL is generated on demand for review).
export async function uploadVerificationDoc(userId: string, imageUri: string, label: string): Promise<string | null> {
  try {
    const response = await fetch(imageUri);
    const blob = await response.blob();
    const key = `verification/${userId}/${label}_${Date.now()}.jpg`;
    await uploadToR2(blob, key, blob.type || "image/jpeg");
    return key;
  } catch {
    return null;
  }
}
