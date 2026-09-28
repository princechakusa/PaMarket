import * as FileSystem from "expo-file-system/legacy";
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
    // Admin kill-switch (General Settings → Allow image uploads) — shown
    // to the user as-is instead of a raw status code.
    if (res.status === 503 && errText.includes("temporarily paused")) {
      throw new Error("Photo uploads are temporarily paused. Please try again later.");
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
  // Always re-encode through the manipulator — never only when resizing is
  // needed. This used to run only when the image exceeded MAX_DIMENSION,
  // which meant an already-small-enough HEIC photo (the iPhone default
  // format) skipped conversion entirely and got uploaded as raw HEIC bytes
  // labeled "image/jpeg". HEIC only decodes on Apple devices, so that
  // listing's photo rendered blank on Android and on the web — see
  // project_heic_listing_photos memory. Re-encoding through
  // expo-image-manipulator with SaveFormat.JPEG guarantees genuine JPEG
  // bytes leave this device regardless of the source format (HEIC, PNG,
  // WebP, or anything else the picker could hand back).
  //
  // A prior version of this function fell back to uploading the original,
  // unconverted file whenever re-encoding threw, to "never block the
  // upload" — but that silently reopened the exact bug this function
  // exists to close: a photo that fails to re-encode (still commonly a
  // HEIC quirk) would publish as raw bytes mislabeled "image/jpeg" and
  // render blank for every viewer, with nothing telling the poster it
  // happened. Throwing here instead is the safe direction: the caller
  // (post.tsx's submit()) already surfaces any error from this call and
  // lets the user retry, matching how the web uploader already treats a
  // failed photo (post-ad.html's uploadOne: marked failed, "Tap to retry",
  // never submitted) instead of silently shipping a broken image.
  const { width, height } = await getImageSize(uri);
  const needsResize = Math.max(width, height) > MAX_DIMENSION;
  // Only one dimension is passed when resizing so the manipulator preserves
  // aspect ratio itself — passing both would stretch non-square images.
  // With no resize needed, an empty transform list still forces the JPEG
  // re-encode.
  const resizeParam = width >= height ? { width: MAX_DIMENSION } : { height: MAX_DIMENSION };
  const pipeline = needsResize ? ImageManipulator.manipulate(uri).resize(resizeParam) : ImageManipulator.manipulate(uri);
  let saved;
  try {
    const rendered = await pipeline.renderAsync();
    saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.8 });
  } catch {
    // Rethrown with a message the caller's friendlyError() has nothing
    // specific to map, so it would otherwise fall through to either a raw
    // native error string or the generic "Something went wrong" — neither
    // tells the user which of several photos failed or what to do about it.
    throw new Error("This photo couldn't be processed. Please try a different photo.");
  }

  const response = await fetch(saved.uri);
  const blob = await response.blob();
  return uploadToR2(blob, key, "image/jpeg");
}

// md5 of the original picked file (before re-encoding), used only to spot
// the same photo posted from different accounts. null when unavailable.
export async function photoFingerprint(uri: string): Promise<string | null> {
  try {
    const info = await FileSystem.getInfoAsync(uri, { md5: true });
    return info.exists && "md5" in info && typeof info.md5 === "string" ? info.md5 : null;
  } catch {
    return null;
  }
}

// Uploads a listing photo plus a small (~480px) thumbnail for feed cards.
// The thumbnail is best effort: if it fails the card simply uses the full
// photo, so a thumbnail problem never blocks posting.
const THUMB_DIMENSION = 480;

export async function uploadListingPhotoWithThumb(uri: string, key: string): Promise<{ url: string; thumbUrl: string | null }> {
  const url = await uploadImageUriToR2(uri, key);
  try {
    const { width, height } = await getImageSize(uri);
    const resize = width >= height ? { width: THUMB_DIMENSION } : { height: THUMB_DIMENSION };
    const rendered = await ImageManipulator.manipulate(uri).resize(resize).renderAsync();
    const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.7 });
    const blob = await (await fetch(saved.uri)).blob();
    const thumbUrl = await uploadToR2(blob, key.replace(/\.jpg$/i, "_t.jpg"), "image/jpeg");
    return { url, thumbUrl };
  } catch {
    return { url, thumbUrl: null };
  }
}
