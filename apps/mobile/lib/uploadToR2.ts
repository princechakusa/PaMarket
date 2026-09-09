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
//
// The `key` param only routes the request to the right prefix check — the
// edge function always generates the real object key server-side
// (keyPrefix + a random UUID), never trusting the caller's literal string.
// This return value reflects that real key (via `publicUrl` when the bucket
// is public, or the resolved `key` field otherwise) — never re-derive your
// own key from the input; see get-r2-upload-url's comment and
// project_verification_doc_key_mismatch memory for why that silently broke
// verification document retrieval for three weeks.
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

  const { signedUrl, publicUrl, key: resolvedKey } = (await res.json()) as {
    signedUrl?: string;
    publicUrl?: string;
    key?: string;
  };
  if (!signedUrl) throw new Error("R2 upload-url response missing signedUrl");

  const uploadRes = await fetch(signedUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: blob,
  });
  if (!uploadRes.ok) throw new Error(`R2 PUT failed: ${uploadRes.status}`);

  return publicUrl ?? resolvedKey ?? signedUrl.split("?")[0];
}

function getImageSize(uri: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    Image.getSize(uri, (width, height) => resolve({ width, height }), reject);
  });
}

export async function uploadImageUriToR2(uri: string, key: string): Promise<string> {
  let uploadUri = uri;
  try {
    // Always re-encode through the manipulator — never only when resizing
    // is needed. This used to run only when the image exceeded
    // MAX_DIMENSION, which meant an already-small-enough HEIC photo (the
    // iPhone default format) skipped conversion entirely and got uploaded
    // as raw HEIC bytes labeled "image/jpeg". HEIC only decodes on Apple
    // devices, so that listing's photo rendered blank on Android and on
    // the web — see project_heic_listing_photos memory. Re-encoding through
    // expo-image-manipulator with SaveFormat.JPEG guarantees genuine JPEG
    // bytes leave this device regardless of the source format (HEIC, PNG,
    // WebP, or anything else the picker could hand back), closing that gap
    // for every new upload from here on. Existing HEIC objects already in
    // R2 are unaffected by this change and still need a separate backfill.
    const { width, height } = await getImageSize(uri);
    const needsResize = Math.max(width, height) > MAX_DIMENSION;
    // Only one dimension is passed when resizing so the manipulator
    // preserves aspect ratio itself — passing both would stretch
    // non-square images. With no resize needed, an empty transform list
    // still forces the JPEG re-encode.
    const resizeParam = width >= height ? { width: MAX_DIMENSION } : { height: MAX_DIMENSION };
    const pipeline = needsResize ? ImageManipulator.manipulate(uri).resize(resizeParam) : ImageManipulator.manipulate(uri);
    const rendered = await pipeline.renderAsync();
    const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.8 });
    uploadUri = saved.uri;
  } catch {
    // If re-encoding fails for any reason, fall back to uploading the
    // original — never block the user's upload entirely on this safety
    // step. This is the one remaining path a non-JPEG file could still
    // reach R2 through, and it's now the exception rather than the rule.
  }
  const response = await fetch(uploadUri);
  const blob = await response.blob();
  return uploadToR2(blob, key, "image/jpeg");
}
