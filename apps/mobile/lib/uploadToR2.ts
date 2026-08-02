import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { Image } from "react-native";
import { supabase } from "./supabase";

// Photos straight off a modern phone camera are commonly 3000-4000px wide
// and several MB each — full resolution nobody actually needs since these
// only ever get displayed at feed/detail-screen sizes. Uploading them
// unresized wastes R2 storage/egress and makes every listing/profile/chat
// image load slower for everyone, at 100k-users scale that adds up fast.
const MAX_DIMENSION = 1600;

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

function getImageSize(uri: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    Image.getSize(uri, (width, height) => resolve({ width, height }), reject);
  });
}

export async function uploadImageUriToR2(uri: string, key: string): Promise<string> {
  let uploadUri = uri;
  try {
    const { width, height } = await getImageSize(uri);
    if (Math.max(width, height) > MAX_DIMENSION) {
      // Only one dimension is passed so the manipulator preserves aspect
      // ratio itself — passing both would stretch non-square images.
      const resizeParam = width >= height ? { width: MAX_DIMENSION } : { height: MAX_DIMENSION };
      const rendered = await ImageManipulator.manipulate(uri).resize(resizeParam).renderAsync();
      const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.8 });
      uploadUri = saved.uri;
    }
  } catch {
    // If resizing fails for any reason, fall back to uploading the original —
    // never block the user's upload on an optimization.
  }
  const response = await fetch(uploadUri);
  const blob = await response.blob();
  return uploadToR2(blob, key, "image/jpeg");
}
