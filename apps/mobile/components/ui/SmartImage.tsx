// Shared image loader for listing/product photos — built for Stage 12's
// "blank Android images" investigation. Root cause for the images that were
// actually blank (not just slow): some photos uploaded from the mobile app
// were raw HEIC bytes (the iPhone camera default) labeled image/jpeg —
// HEIC decodes fine on Apple devices but renders nothing at all on Android
// or in a browser (see project_heic_listing_photos memory; the upload-side
// fix is lib/uploadToR2.ts always re-encoding to JPEG now). This component
// is the other half: whatever the reason a given photo fails to load
// (that bug, a deleted storage object, a slow/offline network, an expired
// URL), the rest of the listing must stay usable and the customer must see
// a real PaMarket-branded placeholder — never a blank gap, and never a
// spinner that never resolves.
import { useEffect, useState } from "react";
import { StyleSheet, View, type StyleProp, type ImageStyle } from "react-native";
import { Image, type ImageContentFit } from "expo-image";
import { BrandSymbol } from "../BrandLogo";
import { logClientError } from "../../lib/error-log";
import type { ColorPalette } from "../../lib/theme";
import { useThemedStyles } from "../../lib/theme-provider";

const MAX_RETRIES = 2;

type Props = {
  uri: string | null | undefined;
  style: StyleProp<ImageStyle>;
  contentFit?: ImageContentFit;
  // Screen name only, for error-log context — never pass the image URL
  // itself here (see logImageFailure below).
  screen?: string;
};

export function SmartImage({ uri, style, contentFit = "cover", screen }: Props) {
  const styles = useThemedStyles(buildStyles);
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);

  // A new uri (e.g. the list re-fetched, or this row now points at a
  // different listing) always gets a clean slate rather than inheriting a
  // previous image's failed/retrying state. Remounting the underlying
  // <Image> (via the `key` below) also naturally drops any in-flight
  // request for the old uri instead of racing it against the new one.
  useEffect(() => {
    setAttempt(0);
    setFailed(false);
  }, [uri]);

  function handleError() {
    if (attempt < MAX_RETRIES) {
      setAttempt((a) => a + 1);
      return;
    }
    setFailed(true);
    // Safe by construction: only a fixed category string and the screen
    // name the caller passed in, never the uri itself — a Supabase/R2 image
    // URL can carry a signed query string, and this must never end up in
    // app_error_events. Never blocks the placeholder from rendering — this
    // is fire-and-forget.
    logClientError({
      error: "image_load_failed",
      screen: screen ?? "unknown",
      component: "SmartImage",
      severity: "warning",
      metadata: { attempts: attempt + 1 },
    });
  }

  if (!uri || failed) {
    return (
      <View style={[style, styles.placeholder]}>
        <BrandSymbol size={32} contained style={styles.placeholderMark} />
      </View>
    );
  }

  return (
    <Image
      key={`${uri}-${attempt}`}
      source={{ uri }}
      style={style}
      contentFit={contentFit}
      transition={150}
      cachePolicy="memory-disk"
      onError={handleError}
    />
  );
}

function buildStyles(color: ColorPalette) {
  return StyleSheet.create({
    placeholder: {
      backgroundColor: color.surfaceAlt,
      alignItems: "center",
      justifyContent: "center",
    },
    placeholderMark: { borderRadius: 8, overflow: "hidden" },
  });
}
