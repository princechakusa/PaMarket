import { supabase } from "./supabase";

// Mirrors www/js/supabase.js H.uploadToR2: get a short-lived presigned PUT
// URL from the get-r2-upload-url edge function, then PUT the blob directly
// to Cloudflare R2. Returns the permanent public URL.
export async function uploadToR2(blob: Blob, key: string, contentType: string): Promise<string> {
  const { data: sessionData } = await supabase.auth.getSession();
  let token = sessionData.session?.access_token;

  if (!token) {
    const { data: refreshed } = await supabase.auth.refreshSession();
    token = refreshed.session?.access_token;
  }
  if (!token) throw new Error("Not authenticated");

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
  const res = await fetch(`${supabaseUrl}/functions/v1/get-r2-upload-url`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ key, contentType }),
  });

  if (!res.ok) {
    let errText = "";
    try {
      errText = (await res.json()).error ?? "";
    } catch {
      // ignore
    }
    throw new Error(`R2 upload-url error: ${errText || res.status}`);
  }

  const { signedUrl, publicUrl } = (await res.json()) as { signedUrl?: string; publicUrl?: string };
  if (!signedUrl) throw new Error("R2 upload-url response missing signedUrl");

  const uploadRes = await fetch(signedUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: blob,
  });
  if (!uploadRes.ok) throw new Error(`R2 PUT failed: ${uploadRes.status}`);

  return publicUrl ?? signedUrl.split("?")[0];
}

export async function uploadImageUriToR2(uri: string, key: string): Promise<string> {
  const response = await fetch(uri);
  const blob = await response.blob();
  return uploadToR2(blob, key, "image/jpeg");
}
