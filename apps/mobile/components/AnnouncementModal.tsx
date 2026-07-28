import { useEffect, useState } from "react";
import { Image, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import type { ColorPalette } from "../lib/theme";
import { useThemedStyles } from "../lib/theme-provider";
import { fetchActiveAds, subscribeToAds, trackAdClick, trackAdImpression, type PaidAd } from "../lib/ads";
import { dismissAnnouncement, isAnnouncementDismissed } from "../lib/announcements";

// Mirrors www/js/app.js H._showAnnouncementPopups: a centered, one-at-a-time
// announcement card sourced from paid_ads (type='announcement'), dismissible
// with a persisted "never show again" flag.
export function AnnouncementModal() {
  const styles = useThemedStyles(buildStyles);
  const router = useRouter();
  const [ad, setAd] = useState<PaidAd | null>(null);
  const trackedIdRef = { current: "" } as { current: string };

  async function pickAnnouncement(ads: PaidAd[]) {
    const candidates = ads.filter((a) => a.type === "announcement");
    for (const candidate of candidates) {
      if (!(await isAnnouncementDismissed(candidate.id))) {
        return candidate;
      }
    }
    return null;
  }

  useEffect(() => {
    let cancelled = false;
    fetchActiveAds().then(async (ads) => {
      const chosen = await pickAnnouncement(ads);
      if (!cancelled && chosen) setAd(chosen);
    });
    const unsubscribe = subscribeToAds(async (ads) => {
      const chosen = await pickAnnouncement(ads);
      if (!cancelled && chosen) setAd((current) => current ?? chosen);
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (ad && trackedIdRef.current !== ad.id) {
      trackedIdRef.current = ad.id;
      trackAdImpression(ad.id);
    }
  }, [ad]);

  if (!ad) return null;

  async function close() {
    if (ad) await dismissAnnouncement(ad.id);
    setAd(null);
  }

  function view() {
    if (!ad) return;
    trackAdClick(ad.id);
    close();
    if (ad.listingId) router.push(`/listing/${ad.listingId}`);
  }

  const hasCta = !!(ad.linkUrl || ad.targetCat || ad.listingId);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          {ad.imageUrl ? (
            <View>
              <Image source={{ uri: ad.imageUrl }} style={styles.image} />
              <Pressable style={styles.closeBtnOnImage} onPress={close} hitSlop={8}>
                <Text style={styles.closeText}>×</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.header}>
              <Text style={styles.headerLabel}>PaMarket Announcement</Text>
              <Pressable style={styles.closeBtn} onPress={close} hitSlop={8}>
                <Text style={styles.closeText}>×</Text>
              </Pressable>
            </View>
          )}

          <View style={styles.body}>
            {ad.businessName ? <Text style={styles.kicker}>{ad.businessName}</Text> : null}
            <Text style={styles.headline}>{ad.headline || ad.businessName || "Announcement"}</Text>
            {ad.tagline ? <Text style={styles.tagline}>{ad.tagline}</Text> : null}
          </View>

          {hasCta ? (
            <View style={styles.actions}>
              <Pressable style={styles.dismissBtn} onPress={close}>
                <Text style={styles.dismissText}>Dismiss</Text>
              </Pressable>
              <Pressable style={styles.viewBtn} onPress={view}>
                <Text style={styles.viewText}>View</Text>
              </Pressable>
            </View>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function buildStyles(color: ColorPalette) {
  return StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: color.overlay,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: color.surface,
    borderRadius: 18,
    overflow: "hidden",
  },
  image: {
    width: "100%",
    height: 180,
  },
  closeBtnOnImage: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  header: {
    backgroundColor: color.brand,
    paddingHorizontal: 16,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: color.textOnBrandSub,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  closeText: {
    color: color.textOnBrand,
    fontSize: 18,
    lineHeight: 18,
  },
  body: {
    padding: 18,
  },
  kicker: {
    fontSize: 10,
    fontWeight: "700",
    color: color.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  headline: {
    fontSize: 17,
    fontWeight: "800",
    color: color.text,
    lineHeight: 23,
  },
  tagline: {
    fontSize: 13.5,
    color: color.textSub,
    marginTop: 7,
    lineHeight: 20,
  },
  actions: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 18,
    paddingBottom: 18,
  },
  dismissBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: color.surfaceAlt,
    alignItems: "center",
  },
  dismissText: {
    fontSize: 13,
    fontWeight: "600",
    color: color.textSub,
  },
  viewBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: color.brand,
    alignItems: "center",
  },
  viewText: {
    fontSize: 13,
    fontWeight: "700",
    color: color.textOnBrand,
  },
  });
}
